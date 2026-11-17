package palace

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/tasktrace"
)

func (s *Service) work(ctx context.Context) {
	defer close(s.done)
	for {
		if ctx.Err() != nil {
			return
		}
		row, err := s.queries.NextPalaceJob(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			select {
			case <-ctx.Done():
				return
			case <-s.wake:
				continue
			}
		}
		if err != nil {
			if ctx.Err() == nil {
				slog.Error("palace queue read failed")
			}
			return
		}
		row, err = s.queries.ClaimPalaceJob(ctx, storedb.ClaimPalaceJobParams{ID: row.ID, UpdatedAtMs: time.Now().UTC().UnixMilli()})
		if err != nil {
			continue
		}
		s.process(ctx, row)
	}
}

func (s *Service) process(parent context.Context, row storedb.PalaceJob) {
	ctx, cancel := context.WithCancel(parent)
	if value, err := jobValue(row); err == nil && value.Snapshot.Pipeline == nil {
		cancel()
		ctx, cancel = context.WithTimeout(parent, 10*time.Minute)
	}
	s.active.Lock()
	s.activeID = row.ID
	s.activeCancel = cancel
	s.active.Unlock()
	defer func() { cancel(); s.active.Lock(); s.activeID = ""; s.activeCancel = nil; s.active.Unlock() }()
	ctx, endTrace := s.traceRun(ctx, row.ID)
	defer endTrace()
	job, err := jobValue(row)
	if err != nil {
		s.finish(row.ID, "failed", nil, &Failure{"invalid_snapshot", "任务内容无法读取"})
		return
	}
	if job.Snapshot.RetryOf != "" {
		tasktrace.Note(ctx, "scheduler", "仅重跑生图", "复用来源任务 "+job.Snapshot.RetryOf+" 的最终提示词；本次不调用 LLM。")
	}
	if s.stopAtBoundary(ctx, job.ID) {
		return
	}
	input := ProviderInput{Model: job.Snapshot.Settings.Model, Prompt: job.Snapshot.Prompt,
		Size: job.Snapshot.Settings.Size, Quality: job.Snapshot.Settings.Quality}
	if job.Snapshot.Settings.UseReference {
		var hash string
		input.Reference, hash, err = s.reference(ctx, job.Snapshot.Question)
		input.ReferenceName = job.Snapshot.Question.ImageURL
		if err != nil || hash != job.Snapshot.ReferenceHash {
			s.finish(job.ID, "failed", nil, &Failure{"reference_changed", "原题配图已变化或不可读取"})
			return
		}
	}
	job, err = s.runPlanning(ctx, job)
	if err != nil {
		if errors.Is(err, ErrPaused) {
			s.park(row.ID)
			return
		}
		failure := &Failure{"planning_failed", "LLM 构思失败，未提交生图请求"}
		var known *Failure
		if errors.As(err, &known) {
			failure = known
		}
		if parent.Err() != nil {
			s.finish(row.ID, "interrupted", nil, &Failure{"interrupted", "服务已停止，请手动重新生成"})
			return
		}
		s.finish(row.ID, "failed", nil, failure)
		return
	}
	if ctx.Err() != nil {
		s.finish(row.ID, "interrupted", nil, &Failure{"interrupted", "生成已停止，请手动重新生成"})
		return
	}
	if s.stopAtBoundary(ctx, job.ID) {
		return
	}
	input.Prompt = job.Snapshot.Prompt
	s.configuration.RLock()
	provider := s.provider
	s.configuration.RUnlock()
	if provider == nil {
		s.finish(job.ID, "failed", nil, &Failure{"configuration", "请先配置生图服务"})
		return
	}
	imageContext, imageSpan := tasktrace.Begin(ctx, "image", "生成记忆画面 · "+input.Model)
	output, err := provider.Generate(imageContext, input)
	imageStatus := "completed"
	if err != nil {
		imageStatus = "failed"
	}
	if ctx.Err() != nil {
		imageStatus = "canceled"
	}
	imageSpan.End(imageStatus, "")
	if ctx.Err() != nil {
		if parent.Err() != nil {
			s.finish(job.ID, "interrupted", nil, &Failure{"interrupted", "服务已停止，请手动重新生成"})
		} else {
			s.finish(job.ID, "failed", nil, &Failure{"timeout", "等待生图超时，请检查历史后手动重试"})
		}
		return
	}
	if err != nil {
		failure := &Failure{"generation_failed", "生成未完成，请检查设置后手动重试"}
		var known *Failure
		if errors.As(err, &known) {
			failure = known
		}
		s.finish(job.ID, "failed", nil, failure)
		return
	}
	_, saveSpan := tasktrace.Begin(ctx, "storage", "图片校验与本地保存")
	metadata, err := s.saveImage(job.ID, output)
	saveStatus := "completed"
	if err != nil {
		saveStatus = "failed"
	}
	saveSpan.End(saveStatus, "")
	if err != nil {
		failure := &Failure{"save_failed", "图片未能保存到本地"}
		var known *Failure
		if errors.As(err, &known) {
			failure = known
		}
		s.finish(job.ID, "failed", nil, failure)
		return
	}
	if !s.finish(job.ID, "succeeded", &metadata, nil) {
		os.Remove(filepath.Join(s.directory, metadata.Filename))
	}
}

func (s *Service) finish(id, status string, metadata *Image, failure *Failure) bool {
	imageJSON, errorJSON := "", ""
	if metadata != nil {
		value, err := json.Marshal(metadata)
		if err != nil {
			return false
		}
		imageJSON = string(value)
	}
	if failure != nil {
		value, err := json.Marshal(failure)
		if err != nil {
			return false
		}
		errorJSON = string(value)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	count, err := s.queries.FinishPalaceJob(ctx, storedb.FinishPalaceJobParams{ID: id, Status: status,
		ImageJson: imageJSON, ErrorJson: errorJSON, UpdatedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		slog.Error("palace result persistence failed", "job_id", id)
		return false
	}
	return count == 1
}
