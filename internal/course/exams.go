package course

type ExamRule struct {
	SubjectID int64          `json:"subject_id"`
	Count     int            `json:"count"`
	Minutes   int            `json:"minutes"`
	Points    int            `json:"points"`
	PassScore int            `json:"pass_score"`
	Version   string         `json:"version"`
	Blueprint *ExamBlueprint `json:"blueprint,omitempty"`
}

type ExamTypeQuota struct {
	QuestionType int64  `json:"question_type"`
	Name         string `json:"name"`
	Count        int    `json:"count"`
}

type ExamTopicQuota struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type ExamRuleSource struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

type ExamBlueprint struct {
	Scope            string           `json:"scope"`
	ContentAlignment string           `json:"content_alignment"`
	Types            []ExamTypeQuota  `json:"types"`
	Topics           []ExamTopicQuota `json:"topics"`
	Sources          []ExamRuleSource `json:"sources"`
}
