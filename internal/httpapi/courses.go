package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

const maxCourseUploadOverhead = 64 << 10

func (s *Server) courses(w http.ResponseWriter, r *http.Request) {
	value, err := s.study.Courses(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) guide(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.Guide(r.Context(), subject)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) courseDB(w http.ResponseWriter) (*sql.DB, bool) {
	if s.study == nil || s.study.DB() == nil {
		problem(w, http.StatusServiceUnavailable, "课程存储未就绪")
		return nil, false
	}
	return s.study.DB(), true
}

func (s *Server) coursePackages(w http.ResponseWriter, r *http.Request) {
	db, ok := s.courseDB(w)
	if !ok {
		return
	}
	packages, err := storage.ListInstalledPackages(r.Context(), db)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"packages": packages})
}

func (s *Server) installCoursePackage(w http.ResponseWriter, r *http.Request) {
	db, ok := s.courseDB(w)
	if !ok {
		return
	}
	data, status, message := readUploadedCourseZip(w, r)
	if status != 0 {
		problem(w, status, message)
		return
	}
	manifest, err := storage.InstallCourseZip(r.Context(), db, data)
	if err != nil {
		respondCourseInstallError(w, err)
		return
	}
	packages, err := storage.ListInstalledPackages(r.Context(), db)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"course_id": manifest.ID,
		"version":   manifest.Version,
		"title":     manifest.Title,
		"active":    true,
		"packages":  packages,
	})
}

func (s *Server) activateCourseVersion(w http.ResponseWriter, r *http.Request) {
	db, ok := s.courseDB(w)
	if !ok {
		return
	}
	courseID := r.PathValue("course")
	version := r.PathValue("version")
	if !course.ValidID(courseID) || strings.TrimSpace(version) == "" {
		problem(w, http.StatusBadRequest, "课程或版本参数无效")
		return
	}
	if err := storage.ActivateCourseVersion(r.Context(), db, courseID, version); err != nil {
		respondCourseLifecycleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"course_id": courseID,
		"version":   version,
		"active":    true,
	})
}

func (s *Server) deactivateCourse(w http.ResponseWriter, r *http.Request) {
	db, ok := s.courseDB(w)
	if !ok {
		return
	}
	courseID := r.PathValue("course")
	if !course.ValidID(courseID) {
		problem(w, http.StatusBadRequest, "课程参数无效")
		return
	}
	if err := storage.DeactivateCourse(r.Context(), db, courseID); err != nil {
		respondCourseLifecycleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"course_id": courseID,
		"active":    false,
	})
}

func readUploadedCourseZip(w http.ResponseWriter, r *http.Request) ([]byte, int, string) {
	r.Body = http.MaxBytesReader(w, r.Body, course.MaxZipBytes+maxCourseUploadOverhead)
	reader, err := r.MultipartReader()
	if err != nil {
		if isMaxBytesError(err) {
			return nil, http.StatusRequestEntityTooLarge, "上传的课程包超过 64 MiB 大小限制"
		}
		return nil, http.StatusBadRequest, "请通过表单字段 file 上传 .zip 课程包"
	}
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, http.StatusBadRequest, "缺少课程包文件字段 file"
		}
		if err != nil {
			if isMaxBytesError(err) {
				return nil, http.StatusRequestEntityTooLarge, "上传的课程包超过 64 MiB 大小限制"
			}
			return nil, http.StatusBadRequest, "无法读取上传的课程包数据"
		}
		if part.FormName() != "file" {
			_ = part.Close()
			continue
		}
		if name := strings.TrimSpace(part.FileName()); name != "" &&
			!strings.EqualFold(filepath.Ext(name), ".zip") {
			_ = part.Close()
			return nil, http.StatusBadRequest, "仅支持导入 .zip 格式的课程包"
		}
		data, readErr := io.ReadAll(io.LimitReader(part, course.MaxZipBytes+1))
		_ = part.Close()
		if readErr != nil {
			if isMaxBytesError(readErr) {
				return nil, http.StatusRequestEntityTooLarge, "上传的课程包超过 64 MiB 大小限制"
			}
			return nil, http.StatusBadRequest, "读取上传的课程包失败"
		}
		if int64(len(data)) > course.MaxZipBytes {
			return nil, http.StatusRequestEntityTooLarge, "上传的课程包超过 64 MiB 大小限制"
		}
		if len(data) == 0 {
			return nil, http.StatusBadRequest, "上传的课程包文件为空"
		}
		return data, 0, ""
	}
}

func isMaxBytesError(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr)
}

func respondCourseInstallError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, context.Canceled):
		return
	case errors.Is(err, course.ErrArchiveTooLarge):
		problem(w, http.StatusRequestEntityTooLarge, "课程包体积或解压内容超过限制")
	case errors.Is(err, study.ErrConflict):
		problem(w, http.StatusConflict, "课程版本冲突或与已激活课程形成先修环："+err.Error())
	case errors.Is(err, course.ErrInvalidArchive), errors.Is(err, study.ErrInvalid):
		problem(w, http.StatusBadRequest, "课程包校验失败："+err.Error())
	default:
		slog.Error("course install failed", "error", err)
		problem(w, http.StatusInternalServerError, "导入课程包失败，请稍后重试")
	}
}

func respondCourseLifecycleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		problem(w, http.StatusNotFound, "课程或版本不存在")
	case errors.Is(err, study.ErrConflict):
		problem(w, http.StatusConflict, "激活该版本会与其他课程形成先修环："+err.Error())
	case errors.Is(err, study.ErrInvalid):
		problem(w, http.StatusBadRequest, "课程或版本参数无效")
	default:
		slog.Error("course lifecycle request failed", "error", err)
		problem(w, http.StatusInternalServerError, "课程状态更新失败，请稍后重试")
	}
}
