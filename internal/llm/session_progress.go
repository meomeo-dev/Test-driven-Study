package llm

import (
	"context"
	"crypto/sha256"
	"encoding/json"
)

func (s *planningSession) receive(data []byte) (responseEnvelope, error) {
	searching := needsResearch(s.params, s.progress)
	var response responseEnvelope
	if json.Unmarshal(data, &response) != nil {
		return response, &Failure{Code: "invalid_response",
			Message: "LLM 未返回有效的 Responses 响应"}
	}
	s.progress.Rounds++
	s.progress.Usage = addUsage(s.progress.Usage, response.Usage)
	s.progress.ContextTokens = response.Usage.InputTokens + response.Usage.OutputTokens
	activity := inspectCourseOutput(response.Output, s.progress.GeneralCourse)
	s.progress.Searches += activity.Searches
	s.progress.PageOpens += activity.Opens
	s.progress.PageFinds += activity.Finds
	s.progress.Compactions += activity.Compactions
	changed := s.newEvidence(activity)
	if searching {
		s.progress.ResearchRounds++
		if changed {
			s.researchStalls = 0
		} else {
			s.researchStalls++
		}
		if activity.Searches+activity.Opens+activity.Finds > 0 {
			s.progress.EvidenceGap = ""
		}
	}
	if err := s.publish(); err != nil {
		return response, err
	}
	if searching && response.Status == "completed" &&
		activity.Searches+activity.Opens+activity.Finds == 0 {
		return response, &Failure{Code: "search_not_executed",
			Message: "本轮研究未返回实际检索或网页读取，未提交生图请求"}
	}
	return response, nil
}

func (s *planningSession) compactWindow(ctx context.Context) error {
	s.progress.Phase = "compacting"
	if err := s.publish(); err != nil {
		return err
	}
	window, usage, method, err := s.provider.compact(ctx, s.params,
		s.history, s.original)
	s.progress.Usage = addUsage(s.progress.Usage, usage)
	if err != nil {
		return err
	}
	s.history = window
	s.progress.Compactions++
	s.progress.CompactionMethod = method
	return nil
}

func (s *planningSession) continueRound(ctx context.Context,
	response responseEnvelope, correction string) error {
	searching := needsResearch(s.params, s.progress)
	fingerprint := sha256.Sum256(rawValue(response.Output))
	if fingerprint == s.previous {
		s.unchanged++
	} else {
		s.unchanged = 0
	}
	s.previous = fingerprint
	if s.unchanged >= 2 && !searching {
		return &Failure{Code: "no_progress", Message: "连续构思没有产生进展，已停止重复请求"}
	}
	s.history = append(s.history, response.Output...)
	if response.Status == "incomplete" ||
		s.progress.ContextTokens >= int64(compactThreshold(s.params, searching)) {
		if err := s.compactWindow(ctx); err != nil {
			return err
		}
	}
	// Each continuation returns a complete replacement object. Joining truncated
	// JSON fragments could silently produce a scene different from the plan.
	note := "Continue the existing research and reasoning. Return one complete replacement JSON scene plan matching the required schema, not partial JSON fragments. Preserve the original question, images and actual source evidence."
	s.progress.Phase = "continuing"
	if searching {
		note = "Follow the research instructions to investigate the unresolved evidence gap. " +
			"Return updated notes with citations to the sources actually retrieved."
		s.progress.Phase = "research"
	} else if correction != "" {
		note += "\nCorrect the previous output: " + correction
	}
	s.history = append(s.history, rawValue(map[string]any{"role": "user",
		"content": []map[string]string{{"type": "input_text", "text": note}}}))
	return nil
}
