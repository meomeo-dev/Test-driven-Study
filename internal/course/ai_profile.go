package course

import (
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"unicode/utf8"
)

type AIProfileRef struct {
	AssistantInstructions      string `json:"assistant_instructions,omitempty"`
	PalaceTemplate             string `json:"palace_template,omitempty"`
	PalacePlanningInstructions string `json:"palace_planning_instructions,omitempty"`
	PalaceResearchInstructions string `json:"palace_research_instructions,omitempty"`
}

type AIProfile struct {
	Assistant string
	Palace    *PalaceTemplate
	Prompts   PalacePrompts
}

type PalaceTemplate struct {
	ID      string `json:"template_id"`
	Version string `json:"version"`
	Prompt  string `json:"prompt_template"`
}

type PalacePrompts struct {
	Planning string
	Research string
}

type AIProfileVersion struct {
	CourseID      string `json:"course_id"`
	CourseVersion string `json:"course_version"`
}

func LoadAIProfile(ref *AIProfileRef, read func(string) ([]byte, error)) (AIProfile, error) {
	var profile AIProfile
	if ref == nil {
		return profile, nil
	}
	for _, field := range []struct {
		filename string
		target   *string
	}{
		{ref.AssistantInstructions, &profile.Assistant},
		{ref.PalacePlanningInstructions, &profile.Prompts.Planning},
		{ref.PalaceResearchInstructions, &profile.Prompts.Research},
	} {
		if field.filename == "" {
			continue
		}
		data, err := readAIProfileFile(field.filename, ".txt", read)
		if err != nil {
			return profile, err
		}
		*field.target = strings.TrimSpace(string(data))
	}
	if ref.PalaceTemplate != "" {
		data, err := readAIProfileFile(ref.PalaceTemplate, ".json", read)
		if err != nil {
			return profile, err
		}
		var template PalaceTemplate
		if err := json.Unmarshal(data, &template); err != nil {
			return profile, fmt.Errorf("%s: %w", ref.PalaceTemplate, err)
		}
		if err := template.validateAIProfile(); err != nil {
			return profile, fmt.Errorf("%s: %w", ref.PalaceTemplate, err)
		}
		profile.Palace = &template
	}
	return profile, nil
}

func readAIProfileFile(filename, extension string, read func(string) ([]byte, error)) ([]byte, error) {
	if !validPath(filename, "profiles") || path.Ext(filename) != extension {
		return nil, fmt.Errorf("invalid AI profile path %q", filename)
	}
	data, err := read(filename)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", filename, err)
	}
	if len(data) > 24<<10 || !utf8.Valid(data) || strings.TrimSpace(string(data)) == "" ||
		strings.ContainsRune(string(data), 0) {
		return nil, fmt.Errorf("%s: expected nonempty UTF-8 AI profile up to 24 KiB", filename)
	}
	return data, nil
}

func (template PalaceTemplate) validateAIProfile() error {
	for _, value := range []string{template.ID, template.Version} {
		if strings.TrimSpace(value) == "" || len(value) > 128 || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("template ID and version must be single-line identifiers")
		}
	}
	if strings.ContainsRune(template.Prompt, 0) {
		return fmt.Errorf("prompt contains a null character")
	}
	if !strings.Contains(template.Prompt, "{{QUESTION_TEXT}}") ||
		!strings.Contains(template.Prompt, "{{REFERENCE_ANSWER}}") {
		return fmt.Errorf("prompt requires QUESTION_TEXT and REFERENCE_ANSWER placeholders")
	}
	rest := strings.NewReplacer("{{QUESTION_TEXT}}", "", "{{REFERENCE_ANSWER}}", "",
		"{{PALACE_ADDRESS}}", "").Replace(template.Prompt)
	if strings.Contains(rest, "{{") || strings.Contains(rest, "}}") {
		return fmt.Errorf("prompt has an unsupported placeholder")
	}
	return nil
}
