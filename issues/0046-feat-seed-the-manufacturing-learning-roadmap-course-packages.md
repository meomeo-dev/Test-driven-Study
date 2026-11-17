---
id: 0046
type: feat
status: closed
closed-by: 69fb9a29ea2c10bbeadc3a25bc93f74cd205e63c
labels: []
branch: feat/0046-seed-the-manufacturing-learning-roadmap-course-packages
created: 2026-11-13
---
# Seed the manufacturing learning roadmap course packages

## 背景 / 目标

Turn the manufacturing study roadmap into installable starter course packages
that can be expanded as the learner works toward a desktop inspection station.

## 关键功能清单（Key Feature List，KFL）

- Initialize sixteen technical, mathematics, and beginner English packages.
- Give each course its own README, a guide lesson, and four original samples.
- Include local audio, its transcript, and an oral self-check in beginner English.

## 改造面

Course packages and the bundled course list.

## 非目标

Full curricula, new graded response types, and changes to the learning runtime.

## 验收标准（Acceptance Criteria，AC）

- Each new package passes validation and declares exactly one sample of each
  supported graded type.
- The course catalog and study endpoints load all packages.
- English audio and its matching transcript are served locally.

## 讨论

PCB design is an elective. Course READMEs identify prerequisites, learning
outcomes, the scope of the samples, and the next project task.

All 16 packages passed validation. Go tests passed. An isolated server loaded
the 19-course catalog and served all new guides and samples. All 64 questions
accepted the expected answer and rejected a wrong answer. Chrome verified the
catalog, CAD entry, English playback, transcript, and speaking guide.
