package palace

import "testing"

func TestSizePresetsMatchImagegenConstraints(t *testing.T) {
	for ratio, tiers := range outputSizes {
		for tier, size := range tiers {
			if !validImageSize(size) {
				t.Fatalf("%s/%s violates skill constraints: %s", ratio, tier, size)
			}
			normalized, err := normalizeSize(Settings{AspectRatio: ratio, Resolution: tier})
			if err != nil || normalized.Size != size {
				t.Fatal("preset mapping changed")
			}
		}
	}
	for _, size := range []string{"576x1024", "2560x3840", "721x1280", "720x1281", "4096x2160", "016x1024", "0x1024", "-16x1024", "64x2048", "foo"} {
		if validImageSize(size) {
			t.Fatalf("invalid dimensions accepted: %s", size)
		}
	}
	if _, err := normalizeSize(Settings{AspectRatio: "9:16", Resolution: "4k", Size: "1152x2048"}); err == nil {
		t.Fatal("mismatched tier and size accepted")
	}
	if _, err := normalizeSize(Settings{AspectRatio: "9:16", Resolution: "8k"}); err == nil {
		t.Fatal("unknown resolution accepted")
	}
}
