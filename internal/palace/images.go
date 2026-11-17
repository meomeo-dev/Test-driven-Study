package palace

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"

	"test-driven-study/internal/study"
)

func imageMetadata(data []byte) (Image, error) {
	config, kind, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (kind != "png" && kind != "jpeg") || len(data) > maxImageBytes || config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 {
		return Image{}, &Failure{"invalid_image", "返回内容不是可验证的 PNG/JPEG 图片"}
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return Image{}, &Failure{"invalid_image", "返回图片不完整或损坏"}
	}
	hash := sha256.Sum256(data)
	contentType := "image/" + kind
	ext := ".png"
	if kind == "jpeg" {
		ext = ".jpg"
	}
	return Image{Filename: ext, ContentType: contentType, Width: config.Width, Height: config.Height,
		Bytes: len(data), SHA256: hex.EncodeToString(hash[:])}, nil
}

func (s *Service) saveImage(id string, output ProviderOutput) (Image, error) {
	metadata, err := imageMetadata(output.Bytes)
	if err != nil {
		return Image{}, err
	}
	metadata.Filename = id + metadata.Filename
	metadata.Usage = output.Usage
	file, err := os.CreateTemp(s.directory, ".image-*")
	if err != nil {
		return Image{}, err
	}
	temporary := file.Name()
	defer os.Remove(temporary)
	if _, err = file.Write(output.Bytes); err != nil {
		file.Close()
		return Image{}, err
	}
	if err = file.Close(); err != nil {
		return Image{}, err
	}
	if err = os.Rename(temporary, filepath.Join(s.directory, metadata.Filename)); err != nil {
		return Image{}, err
	}
	return metadata, nil
}

func (s *Service) reference(ctx context.Context, question study.Question) ([]byte, string, error) {
	data, err := s.study.ReadQuestionImage(ctx, question)
	if err != nil || len(data) > 10<<20 {
		return nil, "", ErrInvalid
	}
	if _, err := imageMetadata(data); err != nil {
		return nil, "", ErrInvalid
	}
	hash := sha256.Sum256(data)
	return data, hex.EncodeToString(hash[:]), nil
}
