package llm

import (
	"context"

	"test-driven-study/internal/storage/storedb"
)

func (s *Service) ConversationCoverage(ctx context.Context, subject int64) ([]storedb.ConversationCoverageRow, error) {
	if subject == 2 || subject == 3 {
		return nil, ErrInvalid
	}
	if subject != 1 && subject != 4 {
		if _, err := s.queries.GetWorkspaceUnit(ctx, subject); err != nil {
			return nil, ErrInvalid
		}
	}
	return s.queries.ConversationCoverage(ctx, subject)
}
