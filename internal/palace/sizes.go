package palace

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

func validImageSize(size string) bool {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return false
	}
	width, err := strconv.Atoi(parts[0])
	if err != nil {
		return false
	}
	height, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}
	if width <= 0 || height <= 0 || width > 3840 || height > 3840 || width%16 != 0 || height%16 != 0 {
		return false
	}
	if fmt.Sprintf("%dx%d", width, height) != size {
		return false
	}
	pixels := width * height
	return max(width, height) <= 3*min(width, height) && pixels >= 655360 && pixels <= 8294400
}

//go:embed output-sizes.json
var sizePresets []byte

var outputSizes = func() map[string]map[string]string {
	var values map[string]map[string]string
	if json.Unmarshal(sizePresets, &values) != nil {
		panic("invalid embedded image presets")
	}
	return values
}()

func normalizeSize(settings Settings) (Settings, error) {
	// Old clients and immutable historical jobs retain the size-only contract.
	// New controls send the preset fields and the exact corresponding size.
	if settings.AspectRatio == "" && settings.Resolution == "" {
		if settings.Size == "" {
			settings.Size = "1152x2048"
		}
		if settings.Size == "1152x2048" || settings.Size == "1024x1536" {
			return settings, nil
		}
		return Settings{}, ErrInvalid
	}
	if settings.AspectRatio == "" {
		settings.AspectRatio = "9:16"
	}
	if settings.Resolution == "" {
		settings.Resolution = "2k"
	}
	size := outputSizes[settings.AspectRatio][settings.Resolution]
	if !validImageSize(size) || (settings.Size != "" && settings.Size != size) {
		return Settings{}, ErrInvalid
	}
	settings.Size = size
	return settings, nil
}
