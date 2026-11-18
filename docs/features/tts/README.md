# Text-to-Speech (TTS) Service Feature

This directory documents the Text-to-Speech (TTS) architecture, settings integration,
and audio processing capabilities for the learning platform.

## Documentation Index

- [DeepSeek TTS Architecture and Specification](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/deepseek-tts-architecture.md):
  Covers the 3-tab unified provider settings (`ProviderDialog`), credential reuse and OS
  Keyring storage, DeepSeek `/v1/tools/tts` API integration, 24kHz PCM-to-WAV packaging,
  64-bit FNV-1a phrase key caching, audio extraction and Anti-Cloze rules, and frontend
  playback controls (`AudioControls`, `Volume2`, `RotateCcw`).

## Related Specifications and Code
- Settings UI: [ProviderDialog.tsx](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/web/src/features/palace/ProviderDialog.tsx)
- Provider Form: [ProviderForm.tsx](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/web/src/features/palace/ProviderForm.tsx)
- Question Types v2: [v2-question-types-specification.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/v2-question-types-specification.md)
