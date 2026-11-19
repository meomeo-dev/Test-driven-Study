package course

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"maps"
	"os"
	"path"
	"slices"
	"strings"
	"unicode/utf8"
)

const ManifestFile = "course.json"

type Package struct {
	Manifest Manifest
	Digest   string
	Units    map[string]UnitContent
	Files    []string
	hashes   map[string]string
}

type UnitContent struct {
	Items   []Item
	Lessons map[string]string
}

func Load(directory string) (Package, error) {
	root, err := os.OpenRoot(directory)
	if err != nil {
		return Package{}, err
	}
	defer root.Close()
	files := packageFiles{root: root, hashes: make(map[string]string)}
	versions, err := loadSchemas()
	if err != nil {
		return Package{}, err
	}
	data, err := files.read(ManifestFile)
	if err != nil {
		return Package{}, err
	}
	var protocol struct {
		Version int `json:"protocol_version"`
	}
	if err := json.Unmarshal(data, &protocol); err != nil {
		return Package{}, fmt.Errorf("%s: %w", ManifestFile, err)
	}
	if protocol.Version < 1 || protocol.Version >= len(versions) {
		return Package{}, fmt.Errorf("%s: unsupported protocol_version %d", ManifestFile, protocol.Version)
	}
	schemas := versions[protocol.Version]
	manifest, err := decodeFile[Manifest](data, ManifestFile, schemas.manifest)
	if err != nil {
		return Package{}, err
	}
	if err := files.asset(manifest.Logo); err != nil {
		return Package{}, err
	}
	result := Package{Manifest: manifest, Units: make(map[string]UnitContent)}
	seenItems := make(map[string]bool)
	for _, unit := range manifest.Units {
		if _, exists := result.Units[unit.ID]; exists {
			return Package{}, fmt.Errorf("duplicate unit ID %q", unit.ID)
		}
		content, err := files.unit(unit, seenItems, schemas, protocol.Version)
		if err != nil {
			return Package{}, fmt.Errorf("unit %q: %w", unit.ID, err)
		}
		result.Units[unit.ID] = content
	}
	if err := validateConcepts(manifest, result.Units); err != nil {
		return Package{}, err
	}
	if err := validateRoadmap(manifest); err != nil {
		return Package{}, err
	}
	if _, err := LoadAIProfile(manifest.AIProfile, files.read); err != nil {
		return Package{}, err
	}
	result.Files = slices.Sorted(maps.Keys(files.hashes))
	result.hashes = files.hashes
	digest := sha256.New()
	for _, filename := range result.Files {
		fmt.Fprintf(digest, "%s\x00%s\n", filename, files.hashes[filename])
	}
	result.Digest = hex.EncodeToString(digest.Sum(nil))
	return result, nil
}

func (pkg Package) IsStoredAsset(filename string) bool {
	ref := pkg.Manifest.AIProfile
	return IsAssetPath(filename) ||
		(ref != nil && (filename == ref.AssistantInstructions || filename == ref.PalaceTemplate ||
			filename == ref.PalacePlanningInstructions || filename == ref.PalaceResearchInstructions))
}

