package course

import "test-driven-study/courses"

var starterPalaceRef = AIProfileRef{
	PalaceTemplate:             "profiles/memory-palace.json",
	PalacePlanningInstructions: "profiles/palace-planning.txt",
	PalaceResearchInstructions: "profiles/palace-research.txt",
}

var starterPalace = bundledPalaceProfile("starter", starterPalaceRef)

func bundledPalaceProfile(directory string, ref AIProfileRef) AIProfile {
	profile, err := LoadAIProfile(&ref, func(name string) ([]byte, error) {
		return courses.PromptFiles.ReadFile(directory + "/" + name)
	})
	if err != nil {
		panic(err)
	}
	return profile
}

func DefaultPalaceTemplate() PalaceTemplate {
	return *starterPalace.Palace
}

func (prompts PalacePrompts) WithDefaults() PalacePrompts {
	fallback := starterPalace.Prompts
	if prompts.Planning == "" {
		prompts.Planning = fallback.Planning
	}
	if prompts.Research == "" {
		prompts.Research = fallback.Research
	}
	return prompts
}

func writeStarterPalace(directory string) error {
	for _, name := range []string{starterPalaceRef.PalaceTemplate,
		starterPalaceRef.PalacePlanningInstructions, starterPalaceRef.PalaceResearchInstructions,
		"profiles/PROMPT-AUTHORING.md"} {
		data, err := courses.PromptFiles.ReadFile("starter/" + name)
		if err != nil {
			return err
		}
		if err := writeContent(directory, name, data); err != nil {
			return err
		}
	}
	return nil
}
