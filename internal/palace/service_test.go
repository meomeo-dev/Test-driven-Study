package palace

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type providerFunc func(context.Context, ProviderInput) (ProviderOutput, error)

func (f providerFunc) Generate(ctx context.Context, input ProviderInput) (ProviderOutput, error) {
	return f(ctx, input)
}

func testOptions(t *testing.T, provider ImageProvider) Options {
	t.Helper()
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return Options{DB: db, Study: study.New(db, root), Root: root, DataDirectory: directory,
		Config: testConfig("http://127.0.0.1:1/v1"), Provider: provider}
}

func newService(t *testing.T, options Options) *Service {
	t.Helper()
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}

func waitJob(t *testing.T, s *Service, id, status string) Job {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		job, err := s.Get(context.Background(), id)
		if err != nil {
			t.Fatal(err)
		}
		if job.Status == status {
			return job
		}
		time.Sleep(10 * time.Millisecond)
	}
	job, _ := s.Get(context.Background(), id)
	t.Fatalf("job status %s, wanted %s: %v", job.Status, status, job.Error)
	return Job{}
}

func TestFullPromptAndConfigurationBoundary(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) { return ProviderOutput{}, nil }))
	s := newService(t, options)
	preview, err := s.Preview(context.Background(), 4, "Traffic hall")
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{"在路口这个位置时可以加速通过路口。", "1. 正确", "2. 错误", "Traffic hall", "正确答案", "未经现行法规核验", "忽略原题配图中的水印", "保留与作答有关的真实交通标志"} {
		if !strings.Contains(preview.Prompt, fragment) {
			t.Errorf("prompt omitted %q", fragment)
		}
	}
	if strings.Contains(preview.Prompt, "{{") || strings.Contains(preview.Prompt, "题目标识") || !preview.ReferenceAvailable {
		t.Fatal("unresolved prompt or missing reference")
	}
	original, err := os.ReadFile(filepath.Join(options.Root, "courses", "driving-theory",
		"profiles/memory-palace.v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var stored course.PalaceTemplate
	if err := json.Unmarshal(original, &stored); err != nil || stored != s.template {
		t.Fatal("loaded template differs from canonical course source", err)
	}
	if s.template.Version != "1.2" || fmt.Sprintf("%x", sha256.Sum256(original)) != "be5007883e4e2e33528b8d337309c245ccc54422711725752c6f4bca1e4feb5d" {
		t.Fatal("template content changed without updating its verified version")
	}
	payload, _ := json.Marshal(s.Info())
	if strings.Contains(string(payload), options.Config.APIKey) || strings.Contains(string(payload), options.Config.BaseURL) {
		t.Fatal("public config leaks private provider settings")
	}
	for _, address := range []string{strings.Repeat("a", 129), "line\nbreak"} {
		if _, err := s.Preview(context.Background(), 4, address); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid address accepted")
		}
	}
}

func TestDurableImageIdempotencyAndSnapshot(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	data := testPNG(t)
	options := testOptions(t, providerFunc(func(_ context.Context, input ProviderInput) (ProviderOutput, error) {
		calls.Add(1)
		if len(input.Reference) == 0 || !strings.Contains(input.Prompt, "2. 错误") {
			t.Error("incomplete provider input")
		}
		return ProviderOutput{Bytes: data, Usage: Usage{TotalTokens: 42}}, nil
	}))
	s := newService(t, options)
	input := CreateInput{ID: "10000000-0000-4000-8000-000000000001", QuestionID: 4, Settings: Settings{UseReference: true}}
	if _, err := s.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	saved := waitJob(t, s, input.ID, "succeeded")
	if _, err := s.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 || saved.Image.Width != 16 || saved.Image.Usage.TotalTokens != 42 || saved.Snapshot.ReferenceHash == "" {
		t.Fatal("result/idempotency metadata incorrect")
	}
	path, _, err := s.ImageFile(context.Background(), input.ID)
	if err != nil {
		t.Fatal(err)
	}
	contents, _ := os.ReadFile(path)
	if sha256.Sum256(contents) != sha256.Sum256(data) {
		t.Fatal("saved image changed")
	}
	input.PalaceAddress = "different"
	if _, err := s.Create(context.Background(), input); !errors.Is(err, ErrConflict) {
		t.Fatal("ID conflict accepted")
	}
	rows, err := s.List(context.Background(), 1, 4)
	if err != nil || len(rows) != 1 {
		t.Fatal("history missing")
	}
	rows, _ = s.List(context.Background(), 4, 0)
	if len(rows) != 0 {
		t.Fatal("history mixed subjects")
	}
	var attempts int
	if err := options.DB.QueryRow("SELECT count(*) FROM answer_attempts").Scan(&attempts); err != nil {
		t.Fatal(err)
	}
	if attempts != 0 {
		t.Fatal("image generation polluted scored learning history")
	}
}

func TestCancelAndRestartNeverReplayPaidRequests(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	options := testOptions(t, providerFunc(func(ctx context.Context, _ ProviderInput) (ProviderOutput, error) {
		calls.Add(1)
		<-ctx.Done()
		return ProviderOutput{}, ctx.Err()
	}))
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	input := CreateInput{ID: "20000000-0000-4000-8000-000000000001", QuestionID: 4}
	if _, err := s.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	waitJob(t, s, input.ID, "running")
	if _, err := s.Cancel(context.Background(), input.ID); err != nil {
		t.Fatal(err)
	}
	waitJob(t, s, input.ID, "canceled")
	input.ID = "20000000-0000-4000-8000-000000000002"
	s.Create(context.Background(), input)
	waitJob(t, s, input.ID, "running")
	queued := input
	queued.ID = "20000000-0000-4000-8000-000000000003"
	s.Create(context.Background(), queued)
	s.Close()
	before := calls.Load()
	reopened := newService(t, options)
	waitJob(t, reopened, input.ID, "interrupted")
	waitJob(t, reopened, queued.ID, "interrupted")
	if calls.Load() != before {
		t.Fatal("restart replayed a paid request")
	}
}

