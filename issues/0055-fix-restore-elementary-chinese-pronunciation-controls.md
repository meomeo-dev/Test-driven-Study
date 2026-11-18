---
id: 0055
type: fix
status: open
labels: []
branch: fix/0055-restore-elementary-chinese-pronunciation-controls
created: 2026-11-18
---
# Restore elementary Chinese pronunciation controls

## 背景 / 目标

The elementary Chinese worksheet lacks playable pronunciation for most stems
and all choices. Add playback using the bundled Pinyin recordings and DeepSeek
for Han text.

## 关键功能清单（Key Feature List，KFL）

- Play Han instructions and visible Pinyin in question stems.
- Play Pinyin choices from local recordings, including multisyllable options.

## 改造面

Course question content, course and HTTP contracts, and shared study controls.

## 非目标

Changes to the worksheet's answers, question order, or exam terminal.

## 验收标准（Acceptance Criteria，AC）

- Practice and memorization show playback controls for the worksheet.
- Pinyin playback uses local MP3 files and makes no synthesis requests.
- Han instructions send Han text to the existing TTS API.
- Hidden worksheet blanks and stored learning history are preserved.

## 讨论

The audio library contains standard syllables. Unavailable pronunciations are
reported at playback time.
