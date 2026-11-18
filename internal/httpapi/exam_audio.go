package httpapi

import "net/http"

func (s *Server) examAudio(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Index *int `json:"index"`
		Line  *int `json:"line"`
		Force bool `json:"force,omitempty"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if input.Index == nil || input.Line == nil {
		problem(w, http.StatusBadRequest, "缺少题目或音频序号")
		return
	}
	line, err := s.study.ExamSpeech(r.Context(), r.PathValue("exam"), *input.Index, *input.Line)
	if err != nil {
		examError(w, err)
		return
	}
	if !s.hasTTS(w) {
		return
	}
	text, voice := line.Text, ""
	if line.TTS != nil {
		voice = line.TTS.Config.Voice
		if line.TTS.Config.Text != "" {
			text = line.TTS.Config.Text
		}
	}
	result, err := s.tts.Synthesize(r.Context(), text, voice, input.Force)
	if err != nil {
		problem(w, http.StatusBadGateway, "暂时无法播放听力录音")
		return
	}
	writeJSON(w, http.StatusOK, result)
}
