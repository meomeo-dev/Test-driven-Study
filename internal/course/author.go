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
		manifest := Manifest{ProtocolVersion: 1, ID: id, Version: "1.0.0",
			Title: title, Language: language, AIProfile: &starterPalaceRef, Units: []Unit{{
				ID: "intro", Title: "Introduction", QuestionFile: "questions/intro.json",
				Lessons: []LessonRef{{ID: "intro", Title: "Getting started",
					File: "lessons/intro.md"}},
			}}}
		items := []Item{{
			Prompt:      Prompt{ID: "1", Type: Numeric, Stem: RichContent{Text: "What is 1 divided by 4?"}},
			Grading:     Grading{Value: "0.25", AbsoluteTolerance: "0"},
			Explanation: "Dividing one by four gives one quarter.",
		}}
		if err := writeJSON(directory, ManifestFile, manifest); err != nil {
			return err
		}
		if err := writeJSON(directory, "questions/intro.json", items); err != nil {
			return err
		}
		if err := writeStarterPalace(directory); err != nil {
			return err
		}
		return writeContent(directory, "lessons/intro.md",
			[]byte("Replace this lesson and the sample exercise with your course content.\n"))
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
