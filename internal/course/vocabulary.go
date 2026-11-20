package course

import (
	"fmt"
	"path"
	"slices"
)

type vocabularyReference struct {
	ID          string   `json:"id"`
	UnitID      string   `json:"unit_id"`
	QuestionIDs []string `json:"question_ids"`
}

func isVocabularyPath(filename string) bool {
	return validPath(filename, "assets/vocabulary") && path.Ext(filename) == ".json"
}

func (files packageFiles) validateVocabulary(
	filename string, units map[string]UnitContent, schemas packageSchemas,
) error {
	if !isVocabularyPath(filename) {
		return fmt.Errorf("invalid vocabulary asset path %q", filename)
	}
	data, err := files.read(filename)
	if err != nil {
		return err
	}
	entries, err := decodeFile[[]vocabularyReference](data, filename, schemas.vocabulary)
	if err != nil {
		return err
	}
	seen := make(map[string]bool, len(entries))
	for _, entry := range entries {
		if seen[entry.ID] {
			return fmt.Errorf("%s: duplicate vocabulary ID %q", filename, entry.ID)
		}
		seen[entry.ID] = true
		unit, exists := units[entry.UnitID]
		if !exists {
			return fmt.Errorf("%s: vocabulary %q references unknown unit %q",
				filename, entry.ID, entry.UnitID)
		}
		for _, questionID := range entry.QuestionIDs {
			found := slices.ContainsFunc(unit.Items, func(item Item) bool {
				return item.ID == questionID
			})
			if !found {
				return fmt.Errorf("%s: vocabulary %q references question %q outside unit %q",
					filename, entry.ID, questionID, entry.UnitID)
			}
		}
	}
	return nil
}
