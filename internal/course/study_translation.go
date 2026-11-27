package course

import (
	"fmt"
	"slices"
	"strings"
)

const (
	SurfaceMemorize       = "memorize"
	SurfacePracticeReview = "practice_review"
	SurfaceExamReview     = "exam_review"
	SurfaceTyping         = "typing"
	SurfacePalace         = "palace"
)

var validStudyTranslationSurfaces = map[string]bool{
	SurfaceMemorize:       true,
	SurfacePracticeReview: true,
	SurfaceExamReview:     true,
	SurfaceTyping:         true,
	SurfacePalace:         true,
}

type StudyTranslation struct {
	DisplayIn      []string                               `json:"display_in,omitempty"`
	Stem           *string                                `json:"stem,omitempty"`
	Options        map[string]string                      `json:"options,omitempty"`
	Material       []string                               `json:"material,omitempty"`
	SampleResponse []string                               `json:"sample_response,omitempty"`
	SubQuestions   map[string]StudySubQuestionTranslation `json:"sub_questions,omitempty"`
}

type StudySubQuestionTranslation struct {
	Stem    *string           `json:"stem,omitempty"`
	Options map[string]string `json:"options,omitempty"`
}

func (item Item) validateStudyTranslation() error {
	translation := item.StudyTranslation
	if translation == nil {
		return nil
	}
	if err := validateDisplayIn(translation.DisplayIn); err != nil {
		return err
	}
	hasContent := translation.Stem != nil || len(translation.Options) > 0 ||
		len(translation.Material) > 0 || len(translation.SampleResponse) > 0 ||
		len(translation.SubQuestions) > 0
	if !hasContent {
		return fmt.Errorf("study_translation must provide at least one translation field")
	}
	if translation.Stem != nil && strings.TrimSpace(*translation.Stem) == "" {
		return fmt.Errorf("study_translation stem is blank")
	}
	if err := item.validateOptionTranslations(translation.Options); err != nil {
		return err
	}
	if err := item.validateMaterialTranslations(translation.Material); err != nil {
		return err
	}
	if err := item.validateSampleResponseTranslations(translation.SampleResponse); err != nil {
		return err
	}
	return item.validateSubQuestionTranslations(translation.SubQuestions)
}

func validateDisplayIn(surfaces []string) error {
	if surfaces == nil {
		return nil
	}
	if len(surfaces) == 0 {
		return fmt.Errorf("study_translation display_in must not be empty")
	}
	seen := make(map[string]bool, len(surfaces))
	for _, surface := range surfaces {
		if !validStudyTranslationSurfaces[surface] {
			return fmt.Errorf("study_translation display_in contains unknown surface %q", surface)
		}
		if seen[surface] {
			return fmt.Errorf("study_translation display_in contains duplicate surface %q", surface)
		}
		seen[surface] = true
	}
	return nil
}

func (item Item) validateOptionTranslations(options map[string]string) error {
	if len(options) == 0 {
		return nil
	}
	if item.Type != SingleChoice && item.Type != MultipleChoice && item.Type != TrueFalse {
		return fmt.Errorf("study_translation options are only supported on choice and true_false items")
	}
	for id, text := range options {
		if !slices.ContainsFunc(item.Options, func(option Option) bool { return option.ID == id }) {
			return fmt.Errorf("study_translation references unknown option %q", id)
		}
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("study_translation option %q is blank", id)
		}
	}
	return nil
}

func (item Item) validateMaterialTranslations(material []string) error {
	isComposite := item.Type == Reading || item.Type == Listening
	if !isComposite && item.Type != Cloze {
		if len(material) > 0 {
			return fmt.Errorf("study_translation material is only supported on reading, listening, and cloze items")
		}
		return nil
	}
	if len(material) == 0 {
		if isComposite {
			return fmt.Errorf("study_translation material is required on %s items", item.Type)
		}
		return nil
	}
	count := item.studyTranslationSourceCount()
	if count == 0 {
		return fmt.Errorf("study_translation requires a passage or structured transcript")
	}
	if len(material) != count {
		return fmt.Errorf("study_translation material: got %d translations for %d source parts",
			len(material), count)
	}
	for index, text := range material {
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("study_translation material %d is blank", index+1)
		}
	}
	return nil
}

func (item Item) validateSampleResponseTranslations(samples []string) error {
	if len(samples) == 0 {
		return nil
	}
	if item.Type != Writing {
		return fmt.Errorf("study_translation sample_response is only supported on writing items")
	}
	count := richContentPartCount(item.Sample)
	if count == 0 {
		return fmt.Errorf("study_translation sample_response requires a nonblank sample_response")
	}
	if len(samples) != count {
		return fmt.Errorf("study_translation sample_response: got %d translations for %d sample parts",
			len(samples), count)
	}
	for index, text := range samples {
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("study_translation sample_response %d is blank", index+1)
		}
	}
	return nil
}

func (item Item) validateSubQuestionTranslations(subTranslations map[string]StudySubQuestionTranslation) error {
	if len(subTranslations) == 0 {
		return nil
	}
	if item.Type != Reading && item.Type != Listening {
		return fmt.Errorf("study_translation sub_questions are only supported on reading and listening items")
	}
	optionsBySubID := make(map[string][]Option, len(item.SubQuestions))
	for _, sub := range item.SubQuestions {
		optionsBySubID[sub.ID] = sub.Options
	}
	for id, translated := range subTranslations {
		options, exists := optionsBySubID[id]
		if !exists {
			return fmt.Errorf("study_translation references unknown sub-question %q", id)
		}
		if err := translated.validate(options); err != nil {
			return fmt.Errorf("study_translation for sub-question %q: %w", id, err)
		}
	}
	return nil
}

func (item Item) studyTranslationSourceCount() int {
	if item.Type == Listening {
		if item.Transcript != nil {
			return len(item.Transcript.Lines)
		}
		if item.AudioPath() != "" {
			return 0
		}
	}
	if item.Type == Cloze {
		if item.Passage == nil {
			return 0
		}
		if len(item.Passage.Segments) == 0 && strings.TrimSpace(item.Passage.Text) != "" {
			return 1
		}
		count := 0
		for _, segment := range item.Passage.Segments {
			if segment.Type != "blank" && strings.TrimSpace(segment.Text) != "" {
				count++
			}
		}
		return count
	}
	return richContentPartCount(item.Passage)
}

func richContentPartCount(content *RichContent) int {
	if content == nil {
		return 0
	}
	if len(content.Segments) == 0 && strings.TrimSpace(content.Text) != "" {
		return 1
	}
	count := 0
	for _, segment := range content.Segments {
		if strings.TrimSpace(segment.Text) != "" {
			count++
		}
	}
	return count
}

func (translated StudySubQuestionTranslation) validate(options []Option) error {
	if translated.Stem != nil && strings.TrimSpace(*translated.Stem) == "" {
		return fmt.Errorf("stem translation is blank")
	}
	if translated.Stem == nil && len(translated.Options) == 0 {
		return fmt.Errorf("expected a stem or option translation")
	}
	for id, text := range translated.Options {
		if !slices.ContainsFunc(options, func(option Option) bool { return option.ID == id }) {
			return fmt.Errorf("references unknown option %q", id)
		}
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("option %q translation is blank", id)
		}
	}
	return nil
}
