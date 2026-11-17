package study

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"test-driven-study/internal/storage/storedb"
)

var ErrInvalid = errors.New("invalid study request")

type Service struct {
	db             *sql.DB
	queries        *storedb.Queries
	imageDirectory string
}

func New(db *sql.DB, root string) *Service {
	return &Service{
		db:             db,
		queries:        storedb.New(db),
		imageDirectory: filepath.Join(root, "assets", "img"),
	}
}

func (s *Service) Overview(ctx context.Context, subject int64) (Overview, error) {
	counts, err := s.queries.SubjectOverview(ctx, subject)
	if err != nil {
		return Overview{}, err
	}
	chapters, err := s.queries.ListChapters(ctx, subject)
	if err != nil {
		return Overview{}, err
	}
	result := Overview{SubjectID: subject, Total: counts.Total, Mastered: counts.Mastered,
		Review: counts.Review, Unlearned: counts.Total - counts.Mastered - counts.Review,
		Chapters: make([]Chapter, 0, len(chapters))}
	for _, chapter := range chapters {
		name := chapter.ChapterName
		if chapter.ChapterID == 0 {
			name = "未分类"
		}
		result.Chapters = append(result.Chapters, Chapter{chapter.ChapterID, name, chapter.Total})
	}
	cursor, err := s.queries.GetCursor(ctx, subject)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Overview{}, err
	}
	result.LastQuestionID = cursor
	return result, nil
}

func (s *Service) Questions(ctx context.Context, filter Filter) ([]storedb.ListQuestionsRow, error) {
	return s.queries.ListQuestions(ctx, storedb.ListQuestionsParams{
		SubjectID: filter.SubjectID, ChapterID: filter.ChapterID, Search: filter.Search, State: filter.State,
	})
}

func (s *Service) Detail(ctx context.Context, id int64) (Detail, error) {
	payload, err := s.queries.GetQuestion(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	var result Detail
	if err := json.Unmarshal([]byte(payload), &result.Question); err != nil {
		return Detail{}, err
	}
	result.State, err = s.queries.GetProgress(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		result.State = "unlearned"
	} else if err != nil {
		return Detail{}, err
	}
	result.ImageAvailable = s.questionImageAvailable(ctx, result.Question)
	return result, nil
}

func (s *Service) questionImageAvailable(ctx context.Context, q Question) bool {
	if q.ImageURL == "" {
		return false
	}
	if q.PackageID == "" {
		return s.imageAvailable(q.ImageURL)
	}
	_, err := s.CourseAsset(ctx, q.PackageID, q.PackageVersion, q.ImageURL)
	return err == nil
}

func (s *Service) ReadQuestionImage(ctx context.Context, q Question) ([]byte, error) {
	if q.PackageID != "" {
		return s.CourseAsset(ctx, q.PackageID, q.PackageVersion, q.ImageURL)
	}
	if !s.imageAvailable(q.ImageURL) {
		return nil, os.ErrNotExist
	}
	return os.ReadFile(filepath.Join(s.imageDirectory, q.ImageURL))
}

func (s *Service) WorkspaceUnit(ctx context.Context, id int64) (storedb.CourseUnit, error) {
	return s.queries.GetWorkspaceUnit(ctx, id)
}

func (s *Service) imageAvailable(filename string) bool {
	if filename == "" || filepath.Base(filename) != filename {
		return false
	}
	info, err := os.Stat(filepath.Join(s.imageDirectory, filename))
	return err == nil && info.Mode().IsRegular()
}

func (s *Service) SetProgress(ctx context.Context, id int64, state string) error {
	if state != "mastered" && state != "review" && state != "unlearned" {
		return ErrInvalid
	}
	if _, err := s.queries.GetQuestion(ctx, id); err != nil {
		return err
	}
	if state == "unlearned" {
		return s.queries.ClearProgress(ctx, id)
	}
	return s.queries.SetProgress(ctx, storedb.SetProgressParams{
		QuestionID: id, State: state, UpdatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (s *Service) SetCursor(ctx context.Context, subject, id int64) error {
	detail, err := s.Detail(ctx, id)
	if err != nil {
		return err
	}
	if detail.Question.SubjectID != subject {
		return fmt.Errorf("%w: subject mismatch", ErrInvalid)
	}
	return s.queries.SetCursor(ctx, storedb.SetCursorParams{SubjectID: subject, QuestionID: id})
}
