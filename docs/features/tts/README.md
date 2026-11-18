# Text-to-Speech (TTS) Service Feature

This directory documents the Text-to-Speech (TTS) architecture, settings integration,
and audio processing capabilities for the learning platform.

An explicit question or transcript voice takes precedence over the service default.
Requests that omit the voice use the current setting. The server resolves the voice
before selecting the cached audio or calling the synthesis provider.

## Documentation Index

- [DeepSeek TTS Architecture and Specification](deepseek-tts-architecture.md):
  Covers the 3-tab unified provider settings (`ProviderDialog`), credential reuse and OS
  Keyring storage, DeepSeek `/v1/tools/tts` API integration, 24kHz PCM-to-WAV packaging,
  64-bit FNV-1a phrase key caching, audio extraction and Anti-Cloze rules, and frontend
  playback controls (`AudioControls`, `Volume2`, `RotateCcw`).

## Related Specifications and Code
- Settings UI: [ProviderDialog.tsx](../../../web/src/features/palace/ProviderDialog.tsx)
- Provider Form: [ProviderForm.tsx](../../../web/src/features/palace/ProviderForm.tsx)
- Question Types v2: [v2-question-types-specification.md](../question-types/v2-question-types-specification.md)
