package study

type ExamItem struct {
	Detail   PracticeDetail `json:"detail"`
	Selected []int64        `json:"selected"`
	Numeric  *string        `json:"numeric,omitempty"`
	Answered bool           `json:"answered"`
	Flagged  bool           `json:"flagged"`
	Correct  *bool          `json:"correct,omitempty"`
	Review   *Question      `json:"review,omitempty"`
}

type ExamSession struct {
	ID           string     `json:"id"`
	SubjectID    int64      `json:"subject_id"`
	Status       string     `json:"status"`
	Rule         ExamRule   `json:"rule"`
	StartedAtMS  int64      `json:"started_at_ms"`
	DeadlineAtMS int64      `json:"deadline_at_ms"`
	ServerNowMS  int64      `json:"server_now_ms"`
	FinishedAtMS int64      `json:"finished_at_ms"`
	Reason       string     `json:"reason"`
	Score        *int64     `json:"score,omitempty"`
	CurrentIndex int64      `json:"current_index"`
	Items        []ExamItem `json:"items"`
}

type ExamSummary struct {
	ID           string `json:"id"`
	SubjectID    int64  `json:"subject_id"`
	Status       string `json:"status"`
	StartedAtMS  int64  `json:"started_at_ms"`
	FinishedAtMS int64  `json:"finished_at_ms"`
	Score        *int64 `json:"score,omitempty"`
	Answered     int    `json:"answered"`
	Total        int    `json:"total"`
	Reason       string `json:"reason"`
}

type examPaperItem struct {
	Question       Question `json:"question"`
	ImageAvailable bool     `json:"image_available"`
	PriorExposure  int64    `json:"prior_exposure"`
	Revision       string   `json:"revision,omitempty"`
}
type examAnswer struct {
	Selected     []int64 `json:"selected"`
	Numeric      *string `json:"numeric,omitempty"`
	AnsweredAtMS int64   `json:"answered_at_ms"`
	Flagged      bool    `json:"flagged"`
}

func (answer examAnswer) input() AnswerInput {
	return AnswerInput{Selected: answer.Selected, Numeric: answer.Numeric}
}
