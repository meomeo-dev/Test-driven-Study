package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"test-driven-study/internal/course"
	"test-driven-study/internal/tasktrace"
)

const maxGeneralCourseRounds = 8

type planningSession struct {
	provider       *HTTPProvider
	params         Parameters
	prompts        course.PalacePrompts
	history        []json.RawMessage
	original       json.RawMessage
	progress       SessionProgress
	observe        progressObserver
	previous       [32]byte
	unchanged      int
	lastPlan       Plan
	researchStalls int
	seenReads      map[string]struct{}
	hooks          *sessionHooks
	useShapeOnly   bool
}

type progressObserver func(SessionProgress) error

func (p *HTTPProvider) GenerateSession(ctx context.Context, params Parameters, source string, images []InputImage, observe progressObserver) (Plan, Usage, error) {
	return p.generateSession(ctx, params, source, images, observe, nil, course.PalacePrompts{})
}

func (p *HTTPProvider) generateSession(ctx context.Context, params Parameters, source string,
	images []InputImage, observe progressObserver, hooks *sessionHooks,
	prompts course.PalacePrompts) (Plan, Usage, error) {
	params, err := normalizePolicy(params)
	if err != nil {
		return Plan{}, Usage{}, err
	}
	history := initialWindow(source, images)
	s := planningSession{provider: p, params: params, history: history, original: history[0], observe: observe,
		prompts:  prompts.WithDefaults(),
		progress: SessionProgress{Phase: "planning", Sources: []Source{}, GeneralCourse: generalCourse(ctx)}, hooks: hooks}
	if params.WebSearch == "required" {
		s.progress.Phase = "research"
		s.progress.SearchProtocol = "web_search"
	}
	if hooks != nil && hooks.restore != nil {
		if err := hooks.restore(&s); err != nil {
			return Plan{}, Usage{}, err
		}
	}
	for ctx.Err() == nil {
		if s.progress.GeneralCourse && s.progress.Rounds >= maxGeneralCourseRounds {
			return s.lastPlan, s.progress.Usage, &Failure{Code: "planning_round_limit",
				Message: fmt.Sprintf("构思与检索已达 %d 轮，仍未得到可提交的构思，已停止；未提交生图请求",
					maxGeneralCourseRounds)}
		}
		if err := s.checkpoint(ctx, "ready"); err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		if err := s.publish(); err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		if err := s.checkpoint(ctx, "inflight"); err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		body, err := s.prepareRequest(ctx)
		if err != nil {
			if s.useCompatibleSchema(ctx, err) {
				continue
			}
			return s.lastPlan, s.progress.Usage, err
		}
		if err := s.checkpoint(ctx, "ready"); err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		if err := s.checkpoint(ctx, "inflight"); err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		data, err := p.postJSON(ctx, "/responses", body)
		if err != nil {
			if s.useCompatibleSchema(ctx, err) {
				continue
			}
			return s.lastPlan, s.progress.Usage, err
		}
		response, err := s.receive(data)
		if err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
		done, err := s.assess(ctx, data, response)
		if done || err != nil {
			return s.lastPlan, s.progress.Usage, err
		}
	}
	return s.lastPlan, s.progress.Usage, ctx.Err()
}

func (s *planningSession) useCompatibleSchema(ctx context.Context, err error) bool {
	var failure *Failure
	if s.useShapeOnly || needsResearch(s.params, s.progress) ||
		!errors.As(err, &failure) || failure.Code != "unsupported_schema_constraints" {
		return false
	}
	s.useShapeOnly = true
	tasktrace.Note(ctx, "scheduler", "端点不支持结构化长度约束",
		"本次构思使用提示词中的长度要求，并在返回后校验字段。")
	return true
}

func (s *planningSession) publish() error {
	if s.observe != nil {
		return s.observe(s.progress)
	}
	return nil
}

func reviewRound(data []byte, response responseEnvelope, params Parameters, progress SessionProgress) (Plan, error, bool) {
	if params.WebSearch == "required" && response.Status == "completed" &&
		!hasRetrieval(progress) {
		return Plan{}, &Failure{Code: "search_not_executed",
			Message: "当前供应商没有返回已执行的内置搜索，未提交生图请求"}, true
	}
	plan, _, parseErr := parseResponse(data)
	if parseErr == nil {
		researchErr := validateResearch(plan, params.WebSearch == "required", progress)
		if researchErr == nil {
			return plan, nil, true
		}
		var invalid *Failure
		if errors.As(researchErr, &invalid) && (invalid.Code == "invalid_research" ||
			invalid.Code == "unverified_source" || invalid.Code == "insufficient_evidence") {
			parseErr = researchErr
		} else {
			return plan, researchErr, true
		}
	}
	var failure *Failure
	if errors.As(parseErr, &failure) && (failure.Code == "refused" || failure.Code == "provider_error" || failure.Code == "invalid_response") {
		return Plan{}, parseErr, true
	}
	if response.Status != "completed" && !(response.Status == "incomplete" && response.Incomplete.Reason == "max_output_tokens") {
		return Plan{}, parseErr, true
	}
	if len(response.Output) == 0 {
		return Plan{}, &Failure{Code: "missing_state", Message: "LLM 未返回可继续使用的会话状态"}, true
	}
	return plan, parseErr, false
}
