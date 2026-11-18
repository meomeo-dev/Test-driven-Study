---
id: 0055
type: fix
status: closed
closed-by: 46d404a94aafe88312f665cb3971696a128dfbb6
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

- Play Han instructions and the illustrated words in fill-in prompts.
- Play Pinyin choices from local recordings, including multisyllable options.
- Read explanations using Han TTS and local Pinyin in the authored order.

## 改造面

Course question content, course and HTTP contracts, and shared study controls.

## 非目标

Changes to the worksheet's answers, question order, or exam grading and
answer-reveal rules.

## 验收标准（Acceptance Criteria，AC）

- Practice and memorization show playback controls for the worksheet.
- Pinyin playback uses local MP3 files and makes no synthesis requests.
- Han instructions and explanations send only Han text to the TTS API.
- Active unanswered questions keep explanation audio hidden.
- Hidden worksheet blanks and stored learning history are preserved.

## 讨论

The audio library contains standard syllables. Unavailable pronunciations are
reported at playback time.
