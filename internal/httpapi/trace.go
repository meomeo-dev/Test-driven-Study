package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"test-driven-study/internal/palace"
)

func traceCursor(r *http.Request) (int64, error) {
	value := r.URL.Query().Get("after")
	if value == "" {
		value = "0"
	}
	if r.Header.Get("Last-Event-ID") != "" {
		value = r.Header.Get("Last-Event-ID")
	}
	after, err := strconv.ParseInt(value, 10, 64)
	if err != nil || after < 0 {
		return 0, palace.ErrInvalid
	}
	return after, nil
}

func (s *Server) traceSnapshot(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	after, err := traceCursor(r)
	if err != nil {
		palaceError(w, err)
		return
	}
	page, err := s.palaces.Trace(r.Context(), r.PathValue("job"), after)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, page)
}

func (s *Server) traceStream(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	after, err := traceCursor(r)
	if err != nil {
		palaceError(w, err)
		return
	}
	if _, err = s.palaces.Get(r.Context(), r.PathValue("job")); err != nil {
		palaceError(w, err)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		problem(w, 500, "当前连接不支持事件流")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	controller := http.NewResponseController(w)
	controller.SetWriteDeadline(time.Now().Add(20 * time.Second))
	if _, err = fmt.Fprint(w, "retry: 1500\n\n"); err != nil {
		return
	}
	flusher.Flush()
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	quiet := 0
	for {
		page, err := s.palaces.Trace(r.Context(), r.PathValue("job"), after)
		if err != nil {
			return
		}
		controller.SetWriteDeadline(time.Now().Add(20 * time.Second))
		for _, event := range page.Events {
			data, _ := json.Marshal(event)
			if _, err = fmt.Fprintf(w, "id: %d\nevent: trace\ndata: %s\n\n", event.ID, data); err != nil {
				return
			}
		}
		after = page.Cursor
		if page.HasMore {
			flusher.Flush()
			continue
		}
		live := page.Status == "queued" || page.Status == "running" || page.Status == "pausing"
		if live || len(page.Events) > 0 {
			quiet = 0
		} else {
			quiet++
		}
		if quiet >= 2 {
			fmt.Fprint(w, "event: settled\ndata: {}\n\n")
			flusher.Flush()
			return
		}
		if _, err = fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
			return
		}
		flusher.Flush()
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}
