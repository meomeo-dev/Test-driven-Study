package llm

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

const (
	planTitleLimit               = 120
	planSceneLimit               = 1600
	planImagePromptLimit         = 4000
	planAnchorLimit              = 8
	planAnchorCueLimit           = 240
	planAnchorMeaningLimit       = 400
	planPitfallLimit             = 8
	planPitfallTextLimit         = 400
	planResearchExplanationLimit = 2400
	planResearchSourceLimit      = 12
	planSourceTitleLimit         = 300
	planSourceClaimLimit         = 1600
)

func planLengthInstructions() string {
	return fmt.Sprintf(`
Use these character limits for the JSON fields: title %d, scene %d, image_prompt %d,
research.explanation %d. Include 1–%d anchors (cue up to %d, meaning up to %d)
and 0–%d pitfalls (up to %d characters each). Include at most %d research sources
(title up to %d, claim up to %d). Use short entries and omit redundant details.
`, planTitleLimit, planSceneLimit, planImagePromptLimit, planResearchExplanationLimit,
		planAnchorLimit, planAnchorCueLimit, planAnchorMeaningLimit, planPitfallLimit,
		planPitfallTextLimit, planResearchSourceLimit, planSourceTitleLimit, planSourceClaimLimit)
}

func validPlan(plan Plan) bool {
	return planViolation(plan) == ""
}

func planViolation(plan Plan) string {
	fields := []struct {
		name, value string
		limit       int
	}{
		{"title", plan.Title, planTitleLimit},
		{"scene", plan.Scene, planSceneLimit},
		{"image_prompt", plan.ImagePrompt, planImagePromptLimit},
	}
	for _, field := range fields {
		if issue := planTextViolation(field.name, field.value, field.limit); issue != "" {
			return issue
		}
	}
	if len(plan.Anchors) < 1 || len(plan.Anchors) > planAnchorLimit {
		return fmt.Sprintf("anchors 有 %d 项，要求 1–%d 项", len(plan.Anchors), planAnchorLimit)
	}
	if plan.Pitfalls == nil {
		return fmt.Sprintf("pitfalls 必须是 0–%d 项的数组", planPitfallLimit)
	}
	if len(plan.Pitfalls) > planPitfallLimit {
		return fmt.Sprintf("pitfalls 有 %d 项，上限 %d 项", len(plan.Pitfalls), planPitfallLimit)
	}
	for _, anchor := range plan.Anchors {
		if issue := planTextViolation("anchors[].cue", anchor.Cue, planAnchorCueLimit); issue != "" {
			return issue
		}
		if issue := planTextViolation("anchors[].meaning", anchor.Meaning, planAnchorMeaningLimit); issue != "" {
			return issue
		}
	}
	for _, pitfall := range plan.Pitfalls {
		if issue := planTextViolation("pitfalls[]", pitfall, planPitfallTextLimit); issue != "" {
			return issue
		}
	}
	return ""
}

func planTextViolation(field, value string, limit int) string {
	if count := utf8.RuneCountInString(value); count > limit {
		return fmt.Sprintf("%s 有 %d 个字符，上限 %d 个", field, count, limit)
	}
	if strings.TrimSpace(value) == "" || strings.ContainsRune(value, 0) {
		return fmt.Sprintf("%s 必须是非空且不含空字符的文本", field)
	}
	return ""
}
