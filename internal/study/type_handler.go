package study

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"

	"test-driven-study/internal/course"
)

// TypeHandler encapsulates all per-question-type runtime behavior across
// projection, visibility redaction, answer validation/scoring, exams, and audio.
type TypeHandler struct {
	Type             course.QuestionType
	MediaCapable     bool
	ExamSectionOrder int
	Project          func(base Question, item course.Item) (Question, error)
	ToPublic         func(q Question, vis Visibility) PublicQuestion
	NormalizeInput   func(q Question, input AnswerInput) (AnswerInput, error)
	Score            func(q Question, answer AnswerInput) (float64, error)
	EncodeAttempt    func(q Question, answer AnswerInput, score float64) (string, string, error)
	IsEligibleExam   func(q Question) bool
	PrepareExamItem  func(q Question) (Question, error)
	ExamAudioSpeeds  func(q Question) []float64
	ExamSpeechLine   func(q Question, line int) (course.TranscriptLine, error)
	ExamReview       func(q Question, finished bool) Question
	TranscriptText   func(ctx context.Context, s *Service, q Question) (string, error)
}

var typeHandlers = map[course.QuestionType]TypeHandler{
	course.SingleChoice: {
		Type:             course.SingleChoice,
		MediaCapable:     true,
		ExamSectionOrder: 0,
		Project:          projectChoice,
		ToPublic:         func(q Question, vis Visibility) PublicQuestion { return publicMedia(q, vis, true) },
		NormalizeInput:   normalizeChoiceInput,
		Score:            scoreChoiceAnswer,
		EncodeAttempt:    encodeChoiceAttempt,
		IsEligibleExam:   isChoiceEligibleExam,
		PrepareExamItem:  shuffleQuestionItems,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       redactMediaReview,
		TranscriptText:   mediaTranscriptText,
	},
	course.MultipleChoice: {
		Type:             course.MultipleChoice,
		MediaCapable:     true,
		ExamSectionOrder: 1,
		Project:          projectChoice,
		ToPublic:         func(q Question, vis Visibility) PublicQuestion { return publicMedia(q, vis, true) },
		NormalizeInput:   normalizeChoiceInput,
		Score:            scoreChoiceAnswer,
		EncodeAttempt:    encodeChoiceAttempt,
		IsEligibleExam:   isChoiceEligibleExam,
		PrepareExamItem:  shuffleQuestionItems,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       redactMediaReview,
		TranscriptText:   mediaTranscriptText,
	},
	course.TrueFalse: {
		Type:             course.TrueFalse,
		MediaCapable:     true,
		ExamSectionOrder: 0,
		Project:          projectTrueFalse,
		ToPublic:         func(q Question, vis Visibility) PublicQuestion { return publicMedia(q, vis, true) },
		NormalizeInput:   normalizeTrueFalseInput,
		Score:            scoreChoiceAnswer,
		EncodeAttempt:    encodeTrueFalseAttempt,
		IsEligibleExam:   isChoiceEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       redactMediaReview,
		TranscriptText:   mediaTranscriptText,
	},
	course.Numeric: {
		Type:             course.Numeric,
		MediaCapable:     true,
		ExamSectionOrder: 0,
		Project:          projectNumeric,
		ToPublic:         func(q Question, vis Visibility) PublicQuestion { return publicMedia(q, vis, false) },
		NormalizeInput:   normalizeNumericInput,
		Score:            scoreNumericAnswer,
		EncodeAttempt:    encodeNumericAttempt,
		IsEligibleExam:   isNumericEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       redactMediaReview,
		TranscriptText:   mediaTranscriptText,
	},
	course.Cloze: {
		Type:             course.Cloze,
		MediaCapable:     false,
		ExamSectionOrder: 0,
		Project:          projectCloze,
		ToPublic:         publicNonMedia,
		NormalizeInput:   normalizeExtendedInput,
		Score:            scoreExtendedAnswer,
		EncodeAttempt:    encodeExtendedAttempt,
		IsEligibleExam:   isExtendedEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       nonMediaExamReview,
		TranscriptText:   noTranscriptText,
	},
	course.Listening: {
		Type:             course.Listening,
		MediaCapable:     true,
		ExamSectionOrder: 0,
		Project:          projectListening,
		ToPublic:         func(q Question, vis Visibility) PublicQuestion { return publicMedia(q, vis, false) },
		NormalizeInput:   normalizeExtendedInput,
		Score:            scoreExtendedAnswer,
		EncodeAttempt:    encodeExtendedAttempt,
		IsEligibleExam:   isExtendedEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  listeningAudioSpeeds,
		ExamSpeechLine:   listeningSpeechLine,
		ExamReview:       redactListeningReview,
		TranscriptText:   mediaTranscriptText,
	},
	course.Reading: {
		Type:             course.Reading,
		MediaCapable:     false,
		ExamSectionOrder: 0,
		Project:          projectReading,
		ToPublic:         publicNonMedia,
		NormalizeInput:   normalizeExtendedInput,
		Score:            scoreExtendedAnswer,
		EncodeAttempt:    encodeExtendedAttempt,
		IsEligibleExam:   isExtendedEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       nonMediaExamReview,
		TranscriptText:   noTranscriptText,
	},
	course.Writing: {
		Type:             course.Writing,
		MediaCapable:     false,
		ExamSectionOrder: 0,
		Project:          projectWriting,
		ToPublic:         publicNonMedia,
		NormalizeInput:   normalizeExtendedInput,
		Score:            scoreExtendedAnswer,
		EncodeAttempt:    encodeExtendedAttempt,
		IsEligibleExam:   isExtendedEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       nonMediaExamReview,
		TranscriptText:   noTranscriptText,
	},
	course.Translation: {
		Type:             course.Translation,
		MediaCapable:     false,
		ExamSectionOrder: 0,
		Project:          projectTranslation,
		ToPublic:         publicNonMedia,
		NormalizeInput:   normalizeExtendedInput,
		Score:            scoreExtendedAnswer,
		EncodeAttempt:    encodeExtendedAttempt,
		IsEligibleExam:   isExtendedEligibleExam,
		PrepareExamItem:  keepExamItem,
		ExamAudioSpeeds:  noExamAudioSpeeds,
		ExamSpeechLine:   noExamSpeechLine,
		ExamReview:       nonMediaExamReview,
		TranscriptText:   noTranscriptText,
	},
}

