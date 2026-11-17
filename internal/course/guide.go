package course

type CourseGuide struct {
	Reviewed     string              `json:"reviewed"`
	Sources      []CourseGuideSource `json:"sources"`
	Stages       []CourseGuideStage  `json:"stages"`
	HourNotes    []string            `json:"hour_notes"`
	BookingNotes []string            `json:"booking_notes"`
	TotalHours   map[string]int      `json:"total_hours"`
}

type CourseGuideSource struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Date      string `json:"date"`
	Publisher string `json:"publisher"`
	URL       string `json:"url"`
}

type CourseGuideStage struct {
	ID            int64               `json:"id"`
	Title         string              `json:"title"`
	Short         string              `json:"short"`
	Official      string              `json:"official"`
	Hours         map[string]int      `json:"hours"`
	Pass          int                 `json:"pass"`
	Format        string              `json:"format"`
	Learning      []string            `json:"learning"`
	Exam          []string            `json:"exam"`
	Refs          []string            `json:"refs"`
	Prerequisites map[string][]string `json:"prerequisites"`
}
