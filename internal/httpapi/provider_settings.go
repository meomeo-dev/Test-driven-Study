package httpapi

import (
	"errors"
	"net/http"

	"test-driven-study/internal/palace"
)

func settingsError(w http.ResponseWriter, err error) {
	var validation *palace.SettingsError
	if errors.As(err, &validation) {
		problem(w, 400, validation.Message)
		return
	}
	palaceError(w, err)
}

func (s *Server) providerSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !s.hasPalaces(w) {
		return
	}
	writeJSON(w, 200, s.palaces.ProviderSettings())
}

func (s *Server) settingsInput(w http.ResponseWriter, r *http.Request) (palace.ProviderUpdate, bool) {
	w.Header().Set("Cache-Control", "no-store")
	if !s.hasPalaces(w) {
		return palace.ProviderUpdate{}, false
	}
	if !s.palaces.AuthorizeSettings(r.Header.Get("X-Settings-Token")) {
		problem(w, 403, "设置验证已失效，请重新打开生图设置")
		return palace.ProviderUpdate{}, false
	}
	var input palace.ProviderUpdate
	if !decodeBody(w, r, &input) {
		return palace.ProviderUpdate{}, false
	}
	return input, true
}

func (s *Server) saveProviderSettings(w http.ResponseWriter, r *http.Request) {
	input, ok := s.settingsInput(w, r)
	if !ok {
		return
	}
	value, err := s.palaces.SaveProvider(r.Context(), input)
	if err != nil {
		settingsError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) testProviderSettings(w http.ResponseWriter, r *http.Request) {
	input, ok := s.settingsInput(w, r)
	if !ok {
		return
	}
	value, err := s.palaces.TestProvider(r.Context(), input)
	if err != nil {
		settingsError(w, err)
		return
	}
	writeJSON(w, 200, value)
}
