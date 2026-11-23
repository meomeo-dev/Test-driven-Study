package course

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const (
	// MaxZipBytes bounds both compressed zip inputs and total extracted bytes.
	MaxZipBytes = 64 << 20
	// MaxZipEntries bounds the total number of entries in a course zip archive.
	MaxZipEntries = 2000
	// MaxZipFileBytes bounds any single extracted file in a course zip archive.
	MaxZipFileBytes = 24 << 20
)

var (
	// ErrArchiveTooLarge reports an archive exceeding compressed, total, or file limits.
	ErrArchiveTooLarge = errors.New("course archive exceeds size limit")
	// ErrInvalidArchive reports a malformed or unsafe zip course archive.
	ErrInvalidArchive = errors.New("invalid course archive")
)

// AssetData returns a copy of a preloaded stored asset from a package loaded
// via LoadPath or LoadZipBytes.
func (pkg Package) AssetData(filename string) ([]byte, error) {
	if !pkg.IsStoredAsset(filename) {
		return nil, fs.ErrNotExist
	}
	data, ok := pkg.assets[filename]
	if !ok {
		return nil, fs.ErrNotExist
	}
	return bytes.Clone(data), nil
}

// LoadPath loads and validates a course package from either a directory or a
// local .zip archive, preloading stored assets and cleaning up temporary files.
func LoadPath(target string) (*Package, error) {
	info, err := os.Stat(target)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return loadDirWithAssets(target)
	}
	if !info.Mode().IsRegular() || !strings.EqualFold(filepath.Ext(target), ".zip") {
		return nil, fmt.Errorf("%w: expected a course directory or .zip archive",
			ErrInvalidArchive)
	}
	if info.Size() > MaxZipBytes {
		return nil, fmt.Errorf("%w: archive exceeds %d bytes",
			ErrArchiveTooLarge, MaxZipBytes)
	}
	file, err := os.Open(target)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, MaxZipBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > MaxZipBytes {
		return nil, fmt.Errorf("%w: archive exceeds %d bytes",
			ErrArchiveTooLarge, MaxZipBytes)
	}
	return LoadZipBytes(data)
}

// LoadZipBytes validates and extracts a zip archive into a temporary directory,
// runs full course.Load validation, preloads stored assets, and removes the
// temporary directory before returning.
func LoadZipBytes(data []byte) (*Package, error) {
	if int64(len(data)) > MaxZipBytes {
		return nil, fmt.Errorf("%w: archive exceeds %d bytes",
			ErrArchiveTooLarge, MaxZipBytes)
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidArchive, err)
	}
	tmpDir, err := os.MkdirTemp("", "course-zip-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)
	if err := extractSafeZip(reader, tmpDir); err != nil {
		return nil, err
	}
	courseDir, err := resolveArchiveCourseDir(tmpDir)
	if err != nil {
		return nil, err
	}
	return loadDirWithAssets(courseDir)
}

// PackZip validates courseDir with Load and writes a deterministic zip archive
// to outPath, skipping macOS metadata files such as .DS_Store.
func PackZip(courseDir, outPath string) error {
	if _, err := Load(courseDir); err != nil {
		return err
	}
	absCourse, err := filepath.Abs(courseDir)
	if err != nil {
		return err
	}
	absOut, err := filepath.Abs(outPath)
	if err != nil {
		return err
	}
	relFiles, err := collectPackFiles(absCourse, absOut)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(absOut), 0o755); err != nil {
		return err
	}
	tmpFile, err := os.CreateTemp(filepath.Dir(absOut), ".course-pack-*.zip")
	if err != nil {
		return err
	}
	tmpName := tmpFile.Name()
	defer os.Remove(tmpName)
	if err := writeDeterministicZip(tmpFile, absCourse, relFiles); err != nil {
		tmpFile.Close()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, absOut)
}

func loadDirWithAssets(directory string) (*Package, error) {
	pkg, err := Load(directory)
	if err != nil {
		return nil, err
	}
	if err := populateStoredAssets(directory, &pkg); err != nil {
		return nil, err
	}
	return &pkg, nil
}

