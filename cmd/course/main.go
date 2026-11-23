package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: course <new | check | install | pack | deactivate | rollback>")
	}
	switch args[0] {
	case "new":
		return scaffold(args[1:])
	case "check":
		if len(args) != 2 {
			return errors.New("usage: course check <directory-or-zip>")
		}
		return check(args[1])
	case "install":
		return install(args[1:])
	case "pack":
		return pack(args[1:])
	case "deactivate":
		return deactivate(args[1:])
	case "rollback":
		return rollback(args[1:])
	default:
		return fmt.Errorf("unknown course command %q", args[0])
	}
}

func scaffold(args []string) error {
	flags := flag.NewFlagSet("course new", flag.ContinueOnError)
	parent := flags.String("dir", "courses", "parent directory")
	id := flags.String("id", "", "stable course ID")
	title := flags.String("title", "", "display title")
	language := flags.String("language", "en", "language tag")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("course new accepts only named options")
	}
	directory, err := course.Scaffold(*parent, *id, *title, *language)
	if err == nil {
		fmt.Println(directory)
	}
	return err
}

func defaultDataDir() string {
	if directory := os.Getenv("STUDY_DATA_DIR"); directory != "" {
		return directory
	}
	return "var"
}

func openDB(ctx context.Context, dataDirectory string) (*sql.DB, error) {
	root, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	return storage.Open(ctx, root, dataDirectory)
}

func install(args []string) error {
	flags := flag.NewFlagSet("course install", flag.ContinueOnError)
	dataDirectory := flags.String("data-dir", defaultDataDir(), "application data directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: course install [--data-dir <directory>] <directory-or-zip>")
	}
	ctx := context.Background()
	db, err := openDB(ctx, *dataDirectory)
	if err != nil {
		return err
	}
	defer db.Close()
	manifest, err := storage.InstallCourse(ctx, db, flags.Arg(0))
	if err == nil {
		fmt.Printf("installed %s@%s\n", manifest.ID, manifest.Version)
	}
	return err
}

func pack(args []string) error {
	flags := flag.NewFlagSet("course pack", flag.ContinueOnError)
	outPath := flags.String("out", "", "output .zip file path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() < 1 || flags.NArg() > 2 {
		return errors.New("usage: course pack [--out <file.zip>] <course-directory> [file.zip]")
	}
	courseDir := flags.Arg(0)
	target := strings.TrimSpace(*outPath)
	if flags.NArg() == 2 {
		if target != "" {
			return errors.New("specify output path with either --out or positional argument, not both")
		}
		target = flags.Arg(1)
	}
	pkg, err := course.Load(courseDir)
	if err != nil {
		return err
	}
	if target == "" {
		target = fmt.Sprintf("%s-%s.zip", pkg.Manifest.ID, pkg.Manifest.Version)
	}
	if err := course.PackZip(courseDir, target); err != nil {
		return err
	}
	fmt.Printf("packed %s@%s -> %s\n", pkg.Manifest.ID, pkg.Manifest.Version, target)
	return nil
}

func deactivate(args []string) error {
	flags := flag.NewFlagSet("course deactivate", flag.ContinueOnError)
	dataDirectory := flags.String("data-dir", defaultDataDir(), "application data directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: course deactivate [--data-dir <directory>] <course-id>")
	}
	courseID := flags.Arg(0)
	ctx := context.Background()
	db, err := openDB(ctx, *dataDirectory)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := storage.DeactivateCourse(ctx, db, courseID); err != nil {
		return err
	}
	fmt.Printf("deactivated %s\n", courseID)
	return nil
}

func rollback(args []string) error {
	flags := flag.NewFlagSet("course rollback", flag.ContinueOnError)
	dataDirectory := flags.String("data-dir", defaultDataDir(), "application data directory")
	versionFlag := flags.String("version", "", "target installed version")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() < 1 || flags.NArg() > 2 {
		return errors.New(
			"usage: course rollback [--data-dir <directory>] [--version <ver>] <course-id> [ver]",
		)
	}
	courseID := flags.Arg(0)
	targetVersion := strings.TrimSpace(*versionFlag)
	if flags.NArg() == 2 {
		if targetVersion != "" {
			return errors.New("specify version with either --version or positional argument, not both")
		}
		targetVersion = flags.Arg(1)
	}
	ctx := context.Background()
	db, err := openDB(ctx, *dataDirectory)
	if err != nil {
		return err
	}
	defer db.Close()
	activated, err := storage.RollbackCourse(ctx, db, courseID, targetVersion)
	if err != nil {
		return err
	}
	fmt.Printf("rolled back %s to %s\n", courseID, activated)
	return nil
}

func check(target string) error {
	pkg, err := course.LoadPath(target)
	if err != nil {
		return err
	}
	itemCount := 0
	for _, unit := range pkg.Units {
		itemCount += len(unit.Items)
	}
	fmt.Printf("%s@%s: %d units, %d items, sha256:%s\n",
		pkg.Manifest.ID, pkg.Manifest.Version, len(pkg.Units), itemCount, pkg.Digest)
	if roadmap := pkg.Manifest.Roadmap; roadmap != nil {
		for _, group := range roadmap.Prerequisites {
			fmt.Printf("roadmap %s: %s\n", group.Strength, strings.Join(group.AllOf, " + "))
		}
		if len(roadmap.ParallelWith) > 0 {
			fmt.Printf("roadmap parallel: %s\n", strings.Join(roadmap.ParallelWith, ", "))
		}
	}
	summary := pkg.ConceptSummary()
	if summary.Concepts == 0 && summary.TaggedItems == 0 {
		return nil
	}
	fmt.Printf("concepts: %d, prerequisite groups: %d, tagged items: %d, untagged items: %d\n",
		summary.Concepts, summary.Groups, summary.TaggedItems, summary.UntaggedItems)
	for _, id := range summary.SparseConcepts {
		fmt.Printf("warning: concept %q has fewer than three tagged items\n", id)
	}
	return nil
}
