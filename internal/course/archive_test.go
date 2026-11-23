package course_test

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"test-driven-study/internal/course"
)

func TestPackZipDeterministicAndRoundTrips(t *testing.T) {
	srcDir := filepath.Join("..", "..", "courses", "golden-course-template")
	workDir := copyDirForTest(t, srcDir)
	if err := os.WriteFile(filepath.Join(workDir, ".DS_Store"), []byte("junk"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(workDir, "__MACOSX"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(workDir, "__MACOSX", "._course.json"), []byte("junk"), 0o644,
	); err != nil {
		t.Fatal(err)
	}

	outDir := t.TempDir()
	zipA := filepath.Join(outDir, "a.zip")
	zipB := filepath.Join(outDir, "b.zip")
	if err := course.PackZip(workDir, zipA); err != nil {
		t.Fatalf("PackZip A: %v", err)
	}
	if err := course.PackZip(workDir, zipB); err != nil {
		t.Fatalf("PackZip B: %v", err)
	}
	bytesA, err := os.ReadFile(zipA)
	if err != nil {
		t.Fatal(err)
	}
	bytesB, err := os.ReadFile(zipB)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(bytesA, bytesB) {
		t.Fatal("PackZip output is not deterministic")
	}

	// Ensure .DS_Store and __MACOSX were skipped.
	zr, err := zip.NewReader(bytes.NewReader(bytesA), int64(len(bytesA)))
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range zr.File {
		if entry.Name == ".DS_Store" || entry.Name == "__MACOSX" {
			t.Fatalf("unexpected metadata entry packed: %s", entry.Name)
		}
	}

	fromDir, err := course.LoadPath(workDir)
	if err != nil {
		t.Fatalf("LoadPath dir: %v", err)
	}
	fromZip, err := course.LoadPath(zipA)
	if err != nil {
		t.Fatalf("LoadPath zip: %v", err)
	}
	if fromDir.Digest != fromZip.Digest || fromDir.Manifest.ID != fromZip.Manifest.ID {
		t.Fatalf("digest mismatch: dir=%s zip=%s", fromDir.Digest, fromZip.Digest)
	}
	if !slices.Equal(fromDir.Files, fromZip.Files) {
		t.Fatalf("file list mismatch: dir=%v zip=%v", fromDir.Files, fromZip.Files)
	}
	storedCount := 0
	for _, filename := range fromZip.Files {
		if !fromZip.IsStoredAsset(filename) {
			continue
		}
		storedCount++
		dirBytes, err := fromDir.AssetData(filename)
		if err != nil {
			t.Fatalf("dir AssetData(%s): %v", filename, err)
		}
		zipBytes, err := fromZip.AssetData(filename)
		if err != nil {
			t.Fatalf("zip AssetData(%s): %v", filename, err)
		}
		if !bytes.Equal(dirBytes, zipBytes) {
			t.Fatalf("asset content mismatch for %s", filename)
		}
	}
	if storedCount == 0 {
		t.Fatal("expected stored assets in golden-course-template")
	}

	// PackZip must reject an invalid course directory.
	invalidDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(invalidDir, course.ManifestFile), []byte("{"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := course.PackZip(invalidDir, filepath.Join(outDir, "bad.zip")); err == nil {
		t.Fatal("PackZip accepted invalid course directory")
	}
}

func TestLoadZipSupportsRootAndSingleTopLevelDir(t *testing.T) {
	scaffoldParent := t.TempDir()
	courseDir, err := course.Scaffold(scaffoldParent, "zip-demo", "Zip Demo", "en")
	if err != nil {
		t.Fatal(err)
	}
	expected, err := course.Load(courseDir)
	if err != nil {
		t.Fatal(err)
	}

	rootZip := buildZipFromDir(t, courseDir, "")
	nestedZip := buildZipFromDir(t, courseDir, "zip-demo-v1/")

	for name, data := range map[string][]byte{
		"root":   rootZip,
		"nested": nestedZip,
	} {
		t.Run(name, func(t *testing.T) {
			pkg, err := course.LoadZipBytes(data)
			if err != nil {
				t.Fatalf("LoadZipBytes(%s): %v", name, err)
			}
			if pkg.Digest != expected.Digest || pkg.Manifest.ID != "zip-demo" {
				t.Fatalf("unexpected loaded package: %s vs %s", pkg.Digest, expected.Digest)
			}
		})
	}

	// Multiple top-level dirs with no root course.json must fail.
	multiZip := buildRawZip(t, []rawZipEntry{
		{name: "dir-a/course.json", data: []byte(`{}`)},
		{name: "dir-b/readme.txt", data: []byte("extra")},
	})
	if _, err := course.LoadZipBytes(multiZip); !errors.Is(err, course.ErrInvalidArchive) {
		t.Fatalf("expected ErrInvalidArchive for multiple top-level dirs, got %v", err)
	}

	// Missing course.json must fail.
	missingManifest := buildRawZip(t, []rawZipEntry{
		{name: "notes.txt", data: []byte("hello")},
	})
	if _, err := course.LoadZipBytes(missingManifest); !errors.Is(err, course.ErrInvalidArchive) {
		t.Fatalf("expected ErrInvalidArchive for missing manifest, got %v", err)
	}
}

func TestLoadZipSecurityGuardrails(t *testing.T) {
	cases := []struct {
		name    string
		entries []rawZipEntry
		wantErr error
	}{
		{
			name:    "empty archive",
			entries: nil,
			wantErr: course.ErrInvalidArchive,
		},
		{
			name:    "zip slip parent traversal",
			entries: []rawZipEntry{{name: "../evil.txt", data: []byte("x")}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name:    "zip slip nested traversal",
			entries: []rawZipEntry{{name: "pkg/../../evil.txt", data: []byte("x")}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name:    "absolute path",
			entries: []rawZipEntry{{name: "/etc/passwd", data: []byte("x")}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name:    "windows drive letter",
			entries: []rawZipEntry{{name: "C:/course.json", data: []byte("{}")}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name:    "backslash separator",
			entries: []rawZipEntry{{name: `pkg\course.json`, data: []byte("{}")}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name: "symlink entry",
			entries: []rawZipEntry{{
				name: "course.json",
				mode: os.ModeSymlink | 0o777,
				data: []byte("/etc/passwd"),
			}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name: "non-regular named pipe",
			entries: []rawZipEntry{{
				name: "course.json",
				mode: os.ModeNamedPipe | 0o644,
				data: nil,
			}},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name: "duplicate file entry",
			entries: []rawZipEntry{
				{name: "course.json", data: []byte("{}")},
				{name: "course.json", data: []byte("{}")},
			},
			wantErr: course.ErrInvalidArchive,
		},
		{
			name: "too many entries",
			entries: func() []rawZipEntry {
				list := make([]rawZipEntry, course.MaxZipEntries+1)
				for i := range list {
					list[i] = rawZipEntry{name: fmt.Sprintf("f/%04d.txt", i), data: []byte("a")}
				}
				return list
			}(),
			wantErr: course.ErrInvalidArchive,
		},
		{
			name: "single file exceeds 24 MiB",
			entries: []rawZipEntry{{
				name: "big.bin",
				data: make([]byte, course.MaxZipFileBytes+1),
			}},
			wantErr: course.ErrArchiveTooLarge,
		},
		{
			name: "total uncompressed size exceeds 64 MiB",
			entries: []rawZipEntry{
				{name: "part1.bin", data: make([]byte, 22<<20)},
				{name: "part2.bin", data: make([]byte, 22<<20)},
				{name: "part3.bin", data: make([]byte, 22<<20)},
			},
			wantErr: course.ErrArchiveTooLarge,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data := buildRawZip(t, tc.entries)
			if _, err := course.LoadZipBytes(data); !errors.Is(err, tc.wantErr) {
				t.Fatalf("got err=%v, want %v", err, tc.wantErr)
			}
		})
	}

	// Non-zip regular file rejected by LoadPath.
	txtPath := filepath.Join(t.TempDir(), "not-a-zip.txt")
	if err := os.WriteFile(txtPath, []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := course.LoadPath(txtPath); !errors.Is(err, course.ErrInvalidArchive) {
		t.Fatalf("LoadPath(.txt): got %v, want %v", err, course.ErrInvalidArchive)
	}
}

type rawZipEntry struct {
	name string
	mode fs.FileMode
	data []byte
}

func buildRawZip(t *testing.T, entries []rawZipEntry) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.name, Method: zip.Deflate}
		if entry.mode != 0 {
			header.SetMode(entry.mode)
		} else {
			header.SetMode(0o644)
		}
		w, err := zw.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if len(entry.data) > 0 {
			if _, err := w.Write(entry.data); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func buildZipFromDir(t *testing.T, dir, prefix string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	if prefix != "" {
		header := &zip.FileHeader{Name: "__MACOSX/._ignore", Method: zip.Deflate}
		header.SetMode(0o644)
		w, err := zw.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte("meta"))
		dsHeader := &zip.FileHeader{Name: prefix + ".DS_Store", Method: zip.Deflate}
		dsHeader.SetMode(0o644)
		w, err = zw.CreateHeader(dsHeader)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte("ds"))
	}
	err := filepath.WalkDir(dir, func(cur string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() {
			return walkErr
		}
		rel, err := filepath.Rel(dir, cur)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(cur)
		if err != nil {
			return err
		}
		header := &zip.FileHeader{
			Name:   prefix + filepath.ToSlash(rel),
			Method: zip.Deflate,
		}
		header.SetMode(0o644)
		w, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func copyDirForTest(t *testing.T, src string) string {
	t.Helper()
	dst := t.TempDir()
	err := filepath.WalkDir(src, func(cur string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(src, cur)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := os.ReadFile(cur)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
	if err != nil {
		t.Fatal(err)
	}
	return dst
}