func (pkg Package) ReadAsset(root *os.Root, filename string) ([]byte, error) {
	expected, exists := pkg.hashes[filename]
	if !exists || !pkg.IsStoredAsset(filename) {
		return nil, fs.ErrNotExist
	}
	file, err := openRegular(root, filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != expected {
		return nil, fmt.Errorf("%s: asset changed during import", filename)
	}
	return data, nil
}

func (files packageFiles) unit(
	unit Unit, seenItems map[string]bool, schemas packageSchemas, protocol int,
) (UnitContent, error) {
	content := UnitContent{Lessons: make(map[string]string)}
	for _, lesson := range unit.Lessons {
		if _, exists := content.Lessons[lesson.ID]; exists {
			return content, fmt.Errorf("duplicate lesson ID %q", lesson.ID)
		}
		if !validPath(lesson.File, "lessons") || path.Ext(lesson.File) != ".md" {
			return content, fmt.Errorf("invalid lesson path %q", lesson.File)
		}
		data, err := files.read(lesson.File)
		if err != nil {
			return content, err
		}
		if !utf8.Valid(data) || strings.TrimSpace(string(data)) == "" {
			return content, fmt.Errorf("%s: expected nonempty UTF-8 Markdown", lesson.File)
		}
		content.Lessons[lesson.ID] = string(data)
	}
	if unit.QuestionFile == "" {
		return content, nil
	}
	if !validPath(unit.QuestionFile, "questions") || path.Ext(unit.QuestionFile) != ".json" {
		return content, fmt.Errorf("invalid question path %q", unit.QuestionFile)
	}
	data, err := files.read(unit.QuestionFile)
	if err != nil {
		return content, err
	}
	content.Items, err = decodeFile[[]Item](data, unit.QuestionFile, schemas.items)
	if err != nil {
		return content, err
	}
	for _, item := range content.Items {
		if err := files.validateItem(item, seenItems, protocol); err != nil {
			return content, fmt.Errorf("%s item %q: %w", unit.QuestionFile, item.ID, err)
		}
	}
	return content, nil
}

func (files packageFiles) validateItem(item Item, seen map[string]bool, protocol int) error {
	if seen[item.ID] {
		return fmt.Errorf("duplicate item ID")
	}
	seen[item.ID] = true
	if err := files.asset(item.Image); err != nil {
		return err
	}
	if audio := item.AudioPath(); audio != "" {
		if !IsAudioPath(audio) {
			return fmt.Errorf("invalid audio asset path %q", audio)
		}
		if err := files.hashAsset(audio); err != nil {
			return err
		}
	}
	if item.Transcript != nil && len(item.Transcript.Lines) == 0 && item.Transcript.Text != "" {
		if err := files.transcript(item.Transcript.Text); err != nil {
			return err
		}
	}
	return item.validate(protocol)
}

func (item Item) validateCommonOptions(protocol int) error {
	if protocol == 2 {
		if err := uniformOptionAudio(item.Options); err != nil {
			return err
		}
	}
	optionIDs := make(map[string]bool, len(item.Options))
	for _, option := range item.Options {
		if optionIDs[option.ID] {
			return fmt.Errorf("duplicate option ID %q", option.ID)
		}
		optionIDs[option.ID] = true
		if item.Type != TrueFalse && option.Value != nil {
			return fmt.Errorf("Boolean values require a true_false item")
		}
	}
	for _, id := range item.Grading.ChoiceIDs {
		if !optionIDs[id] {
			return fmt.Errorf("answer references unknown option %q", id)
		}
	}
	return nil
}

func validateObjectiveItem(item Item, protocol int) error {
	return item.validateCommonOptions(protocol)
}

func validateTrueFalseItem(item Item, protocol int) error {
	if err := item.validateCommonOptions(protocol); err != nil {
		return err
	}
	if len(item.Options) == 2 && item.Options[0].Value != nil && item.Options[1].Value != nil &&
		*item.Options[0].Value == *item.Options[1].Value {
		return fmt.Errorf("true_false options must have distinct Boolean values")
	}
	return nil
}

func validateNumericItem(item Item, protocol int) error {
	if err := item.validateCommonOptions(protocol); err != nil {
		return err
	}
	tolerance, ok := decimal(item.Grading.AbsoluteTolerance)
	if !ok || tolerance.Sign() < 0 {
		return fmt.Errorf("absolute tolerance must be nonnegative")
	}
	return nil
}

type packageFiles struct {
	root   *os.Root
	hashes map[string]string
}

func validPath(filename, directory string) bool {
	return fs.ValidPath(filename) && strings.HasPrefix(filename, directory+"/") &&
		!strings.ContainsAny(filename, "\\:\x00")
}

func IsAssetPath(filename string) bool {
	return isImagePath(filename) || IsAudioPath(filename) || IsTranscriptPath(filename)
}

func IsAudioPath(filename string) bool {
	return validPath(filename, "assets") && strings.EqualFold(path.Ext(filename), ".mp3")
}

func IsTranscriptPath(filename string) bool {
	return validPath(filename, "assets/transcripts") && path.Ext(filename) == ".txt"
}

func (files packageFiles) transcript(filename string) error {
	if !IsTranscriptPath(filename) {
		return fmt.Errorf("invalid transcript path %q", filename)
	}
	if files.hashes[filename] != "" {
		return nil
	}
	const maxBytes = 24 << 10
	file, err := openRegular(files.root, filename)
	if err != nil {
		return err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return err
	}
	if len(data) > maxBytes || !utf8.Valid(data) ||
		strings.TrimSpace(string(data)) == "" || strings.ContainsRune(string(data), 0) {
		return fmt.Errorf("%s: expected nonempty UTF-8 transcript up to 24 KiB", filename)
	}
	digest := sha256.Sum256(data)
	files.hashes[filename] = hex.EncodeToString(digest[:])
	return nil
}

func isImagePath(filename string) bool {
	if !validPath(filename, "assets") {
		return false
	}
	switch strings.ToLower(path.Ext(filename)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		return true
	default:
		return false
	}
}

func (files packageFiles) asset(filename string) error {
	if filename == "" {
		return nil
	}
	if !isImagePath(filename) {
		return fmt.Errorf("invalid asset path %q", filename)
	}
	return files.hashAsset(filename)
}

func (files packageFiles) hashAsset(filename string) error {
	if files.hashes[filename] != "" {
		return nil
	}
	file, err := openRegular(files.root, filename)
	if err != nil {
		return err
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return err
	}
	files.hashes[filename] = hex.EncodeToString(digest.Sum(nil))
	return nil
}

func (files packageFiles) read(filename string) ([]byte, error) {
	file, err := openRegular(files.root, filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	files.hashes[filename] = hex.EncodeToString(digest[:])
	return data, nil
}

func openRegular(root *os.Root, filename string) (*os.File, error) {
	info, err := root.Stat(filename)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("%s: expected a regular file", filename)
	}
	return root.Open(filename)
}
