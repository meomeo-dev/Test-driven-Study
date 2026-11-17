package llm

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
)

type sessionHooks struct {
	restore func(*planningSession) error
	save    func(*planningSession, string) error
	control func(context.Context) error
}

type savedSession struct {
	Version        int               `json:"version"`
	Phase          string            `json:"phase"`
	ProviderHash   string            `json:"provider_hash"`
	OriginalHash   string            `json:"original_hash"`
	History        []json.RawMessage `json:"history"`
	Progress       SessionProgress   `json:"progress"`
	LastPlan       Plan              `json:"last_plan"`
	Previous       [32]byte          `json:"previous"`
	Unchanged      int               `json:"unchanged"`
	ResearchStalls int               `json:"research_stalls"`
	SeenReads      []string          `json:"seen_reads"`
	UseShapeOnly   bool              `json:"use_shape_only,omitempty"`
}

func (s *planningSession) checkpoint(ctx context.Context, phase string) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if s.hooks == nil {
		return nil
	}
	if err := s.hooks.save(s, phase); err != nil {
		return err
	}
	if phase == "ready" && s.hooks.control != nil {
		return s.hooks.control(ctx)
	}
	return nil
}

func providerHash(p *HTTPProvider) string {
	data, _ := json.Marshal([]string{p.config.BaseURL, p.config.APIKey, p.config.ProxyURL})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

func (s *Service) checkpointFile(id string) string {
	return filepath.Join(filepath.Dir(s.settingsFile), "llm-checkpoints", id+".json")
}

func (s *Service) sessionHooks(id string, provider *HTTPProvider, required bool,
	control func(context.Context) error) *sessionHooks {
	file := s.checkpointFile(id)
	return &sessionHooks{control: control,
		restore: func(session *planningSession) error {
			if !required {
				return nil
			}
			return restoreCheckpoint(file, provider, session)
		},
		save: func(session *planningSession, phase string) error {
			return saveCheckpoint(file, provider, session, phase)
		},
	}
}

func restoreCheckpoint(file string, provider *HTTPProvider, session *planningSession) error {
	f, err := os.Open(file)
	if err != nil {
		return checkpointFailure()
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, (64<<20)+1))
	if err != nil || len(data) > 64<<20 {
		return checkpointFailure()
	}
	var saved savedSession
	if json.Unmarshal(data, &saved) != nil || saved.Version != 1 ||
		saved.Phase != "ready" || len(saved.History) == 0 ||
		saved.ProviderHash != providerHash(provider) ||
		saved.OriginalHash != fmt.Sprintf("%x", sha256.Sum256(session.original)) {
		return checkpointFailure()
	}
	history, err := rewriteImageReferences(saved.History, session.original, false)
	if err != nil {
		return err
	}
	session.history, session.progress, session.lastPlan = history, saved.Progress, saved.LastPlan
	session.previous, session.unchanged = saved.Previous, saved.Unchanged
	session.researchStalls = saved.ResearchStalls
	session.useShapeOnly = saved.UseShapeOnly
	session.seenReads = map[string]struct{}{}
	for _, key := range saved.SeenReads {
		session.seenReads[key] = struct{}{}
	}
	return nil
}

func saveCheckpoint(file string, provider *HTTPProvider, session *planningSession, phase string) error {
	history, err := rewriteImageReferences(session.history, session.original, true)
	if err != nil {
		return err
	}
	saved := savedSession{Version: 1, Phase: phase, ProviderHash: providerHash(provider),
		OriginalHash: fmt.Sprintf("%x", sha256.Sum256(session.original)), History: history,
		Progress: session.progress, LastPlan: session.lastPlan, Previous: session.previous,
		Unchanged: session.unchanged, ResearchStalls: session.researchStalls,
		UseShapeOnly: session.useShapeOnly}
	for key := range session.seenReads {
		saved.SeenReads = append(saved.SeenReads, key)
	}
	sort.Strings(saved.SeenReads)
	data, err := json.Marshal(saved)
	if err != nil || len(data) > 64<<20 {
		return checkpointFailure()
	}
	return atomicCheckpoint(file, data)
}

func atomicCheckpoint(file string, data []byte) error {
	if os.MkdirAll(filepath.Dir(file), 0700) != nil {
		return checkpointFailure()
	}
	f, err := os.CreateTemp(filepath.Dir(file), ".checkpoint-*")
	if err != nil {
		return checkpointFailure()
	}
	defer os.Remove(f.Name())
	_, writeErr := f.Write(data)
	if writeErr == nil {
		writeErr = f.Sync()
	}
	closeErr := f.Close()
	if writeErr != nil || closeErr != nil || os.Rename(f.Name(), file) != nil {
		return checkpointFailure()
	}
	return nil
}

func checkpointFailure() error {
	return &Failure{Code: "checkpoint_unavailable", Message: "检查点不可用，或供应商/原题资源已变化；不会重发旧请求，请终止后重新生成"}
}
