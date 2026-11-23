package course

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var courseID = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func ValidID(id string) bool {
	return len(id) <= 64 && courseID.MatchString(id)
}

func Scaffold(parent, id, title, language string) (string, error) {
	if !ValidID(id) || strings.TrimSpace(title) == "" {
		return "", fmt.Errorf("provide a lowercase course ID and a nonempty title")
	}
	directory := filepath.Join(parent, id)
	return createPackage(directory, func(directory string) error {
		manifest := Manifest{
			ProtocolVersion: 2,
			ID:              id,
			Version:         "1.0.0",
			Title:           title,
			Language:        language,
			AIProfile:       &starterPalaceRef,
			Units: []Unit{{
				ID:           "intro",
				Title:        "Introduction",
				QuestionFile: "questions/intro.json",
				Lessons: []LessonRef{{
					ID:    "intro",
					Title: "Getting started",
					File:  "lessons/intro.md",
				}},
				Concepts: []Concept{{
					ID:               "intro-basics",
					Title:            "Getting Started",
					Summary:          "Core fraction, decimal, and percentage conversions for this starter unit.",
					EstimatedMinutes: 5,
				}},
			}},
		}
		trueVal, falseVal := true, false
		items := []Item{
			{
				Prompt: Prompt{
					ID:   "1",
					Type: Numeric,
					Stem: RichContent{Text: "What is 1 divided by 4?"},
				},
				Grading:  Grading{Value: "0.25", AbsoluteTolerance: "0"},
				Analysis: &RichContent{Text: "1 除以 4 等于 0.25。"},
				Concepts: []string{"intro-basics"},
			},
			{
				Prompt: Prompt{
					ID:   "2",
					Type: SingleChoice,
					Stem: RichContent{Text: "0.5 等价于哪一项？"},
					Options: []Option{
						{ID: "a", Text: "1/2"},
						{ID: "b", Text: "1/4"},
						{ID: "c", Text: "3/4"},
					},
				},
				Grading:  Grading{ChoiceIDs: []string{"a"}},
				Analysis: &RichContent{Text: "1/2 等于 0.5，其余选项分别等于 0.25 和 0.75。"},
				Concepts: []string{"intro-basics"},
			},
			{
				Prompt: Prompt{
					ID:   "3",
					Type: TrueFalse,
					Stem: RichContent{Text: "0.25 与 25% 数值相等。"},
					Options: []Option{
						{ID: "t", Text: "正确", Value: &trueVal},
						{ID: "f", Text: "错误", Value: &falseVal},
					},
				},
				Grading:  Grading{Boolean: &trueVal, booleanValueKey: true},
				Analysis: &RichContent{Text: "0.25 乘以 100% 等于 25%，两者数值相等。"},
				Concepts: []string{"intro-basics"},
			},
		}
		if err := writeJSON(directory, ManifestFile, manifest); err != nil {
			return err
		}
		if err := writeJSON(directory, "questions/intro.json", items); err != nil {
			return err
		}
		if err := writeStarterPalace(directory); err != nil {
			return err
		}
		lesson := strings.Join([]string{
			"# Getting Started",
			"",
			"## Getting Started",
			"",
			"<!-- concepts: intro-basics -->",
			"",
			"This starter lesson introduces basic decimal, fraction, and percentage conversions.",
			"Review the examples, then complete the three starter exercises to confirm mastery.",
			"",
		}, "\n")
		return writeContent(directory, "lessons/intro.md", []byte(lesson))
	})
}

func createPackage(directory string, build func(string) error) (string, error) {
	if err := os.MkdirAll(filepath.Dir(directory), 0755); err != nil {
		return "", err
	}
	if err := os.Mkdir(directory, 0755); err != nil {
		return "", err
	}
	published := false
	defer func() {
		if !published {
			_ = os.RemoveAll(directory)
		}
	}()
	if err := build(directory); err != nil {
		return "", err
	}
	if _, err := Load(directory); err != nil {
		return "", err
	}
	published = true
	return directory, nil
}

func writeJSON(directory, filename string, document any) error {
	data, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return err
	}
	return writeContent(directory, filename, append(data, '\n'))
}

func writeContent(directory, filename string, data []byte) error {
	filename = filepath.Join(directory, filepath.FromSlash(filename))
	if err := os.MkdirAll(filepath.Dir(filename), 0755); err != nil {
		return err
	}
	return os.WriteFile(filename, data, 0644)
}
