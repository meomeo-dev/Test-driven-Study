package llm

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckpointRestoresOpaqueStateAndRejectsUnsafeChanges(t *testing.T) {
	provider, _ := NewHTTPProvider(testConfig("http://127.0.0.1:1/v1"))
	service := &Service{settingsFile: filepath.Join(t.TempDir(), "llm-provider.json")}
	original := json.RawMessage(`{"role":"user","content":[{"type":"input_image","image_url":"data:image/png;base64,AA=="}]}`)
	session := planningSession{original: original, history: []json.RawMessage{original,
		json.RawMessage(`{"type":"compaction","encrypted_content":"exact-opaque-value","large":9007199254740993}`)},
		progress:       SessionProgress{Rounds: 7, EvidenceGap: "Missing authoritative date", Usage: Usage{10, 20, 30}},
		researchStalls: 2, seenReads: map[string]struct{}{"page-1": {}}}
	hooks := service.sessionHooks("00000000-0000-0000-0000-000000000001", provider, true, nil)
	if err := hooks.save(&session, "ready"); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name   string
		mutate func(*planningSession, *HTTPProvider)
	}{
		{"unchanged", func(*planningSession, *HTTPProvider) {}},
		{"image_changed", func(s *planningSession, _ *HTTPProvider) { s.original = json.RawMessage(`{"role":"user"}`) }},
		{"provider_changed", func(_ *planningSession, p *HTTPProvider) { p.config.APIKey = "changed" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			copyProvider := *provider
			target := planningSession{original: original}
			test.mutate(&target, &copyProvider)
			resumed := service.sessionHooks("00000000-0000-0000-0000-000000000001", &copyProvider, true, nil)
			err := resumed.restore(&target)
			if test.name != "unchanged" {
				if err == nil {
					t.Fatal("unsafe resume accepted")
				}
				return
			}
			payload, _ := json.Marshal(target.history)
			if err != nil || target.researchStalls != 2 || len(target.seenReads) != 1 || target.progress.Rounds != 7 ||
				target.progress.EvidenceGap == "" || !strings.Contains(string(payload), "9007199254740993") ||
				!strings.Contains(string(payload), "exact-opaque-value") || !strings.Contains(string(payload), "data:image/") {
				t.Fatal("checkpoint altered the session", err)
			}
		})
	}
	if err := hooks.save(&session, "inflight"); err != nil {
		t.Fatal(err)
	}
	if err := hooks.restore(&planningSession{original: original}); err == nil {
		t.Fatal("in-flight request replay allowed")
	}
	if err := os.Remove(service.checkpointFile("00000000-0000-0000-0000-000000000001")); err != nil {
		t.Fatal(err)
	}
	if err := hooks.restore(&planningSession{original: original}); err == nil {
		t.Fatal("missing checkpoint restarted from scratch")
	}
}
