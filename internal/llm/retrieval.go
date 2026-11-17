package llm

import (
	"encoding/json"
	"strings"
)

type retrievalActivity struct {
	Searches, Opens, Finds, Compactions int
	Sources                             []Source
	ReadKeys                            []string
}

type retrievalOutput struct {
	Type, Status string
	Action       struct {
		Type, URL, Pattern string
		Sources            []Source
	}
	Content []struct {
		Annotations []struct{ Type, URL, Title string }
	}
}

func hasRetrieval(progress SessionProgress) bool {
	return progress.Searches+progress.PageOpens+progress.PageFinds > 0
}

func inspectOutput(output []json.RawMessage) retrievalActivity {
	return inspectCourseOutput(output, false)
}

func inspectCourseOutput(output []json.RawMessage, general bool) retrievalActivity {
	var activity retrievalActivity
	for _, raw := range output {
		var item retrievalOutput
		if json.Unmarshal(raw, &item) != nil {
			continue
		}
		if item.Type == "compaction" {
			activity.Compactions++
		}
		if item.Type == "web_search_call" && item.Status == "completed" {
			activity.observe(item, general)
		}
		for _, content := range item.Content {
			for _, annotation := range content.Annotations {
				if annotation.Type == "url_citation" {
					activity.Sources = mergeCourseSources(activity.Sources, general,
						Source{URL: annotation.URL, Title: annotation.Title})
				}
			}
		}
	}
	return activity
}

func (a *retrievalActivity) observe(item retrievalOutput, general bool) {
	a.Sources = mergeCourseSources(a.Sources, general, item.Action.Sources...)
	switch item.Action.Type {
	case "search":
		a.Searches++
	case "open_page":
		a.Opens++
	case "find_in_page":
		a.Finds++
	default:
		return
	}
	if item.Action.Type == "search" {
		return
	}
	url := courseSourceURL(item.Action.URL, general)
	if url == "" {
		return
	}
	a.Sources = mergeCourseSources(a.Sources, general, Source{URL: url})
	pattern := strings.ToLower(strings.Join(strings.Fields(item.Action.Pattern), " "))
	if len(pattern) <= 2000 {
		a.ReadKeys = append(a.ReadKeys, item.Action.Type+"\n"+url+"\n"+pattern)
	}
}