// TypeHandlerFor returns the registered TypeHandler for t.
func TypeHandlerFor(t course.QuestionType) (TypeHandler, bool) {
	h, ok := typeHandlers[t]
	return h, ok
}

// ProjectQuestion projects a course item into a study Question using its TypeHandler.
func ProjectQuestion(base Question, item course.Item) (Question, error) {
	h, ok := TypeHandlerFor(item.Type)
	if !ok {
		return Question{}, fmt.Errorf("unsupported question type %q", item.Type)
	}
	base.QuestionType = item.Type
	return h.Project(base, item)
}

// ToPublic builds a learner-facing PublicQuestion for the specified visibility.
func ToPublic(q Question, vis Visibility) PublicQuestion {
	h, ok := TypeHandlerFor(q.QuestionType)
	if !ok {
		return publicBase(q)
	}
	return h.ToPublic(q, vis)
}

func normalizeChoiceInput(q Question, input AnswerInput) (AnswerInput, error) {
	if input.Numeric != nil || input.ExtendedResponse.HasAnswer() {
		return AnswerInput{}, ErrInvalid
	}
	choices, err := normalizeSelection(q, input.Selected)
	if err != nil {
		return AnswerInput{}, err
	}
	return AnswerInput{Selected: choices}, nil
}

func normalizeTrueFalseInput(q Question, input AnswerInput) (AnswerInput, error) {
	if input.Numeric != nil {
		return AnswerInput{}, ErrInvalid
	}
	if input.ExtendedResponse.HasAnswer() {
		if input.Value == nil || len(input.Selected) != 0 ||
			!reflect.DeepEqual(input.ExtendedResponse, course.ExtendedResponse{Value: input.Value}) {
			return AnswerInput{}, ErrInvalid
		}
		input.Selected = booleanSelection(q, *input.Value)
	}
	choices, err := normalizeSelection(q, input.Selected)
	if err != nil {
		return AnswerInput{}, err
	}
	answer := AnswerInput{Selected: choices}
	if q.AnalysisContent != nil {
		for _, option := range q.Items {
			if option.Sign == choices[0] {
				answer.Value = option.BooleanValue
			}
		}
	}
	return answer, nil
}

func normalizeNumericInput(q Question, input AnswerInput) (AnswerInput, error) {
	if input.Numeric == nil || len(input.Selected) != 0 || input.ExtendedResponse.HasAnswer() {
		return AnswerInput{}, ErrInvalid
	}
	if _, err := gradeNumeric(q, input.Numeric); err != nil {
		return AnswerInput{}, err
	}
	return AnswerInput{Numeric: input.Numeric}, nil
}

func normalizeExtendedInput(q Question, input AnswerInput) (AnswerInput, error) {
	if q.QuestionReview == nil || input.Numeric != nil || len(input.Selected) != 0 {
		return AnswerInput{}, ErrInvalid
	}
	normalized, _, err := q.QuestionReview.Evaluate(input.ExtendedResponse)
	if err != nil {
		return AnswerInput{}, ErrInvalid
	}
	return AnswerInput{ExtendedResponse: normalized}, nil
}

