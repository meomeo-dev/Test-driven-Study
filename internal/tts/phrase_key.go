package tts

import (
	"fmt"
	"strings"
	"unicode"
)

const (
	fnvOffsetBasis = uint64(0xcbf29ce484222325)
	fnvPrime       = uint64(0x100000001b3)
)

// NormalizeText standardizes whitespace and trims the input text for stable phrase keys.
func NormalizeText(text string) string {
	fields := strings.FieldsFunc(text, func(r rune) bool {
		return unicode.IsSpace(r)
	})
	return strings.Join(fields, " ")
}

// PhraseKey computes the 64-bit FNV-1a hash of normalized text, producing a 16-char hex key.
// Compatible with .agents/skills/maintain-deepseek-tts-audio.
func PhraseKey(text string) string {
	normalized := NormalizeText(text)
	hash := fnvOffsetBasis
	for i := 0; i < len(normalized); i++ {
		hash ^= uint64(normalized[i])
		hash *= fnvPrime
	}
	return fmt.Sprintf("%016x", hash)
}
