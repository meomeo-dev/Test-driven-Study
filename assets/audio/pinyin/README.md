# Pinyin Audio Asset Integration

This repository includes a standardized collection of Mandarin Chinese Pinyin audio files, sourced from the `mp3-chinese-pinyin-sound` project.

## 1. Source & License
- **Source**: [davinfifield/mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound)
- **License**: The Unlicense (Public Domain dedication).
- **Terms**: This collection is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute the audio files for any purpose, commercial or non-commercial.

## 2. Structure
Audio files are located in `assets/audio/pinyin/`. They are mapped by syllable and tone, e.g., `ma1.mp3`, `ma2.mp3`, etc.

`yi1fu5.mp3` contains the complete word `yīfu` with a neutral-tone final
syllable. It was converted from [Zh-yīfu.ogg](https://commons.wikimedia.org/wiki/File:Zh-y%C4%ABfu.ogg),
a recording credited to Wei Gao and Vion Nicolas (The Shtooka Project), under
[CC BY 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/).

## 3. Usage
Question stems, options, and explanation audio declare ordered recording keys
in the `pinyin` field.
The browser plays these files via `/api/audio/pinyin/{file}` without a TTS request.
The elementary Chinese worksheet uses the standard standalone spellings `ye`,
`you` and `wei` to illustrate the finals `ie`, `iu` and `ui`.
Unmarked finals use first-tone recordings as pronunciation examples. The
distractor `jéi` has no recording. The player reports the missing clip and
keeps the worksheet spelling.

`playback-gain.json` contains linear gain factors for the worksheet recordings.
Measure each MP3 with FFmpeg `ebur128=peak=true`. Using integrated loudness
`I` in LUFS and true peak `TP` in dBTP, compute
`10 ** (min(-20 - I, -2 - TP) / 20)`. The browser applies the gain for
each clip and uses unity gain for other files.
