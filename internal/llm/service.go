package llm

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

var eventID = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)

type Options struct {
	DB                    *sql.DB
	DataDirectory         string
	Config                Config
	Credentials           CredentialStore
	ResolveImages         func(context.Context, int64) ([]InputImage, error)
	AssistantInstructions string
	GeneralQuestion       func(context.Context, int64) bool
	ResolvePalacePrompts  func(context.Context, course.AIProfileVersion) (course.PalacePrompts, error)
}
type Service struct {
	config                                         Config
	provider                                       *HTTPProvider
	configuration                                  sync.RWMutex
	planning                                       sync.Mutex
	queries                                        *storedb.Queries
	resolveImages                                  func(context.Context, int64) ([]InputImage, error)
	assistantInstructions                          string
	generalQuestion                                func(context.Context, int64) bool
	resolvePalacePrompts                           func(context.Context, course.AIProfileVersion) (course.PalacePrompts, error)
	credentials                                    CredentialStore
	credentialAccount, settingsFile, settingsToken string
	ctx                                            context.Context
	stop                                           context.CancelFunc
	workers                                        sync.WaitGroup
}

func New(parent context.Context, options Options) (*Service, error) {
	ctx, stop := context.WithCancel(parent)
	s := &Service{config: options.Config, queries: storedb.New(options.DB),
		credentials: options.Credentials, resolveImages: options.ResolveImages, ctx: ctx, stop: stop,
		assistantInstructions: options.AssistantInstructions,
		generalQuestion:       options.GeneralQuestion,
		resolvePalacePrompts:  options.ResolvePalacePrompts,
		settingsFile:          filepath.Join(options.DataDirectory, "llm-provider.json"), settingsToken: settingsNonce()}
	if err := os.MkdirAll(options.DataDirectory, 0700); err != nil {
		stop()
		return nil, err
	}
	if s.credentials == nil {
		s.credentials = systemCredentials{}
	}
	s.loadSavedProvider()
	if s.config.Message == "" {
		provider, err := NewHTTPProvider(s.config)
		if err != nil {
			s.config.Message = "请检查独立的 LLM 配置与代理"
		} else {
			s.provider = provider
		}
	}
	if err := s.interruptPlans(ctx); err != nil {
		stop()
		return nil, err
	}
	if err := s.interruptConversations(ctx); err != nil {
		stop()
		return nil, err
	}
	return s, nil
}

