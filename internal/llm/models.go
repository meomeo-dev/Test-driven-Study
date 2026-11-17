package llm

import (
	"errors"

	"test-driven-study/internal/course"
)

var ErrInvalid = errors.New("invalid LLM request")
var ErrConflict = errors.New("LLM request conflicts with saved state")
var ErrDisabled = errors.New("LLM provider is not configured")
var ErrPaused = errors.New("LLM paused at a saved checkpoint")

type Failure struct {
	HTTPStatus int    `json:"-"`
	Operation  string `json:"operation,omitempty"`
	Parameter  string `json:"parameter,omitempty"`
	Code       string `json:"code"`
	Message    string `json:"message"`
}

func (f *Failure) Error() string { return f.Code + ": " + f.Message }

type Parameters struct {
	Model             string `json:"model"`
	ReasoningEffort   string `json:"reasoning_effort"`
	MaxOutputTokensK  int    `json:"max_output_tokens_k"`
	ContextBudgetK    int    `json:"context_budget_k,omitempty"`
	CompactThresholdK int    `json:"compact_threshold_k,omitempty"`
	CompactReserveK   int    `json:"compact_reserve_k,omitempty"`
	WebSearch         string `json:"web_search,omitempty"`
}
type PlanInput struct {
	ID            string `json:"id"`
	QuestionID    int64  `json:"question_id"`
	PalaceAddress string `json:"palace_address"`
	Parameters
}

type PlanSource struct {
	Prompt         string
	ProfileVersion *course.AIProfileVersion
}
type Anchor struct {
	Cue     string `json:"cue"`
	Meaning string `json:"meaning"`
}
type Plan struct {
	Title       string    `json:"title"`
	Scene       string    `json:"scene"`
	Anchors     []Anchor  `json:"anchors"`
	Pitfalls    []string  `json:"pitfalls"`
	ImagePrompt string    `json:"image_prompt"`
	Research    *Research `json:"research,omitempty"`
}
type Usage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}
type PlanRecord struct {
	PlanInput
	References     []ImageReference         `json:"references,omitempty"`
	Session        SessionProgress          `json:"session"`
	Status         string                   `json:"status"`
	SourcePrompt   string                   `json:"source_prompt"`
	ProfileVersion *course.AIProfileVersion `json:"ai_profile_version,omitempty"`
	Plan           *Plan                    `json:"plan,omitempty"`
	Usage          Usage                    `json:"usage"`
	Error          *Failure                 `json:"error,omitempty"`
	CreatedAtMS    int64                    `json:"created_at_ms"`
	UpdatedAtMS    int64                    `json:"updated_at_ms"`
}

func (record PlanRecord) matchesSource(source PlanSource) bool {
	if record.SourcePrompt != source.Prompt {
		return false
	}
	// Records written before course-owned planning did not carry a profile.
	return record.ProfileVersion == nil ||
		(source.ProfileVersion != nil && *record.ProfileVersion == *source.ProfileVersion)
}

type Source struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}
type SourceClaim struct {
	URL   string `json:"url"`
	Title string `json:"title"`
	Claim string `json:"claim"`
}
type Research struct {
	Status      string        `json:"status"`
	Explanation string        `json:"explanation"`
	Sources     []SourceClaim `json:"sources"`
}
type SessionProgress struct {
	GeneralCourse    bool     `json:"general_course,omitempty"`
	EvidenceGap      string   `json:"evidence_gap,omitempty"`
	ResearchRounds   int      `json:"research_rounds,omitempty"`
	PageOpens        int      `json:"page_opens,omitempty"`
	PageFinds        int      `json:"page_finds,omitempty"`
	SearchProtocol   string   `json:"search_protocol,omitempty"`
	CompactionMethod string   `json:"compaction_method,omitempty"`
	Rounds           int      `json:"rounds"`
	Compactions      int      `json:"compactions"`
	Searches         int      `json:"searches"`
	Phase            string   `json:"phase"`
	ContextTokens    int64    `json:"context_tokens"`
	Sources          []Source `json:"sources"`
	Usage            Usage    `json:"usage"`
}
type ImageReference struct {
	SHA256      string `json:"sha256"`
	ContentType string `json:"content_type"`
	Bytes       int    `json:"bytes"`
	Frame       int    `json:"frame"`
	TotalFrames int    `json:"total_frames"`
}
type InputImage struct {
	Data      []byte
	Reference ImageReference
}
