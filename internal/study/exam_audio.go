package study

import (
	"context"

	"test-driven-study/internal/course"
)

func listeningSpeeds(q Question) []float64 {
	rates := make([]float64, len(q.TranscriptLines))
	for i, line := range q.TranscriptLines {
		rates[i] = 1
		if line.TTS != nil && line.TTS.Config.Speed != nil {
			rates[i] = *line.TTS.Config.Speed
		}
	}
	return rates
}

// ExamSpeech resolves a line by position on the saved paper. The caller
// receives only synthesized audio; no transcript is sent in the active session.
func (s *Service) ExamSpeech(ctx context.Context, id string, index, line int) (
	course.TranscriptLine, error,
) {
	if !validExamID(id) {
		return course.TranscriptLine{}, ErrInvalid
	}
	row, err := s.queries.GetMockExam(ctx, id)
	if err != nil {
		return course.TranscriptLine{}, err
	}
	record, err := decodeExam(row)
	if err != nil {
		return course.TranscriptLine{}, err
	}
	if index < 0 || index >= len(record.paper) {
		return course.TranscriptLine{}, ErrInvalid
	}
	q := record.paper[index].Question
	if q.QuestionType != ListeningQuestion || q.AudioURL != "" ||
		line < 0 || line >= len(q.TranscriptLines) {
		return course.TranscriptLine{}, ErrInvalid
	}
	return q.TranscriptLines[line], nil
}
