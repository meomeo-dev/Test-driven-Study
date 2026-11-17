package course

const (
	SingleChoice   = "single_choice"
	MultipleChoice = "multiple_choice"
	TrueFalse      = "true_false"
	Numeric        = "numeric"
)

type Manifest struct {
	ProtocolVersion int                `json:"protocol_version"`
	ID              string             `json:"course_id"`
	Version         string             `json:"version"`
	Title           string             `json:"title"`
	Language        string             `json:"language"`
	Description     string             `json:"description,omitempty"`
	Logo            string             `json:"logo,omitempty"`
	Units           []Unit             `json:"units"`
	AIProfile       *AIProfileRef      `json:"ai_profile,omitempty"`
	Roadmap         *Roadmap           `json:"roadmap,omitempty"`
}

// Prerequisite strengths record how firmly the course README states a
// relation. Both order the roadmap; neither blocks opening a course.
const (
	StrengthRequired    = "required"
	StrengthRecommended = "recommended"
)

// Roadmap relates a course to other installed courses. Note quotes the README
// sentence that states the relations. Prerequisites are alternative groups in
// disjunctive normal form, like concept prerequisites; ParallelWith lists
// courses to study alongside, which orders nothing.
type Roadmap struct {
	Note          string               `json:"note"`
	Prerequisites []CoursePrerequisite `json:"prerequisites,omitempty"`
	ParallelWith  []string             `json:"parallel_with,omitempty"`
}

type CoursePrerequisite struct {
	AllOf    []string `json:"all_of"`
	Strength string   `json:"strength"`
}

type Unit struct {
	ID           string      `json:"id"`
	Title        string      `json:"title"`
	QuestionFile string      `json:"question_file,omitempty"`
	Lessons      []LessonRef `json:"lessons,omitempty"`
	Concepts     []Concept   `json:"concepts,omitempty"`
}

// Concept is one node of a course's knowledge graph. Prerequisites are
// alternative groups: the concept unlocks when every member of any one group
// is satisfied, which expresses AND/OR rules in disjunctive normal form.
type Concept struct {
	ID               string              `json:"id"`
	Title            string              `json:"title"`
	Summary          string              `json:"summary,omitempty"`
	EstimatedMinutes int                 `json:"estimated_minutes"`
	Lesson           string              `json:"lesson,omitempty"`
	Prerequisites    []PrerequisiteGroup `json:"prerequisites,omitempty"`
}

type PrerequisiteGroup struct {
	AllOf []string `json:"all_of"`
}

type LessonRef struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	File  string `json:"file"`
}

type Option struct {
	ID    string `json:"id"`
	Text  string `json:"text"`
	Value *bool  `json:"value,omitempty"`
}

type Prompt struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	Stem       string   `json:"stem"`
	Chapter    string   `json:"chapter,omitempty"`
	Image      string   `json:"image,omitempty"`
	Audio      string   `json:"audio,omitempty"`
	Transcript string   `json:"transcript,omitempty"`
	Options    []Option `json:"options,omitempty"`
}

type Grading struct {
	ChoiceIDs         []string `json:"choice_ids,omitempty"`
	Boolean           *bool    `json:"boolean,omitempty"`
	Value             string   `json:"value,omitempty"`
	AbsoluteTolerance string   `json:"absolute_tolerance,omitempty"`
}

// Item is the authored question. Concept tags stay outside the learner-facing
// Prompt so that they never reach the browser or AI prompts.
type Item struct {
	Prompt
	Explanation string   `json:"explanation,omitempty"`
	Hint        string   `json:"hint,omitempty"`
	Concepts    []string `json:"concepts,omitempty"`
	Grading     Grading  `json:"grading"`
}

type Response struct {
	ChoiceIDs []string `json:"choice_ids,omitempty"`
	Boolean   *bool    `json:"boolean,omitempty"`
	Value     *string  `json:"value,omitempty"`
}
