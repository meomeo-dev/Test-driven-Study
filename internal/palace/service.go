package palace

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

var eventID = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)

type Options struct {
	DB                  *sql.DB
	Study               *study.Service
	Root, DataDirectory string
	Config              Config
	Provider            ImageProvider
	Credentials         CredentialStore
	Planner             Planner
	ResolvePlan         func(context.Context, string, int64, string, string) (string, error)
	DiscardPlan         func(context.Context, string) error
}

type Service struct {
	queries                     *storedb.Queries
	study                       *study.Service
	root, directory             string
	config                      Config
	provider                    ImageProvider
	wake                        chan struct{}
	done                        chan struct{}
	stop                        context.CancelFunc
	creation                    sync.Mutex
	active                      sync.Mutex
	activeID                    string
	activeCancel                context.CancelFunc
	configuration               sync.RWMutex
	credentials                 CredentialStore
	credentialAccount           string
	settingsFile, settingsToken string
	planner                     Planner
	template                    course.PalaceTemplate
	resolvePlan                 func(context.Context, string, int64, string, string) (string, error)
	discardPlan                 func(context.Context, string) error
}

func New(parent context.Context, options Options) (*Service, error) {
	template := sharedTemplate
	ctx, cancel := context.WithCancel(parent)
	s := &Service{queries: storedb.New(options.DB), study: options.Study, root: options.Root,
		directory: filepath.Join(options.DataDirectory, "palaces"), config: options.Config,
		provider: options.Provider, wake: make(chan struct{}, 1), done: make(chan struct{}), stop: cancel,
		template: template}
	s.planner = options.Planner
	s.resolvePlan = options.ResolvePlan
	s.discardPlan = options.DiscardPlan
	s.credentials = options.Credentials
	if s.credentials == nil {
		s.credentials = systemCredentials{}
	}
	s.settingsFile = filepath.Join(options.DataDirectory, "image-provider.json")
	s.settingsToken = settingsNonce()
	s.loadSavedProvider()
	if err := os.MkdirAll(s.directory, 0700); err != nil {
		cancel()
		return nil, err
	}
	if s.provider == nil && s.config.Message == "" {
		provider, err := NewHTTPProvider(s.config)
		if err == nil {
			s.provider = provider
		} else {
			s.config.Message = "请检查本地生图配置"
		}
	}
	err := s.queries.InterruptPalaceJobs(ctx, storedb.InterruptPalaceJobsParams{
		ErrorJson:   `{"code":"interrupted","message":"服务已重启，请手动重新生成"}`,
		UpdatedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		cancel()
		return nil, err
	}
	go s.work(ctx)
	return s, nil
}

func (s *Service) Close() { s.stop(); <-s.done }

func (s *Service) Info() Info {
	s.configuration.RLock()
	defer s.configuration.RUnlock()
	models := append([]string{}, s.config.Models...)
	return Info{Ready: s.provider != nil, Models: models,
		DefaultModel: s.config.DefaultModel, ProxyEnabled: s.config.ProxyURL != "", Message: s.config.Message,
		TemplateID: s.template.ID, TemplateVersion: s.template.Version}
}

func validAddress(value string) bool {
	return len([]rune(value)) <= 128 && !strings.ContainsAny(value, "\r\n\x00")
}

func (s *Service) Preview(ctx context.Context, id int64, address string) (Preview, error) {
	return s.PreviewWithPlan(ctx, id, address, "")
}

func (s *Service) PreviewWithPlan(ctx context.Context, id int64, address, planID string) (Preview, error) {
	if !validAddress(address) {
		return Preview{}, ErrInvalid
	}
	detail, err := s.study.Detail(ctx, id)
	if err != nil {
		return Preview{}, err
	}
	return s.questionPreview(ctx, detail, strings.TrimSpace(address), planID)
}

func (s *Service) questionPreview(ctx context.Context, detail study.Detail, address, planID string) (Preview, error) {
	question := detail.Question
	template := s.questionTemplate(question)
	profile, version, err := s.study.QuestionAIProfile(ctx, question)
	if err != nil {
		return Preview{}, err
	}
	if profile.Palace != nil {
		template = *profile.Palace
	} else if profile.Prompts == (course.PalacePrompts{}) {
		version = nil
	}
	prompt, err := renderPrompt(template, question, address)
	if err != nil {
		return Preview{}, err
	}
	transcript, err := s.study.QuestionTranscript(ctx, question)
	if err != nil {
		return Preview{}, err
	}
	if transcript != "" {
		prompt += "\n\n将以下逐字稿作为听力证据。引用时保留原句及说话人，只选相关短句。\n" +
			"<listening_transcript>\n" + transcript + "\n</listening_transcript>"
	}
	if planID != "" {
		if s.resolvePlan == nil {
			return Preview{}, ErrInvalid
		}
		scene, err := s.resolvePlan(ctx, planID, question.QuestionID, address, prompt)
		if err != nil {
			return Preview{}, ErrInvalid
		}
		prompt += "\n\n补充记忆场景（以原题正确答案和上方模板要求为准）：\n" + scene
	}
	return Preview{QuestionID: question.QuestionID, Prompt: prompt, TemplateID: template.ID,
		TemplateVersion:    template.Version,
		ProfileVersion:     version,
		ReferenceAvailable: detail.ImageAvailable && question.ImageType != 2}, nil
}

func (s *Service) normalize(settings Settings) (Settings, error) {
	if settings.Model == "" {
		settings.Model = s.config.DefaultModel
	}
	var err error
	settings, err = normalizeSize(settings)
	if err != nil {
		return Settings{}, err
	}
	if settings.Quality == "" {
		settings.Quality = "medium"
	}
	settings.PalaceAddress = strings.TrimSpace(settings.PalaceAddress)
	if settings.GenerationMode != "" && settings.GenerationMode != "direct" && settings.GenerationMode != "pipeline" {
		return Settings{}, ErrInvalid
	}
	if settings.GenerationMode == "pipeline" {
		if settings.PlanID != "" || s.planner == nil {
			return Settings{}, ErrInvalid
		}
		settings.LLM, err = s.planner.Prepare(settings.LLM)
		if err != nil {
			return Settings{}, &Failure{"llm_configuration", "请检查独立的 LLM 配置、模型及构思参数"}
		}
	} else if settings.LLM != (PlanningParameters{}) {
		return Settings{}, ErrInvalid
	}
	validModel := slices.Contains(s.config.Models, settings.Model)
	validQuality := slices.Contains([]string{"low", "medium", "high"}, settings.Quality)
	if !validModel || !validQuality || !validAddress(settings.PalaceAddress) {
		return Settings{}, ErrInvalid
	}
	return settings, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (Job, error) {
	if !eventID.MatchString(input.ID) {
		return Job{}, ErrInvalid
	}
	s.creation.Lock()
	defer s.creation.Unlock()
	settings, err := s.normalize(input.Settings)
	if err != nil {
		return Job{}, err
	}
	previous, err := s.Get(ctx, input.ID)
	if err == nil {
		if previous.QuestionID != input.QuestionID || previous.Snapshot.Settings != settings {
			return Job{}, ErrConflict
		}
		return previous, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Job{}, err
	}
	if err = s.admit(ctx); err != nil {
		return Job{}, err
	}
	detail, err := s.study.Detail(ctx, input.QuestionID)
	if err != nil {
		return Job{}, err
	}
	prompt, err := s.questionPreview(ctx, detail, settings.PalaceAddress, settings.PlanID)
	if err != nil {
		return Job{}, err
	}
	snapshot := Snapshot{Question: detail.Question, Settings: settings, Prompt: prompt.Prompt,
		TemplateID: prompt.TemplateID, TemplateVersion: prompt.TemplateVersion,
		ProfileVersion: prompt.ProfileVersion}
	if settings.GenerationMode == "pipeline" {
		snapshot.Pipeline = &Pipeline{Stage: "planning", PlanID: input.ID}
	}
	if settings.UseReference {
		if !prompt.ReferenceAvailable {
			return Job{}, ErrInvalid
		}
		_, snapshot.ReferenceHash, err = s.reference(ctx, detail.Question)
		if err != nil {
			return Job{}, err
		}
	}
	return s.enqueue(ctx, input.ID, snapshot)
}

func jobValue(row storedb.PalaceJob) (Job, error) {
	job := Job{ID: row.ID, QuestionID: row.QuestionID, SubjectID: row.SubjectID, Status: row.Status,
		CreatedAtMS: row.CreatedAtMs, UpdatedAtMS: row.UpdatedAtMs}
	if (row.Status == "queued" || row.Status == "running") && row.ControlState != "run" {
		job.Status = row.ControlState
	}
	if err := json.Unmarshal([]byte(row.SnapshotJson), &job.Snapshot); err != nil {
		return Job{}, err
	}
	if row.ImageJson != "" {
		if err := json.Unmarshal([]byte(row.ImageJson), &job.Image); err != nil {
			return Job{}, err
		}
	}
	if row.ErrorJson != "" {
		if err := json.Unmarshal([]byte(row.ErrorJson), &job.Error); err != nil {
			return Job{}, err
		}
	}
	job.CanRetryImage = imageRetryReady(job)
	return job, nil
}

func (s *Service) Get(ctx context.Context, id string) (Job, error) {
	if !eventID.MatchString(id) {
		return Job{}, ErrInvalid
	}
	row, err := s.queries.GetPalaceJob(ctx, id)
	if err != nil {
		return Job{}, err
	}
	return jobValue(row)
}

func (s *Service) List(ctx context.Context, subject, question int64) ([]Job, error) {
	rows, err := s.queries.ListPalaceJobs(ctx, storedb.ListPalaceJobsParams{SubjectID: subject, QuestionID: question})
	if err != nil {
		return nil, err
	}
	jobs := make([]Job, 0, len(rows))
	for _, row := range rows {
		job, err := jobValue(row)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func (s *Service) Cancel(ctx context.Context, id string) (Job, error) {
	if !eventID.MatchString(id) {
		return Job{}, ErrInvalid
	}
	_, err := s.queries.CancelPalaceJob(ctx, storedb.CancelPalaceJobParams{UpdatedAtMs: time.Now().UTC().UnixMilli(), ID: id})
	if err != nil {
		return Job{}, err
	}
	s.active.Lock()
	if s.activeID == id && s.activeCancel != nil {
		s.activeCancel()
	}
	s.active.Unlock()
	if s.discardPlan != nil {
		if err := s.discardPlan(ctx, id); err != nil {
			return Job{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s *Service) ImageFile(ctx context.Context, id string) (string, Image, error) {
	job, err := s.Get(ctx, id)
	if err != nil {
		return "", Image{}, err
	}
	if job.Status != "succeeded" || job.Image == nil {
		return "", Image{}, sql.ErrNoRows
	}
	if filepath.Base(job.Image.Filename) != job.Image.Filename {
		return "", Image{}, ErrInvalid
	}
	return filepath.Join(s.directory, job.Image.Filename), *job.Image, nil
}
