package storage

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Open(ctx context.Context, root, dataDirectory string) (*sql.DB, error) {
	if err := os.MkdirAll(dataDirectory, 0700); err != nil {
		return nil, err
	}
	filename, err := filepath.Abs(filepath.Join(dataDirectory, "study.sqlite"))
	if err != nil {
		return nil, err
	}
	location := (&url.URL{Scheme: "file", Path: filename}).String()
	db, err := sql.Open("sqlite", location+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := initialize(ctx, db, root); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func initialize(ctx context.Context, db *sql.DB, root string) error {
	migrationFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, db, migrationFS)
	if err != nil {
		return fmt.Errorf("prepare migrations: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	if err := seedCourses(ctx, db, root); err != nil {
		return err
	}
	return initializeWorkspace(ctx, db)
}