func scoreChoiceAnswer(q Question, answer AnswerInput) (float64, error) {
	expected, err := originalAnswer(q)
	if err != nil {
		return 0, err
	}
	if slices.Equal(answer.Selected, expected) {
		return 1, nil
	}
	return 0, nil
}

func scoreNumericAnswer(q Question, answer AnswerInput) (float64, error) {
	correct, err := gradeNumeric(q, answer.Numeric)
	if err != nil {
		return 0, err
	}
	if correct {
		return 1, nil
	}
	return 0, nil
}

func scoreExtendedAnswer(q Question, answer AnswerInput) (float64, error) {
	if q.QuestionReview == nil {
		return 0, ErrInvalid
	}
	_, score, err := q.QuestionReview.Evaluate(answer.ExtendedResponse)
	if err != nil {
		return 0, ErrInvalid
	}
	return score, nil
}

func encodeChoiceAttempt(q Question, answer AnswerInput, _ float64) (string, string, error) {
	expected, err := originalAnswer(q)
	if err != nil {
		return "", "", err
	}
	selectedJSON, _ := json.Marshal(answer.Selected)
	expectedJSON, _ := json.Marshal(expected)
	return string(selectedJSON), string(expectedJSON), nil
}

func encodeTrueFalseAttempt(q Question, answer AnswerInput, score float64) (string, string, error) {
	if answer.Value == nil {
		return encodeChoiceAttempt(q, answer, score)
	}
	expected, err := originalAnswer(q)
	if err != nil {
		return "", "", err
	}
	var key course.ExtendedResponse
	for _, option := range q.Items {
		if option.Sign == expected[0] {
			key.Value = option.BooleanValue
		}
	}
	actual, err := json.Marshal(answer.ExtendedResponse)
	if err != nil {
		return "", "", err
	}
	review, err := json.Marshal(extendedAttemptKey{ExtendedResponse: key, Score: &score})
	return string(actual), string(review), err
}

func encodeNumericAttempt(q Question, answer AnswerInput, _ float64) (string, string, error) {
	selected, err := json.Marshal(course.Response{Value: answer.Numeric})
	if err != nil {
		return "", "", err
	}
	expected, err := json.Marshal(course.Response{Value: &q.Answer})
	return string(selected), string(expected), err
}

func encodeExtendedAttempt(q Question, answer AnswerInput, score float64) (string, string, error) {
	if q.QuestionReview == nil {
		return "", "", ErrInvalid
	}
	actual, err := json.Marshal(answer.ExtendedResponse)
	if err != nil {
		return "", "", err
	}
	review, err := json.Marshal(extendedAttemptKey{
		ExtendedResponse: q.QuestionReview.ExpectedResponse(),
		Score:            &score,
	})
	return string(actual), string(review), err
}

func isChoiceEligibleExam(q Question) bool {
	_, err := originalAnswer(q)
	return err == nil
}

func isNumericEligibleExam(q Question) bool {
	_, err := gradeNumeric(q, &q.Answer)
	return err == nil
}

func isExtendedEligibleExam(q Question) bool {
	return q.QuestionReview != nil
}

func shuffleQuestionItems(q Question) (Question, error) {
	q.Items = slices.Clone(q.Items)
	if err := shuffleExamOptions(q.Items); err != nil {
		return Question{}, err
	}
	return q, nil
}

func keepExamItem(q Question) (Question, error) {
	return q, nil
}

func noExamAudioSpeeds(Question) []float64 {
	return nil
}

func listeningAudioSpeeds(q Question) []float64 {
	if q.AudioURL != "" {
		return nil
	}
	return listeningSpeeds(q)
}

func noExamSpeechLine(Question, int) (course.TranscriptLine, error) {
	return course.TranscriptLine{}, ErrInvalid
}

func listeningSpeechLine(q Question, line int) (course.TranscriptLine, error) {
	if q.AudioURL != "" || line < 0 || line >= len(q.TranscriptLines) {
		return course.TranscriptLine{}, ErrInvalid
	}
	return q.TranscriptLines[line], nil
}

func redactMediaReview(q Question, finished bool) Question {
	if !finished {
		q.TranscriptURL = ""
		q.TranscriptLines = nil
	}
	return q
}

func redactListeningReview(q Question, finished bool) Question {
	if !finished {
		q.TranscriptURL = ""
		q.TranscriptLines = nil
		if q.QuestionReview != nil {
			key := *q.QuestionReview
			key.Transcript = nil
			key.Passage = nil
			key.StudyTranslation = nil
			q.QuestionReview = &key
		}
	}
	return q
}

func nonMediaExamReview(q Question, finished bool) Question {
	// Sanitize a copy of the authored review before redacting it for an active paper.
	q.sanitizeMedia()
	if !finished && q.QuestionReview != nil {
		q.QuestionReview.StudyTranslation = nil
	}
	return q
}