func populateStoredAssets(directory string, pkg *Package) error {
	root, err := os.OpenRoot(directory)
	if err != nil {
		return err
	}
	defer root.Close()
	assets := make(map[string][]byte)
	for _, filename := range pkg.Files {
		if !pkg.IsStoredAsset(filename) {
			continue
		}
		data, err := pkg.ReadAsset(root, filename)
		if err != nil {
			return err
		}
		assets[filename] = data
	}
	pkg.assets = assets
	return nil
}

func extractSafeZip(reader *zip.Reader, tmpDir string) error {
	if len(reader.File) == 0 {
		return fmt.Errorf("%w: archive is empty", ErrInvalidArchive)
	}
	if len(reader.File) > MaxZipEntries {
		return fmt.Errorf("%w: archive exceeds %d entries",
			ErrInvalidArchive, MaxZipEntries)
	}
	root, err := os.OpenRoot(tmpDir)
	if err != nil {
		return err
	}
	defer root.Close()

	seenFiles := make(map[string]bool, len(reader.File))
	var totalBytes int64
	for _, entry := range reader.File {
		relPath, isDir, err := validateZipEntry(entry)
		if err != nil {
			return err
		}
		if isArchiveMetadata(relPath) {
			continue
		}
		if isDir {
			if err := root.MkdirAll(relPath, 0o755); err != nil {
				return err
			}
			continue
		}
		if seenFiles[relPath] {
			return fmt.Errorf("%w: duplicate entry %q", ErrInvalidArchive, relPath)
		}
		seenFiles[relPath] = true
		written, err := extractZipFile(root, entry, relPath, &totalBytes)
		if err != nil {
			return err
		}
		_ = written
	}
	return nil
}

func validateZipEntry(entry *zip.File) (string, bool, error) {
	raw := entry.Name
	if raw == "" || strings.ContainsRune(raw, '\x00') ||
		strings.ContainsRune(raw, '\\') || strings.HasPrefix(raw, "/") {
		return "", false, fmt.Errorf("%w: unsafe path %q", ErrInvalidArchive, raw)
	}
	isDir := strings.HasSuffix(raw, "/")
	trimmed := strings.TrimSuffix(raw, "/")
	if trimmed == "" || !fs.ValidPath(trimmed) {
		return "", false, fmt.Errorf("%w: invalid path %q", ErrInvalidArchive, raw)
	}
	segments := strings.Split(trimmed, "/")
	for _, seg := range segments {
		if seg == "" || seg == "." || seg == ".." || strings.ContainsRune(seg, ':') {
			return "", false, fmt.Errorf("%w: unsafe path %q", ErrInvalidArchive, raw)
		}
	}
	mode := entry.Mode()
	if mode&os.ModeSymlink != 0 {
		return "", false, fmt.Errorf("%w: symlink entry %q is not allowed",
			ErrInvalidArchive, raw)
	}
	if isDir || entry.FileInfo().IsDir() {
		if mode.Type() != 0 && mode.Type() != os.ModeDir {
			return "", false, fmt.Errorf("%w: unsupported entry mode for %q",
				ErrInvalidArchive, raw)
		}
		if entry.UncompressedSize64 > 0 {
			return "", false, fmt.Errorf("%w: directory entry %q has content",
				ErrInvalidArchive, raw)
		}
		return trimmed, true, nil
	}
	if !mode.IsRegular() {
		return "", false, fmt.Errorf("%w: non-regular entry %q is not allowed",
			ErrInvalidArchive, raw)
	}
	if entry.UncompressedSize64 > MaxZipFileBytes {
		return "", false, fmt.Errorf("%w: %q exceeds %d bytes",
			ErrArchiveTooLarge, raw, MaxZipFileBytes)
	}
	return trimmed, false, nil
}

