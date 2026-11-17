package llm

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	_ "image/jpeg"
	"image/png"
	"os"
	"path/filepath"
)

func LoadQuestionImages(root, name string) ([]InputImage, error) {
	if name == "" {
		return nil, nil
	}
	if filepath.Base(name) != name {
		return nil, ErrInvalid
	}
	data, err := os.ReadFile(filepath.Join(root, "assets", "img", name))
	if err != nil {
		return nil, &Failure{Code: "missing_reference", Message: "原题配图无法读取，未忽略图片继续构思"}
	}
	return DecodeQuestionImages(data)
}

func DecodeQuestionImages(data []byte) ([]InputImage, error) {
	if len(data) > 10<<20 {
		return nil, &Failure{Code: "missing_reference", Message: "原题配图无法读取，未忽略图片继续构思"}
	}
	config, kind, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 {
		return nil, &Failure{Code: "invalid_reference", Message: "原题配图格式或尺寸无效"}
	}
	if kind == "gif" {
		return gifInputs(data)
	}
	if kind != "jpeg" && kind != "png" {
		return nil, &Failure{Code: "invalid_reference", Message: "原题配图不是可用的 PNG/JPEG/GIF"}
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return nil, &Failure{Code: "invalid_reference", Message: "原题配图损坏"}
	}
	return []InputImage{imageInput(data, "image/"+kind, 1, 1)}, nil
}
func imageInput(data []byte, kind string, frame, total int) InputImage {
	hash := sha256.Sum256(data)
	return InputImage{Data: data, Reference: ImageReference{SHA256: hex.EncodeToString(hash[:]), ContentType: kind, Bytes: len(data), Frame: frame, TotalFrames: total}}
}
func gifInputs(data []byte) ([]InputImage, error) {
	animation, err := gif.DecodeAll(bytes.NewReader(data))
	if err != nil || len(animation.Image) == 0 {
		return nil, &Failure{Code: "invalid_reference", Message: "原题动画无法解码"}
	}
	count := len(animation.Image)
	if count == 1 {
		return []InputImage{imageInput(data, "image/gif", 1, 1)}, nil
	}
	if count > 2000 || animation.Config.Width*animation.Config.Height*count > 128<<20 {
		return nil, &Failure{Code: "invalid_reference", Message: "原题动画超过本地解码限制"}
	}
	selected := map[int]bool{}
	for i := 0; i < min(8, count); i++ {
		selected[i*(count-1)/(min(8, count)-1)] = true
	}
	canvas := image.NewNRGBA(image.Rect(0, 0, animation.Config.Width, animation.Config.Height))
	var result []InputImage
	totalBytes := 0
	for i, frame := range animation.Image {
		var previous *image.NRGBA
		disposal := byte(0)
		if i < len(animation.Disposal) {
			disposal = animation.Disposal[i]
		}
		if disposal == gif.DisposalPrevious {
			previous = image.NewNRGBA(canvas.Bounds())
			copy(previous.Pix, canvas.Pix)
		}
		draw.Draw(canvas, frame.Bounds(), frame, frame.Bounds().Min, draw.Over)
		if selected[i] {
			var output bytes.Buffer
			if err := png.Encode(&output, canvas); err != nil {
				return nil, err
			}
			totalBytes += output.Len()
			if totalBytes > 24<<20 {
				return nil, &Failure{Code: "invalid_reference", Message: "动画参考帧超过大小限制"}
			}
			result = append(result, imageInput(output.Bytes(), "image/png", i+1, count))
		}
		if disposal == gif.DisposalBackground {
			background := image.Image(image.Transparent)
			if palette, ok := animation.Config.ColorModel.(color.Palette); ok && int(animation.BackgroundIndex) < len(palette) {
				background = image.NewUniform(palette[animation.BackgroundIndex])
			}
			draw.Draw(canvas, frame.Bounds(), background, image.Point{}, draw.Src)
		}
		if disposal == gif.DisposalPrevious {
			canvas = previous
		}
	}
	return result, nil
}
