---
id: 0040
type: feat
status: closed
closed-by: b2e341cab06b771cf75d18ab7e29276ca4eeeab9
labels: []
branch: feat/0040-ground-ielts-listening-in-transcripts
created: 2026-11-11
---
# Ground IELTS listening in transcripts

## 背景 / 目标

Listening learners need the matching transcript beside playback. The AI tutor needs the same source to explain the original wording.

## 关键功能清单（Key Feature List，KFL）

- Versioned transcript references on listening items.
- An inline transcript beside the audio player.
- Transcript evidence in tutor and memory palace requests.

## 改造面

Course package schema, versioned assets, question media, and existing AI context assembly.

## 非目标

Audio transcription, timing alignment, and changes to provider configuration.

## 验收标准（Acceptance Criteria，AC）

- All six IELTS recordings have matching scripts.
- The learner can read the script while listening.
- The tutor and palace receive the original text for the selected question.
- The active mock exam omits the transcript control.

## 讨论

The installed package version determines the recording and transcript. Preserve existing question IDs and snapshots.
