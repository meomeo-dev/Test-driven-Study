package llm

import (
	"context"
	"errors"

	"test-driven-study/internal/tasktrace"
)

const maxStalledResearchRounds = 3

func (s *planningSession) assess(ctx context.Context, data []byte,
	response responseEnvelope) (bool, error) {
	plan, err, terminal := reviewRound(data, response, s.params, s.progress)
	if validPlan(plan) {
		s.lastPlan = plan
	}
	if err == nil {
		s.progress.EvidenceGap = ""
		s.progress.Phase = "completed"
		return true, s.publish()
	}
	if terminal {
		return true, err
	}
	var failure *Failure
	correction := ""
	if errors.As(err, &failure) && (failure.Code == "insufficient_evidence" ||
		failure.Code == "unverified_source") {
		s.reopenResearch(plan, failure)
		tasktrace.Note(ctx, "scheduler", "补充权威证据", s.progress.EvidenceGap)
		if err := s.publish(); err != nil {
			return true, err
		}
	} else if failure != nil && s.progress.Phase != "research" {
		correction = failure.Message
		tasktrace.Note(ctx, "scheduler", "构思需要修正", correction)
	}
	if needsResearch(s.params, s.progress) &&
		s.researchStalls >= maxStalledResearchRounds {
		return true, &Failure{Code: "no_research_progress",
			Message: "补充研究连续 3 轮未取得新的可核对来源或网页读取进展，已停止；未提交生图请求"}
	}
	return false, s.continueRound(ctx, response, correction)
}

func (s *planningSession) reopenResearch(plan Plan, failure *Failure) {
	gap := failure.Message
	if plan.Research != nil && validText(plan.Research.Explanation, planResearchExplanationLimit) {
		gap += "\n" + plan.Research.Explanation
	}
	if len([]rune(gap)) > 2400 {
		gap = string([]rune(gap)[:2400])
	}
	// An insufficiency assessment is a request for new evidence, not a failed job.
	// The gap remains independent of history so compaction cannot lose it.
	s.progress.EvidenceGap = gap
}

func (s *planningSession) newEvidence(activity retrievalActivity) bool {
	before := len(s.progress.Sources)
	s.progress.Sources = mergeCourseSources(s.progress.Sources, s.progress.GeneralCourse, activity.Sources...)
	changed := len(s.progress.Sources) > before
	if s.seenReads == nil {
		s.seenReads = map[string]struct{}{}
	}
	for _, key := range activity.ReadKeys {
		if _, known := s.seenReads[key]; !known && len(s.seenReads) < 1024 {
			s.seenReads[key] = struct{}{}
			changed = true
		}
	}
	return changed
}
