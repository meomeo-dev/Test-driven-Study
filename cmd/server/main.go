package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
	"test-driven-study/internal/tts"
)

func main() {
	if err := run(); err != nil {
		slog.Error("application stopped", "error", err)
		os.Exit(1)
	}
}

func value(name, fallback string) string {
	if content := os.Getenv(name); content != "" {
		return content
	}
	return fallback
}

func localPort(name, fallback string) (string, error) {
	port := value(name, fallback)
	number, err := strconv.Atoi(port)
	if err != nil || number < 1024 || number > 65535 {
		return "", fmt.Errorf("invalid %s", name)
	}
	return port, nil
}

func run() error {
	root, err := os.Getwd()
	if err != nil {
		return err
	}
	apiPort, err := localPort("STUDY_API_PORT", "43388")
	if err != nil {
		return err
	}
	webPort, err := localPort("STUDY_WEB_PORT", "43387")
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	dataDirectory := value("STUDY_DATA_DIR", filepath.Join(root, "var"))
	db, err := storage.Open(ctx, root, dataDirectory)
	if err != nil {
		return err
	}
	defer db.Close()
	studyService := study.New(db, root)
	planner, palaces, err := sharedServices(ctx, db, studyService, root, dataDirectory)
	if err != nil {
		return err
	}
	if planner != nil {
		defer planner.Close()
		defer palaces.Close()
	}
	ttsService := tts.New(root, dataDirectory)
	server := &http.Server{Addr: "127.0.0.1:" + apiPort,
		Handler:           httpapi.New(studyService, palaces, root, apiPort, webPort, planner, ttsService),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second}
	return serve(ctx, server)
}

func sharedServices(
	ctx context.Context, db *sql.DB, studyService *study.Service, root, dataDirectory string,
) (*llm.Service, *palace.Service, error) {
	planner, err := llm.New(ctx, llm.Options{DB: db, DataDirectory: dataDirectory,
		Config: llm.LoadConfig(root),
		ResolvePalacePrompts: studyService.PalacePrompts,
		GeneralQuestion: func(ctx context.Context, id int64) bool {
			detail, err := studyService.Detail(ctx, id)
			return err == nil && detail.Question.PackageID != ""
		},
		ResolveImages: func(ctx context.Context, id int64) ([]llm.InputImage, error) {
			detail, err := studyService.Detail(ctx, id)
			if err != nil {
				return nil, err
			}
			if detail.Question.ImageURL == "" {
				return nil, nil
			}
			data, err := studyService.ReadQuestionImage(ctx, detail.Question)
			if err != nil {
				return nil, err
			}
			return llm.DecodeQuestionImages(data)
		}})
	if err != nil {
		return nil, nil, err
	}
	palaces, err := palace.New(ctx, palace.Options{DB: db, Study: studyService, Root: root,
		DataDirectory: dataDirectory, Config: palace.LoadConfig(root), ResolvePlan: planner.Resolve,
		DiscardPlan: planner.DiscardPaused,
		Planner:     palacePlanner{service: planner, root: root, study: studyService}})
	if err != nil {
		planner.Close()
		return nil, nil, err
	}
	return planner, palaces, nil
}

func serve(ctx context.Context, server *http.Server) error {
	result := make(chan error, 1)
	go func() { result <- server.ListenAndServe() }()
	slog.Info("API ready", "url", "http://"+server.Addr)
	select {
	case err := <-result:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}
