package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"test-driven-study/internal/tts"
)

func (s *Server) registerTTSRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/audio/{voice}/{key}", s.streamAudio)
	mux.HandleFunc("POST /api/tts/synthesize", s.synthesizeSpeech)
	mux.HandleFunc("GET /api/tts/settings", s.ttsSettings)
	mux.HandleFunc("PUT /api/tts/settings", s.saveTTSSettings)
	mux.HandleFunc("POST /api/tts/settings/test", s.testTTSSettings)
}

func (s *Server) hasTTS(w http.ResponseWriter) bool {
	if s.tts != nil {
		return true
	}
	problem(w, http.StatusServiceUnavailable, "TTS 语音服务未启用")
	return false
}

func (s *Server) streamAudio(w http.ResponseWriter, r *http.Request) {
	if !s.hasTTS(w) {
		return
	}
	voice := r.PathValue("voice")
	key := strings.TrimSuffix(r.PathValue("key"), ".wav")
	filePath, err := s.tts.GetAudioFilePath(voice, key)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			problem(w, http.StatusNotFound, "音频文件尚未生成")
			return
		}
		problem(w, http.StatusBadRequest, "音频参数无效")
		return
	}

	w.Header().Set("Content-Type", "audio/wav")
	if r.URL.Query().Get("v") != "" {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeFile(w, r, filePath)
}

type synthesizeRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
	Force bool   `json:"force,omitempty"`
}

func (s *Server) synthesizeSpeech(w http.ResponseWriter, r *http.Request) {
	if !s.hasTTS(w) {
		return
	}
	var req synthesizeRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024))
	if err := decoder.Decode(&req); err != nil {
		problem(w, http.StatusBadRequest, "请求体格式无效")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		problem(w, http.StatusBadRequest, "发音文本不能为空")
		return
	}
	res, err := s.tts.Synthesize(r.Context(), req.Text, req.Voice, req.Force)
	if err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) ttsSettings(w http.ResponseWriter, r *http.Request) {
	if !s.hasTTS(w) {
		return
	}
	writeJSON(w, http.StatusOK, s.tts.Settings())
}

func (s *Server) saveTTSSettings(w http.ResponseWriter, r *http.Request) {
	if !s.hasTTS(w) {
		return
	}
	token := r.Header.Get("X-Settings-Token")
	if !s.tts.AuthorizeSettings(token) {
		problem(w, http.StatusForbidden, "设置验证已失效，请重新打开设置")
		return
	}
	var update tts.ProviderUpdate
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&update); err != nil {
		problem(w, http.StatusBadRequest, "请求体格式无效")
		return
	}
	if err := s.tts.Save(update, token); err != nil {
		problem(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s.tts.Settings())
}

func (s *Server) testTTSSettings(w http.ResponseWriter, r *http.Request) {
	if !s.hasTTS(w) {
		return
	}
	token := r.Header.Get("X-Settings-Token")
	if !s.tts.AuthorizeSettings(token) {
		problem(w, http.StatusForbidden, "设置验证已失效，请重新打开设置")
		return
	}
	var update tts.ProviderUpdate
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&update); err != nil && !errors.Is(err, io.EOF) {
		problem(w, http.StatusBadRequest, "请求体格式无效")
		return
	}
	msg, err := s.tts.Test(r.Context(), update, token)
	if err != nil {
		problem(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"connected": true,
		"message":   msg,
	})
}
