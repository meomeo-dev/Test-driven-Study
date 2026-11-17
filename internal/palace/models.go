package palace

import (
	"context"
	"errors"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

var ErrInvalid = errors.New("invalid palace request")
var ErrConflict = errors.New("palace request conflicts with saved state")
var ErrDisabled = errors.New("image generation is not configured")
var ErrPaused = errors.New("palace task paused")

type Settings struct {
	GenerationMode string             `json:"generation_mode,omitempty"`
	LLM            PlanningParameters `json:"llm,omitzero"`
	Model          string             `json:"model"`
	PlanID         string             `json:"plan_id,omitempty"`
	Size           string             `json:"size"`
	AspectRatio    string             `json:"aspect_ratio,omitempty"`
	Resolution     string             `json:"resolution,omitempty"`
	Quality        string             `json:"quality"`
	PalaceAddress  string             `json:"palace_address"`
	UseReference   bool               `json:"use_reference"`
}

type CreateInput struct {
	ID         string `json:"id"`
	QuestionID int64  `json:"question_id"`
	Settings
}

type Preview struct {
	QuestionID         int64                    `json:"question_id"`
	Prompt             string                   `json:"prompt"`
	TemplateID         string                   `json:"template_id"`
	TemplateVersion    string                   `json:"template_version"`
	ReferenceAvailable bool                     `json:"reference_available"`
	ProfileVersion     *course.AIProfileVersion `json:"ai_profile_version,omitempty"`
}

type Info struct {
	Ready           bool     `json:"ready"`
	Models          []string `json:"models"`
	DefaultModel    string   `json:"default_model"`
	ProxyEnabled    bool     `json:"proxy_enabled"`
	Message         string   `json:"message"`
	TemplateID      string   `json:"template_id"`
	TemplateVersion string   `json:"template_version"`
}

type Snapshot struct {
	RetryOf         string                   `json:"retry_of,omitempty"`
	Pipeline        *Pipeline                `json:"pipeline,omitempty"`
	Question        study.Question           `json:"question"`
	Settings        Settings                 `json:"settings"`
	Prompt          string                   `json:"prompt"`
	TemplateID      string                   `json:"template_id"`
	TemplateVersion string                   `json:"template_version"`
	ReferenceHash   string                   `json:"reference_hash"`
	ProfileVersion  *course.AIProfileVersion `json:"ai_profile_version,omitempty"`
}

type Usage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}

type Image struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	Bytes       int    `json:"bytes"`
	SHA256      string `json:"sha256"`
	Usage       Usage  `json:"usage"`
}

type Failure struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (f *Failure) Error() string { return f.Code + ": " + f.Message }

type Job struct {
	CanRetryImage bool     `json:"can_retry_image"`
	ID            string   `json:"id"`
	QuestionID    int64    `json:"question_id"`
	SubjectID     int64    `json:"subject_id"`
	Status        string   `json:"status"`
	CreatedAtMS   int64    `json:"created_at_ms"`
	UpdatedAtMS   int64    `json:"updated_at_ms"`
	Snapshot      Snapshot `json:"snapshot"`
	Image         *Image   `json:"image,omitempty"`
	Error         *Failure `json:"error,omitempty"`
}

type ProviderInput struct {
	Model, Prompt, Size, Quality string
	Reference                    []byte
	ReferenceName                string
}

type ProviderOutput struct {
	Bytes []byte
	Usage Usage
}

type ImageProvider interface {
	Generate(context.Context, ProviderInput) (ProviderOutput, error)
}