// Recover in Go rather than embedding JSON manipulation in generated SQLite SQL.
func (s *Service) interruptPlans(ctx context.Context) error {
	rows, err := s.queries.ListRunningLLMPlans(ctx)
	if err != nil {
		return err
	}
	for _, payload := range rows {
		var record PlanRecord
		if err := json.Unmarshal([]byte(payload), &record); err != nil {
			return err
		}
		record.Status = "interrupted"
		record.UpdatedAtMS = time.Now().UTC().UnixMilli()
		record.Error = &Failure{Code: "interrupted", Message: "服务已重启，请手动重新构思"}
		updated, err := json.Marshal(record)
		if err != nil {
			return err
		}
		if err := s.queries.FinishLLMPlan(ctx, storedb.FinishLLMPlanParams{
			Status: record.Status, RecordJson: string(updated), ID: record.ID}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) Close() { s.stop(); s.workers.Wait() }

func (s *Service) Get(ctx context.Context, id string) (PlanRecord, error) {
	if !eventID.MatchString(id) {
		return PlanRecord{}, ErrInvalid
	}
	payload, err := s.queries.GetLLMPlan(ctx, id)
	if err != nil {
		return PlanRecord{}, err
	}
	var record PlanRecord
	err = json.Unmarshal([]byte(payload), &record)
	return record, err
}
func (s *Service) normalize(input PlanInput) (PlanInput, error) {
	s.configuration.RLock()
	defaults := s.config.parameters()
	s.configuration.RUnlock()
	if input.Model == "" {
		input.Model = defaults.Model
	}
	if input.ReasoningEffort == "" {
		input.ReasoningEffort = defaults.ReasoningEffort
	}
	if input.MaxOutputTokensK == 0 {
		if input.CompactReserveK > 0 {
			input.MaxOutputTokensK = min(128, input.CompactReserveK)
		} else {
			input.MaxOutputTokensK = defaults.MaxOutputTokensK
		}
	}
	if input.ContextBudgetK == 0 && input.CompactThresholdK == 0 && input.CompactReserveK == 0 {
		input.ContextBudgetK = defaults.ContextBudgetK
		input.CompactThresholdK = defaults.CompactThresholdK
		input.CompactReserveK = defaults.CompactReserveK
	}
	if input.WebSearch == "" {
		input.WebSearch = defaults.WebSearch
	}
	normalized, err := normalizePolicy(input.Parameters)
	if err != nil {
		return PlanInput{}, err
	}
	input.Parameters = normalized
	s.configuration.RLock()
	validModel := slices.Contains(s.config.Models, input.Model)
	s.configuration.RUnlock()
	if !eventID.MatchString(input.ID) || input.QuestionID <= 0 || !validModel || !slices.Contains(Efforts, input.ReasoningEffort) ||
		len([]rune(input.PalaceAddress)) > 128 || strings.ContainsAny(input.PalaceAddress, "\r\n\x00") {
		return PlanInput{}, ErrInvalid
	}
	return input, nil
}
func (s *Service) referenceImages(ctx context.Context, id int64) ([]InputImage, error) {
	if s.resolveImages == nil {
		return nil, nil
	}
	return s.resolveImages(ctx, id)
}
func references(images []InputImage) []ImageReference {
	result := make([]ImageReference, 0, len(images))
	for _, image := range images {
		result = append(result, image.Reference)
	}
	return result
}

func (s *Service) Create(ctx context.Context, input PlanInput, source PlanSource) (PlanRecord, error) {
	input, err := s.normalize(input)
	if err != nil {
		return PlanRecord{}, err
	}
	if !s.planning.TryLock() {
		previous, err := s.Get(ctx, input.ID)
		if err == nil && previous.PlanInput == input && previous.matchesSource(source) {
			return previous, nil
		}
		return PlanRecord{}, ErrConflict
	}
	// Ownership of this lock passes to the worker only after the row is durable.
	unlock := true
	defer func() {
		if unlock {
			s.planning.Unlock()
		}
	}()
	input, err = s.normalize(input)
	if err != nil {
		return PlanRecord{}, err
	}
	previous, err := s.Get(ctx, input.ID)
	if err == nil {
		if previous.PlanInput != input || !previous.matchesSource(source) {
			return PlanRecord{}, ErrConflict
		}
		return previous, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return PlanRecord{}, err
	}
	s.configuration.RLock()
	provider := s.provider
	s.configuration.RUnlock()
	if provider == nil {
		return PlanRecord{}, ErrDisabled
	}
	if source.Prompt == "" || len(source.Prompt) > 100000 {
		return PlanRecord{}, ErrInvalid
	}
	images, err := s.referenceImages(ctx, input.QuestionID)
	if err != nil {
		return PlanRecord{}, err
	}
	now := time.Now().UTC().UnixMilli()
	record := PlanRecord{References: references(images), PlanInput: input,
		SourcePrompt: source.Prompt, ProfileVersion: source.ProfileVersion,
		Status: "running", CreatedAtMS: now, UpdatedAtMS: now}
	payload, err := json.Marshal(record)
	if err != nil {
		return PlanRecord{}, err
	}
	err = s.queries.CreateLLMPlan(ctx, storedb.CreateLLMPlanParams{ID: input.ID, QuestionID: input.QuestionID, RecordJson: string(payload)})
	if err != nil {
		return PlanRecord{}, err
	}
	unlock = false
	s.workers.Add(1)
	go s.generate(provider, record, images...)
	return record, nil
}
func (s *Service) generate(provider *HTTPProvider, record PlanRecord, images ...InputImage) {
	defer s.workers.Done()
	defer s.planning.Unlock()
	_, _ = s.complete(s.ctx, provider, record, images...)
}
func (s *Service) complete(parent context.Context, provider *HTTPProvider, record PlanRecord, images ...InputImage) (PlanRecord, error) {
	return s.completeControlled(parent, provider, record, nil, false, images...)
}

func (s *Service) completeControlled(parent context.Context, provider *HTTPProvider, record PlanRecord,
	control func(context.Context) error, restore bool, images ...InputImage) (PlanRecord, error) {
	ctx := s.questionContext(parent, record.QuestionID)
	hooks := s.sessionHooks(record.ID, provider, restore, control)
	observe := func(progress SessionProgress) error {
		record.Session = progress
		record.Usage = progress.Usage
		record.UpdatedAtMS = time.Now().UTC().UnixMilli()
		payload, err := json.Marshal(record)
		if err != nil {
			return err
		}
		return s.queries.FinishLLMPlan(ctx, storedb.FinishLLMPlanParams{Status: "running", RecordJson: string(payload), ID: record.ID})
	}
	var prompts course.PalacePrompts
	var err error
	if record.ProfileVersion != nil && s.resolvePalacePrompts != nil {
		prompts, err = s.resolvePalacePrompts(ctx, *record.ProfileVersion)
	}
	var plan Plan
	var usage Usage
	if err == nil {
		plan, usage, err = provider.generateSession(ctx, record.Parameters,
			record.SourcePrompt, images, observe, hooks, prompts)
	}
	if validPlan(plan) {
		record.Plan = &plan
	}
	// Restore can fail before any round runs; keep the already persisted usage.
	if usage.TotalTokens >= record.Usage.TotalTokens {
		record.Usage = usage
	}
	record.Status = "succeeded"
	if errors.Is(err, ErrPaused) {
		record.Status = "paused"
		record.Error = nil
	} else if err != nil {
		record.Status = "failed"
		record.Error = &Failure{Code: "generation_failed", Message: "LLM 构思失败，不会自动重试"}
		var failure *Failure
		if errors.As(err, &failure) {
			record.Error = failure
		}
		if parent.Err() != nil {
			record.Error = &Failure{Code: "canceled", Message: "构思已停止，后续生图不会开始"}
		} else if ctx.Err() != nil {
			record.Error = &Failure{Code: "timeout", Message: "构思等待超时，后续生图不会开始"}
		}
		if s.ctx.Err() != nil {
			record.Status = "interrupted"
			record.Error = &Failure{Code: "interrupted", Message: "服务已停止，请手动重新构思"}
		}
	} else {
		record.Plan = &plan
	}
	record.Session.Phase = record.Status
	record.UpdatedAtMS = time.Now().UTC().UnixMilli()
	payload, _ := json.Marshal(record)
	// Persist terminal state even when the server's lifetime context is canceled.
	persist, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	dbStatus := record.Status
	if dbStatus == "paused" {
		dbStatus = "running"
	}
	if err := s.queries.FinishLLMPlan(persist, storedb.FinishLLMPlanParams{
		Status: dbStatus, RecordJson: string(payload), ID: record.ID}); err != nil {
		// The durable running record is recovered as interrupted on restart.
		slog.Error("could not persist LLM plan result", "plan_id", record.ID)
		return record, err
	}
	if record.Status == "paused" {
		return record, ErrPaused
	}
	if removeErr := os.Remove(s.checkpointFile(record.ID)); removeErr != nil && !os.IsNotExist(removeErr) {
		slog.Error("could not remove completed LLM checkpoint", "plan_id", record.ID)
	}
	if record.Error != nil {
		return record, record.Error
	}
	return record, nil
}
func (s *Service) Resolve(ctx context.Context, id string, question int64,
	address, sourcePrompt string) (string, error) {
	record, err := s.Get(ctx, id)
	if err != nil {
		return "", err
	}
	if record.Status != "succeeded" || record.Plan == nil || record.QuestionID != question || record.PalaceAddress != address || !validPlan(*record.Plan) {
		return "", ErrInvalid
	}
	if sourcePrompt != "" && record.SourcePrompt != sourcePrompt {
		return "", ErrInvalid
	}
	return record.Plan.ImagePrompt, nil
}
