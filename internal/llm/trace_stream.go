package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"test-driven-study/internal/tasktrace"
)

type observedPart struct {
	span       *tasktrace.Span
	pending    strings.Builder
	received   strings.Builder
	textSeen   bool
	done       bool
	lastFlush  time.Time
	characters int
}

type streamTrace struct {
	ctx     context.Context
	parts   map[string]*observedPart
	results map[string]bool
}
type traceItem struct {
	ID, Type, Name, Status string
	Action                 json.RawMessage               `json:"action"`
	Content                []traceContent                `json:"content"`
	Summary                []struct{ Type, Text string } `json:"summary"`
}
type traceCitation struct{ Type, URL, Title string }
type traceContent struct {
	Type, Text  string
	Annotations []traceCitation `json:"annotations"`
}
type traceWireEvent struct {
	Type         string        `json:"type"`
	ItemID       string        `json:"item_id"`
	OutputIndex  int           `json:"output_index"`
	ContentIndex int           `json:"content_index"`
	SummaryIndex int           `json:"summary_index"`
	Delta        string        `json:"delta"`
	Text         string        `json:"text"`
	Item         traceItem     `json:"item"`
	Annotation   traceCitation `json:"annotation"`
}

func newStreamTrace(ctx context.Context) *streamTrace {
	return &streamTrace{ctx: ctx, parts: map[string]*observedPart{}, results: map[string]bool{}}
}
func (t *streamTrace) part(key, kind, label string) *observedPart {
	if value := t.parts[key]; value != nil {
		return value
	}
	if len(t.parts) >= 1024 {
		return &observedPart{done: true}
	}
	_, span := tasktrace.Begin(t.ctx, kind, label)
	value := &observedPart{span: span, lastFlush: time.Now()}
	t.parts[key] = value
	return value
}
func (p *observedPart) flush(origin string) {
	if p.pending.Len() == 0 {
		return
	}
	p.span.Text(p.pending.String(), origin)
	p.pending.Reset()
	p.lastFlush = time.Now()
}
func (p *observedPart) append(text, origin string) {
	if p.done || text == "" {
		return
	}
	remaining := tasktrace.MaxSpanText - p.characters
	if remaining <= 0 {
		return
	}
	runes := []rune(text)
	if len(runes) > remaining {
		runes = runes[:remaining]
	}
	text = string(runes)
	p.characters += len(runes)
	p.textSeen = true
	p.received.WriteString(text)
	p.pending.WriteString(text)
	if p.pending.Len() >= 512 || time.Since(p.lastFlush) >= 150*time.Millisecond {
		p.flush(origin)
	}
}
func (p *observedPart) end(status, detail, origin string) {
	if p.done {
		return
	}
	p.flush(origin)
	p.span.End(status, detail)
	p.done = true
}

func (t *streamTrace) observe(data []byte) {
	var e traceWireEvent
	if json.Unmarshal(data, &e) != nil {
		return
	}
	id := e.ItemID
	if id == "" {
		id = e.Item.ID
	}
	if id == "" {
		id = strconv.Itoa(e.OutputIndex)
	}
	switch e.Type {
	case "response.output_text.annotation.added":
		t.citation(e.Annotation)
	case "response.output_text.delta", "response.output_text.done":
		t.textEvent("answer:"+id+":"+strconv.Itoa(e.ContentIndex), "answer", "回答输出", e)
	case "response.reasoning_summary_text.delta", "response.reasoning_summary_text.done":
		t.textEvent("summary:"+id+":"+strconv.Itoa(e.SummaryIndex), "reasoning", "公开思考摘要", e)
	case "response.web_search_call.in_progress", "response.web_search_call.searching":
		t.part("tool:"+id, "tool", "内置联网搜索")
	case "response.web_search_call.completed":
		detail := "内置搜索已返回完成事件"
		if t.parts["tool:"+id] == nil {
			detail = "仅收到完成事件；未测得独立执行区间"
		}
		t.part("tool:"+id, "tool", "内置联网搜索").end("completed", detail, "stream")
	case "response.function_call_arguments.done":
		t.part("arguments:"+id, "arguments", "准备函数调用参数").end("completed", "参数已就绪；不代表工具已执行", "stream")
	case "response.output_item.added":
		if e.Item.Type == "web_search_call" {
			t.part("tool:"+id, "tool", "内置联网搜索")
		}
		if e.Item.Type == "function_call" {
			t.part("arguments:"+id, "arguments", "准备函数调用参数")
		}
	case "response.output_item.done":
		t.item(id, e.Item, "stream")
	}
}

