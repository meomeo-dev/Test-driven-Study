package course

import (
	"fmt"
	"slices"
	"strings"
)

type StudyTranslation struct {
	Material     []string                               `json:"material"`
	SubQuestions map[string]StudySubQuestionTranslation `json:"sub_questions,omitempty"`
}

type StudySubQuestionTranslation struct {
	Stem    *string           `json:"stem,omitempty"`
	Options map[string]string `json:"options,omitempty"`
}

func (item Item) validateStudyTranslation(optionsBySubID map[string][]Option) error {
	translation := item.StudyTranslation
	count := item.studyTranslationSourceCount()
	if count == 0 {
		return fmt.Errorf("study_translation requires a passage or structured transcript")
	}
	if len(translation.Material) != count {
		return fmt.Errorf("study_translation material: got %d translations for %d source parts",
			len(translation.Material), count)
	}
	for index, text := range translation.Material {
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("study_translation material %d is blank", index+1)
		}
	}
	for id, translated := range translation.SubQuestions {
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
	if item.Passage == nil {
		return 0
	}
	if len(item.Passage.Segments) == 0 && strings.TrimSpace(item.Passage.Text) != "" {
		return 1
	}
	count := 0
	for _, segment := range item.Passage.Segments {
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