func extractZipFile(
	root *os.Root, entry *zip.File, relPath string, totalBytes *int64,
) (int64, error) {
	if parent := path.Dir(relPath); parent != "." {
		if err := root.MkdirAll(parent, 0o755); err != nil {
			return 0, err
		}
	}
	src, err := entry.Open()
	if err != nil {
		return 0, fmt.Errorf("%w: open %q: %v", ErrInvalidArchive, relPath, err)
	}
	defer src.Close()

	dst, err := root.OpenFile(relPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return 0, err
	}
	remainingTotal := MaxZipBytes - *totalBytes
	limit := min(int64(MaxZipFileBytes), remainingTotal)
	if limit < 0 {
		dst.Close()
		return 0, fmt.Errorf("%w: total extracted size exceeds %d bytes",
			ErrArchiveTooLarge, MaxZipBytes)
	}
	n, err := io.Copy(dst, io.LimitReader(src, limit+1))
	closeErr := dst.Close()
	if err != nil {
		return 0, err
	}
	if closeErr != nil {
		return 0, closeErr
	}
	if n > MaxZipFileBytes {
		return 0, fmt.Errorf("%w: %q exceeds %d bytes",
			ErrArchiveTooLarge, relPath, MaxZipFileBytes)
	}
	*totalBytes += n
	if *totalBytes > MaxZipBytes {
		return 0, fmt.Errorf("%w: total extracted size exceeds %d bytes",
			ErrArchiveTooLarge, MaxZipBytes)
	}
	return n, nil
}

func resolveArchiveCourseDir(tmpDir string) (string, error) {
	if isRegularFile(filepath.Join(tmpDir, ManifestFile)) {
		return tmpDir, nil
	}
	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		return "", err
	}
	if len(entries) == 1 && entries[0].IsDir() {
		nested := filepath.Join(tmpDir, entries[0].Name())
		if isRegularFile(filepath.Join(nested, ManifestFile)) {
			return nested, nil
		}
	}
	return "", fmt.Errorf(
		"%w: missing %s at archive root or single top-level directory",
		ErrInvalidArchive, ManifestFile,
	)
}

func isRegularFile(filename string) bool {
	info, err := os.Lstat(filename)
	return err == nil && info.Mode().IsRegular()
}

func isArchiveMetadata(relPath string) bool {
	if relPath == "__MACOSX" || strings.HasPrefix(relPath, "__MACOSX/") {
		return true
	}
	return path.Base(relPath) == ".DS_Store"
}

func collectPackFiles(absCourse, absOut string) ([]string, error) {
	var files []string
	var totalBytes int64
	err := filepath.WalkDir(absCourse, func(cur string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if cur == absCourse {
			return nil
		}
		if cur == absOut {
			return nil
		}
		name := d.Name()
		if name == ".DS_Store" || name == "__MACOSX" || name == ".git" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("%w: symlink %q cannot be packed", ErrInvalidArchive, name)
		}
		if d.IsDir() {
			return nil
		}
		if !d.Type().IsRegular() {
			return fmt.Errorf("%w: non-regular file %q cannot be packed",
				ErrInvalidArchive, name)
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if info.Size() > MaxZipFileBytes {
			return fmt.Errorf("%w: %q exceeds %d bytes",
				ErrArchiveTooLarge, name, MaxZipFileBytes)
		}
		totalBytes += info.Size()
		if totalBytes > MaxZipBytes {
			return fmt.Errorf("%w: total size exceeds %d bytes",
				ErrArchiveTooLarge, MaxZipBytes)
		}
		rel, err := filepath.Rel(absCourse, cur)
		if err != nil {
			return err
		}
		files = append(files, filepath.ToSlash(rel))
		if len(files) > MaxZipEntries {
			return fmt.Errorf("%w: package exceeds %d files",
				ErrInvalidArchive, MaxZipEntries)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	slices.Sort(files)
	return files, nil
}

func writeDeterministicZip(w io.Writer, absCourse string, relFiles []string) error {
	zw := zip.NewWriter(w)
	root, err := os.OpenRoot(absCourse)
	if err != nil {
		zw.Close()
		return err
	}
	defer root.Close()
	epoch := time.Unix(0, 0).UTC()
	for _, rel := range relFiles {
		header := &zip.FileHeader{
			Name:     rel,
			Method:   zip.Deflate,
			Modified: epoch,
		}
		header.SetMode(0o644)
		entryWriter, err := zw.CreateHeader(header)
		if err != nil {
			zw.Close()
			return err
		}
		src, err := openRegular(root, rel)
		if err != nil {
			zw.Close()
			return err
		}
		_, copyErr := io.Copy(entryWriter, src)
		closeErr := src.Close()
		if copyErr != nil {
			zw.Close()
			return copyErr
		}
		if closeErr != nil {
			zw.Close()
			return closeErr
		}
	}
	return zw.Close()
}
