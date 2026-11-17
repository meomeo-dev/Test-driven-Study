package study

type Rate struct {
	Attempts int64    `json:"attempts"`
	Correct  int64    `json:"correct"`
	Accuracy *float64 `json:"accuracy"`
}

type ChapterAnalysis struct {
	ChapterID         int64    `json:"chapter_id"`
	ChapterName       string   `json:"chapter_name"`
	Total             int64    `json:"total"`
	Attempts          int64    `json:"attempts"`
	WrongAttempts     int64    `json:"wrong_attempts"`
	UniqueQuestions   int64    `json:"unique_questions"`
	LatestIncorrect   int64    `json:"latest_incorrect"`
	ImprovedQuestions int64    `json:"improved_questions"`
	ErrorRate         *float64 `json:"error_rate"`
	RecentAccuracy    *float64 `json:"recent_accuracy"`
}

type DailyAnalysis struct {
	Day      string `json:"day"`
	Attempts int64  `json:"attempts"`
	Correct  int64  `json:"correct"`
}

type PeriodComparison struct {
	Current  Rate     `json:"current"`
	Previous Rate     `json:"previous"`
	ChangePP *float64 `json:"change_pp"`
}

type ScoreForecast struct {
	Score            *float64 `json:"score"`
	Status           string   `json:"status"`
	SampleQuestions  int64    `json:"sample_questions"`
	MissingChapters  int64    `json:"missing_chapters"`
	Basis            string   `json:"basis"`
	MinimumQuestions int64    `json:"minimum_questions"`
}

type Analysis struct {
	SubjectID             int64             `json:"subject_id"`
	WindowDays            int               `json:"window_days"`
	AsOfMS                int64             `json:"as_of_ms"`
	SinceMS               *int64            `json:"since_ms"`
	TotalQuestions        int64             `json:"total_questions"`
	UniqueQuestions       int64             `json:"unique_questions"`
	Coverage              float64           `json:"coverage"`
	Overall               Rate              `json:"overall"`
	First                 Rate              `json:"first"`
	Repeat                Rate              `json:"repeat"`
	PriorExposureAttempts int64             `json:"prior_exposure_attempts"`
	LatestIncorrect       int64             `json:"latest_incorrect"`
	ImprovedQuestions     int64             `json:"improved_questions"`
	RecentAccuracy        *float64          `json:"recent_accuracy"`
	HalfLifeDays          int               `json:"half_life_days"`
	LastAttemptMS         *int64            `json:"last_attempt_ms"`
	Comparison            PeriodComparison  `json:"comparison"`
	Chapters              []ChapterAnalysis `json:"chapters"`
	Trend                 []DailyAnalysis   `json:"trend"`
	TrendDays             int               `json:"trend_days"`
	Forecast              ScoreForecast     `json:"forecast"`
	Advice                []string          `json:"advice"`
	RecentAttempts        []Attempt         `json:"recent_attempts"`
}
