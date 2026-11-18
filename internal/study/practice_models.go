package study

type PublicQuestion struct {
	QuestionID     int64    `json:"question_id"`
	QuestionType   int64    `json:"question_type"`
	Title          string   `json:"title"`
	RichContent    any      `json:"rich_content,omitempty"`
	Items          []Option `json:"items"`
	ImageURL       string   `json:"image_url"`
	AudioURL       string   `json:"audio_url,omitempty"`
	TranscriptURL  string   `json:"transcript_url,omitempty"`
	ImageType      int64    `json:"image_type"`
	Difficulty     int64    `json:"difficulty"`
	Tags           string   `json:"tags"`
	LicenceID      int64    `json:"licence_id"`
	SubjectID      int64    `json:"subject_id"`
	ChapterID      int64    `json:"chapter_id"`
	ChapterName    string   `json:"chapter_name"`
	SubChapterID   int64    `json:"sub_chapter_id"`
	SubChapterName string   `json:"sub_chapter_name"`
	CourseID       int64    `json:"course_id"`
	CourseName     string   `json:"course_name"`
	Sort           int64    `json:"sort"`
	ProvinceID     int64    `json:"province_id"`
	CityID         int64    `json:"city_id"`
	PackageID      string   `json:"package_id,omitempty"`
	PackageVersion string   `json:"package_version,omitempty"`
	SourceItemID   string   `json:"source_item_id,omitempty"`
}

type PracticeDetail struct {
	Question       PublicQuestion `json:"question"`
	ImageAvailable bool           `json:"image_available"`
}

type Presentation struct {
	ID            string         `json:"id"`
	Detail        PracticeDetail `json:"detail"`
	OpenedAtMS    int64          `json:"opened_at_ms"`
	PriorAttempts int64          `json:"prior_attempts"`
	PriorExposure bool           `json:"prior_exposure"`
}

type PracticeOverview struct {
	SubjectID      int64     `json:"subject_id"`
	Total          int64     `json:"total"`
	Correct        int64     `json:"correct"`
	Incorrect      int64     `json:"incorrect"`
	Unanswered     int64     `json:"unanswered"`
	LastQuestionID int64     `json:"last_question_id"`
	Chapters       []Chapter `json:"chapters"`
}

type Attempt struct {
	ID               int64   `json:"id"`
	PresentationID   string  `json:"presentation_id"`
	QuestionID       int64   `json:"question_id"`
	SubjectID        int64   `json:"subject_id"`
	ChapterID        int64   `json:"chapter_id"`
	ChapterName      string  `json:"chapter_name"`
	QuestionTitle    string  `json:"question_title"`
	QuestionRevision string  `json:"question_revision"`
	Selected         []int64 `json:"selected"`
	CorrectAnswer    []int64 `json:"correct_answer"`
	Numeric          *string `json:"numeric,omitempty"`
	CorrectNumeric   *string `json:"correct_numeric,omitempty"`
	Correct          bool    `json:"correct"`
	FirstAttempt     bool    `json:"first_attempt"`
	PriorExposure    bool    `json:"prior_exposure"`
	OpenedAtMS       int64   `json:"opened_at_ms"`
	AnsweredAtMS     int64   `json:"answered_at_ms"`
}

type AttemptResult struct {
	Attempt Attempt `json:"attempt"`
	Detail  Detail  `json:"detail"`
}
