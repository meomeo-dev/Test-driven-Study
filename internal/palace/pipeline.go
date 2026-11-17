package palace

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

type PlanningParameters struct {
	Model             string `json:"model"`
	ReasoningEffort   string `json:"reasoning_effort"`
	MaxOutputTokensK  int    `json:"max_output_tokens_k"`
	ContextBudgetK    int    `json:"context_budget_k,omitempty"`
	CompactThresholdK int    `json:"compact_threshold_k,omitempty"`
	CompactReserveK   int    `json:"compact_reserve_k,omitempty"`
	WebSearch         string `json:"web_search,omitempty"`
}
type PlanningInput struct {
	ID                                    string
	QuestionID                            int64
	Question                              study.Question
	PalaceAddress, SourcePrompt, ImageURL string
	Parameters                            PlanningParameters
	Checkpoint                            func(context.Context) error
	ProfileVersion                        *course.AIProfileVersion
}
type PlanningResult struct {
	ID, ImagePrompt string
	Usage           Usage
}
type Pipeline struct {
	Stage    string `json:"stage"`
	PlanID   string `json:"plan_id"`
	LLMUsage Usage  `json:"llm_usage"`
}
type Planner interface {
	Prepare(PlanningParameters) (PlanningParameters, error)
	Generate(context.Context, PlanningInput) (PlanningResult, error)
}

func (s *Service) runPlanning(ctx context.Context, job Job) (Job, error) {
	if job.Snapshot.Pipeline == nil || job.Snapshot.Pipeline.Stage == "generating" {
		return job, nil
	}
	if s.planner == nil {
		return Job{}, &Failure{"llm_configuration", "请先配置独立的 LLM 服务"}
	}
	result, err := s.planner.Generate(ctx, PlanningInput{ID: job.ID, QuestionID: job.QuestionID,
		Question:       job.Snapshot.Question,
		ProfileVersion: job.Snapshot.ProfileVersion,
		PalaceAddress:  job.Snapshot.Settings.PalaceAddress, SourcePrompt: job.Snapshot.Prompt,
		Parameters: job.Snapshot.Settings.LLM, ImageURL: job.Snapshot.Question.ImageURL,
		Checkpoint: func(ctx context.Context) error { return s.boundary(ctx, job.ID) }})
	if err != nil {
		return Job{}, err
	}
	if result.ID != job.ID || strings.TrimSpace(result.ImagePrompt) == "" || len([]rune(result.ImagePrompt)) > 4000 {
		return Job{}, &Failure{"invalid_plan", "构思结果无效，未提交生图请求"}
	}
	// No image request is allowed until the validated plan and exact final prompt
	// are durable. The status guard also closes the cancellation gap between stages.
	job.Snapshot.Pipeline.Stage = "generating"
	job.Snapshot.Pipeline.PlanID = result.ID
	job.Snapshot.Pipeline.LLMUsage = result.Usage
	job.Snapshot.Prompt += "\n\n补充记忆场景（以原题正确答案和上方模板要求为准）：\n" + result.ImagePrompt
	payload, err := json.Marshal(job.Snapshot)
	if err != nil {
		return Job{}, err
	}
	count, err := s.queries.UpdatePalaceSnapshot(ctx, storedb.UpdatePalaceSnapshotParams{
		SnapshotJson: string(payload), UpdatedAtMs: time.Now().UTC().UnixMilli(), ID: job.ID})
	if err != nil {
		return Job{}, err
	}
	if count != 1 || ctx.Err() != nil {
		return Job{}, context.Canceled
	}
	return job, nil
}
