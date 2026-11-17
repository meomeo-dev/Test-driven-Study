package llm

import (
	"encoding/json"
	"fmt"
)

func boundPlanSchema(shape json.RawMessage) json.RawMessage {
	var schema map[string]any
	if err := json.Unmarshal(shape, &schema); err != nil {
		panic(err)
	}
	fields := schema["properties"].(map[string]any)
	addTextBound(fields["title"], planTitleLimit)
	addTextBound(fields["scene"], planSceneLimit)
	addTextBound(fields["image_prompt"], planImagePromptLimit)

	anchors := fields["anchors"].(map[string]any)
	anchors["minItems"], anchors["maxItems"] = 1, planAnchorLimit
	anchor := anchors["items"].(map[string]any)["properties"].(map[string]any)
	addTextBound(anchor["cue"], planAnchorCueLimit)
	addTextBound(anchor["meaning"], planAnchorMeaningLimit)

	pitfalls := fields["pitfalls"].(map[string]any)
	pitfalls["maxItems"] = planPitfallLimit
	addTextBound(pitfalls["items"], planPitfallTextLimit)

	research := fields["research"].(map[string]any)["properties"].(map[string]any)
	addTextBound(research["explanation"], planResearchExplanationLimit)
	sources := research["sources"].(map[string]any)
	sources["maxItems"] = planResearchSourceLimit
	source := sources["items"].(map[string]any)["properties"].(map[string]any)
	addTextBound(source["title"], planSourceTitleLimit)
	addTextBound(source["claim"], planSourceClaimLimit)

	bounded, err := json.Marshal(schema)
	if err != nil {
		panic(err)
	}
	return bounded
}

func addTextBound(node any, limit int) {
	node.(map[string]any)["pattern"] = fmt.Sprintf(`^[\s\S]{1,%d}$`, limit)
}
