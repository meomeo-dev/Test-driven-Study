package main

import (
	"context"
	"errors"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/study"
)

type palacePlanner struct {
	service *llm.Service
	root    string
	study   *study.Service
}

func (p palacePlanner) Prepare(input palace.PlanningParameters) (palace.PlanningParameters, error) {
	value, err := p.service.Prepare(llm.Parameters{Model: input.Model, ReasoningEffort: input.ReasoningEffort, MaxOutputTokensK: input.MaxOutputTokensK, ContextBudgetK: input.ContextBudgetK, CompactThresholdK: input.CompactThresholdK, CompactReserveK: input.CompactReserveK, WebSearch: input.WebSearch})
	return palace.PlanningParameters{Model: value.Model, ReasoningEffort: value.ReasoningEffort, MaxOutputTokensK: value.MaxOutputTokensK, ContextBudgetK: value.ContextBudgetK, CompactThresholdK: value.CompactThresholdK, CompactReserveK: value.CompactReserveK, WebSearch: value.WebSearch}, err
}
func (p palacePlanner) Generate(ctx context.Context, input palace.PlanningInput) (palace.PlanningResult, error) {
	images, err := p.images(ctx, input)
	if err != nil {
		return palace.PlanningResult{}, &palace.Failure{Code: "reference_error", Message: "原题配图无法输入 LLM，未提交生图请求"}
	}
	control := func(ctx context.Context) error {
		if input.Checkpoint == nil {
			return nil
		}
		err := input.Checkpoint(ctx)
		if errors.Is(err, palace.ErrPaused) {
			return llm.ErrPaused
		}
		return err
	}
	value, err := p.service.RunControlledPipeline(ctx, llm.PlanInput{ID: input.ID, QuestionID: input.QuestionID,
		PalaceAddress: input.PalaceAddress, Parameters: llm.Parameters{Model: input.Parameters.Model,
			ReasoningEffort: input.Parameters.ReasoningEffort, MaxOutputTokensK: input.Parameters.MaxOutputTokensK, ContextBudgetK: input.Parameters.ContextBudgetK, CompactThresholdK: input.Parameters.CompactThresholdK, CompactReserveK: input.Parameters.CompactReserveK, WebSearch: input.Parameters.WebSearch}},
		llm.PlanSource{Prompt: input.SourcePrompt, ProfileVersion: input.ProfileVersion},
		control, images...)
	if err != nil {
		if errors.Is(err, llm.ErrPaused) {
			return palace.PlanningResult{}, palace.ErrPaused
		}
		var failure *llm.Failure
		if errors.As(err, &failure) {
			return palace.PlanningResult{}, &palace.Failure{Code: "llm_" + failure.Code, Message: failure.Message + "；未提交生图请求"}
		}
		return palace.PlanningResult{}, &palace.Failure{Code: "planning_failed", Message: "LLM 构思未完成；未提交生图请求"}
	}
	if value.Status != "succeeded" || value.Plan == nil {
		return palace.PlanningResult{}, &palace.Failure{Code: "invalid_plan", Message: "构思未完成，未提交生图请求"}
	}
	return palace.PlanningResult{ID: value.ID, ImagePrompt: value.Plan.ImagePrompt,
		Usage: palace.Usage{InputTokens: value.Usage.InputTokens, OutputTokens: value.Usage.OutputTokens, TotalTokens: value.Usage.TotalTokens}}, nil
}

func (p palacePlanner) images(ctx context.Context, input palace.PlanningInput) ([]llm.InputImage, error) {
	if p.study == nil || input.Question.PackageID == "" {
		return llm.LoadQuestionImages(p.root, input.ImageURL)
	}
	if input.ImageURL == "" {
		return nil, nil
	}
	data, err := p.study.ReadQuestionImage(ctx, input.Question)
	if err != nil {
		return nil, err
	}
	return llm.DecodeQuestionImages(data)
}
