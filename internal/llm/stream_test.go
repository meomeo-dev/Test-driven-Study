package llm

import (
	"strings"
	"testing"
)

func TestStreamRequiresACompleteResponse(t *testing.T) {
	for _, value := range []struct {
		name, stream string
		valid        bool
	}{
		{"multiline event", ": heartbeat\r\ndata: {\"type\":\"response.completed\",\n" +
			"data: \"response\":{\"status\":\"completed\",\"output\":[]}}\n\n", true},
		{"last event without blank", "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n", true},
		{"done without response", "data: [DONE]\n\n", false},
		{"missing envelope", "data: {\"type\":\"response.completed\"}\n\n", false},
		{"null envelope", "data: {\"type\":\"response.completed\",\"response\":null}\n\n", false},
		{"malformed", "data: {partial\n\n", false},
		{"provider error", "data: {\"type\":\"error\",\"message\":\"private upstream detail\"}\n\n", false},
	} {
		t.Run(value.name, func(t *testing.T) {
			_, err := readCompletedStream(strings.NewReader(value.stream))
			if (err == nil) != value.valid || (err != nil && strings.Contains(err.Error(), "private")) {
				t.Fatal("stream completion or diagnostics were mishandled", err)
			}
		})
	}
}
