package main

import (
	"context"
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
		return errors.New("usage: course <new | check | install>")
	}
	switch args[0] {
	case "new":
		flags := flag.NewFlagSet("course new", flag.ContinueOnError)
		parent := flags.String("dir", "courses", "parent directory")
		id := flags.String("id", "", "stable course ID")
		title := flags.String("title", "", "display title")
		language := flags.String("language", "en", "language tag")
		if err := flags.Parse(args[1:]); err != nil {
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
	case "check":
		if len(args) != 2 {
			return errors.New("usage: course check <directory>")
		}
		return check(args[1])
	case "install":
		return install(args[1:])
	default:
		return fmt.Errorf("unknown course command %q", args[0])
	}
}

func install(args []string) error {
	flags := flag.NewFlagSet("course install", flag.ContinueOnError)
	directory := os.Getenv("STUDY_DATA_DIR")
	if directory == "" {
		directory = "var"
	}
	dataDirectory := flags.String("data-dir", directory, "application data directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: course install [--data-dir <directory>] <course directory>")
	}
	root, err := os.Getwd()
	if err != nil {
		return err
	}
	ctx := context.Background()
	db, err := storage.Open(ctx, root, *dataDirectory)
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

func check(directory string) error {
	pkg, err := course.Load(directory)
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