func TestProviderFailureAndQueueCapacity(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, providerFunc(func(ctx context.Context, _ ProviderInput) (ProviderOutput, error) {
		<-ctx.Done()
		return ProviderOutput{}, ctx.Err()
	}))
	s := newService(t, options)
	for index := 0; index < 11; index++ {
		input := CreateInput{ID: fmt.Sprintf("30000000-0000-4000-8000-%012d", index), QuestionID: 4}
		_, err := s.Create(context.Background(), input)
		if index < 10 && err != nil {
			t.Fatal(err)
		}
		if index == 10 && !errors.Is(err, ErrConflict) {
			t.Fatal("queue bound not enforced")
		}
	}
	if _, err := s.Get(context.Background(), "not-a-uuid"); !errors.Is(err, ErrInvalid) {
		t.Fatal("bad ID accepted")
	}
	if _, err := s.Get(context.Background(), "30000000-0000-4000-8000-999999999999"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatal("missing job not reported")
	}
}

func TestFailedJobIsDurableAndNeverAutomaticallyRetried(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) {
		calls.Add(1)
		return ProviderOutput{}, &Failure{"quota", "test quota failure"}
	}))
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	input := CreateInput{ID: "50000000-0000-4000-8000-000000000001", QuestionID: 4}
	s.Create(context.Background(), input)
	job := waitJob(t, s, input.ID, "failed")
	if job.Error == nil || job.Error.Code != "quota" {
		t.Fatal("failure reason not persisted")
	}
	s.Close()
	reopened := newService(t, options)
	reopened.Create(context.Background(), input)
	waitJob(t, reopened, input.ID, "failed")
	if calls.Load() != 1 {
		t.Fatal("failed request was automatically retried")
	}
}

func TestCoverageIncludesImagesOutsideRecentHistory(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	data := testPNG(t)
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) { return ProviderOutput{Bytes: data}, nil }))
	s := newService(t, options)
	for index := 0; index < 35; index++ {
		question := int64(4)
		if index == 0 {
			question = 6
		}
		input := CreateInput{ID: fmt.Sprintf("70000000-0000-4000-8000-%012d", index), QuestionID: question}
		if _, err := s.Create(context.Background(), input); err != nil {
			t.Fatal(err)
		}
		waitJob(t, s, input.ID, "succeeded")
	}
	history, err := s.List(context.Background(), 1, 0)
	if err != nil || len(history) != 30 {
		t.Fatal("recent history limit changed")
	}
	for _, job := range history {
		if job.QuestionID == 6 {
			t.Fatal("fixture did not age outside history")
		}
	}
	_, err = options.DB.Exec(`INSERT INTO palace_jobs
  (id,question_id,subject_id,status,snapshot_json,created_at_ms,updated_at_ms)
  VALUES ('70000000-0000-4000-8000-999999999999',4,1,'failed','{}',1,1)`)
	if err != nil {
		t.Fatal(err)
	}
	coverage, err := s.Coverage(context.Background(), 1)
	if err != nil || len(coverage) != 2 {
		t.Fatal("coverage was limited to recent jobs")
	}
	if coverage[0].QuestionID != 4 || coverage[0].ImageCount != 34 || coverage[1].QuestionID != 6 || coverage[1].LatestJobID != "70000000-0000-4000-8000-000000000000" {
		t.Fatalf("wrong coverage: %+v", coverage)
	}
	other, _ := s.Coverage(context.Background(), 4)
	if len(other) != 0 {
		t.Fatal("coverage mixed subjects")
	}
}

func TestConfigFileOverridesAndNoSecretErrors(t *testing.T) {
	root := t.TempDir()
	for _, key := range []string{"STUDY_IMAGE_CONFIG_FILE", "GPT_IMAGE2_1_BASE_URL", "GPT_IMAGE2_1_API_KEY", "GPT_IMAGE2_1_MODELS", "GPT_IMAGE2_1_PROXY_URL", "HTTPS_PROXY"} {
		t.Setenv(key, "")
	}
	t.Setenv("STUDY_IMAGE_CONFIG_FILE", filepath.Join(root, "missing"))
	c := LoadConfig(root)
	if c.Message == "" {
		t.Fatal("missing config enabled generation")
	}
	t.Setenv("GPT_IMAGE2_1_BASE_URL", "https://images.example.invalid/v1/")
	t.Setenv("GPT_IMAGE2_1_API_KEY", "test-key-never-public")
	t.Setenv("GPT_IMAGE2_1_MODELS", "gpt-image-2.5,gpt-image-2,gpt-image-2")
	t.Setenv("GPT_IMAGE2_1_PROXY_URL", "http://127.0.0.1:1")
	c = LoadConfig(root)
	if c.Message != "" || c.DefaultModel != "gpt-image-2" || len(c.Models) != 2 || strings.HasSuffix(c.BaseURL, "/") {
		t.Fatal("configuration normalization failed")
	}
	t.Setenv("GPT_IMAGE2_1_PROXY_URL", "")
	c = LoadConfig(root)
	if c.Message == "" || strings.Contains(c.Message, "test-key") {
		t.Fatal("unsafe remote configuration")
	}
	file := filepath.Join(root, "local.env")
	os.WriteFile(file, []byte("GPT_IMAGE2_1_API_KEY='example'\nBROKEN\n"), 0600)
	if _, err := readConfig(file); err == nil || strings.Contains(err.Error(), "example") {
		t.Fatal("invalid dotenv exposed values")
	}
}
