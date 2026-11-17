package palace

import (
	"context"
	"test-driven-study/internal/storage/storedb"
)

func (s *Service) Coverage(ctx context.Context, subject int64) ([]storedb.PalaceCoverageRow, error) {
	return s.queries.PalaceCoverage(ctx, subject)
}
