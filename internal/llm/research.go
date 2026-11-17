package llm

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
)

func courseSourceURL(raw string, general bool) string {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") || len(raw) > 2048 {
		return ""
	}
	host := strings.ToLower(u.Hostname())
	if host == "" || (!general && host != "gov.cn" && !strings.HasSuffix(host, ".gov.cn")) {
		return ""
	}
	u.Fragment = ""
	query := u.Query()
	for name := range query {
		if strings.HasPrefix(strings.ToLower(name), "utm_") {
			query.Del(name)
		}
	}
	u.RawQuery = query.Encode()
	u.Host = strings.ToLower(u.Host)
	return u.String()
}
func mergeSources(current []Source, more ...Source) []Source {
	return mergeCourseSources(current, false, more...)
}

func mergeCourseSources(current []Source, general bool, more ...Source) []Source {
	for _, item := range more {
		item.URL = courseSourceURL(item.URL, general)
		if len([]rune(item.Title)) > 300 {
			item.Title = string([]rune(item.Title)[:300])
		}
		if item.URL == "" {
			continue
		}
		index := slices.IndexFunc(current, func(s Source) bool { return s.URL == item.URL })
		if index >= 0 {
			if current[index].Title == "" && item.Title != "" {
				current[index].Title = item.Title
			}
			continue
		}
		if len(current) >= 100 {
			break
		}
		current = append(current, item)
	}
	return current
}
func validateResearch(plan Plan, required bool, progress SessionProgress) error {
	research := plan.Research
	if research == nil {
		return &Failure{Code: "invalid_research", Message: "构思结果缺少研究结论"}
	}
	if issue := planTextViolation("research.explanation", research.Explanation,
		planResearchExplanationLimit); issue != "" {
		return &Failure{Code: "invalid_research", Message: issue}
	}
	if research.Sources == nil || len(research.Sources) > planResearchSourceLimit {
		return &Failure{Code: "invalid_research", Message: fmt.Sprintf(
			"research.sources 必须是最多 %d 项的数组", planResearchSourceLimit)}
	}
	if !required {
		if research.Status != "not_requested" || len(research.Sources) != 0 {
			return &Failure{Code: "unverified_research", Message: "未启用搜索，不接受声称已联网核验的结果"}
		}
		return nil
	}
	if !hasRetrieval(progress) {
		return &Failure{Code: "search_not_executed", Message: "模型未返回实际检索或网页读取，未提交生图请求"}
	}
	if research.Status == "conflict" {
		return &Failure{Code: "answer_conflict", Message: "权威资料与题库答案存在冲突，流水线已停止"}
	}
	if research.Status != "supported" || len(research.Sources) == 0 || len(progress.Sources) == 0 {
		return &Failure{Code: "insufficient_evidence", Message: "权威证据仍不足，需要继续检索与核对原文"}
	}
	for _, source := range research.Sources {
		normalized := courseSourceURL(source.URL, progress.GeneralCourse)
		if normalized == "" ||
			!slices.ContainsFunc(progress.Sources, func(s Source) bool { return s.URL == normalized }) {
			return &Failure{Code: "unverified_source", Message: "引用来源无法从实际检索记录核对，需要补充证据"}
		}
		if issue := planTextViolation("research.sources[].title", source.Title,
			planSourceTitleLimit); issue != "" {
			return &Failure{Code: "invalid_research", Message: issue}
		}
		if issue := planTextViolation("research.sources[].claim", source.Claim,
			planSourceClaimLimit); issue != "" {
			return &Failure{Code: "invalid_research", Message: issue}
		}
	}
	return nil
}
