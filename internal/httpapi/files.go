package httpapi

import (
	"bytes"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"test-driven-study/internal/course"
)

func (s *Server) courseAsset(w http.ResponseWriter, r *http.Request) {
	filename := "assets/" + r.PathValue("asset")
	data, err := s.study.CourseAsset(r.Context(), r.PathValue("course"),
		r.PathValue("version"), filename)
	if err != nil {
		respondError(w, err)
		return
	}
	contentType := mime.TypeByExtension(filepath.Ext(filename))
	if course.IsAudioPath(filename) {
		contentType = "audio/mpeg"
	}
	if course.IsTranscriptPath(filename) {
		contentType = "text/plain; charset=utf-8"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	http.ServeContent(w, r, filepath.Base(filename), time.Time{}, bytes.NewReader(data))
}

func (s *Server) frontend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		problem(w, 405, "请求方法无效")
		return
	}
	directory := filepath.Join(s.root, "dist")
	if isFrontendRoute(r.URL.Path) {
		filename := filepath.Join(directory, "index.html")
		if _, err := os.Stat(filename); err != nil {
			problem(w, 404, "前端尚未构建，请使用 npm run dev 或先执行 npm run build")
			return
		}
		http.ServeFile(w, r, filename)
		return
	}
	http.FileServer(http.Dir(directory)).ServeHTTP(w, r)
}

func isFrontendRoute(path string) bool {
	switch path {
	case "/", "/memorize", "/practice", "/analysis", "/palace", "/guide", "/exam", "/courses":
		return true
	default:
		return strings.HasPrefix(path, "/courses/")
	}
}
