package llm

import (
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestOriginalPNGAndLabeledAnimatedFrames(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "assets", "img")
	os.MkdirAll(directory, 0700)
	file, _ := os.Create(filepath.Join(directory, "still.png"))
	png.Encode(file, image.NewRGBA(image.Rect(0, 0, 8, 8)))
	file.Close()
	inputs, err := LoadQuestionImages(root, "still.png")
	if err != nil || len(inputs) != 1 || inputs[0].Reference.ContentType != "image/png" || len(inputs[0].Reference.SHA256) != 64 {
		t.Fatal("PNG reference failed", err)
	}
	animation := &gif.GIF{Config: image.Config{ColorModel: color.Palette{color.White, color.Black}, Width: 8, Height: 8}}
	for i := 0; i < 12; i++ {
		frame := image.NewPaletted(image.Rect(0, 0, 8, 8), color.Palette{color.White, color.Black})
		frame.SetColorIndex(i%8, i%8, 1)
		animation.Image = append(animation.Image, frame)
		animation.Delay = append(animation.Delay, 5)
	}
	file, _ = os.Create(filepath.Join(directory, "motion.gif"))
	gif.EncodeAll(file, animation)
	file.Close()
	inputs, err = LoadQuestionImages(root, "motion.gif")
	if err != nil || len(inputs) != 8 || inputs[0].Reference.Frame != 1 || inputs[7].Reference.Frame != 12 || inputs[7].Reference.TotalFrames != 12 {
		t.Fatal("animated reference was silently flattened", err)
	}
	if _, err := LoadQuestionImages(root, "../private"); err == nil {
		t.Fatal("unsafe reference path accepted")
	}
	if _, err := LoadQuestionImages(root, "missing.jpg"); err == nil {
		t.Fatal("missing diagram silently omitted")
	}
}
