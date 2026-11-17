package llm

import "context"

type generalCourseKey struct{}

func (s *Service) questionContext(ctx context.Context, id int64) context.Context {
	if s.generalQuestion != nil && s.generalQuestion(ctx, id) {
		return context.WithValue(ctx, generalCourseKey{}, true)
	}
	return ctx
}

func generalCourse(ctx context.Context) bool {
	return ctx.Value(generalCourseKey{}) == true
}

func webSearchTool(general bool) map[string]any {
	tool := map[string]any{"type": "web_search"}
	if !general {
		tool["filters"] = map[string]any{"allowed_domains": []string{"gov.cn"}}
	}
	return tool
}
