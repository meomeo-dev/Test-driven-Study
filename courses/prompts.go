package courses

import "embed"

//go:embed starter/profiles/*
var PromptFiles embed.FS