func (t *streamTrace) textEvent(key, kind, label string, e traceWireEvent) {
	part := t.part(key, kind, label)
	if strings.HasSuffix(e.Type, ".delta") {
		part.append(e.Delta, "stream")
		return
	}
	part.reconcile(e.Text, "stream")
	part.end("completed", "", "stream")
}

func (t *streamTrace) item(id string, item traceItem, origin string) {
	switch item.Type {
	case "message":
		for i, content := range item.Content {
			if content.Type != "output_text" {
				continue
			}
			p := t.part("answer:"+id+":"+strconv.Itoa(i), "answer", "回答输出")
			p.reconcile(content.Text, origin)
			p.end("completed", batchDetail(origin), origin)
			for _, citation := range content.Annotations {
				t.citation(citation)
			}
		}
	case "reasoning":
		// Only the explicitly public summary is observable. Encrypted/private
		// reasoning fields and raw response envelopes never enter the trace.
		for i, content := range item.Summary {
			if content.Type != "summary_text" {
				continue
			}
			p := t.part("summary:"+id+":"+strconv.Itoa(i), "reasoning", "公开思考摘要")
			p.reconcile(content.Text, origin)
			p.end("completed", batchDetail(origin), origin)
		}
	case "web_search_call":
		detail := batchDetail(origin)
		if origin == "stream" && t.parts["tool:"+id] == nil {
			detail = "仅收到完成结果；未测得独立执行区间"
		}
		p := t.part("tool:"+id, "tool", "内置联网搜索")
		if !p.done {
			p.end(toolOutcome(item.Status), detail, origin)
		}
		if detail := toolDescription(item.Action, generalCourse(t.ctx)); detail != "" && !t.results[id] && len(t.results) < 1024 {
			tasktrace.Note(t.ctx, "source", "检索返回的信息", detail)
			t.results[id] = true
		}
	case "function_call":
		t.part("arguments:"+id, "arguments", "准备函数调用参数").end("completed", "仅参数生成；未执行应用工具", origin)
	}
}

func (p *observedPart) reconcile(text, origin string) {
	if !p.textSeen {
		p.append(text, origin)
		return
	}
	// Some compatible endpoints omit trailing deltas and put the remaining
	// visible text only in the completed item. Append only a verified suffix.
	if !p.done && strings.HasPrefix(text, p.received.String()) {
		p.append(text[p.received.Len():], origin)
	}
}

func toolDescription(raw json.RawMessage, general bool) string {
	var action struct {
		Type, URL, Pattern string
		Queries            []string
		Sources            []Source
	}
	if json.Unmarshal(raw, &action) != nil {
		return ""
	}
	var lines []string
	switch action.Type {
	case "search":
		lines = append(lines, "动作：联网检索")
	case "open_page":
		if general {
			lines = append(lines, "动作：打开网页")
		} else {
			lines = append(lines, "动作：打开官方网页")
		}
	case "find_in_page":
		lines = append(lines, "动作：页内查找")
	default:
		return ""
	}
	for _, query := range action.Queries[:min(len(action.Queries), 5)] {
		lines = append(lines, "查询："+query)
	}
	if url := courseSourceURL(action.URL, general); url != "" {
		lines = append(lines, url)
	}
	if action.Type == "find_in_page" && action.Pattern != "" {
		lines = append(lines, "查找："+action.Pattern)
	}
	for _, source := range action.Sources[:min(len(action.Sources), 12)] {
		if url := courseSourceURL(source.URL, general); url != "" {
			lines = append(lines, source.Title+"\n"+url)
		}
	}
	return strings.Join(lines, "\n")
}

func (t *streamTrace) citation(citation traceCitation) {
	if citation.Type != "url_citation" {
		return
	}
	url := courseSourceURL(citation.URL, generalCourse(t.ctx))
	key := "citation:" + url
	if url == "" || t.results[key] || len(t.results) >= 1024 {
		return
	}
	tasktrace.Note(t.ctx, "source", "回答引用", citation.Title+"\n"+url)
	t.results[key] = true
}
func batchDetail(origin string) string {
	if origin == "response" {
		return "整轮返回；未测得此项独立执行区间"
	}
	return ""
}
func toolOutcome(status string) string {
	if status == "completed" {
		return "completed"
	}
	if status == "failed" {
		return "failed"
	}
	return "incomplete"
}
func (t *streamTrace) final(data []byte, origin string) {
	var response struct {
		Output []traceItem `json:"output"`
	}
	if json.Unmarshal(data, &response) != nil {
		return
	}
	for i, item := range response.Output {
		id := item.ID
		if id == "" {
			id = fmt.Sprint(i)
		}
		t.item(id, item, origin)
	}
}
func (t *streamTrace) close(status string) {
	for _, p := range t.parts {
		p.end(status, "响应已结束", "stream")
	}
}
