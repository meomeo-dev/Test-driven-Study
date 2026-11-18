package study

import "encoding/json"

type OptionTTS struct {
	Voice string   `json:"voice,omitempty"`
	Text  string   `json:"text,omitempty"`
	Speed *float64 `json:"speed,omitempty"`
}

type Option struct {
	Sign         int64           `json:"sign"`
	ItemTitle    string          `json:"item_title"`
	Title        json.RawMessage `json:"title,omitempty"`
	BooleanValue *bool           `json:"boolean_value,omitempty"`
	TTS          *OptionTTS      `json:"tts,omitempty"`
}

type Question struct {
	QuestionID      int64    `json:"question_id"`
	QuestionType    int64    `json:"question_type"`
	Title           string   `json:"title"`
	RichContent     any      `json:"rich_content,omitempty"`
	Items           []Option `json:"items"`
	ImageURL        string   `json:"image_url"`
	AudioURL        string   `json:"audio_url,omitempty"`
	TranscriptURL   string   `json:"transcript_url,omitempty"`
	ImageType       int64    `json:"image_type"`
	Answer          string   `json:"answer"`
	Analysis        string   `json:"analysis"`
	Skill           string   `json:"skill"`
	Difficulty      int64    `json:"difficulty"`
	Tags            string   `json:"tags"`
	LicenceID       int64    `json:"licence_id"`
	SubjectID       int64    `json:"subject_id"`
	ChapterID       int64    `json:"chapter_id"`
	ChapterName     string   `json:"chapter_name"`
	SubChapterID    int64    `json:"sub_chapter_id"`
	SubChapterName  string   `json:"sub_chapter_name"`
	CourseID        int64    `json:"course_id"`
	CourseName      string   `json:"course_name"`
	Sort            int64    `json:"sort"`
	ProvinceID      int64    `json:"province_id"`
	CityID          int64    `json:"city_id"`
	PackageID       string   `json:"package_id,omitempty"`
	PackageVersion  string   `json:"package_version,omitempty"`
	SourceItemID    string   `json:"source_item_id,omitempty"`
	NumberTolerance string   `json:"number_tolerance,omitempty"`
}

type Detail struct {
	Question       Question `json:"question"`
	State          string   `json:"state"`
	ImageAvailable bool     `json:"image_available"`
}

type Chapter struct {
	ChapterID   int64  `json:"chapter_id"`
	ChapterName string `json:"chapter_name"`
	Total       int64  `json:"total"`
}

type Overview struct {
	SubjectID      int64     `json:"subject_id"`
	Total          int64     `json:"total"`
	Mastered       int64     `json:"mastered"`
	Review         int64     `json:"review"`
	Unlearned      int64     `json:"unlearned"`
	LastQuestionID int64     `json:"last_question_id"`
	Chapters       []Chapter `json:"chapters"`
}

type Filter struct {
	SubjectID int64
	ChapterID int64
	Search    string
	State     string
	// Concept limits practice to items tagged with a concept of the unit.
	Concept string
}
