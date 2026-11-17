package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/study"
)

type Server struct {
	study          *study.Service
	palaces        *palace.Service
	llm            *llm.Service
	root           string
	allowedOrigins map[string]bool
}

func New(service *study.Service, palaces *palace.Service, root, apiPort, webPort string, planners ...*llm.Service) http.Handler {
	server := &Server{study: service, palaces: palaces, root: root, allowedOrigins: map[string]bool{}}
	if len(planners) > 0 {
		server.llm = planners[0]
	}
	for _, host := range []string{"127.0.0.1", "localhost"} {
		for _, port := range []string{apiPort, webPort} {
			server.allowedOrigins["http://"+host+":"+port] = true
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/courses/{course}/versions/{version}/assets/{asset...}", server.courseAsset)
	mux.HandleFunc("GET /api/courses", server.courses)
	mux.HandleFunc("GET /api/guide", server.guide)
	server.registerStudyRoutes(mux)
	server.registerLearningRoutes(mux)
	server.registerRoadmapRoutes(mux)
	server.registerExamRoutes(mux)
	if server.llm != nil {
		server.registerLLMRoutes(mux)
	}
	if server.palaces != nil {
		server.registerPalaceRoutes(mux)
	}
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { problem(w, 404, "接口不存在") })
	mux.HandleFunc("/", server.frontend)
	return server.localOnly(mux)
}

func (s *Server) registerStudyRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/study/overview", s.overview)
	mux.HandleFunc("GET /api/questions", s.questions)
	mux.HandleFunc("GET /api/questions/{id}", s.detail)
	mux.HandleFunc("PUT /api/questions/{id}/progress", s.progress)
	mux.HandleFunc("PUT /api/study/cursor", s.cursor)
	mux.HandleFunc("GET /api/practice/overview", s.practiceOverview)
	mux.HandleFunc("GET /api/practice/questions", s.practiceQuestions)
	mux.HandleFunc("POST /api/practice/presentations", s.openPresentation)
	mux.HandleFunc("POST /api/practice/presentations/{presentation}/answer", s.answer)
	mux.HandleFunc("PUT /api/practice/cursor", s.practiceCursor)
	mux.HandleFunc("POST /api/study/exposures", s.exposure)
	mux.HandleFunc("GET /api/analysis", s.analysis)
	mux.HandleFunc("GET /api/analysis/review-book", s.reviewBook)
}

func (s *Server) registerExamRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/exams/rules", s.examRules)
	mux.HandleFunc("GET /api/exams", s.exams)
	mux.HandleFunc("POST /api/exams", s.createExam)
	mux.HandleFunc("GET /api/exams/{exam}", s.exam)
	mux.HandleFunc("POST /api/exams/{exam}/answer", s.examAnswer)
	mux.HandleFunc("POST /api/exams/{exam}/navigate", s.examNavigate)
	mux.HandleFunc("PUT /api/exams/{exam}/cursor", s.examMove)
	mux.HandleFunc("POST /api/exams/{exam}/submit", s.examSubmit)
}

func (s *Server) registerLLMRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/llm/info", s.llmInfo)
	mux.HandleFunc("POST /api/llm/chat", s.chat)
	mux.HandleFunc("GET /api/llm/conversations", s.listConversations)
	mux.HandleFunc("GET /api/llm/conversations/coverage", s.conversationCoverage)
	mux.HandleFunc("POST /api/llm/conversations", s.createConversation)
	mux.HandleFunc("GET /api/llm/conversations/{conversation}", s.getConversation)
	mux.HandleFunc("POST /api/llm/conversations/{conversation}/messages", s.conversationChat)
	mux.HandleFunc("GET /api/llm/settings", s.llmSettings)
	mux.HandleFunc("PUT /api/llm/settings", s.saveLLMSettings)
	mux.HandleFunc("POST /api/llm/settings/test", s.testLLMSettings)
	mux.HandleFunc("POST /api/llm/plans", s.createLLMPlan)
	mux.HandleFunc("GET /api/llm/plans/{plan}", s.getLLMPlan)
}

func (s *Server) registerPalaceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/palaces/info", s.palaceInfo)
	mux.HandleFunc("GET /api/palaces/coverage", s.palaceCoverage)
	mux.HandleFunc("GET /api/palaces/settings", s.providerSettings)
	mux.HandleFunc("PUT /api/palaces/settings", s.saveProviderSettings)
	mux.HandleFunc("POST /api/palaces/settings/test", s.testProviderSettings)
	mux.HandleFunc("POST /api/palaces/preview", s.palacePreview)
	mux.HandleFunc("GET /api/palaces/jobs", s.palaceList)
	mux.HandleFunc("POST /api/palaces/jobs", s.palaceCreate)
	mux.HandleFunc("GET /api/palaces/jobs/{job}", s.palaceGet)
	mux.HandleFunc("POST /api/palaces/jobs/{job}/cancel", s.palaceCancel)
	mux.HandleFunc("POST /api/palaces/jobs/{job}/retry", s.palaceRetry)
	mux.HandleFunc("POST /api/palaces/jobs/{job}/retry-image", s.palaceImageRetry)
	mux.HandleFunc("POST /api/palaces/jobs/{job}/{action}", s.palaceControl)
	mux.HandleFunc("GET /api/tasks", s.tasks)
	mux.HandleFunc("GET /api/tasks/{job}/events", s.taskEvents)
	mux.HandleFunc("GET /api/palaces/jobs/{job}/trace", s.traceSnapshot)
	mux.HandleFunc("GET /api/palaces/jobs/{job}/trace/stream", s.traceStream)
	mux.HandleFunc("GET /api/palaces/jobs/{job}/image", s.palaceImage)
}

func (s *Server) localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			host = r.Host
		}
		if host != "127.0.0.1" && host != "localhost" && host != "::1" {
			problem(w, http.StatusForbidden, "仅限本机访问")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			origin := r.Header.Get("Origin")
			if origin != "" && !s.allowedOrigins[origin] {
				problem(w, 403, "请求来源无效")
				return
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				problem(w, 415, "请使用 JSON 请求")
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("write response", "error", err)
	}
}

func problem(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func respondError(w http.ResponseWriter, err error) {
	// Navigation can cancel in-flight reads; the client no longer needs a response.
	if errors.Is(err, context.Canceled) {
		return
	}
	// Learning-path services name the missing or invalid resource themselves.
	var userError *study.UserError
	if errors.As(err, &userError) {
		status := 400
		if errors.Is(userError, study.ErrNotFound) {
			status = 404
		}
		problem(w, status, userError.Message)
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		problem(w, 404, "题目不存在")
		return
	}
	if errors.Is(err, study.ErrConflict) {
		problem(w, 409, "本次作答已保存或题目已变化，请重新载入题目")
		return
	}
	if errors.Is(err, study.ErrInvalid) {
		problem(w, 400, "请求参数无效")
		return
	}
	slog.Error("study request failed", "error", err)
	problem(w, 500, "保存或读取失败，请稍后重试")
}

func decodeBody(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		problem(w, 400, "请求内容无效")
		return false
	}
	if decoder.Decode(new(any)) != io.EOF {
		problem(w, 400, "请求只能包含一个 JSON 对象")
		return false
	}
	return true
}
