import { courseAsset } from '../api/courses';
import * as tts from '../api/tts';
import type { PublicQuestion, Question, TranscriptLine } from '../api/generated/types.gen';
import { ttsConfig } from './AudioControls';
import {
  DialoguePlayer,
  type DialogueLine,
  type ProtectedAudio,
} from './DialoguePlayer';
import { ListeningTranscript } from './ListeningTranscript';

export type { DialogueLine, ProtectedAudio };

export type QuestionAudioSource = Extract<
  Question | PublicQuestion,
  {
    question_type:
      | 'single_choice'
      | 'multiple_choice'
      | 'true_false'
      | 'numeric'
      | 'listening';
  }
>;

function parseLineItem(raw: TranscriptLine): DialogueLine {
  const config = ttsConfig(raw.tts);
  return {
    speaker: raw.speaker?.trim(),
    text: raw.text?.trim() || '',
    voice: config?.voice,
    speed: config?.speed,
    speech: config?.text,
  };
}

function parseInlineTranscript(transcriptUrl: string): DialogueLine[] {
  return transcriptUrl
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([a-zA-Z0-9_\u4e00-\u9fa5]+):\s*(.+)$/);
      return match?.[1] && match[2]
        ? { speaker: match[1].trim(), text: match[2].trim() }
        : { text: line };
    });
}

export function parseDialogueLines(
  transcriptUrl?: string,
  transcriptLinesRaw?: TranscriptLine[],
): DialogueLine[] {
  if (Array.isArray(transcriptLinesRaw) && transcriptLinesRaw.length > 0) {
    return transcriptLinesRaw.map(parseLineItem).filter(l => Boolean(l.text));
  }
  const isInline =
    transcriptUrl && !transcriptUrl.startsWith('assets/') && !transcriptUrl.endsWith('.txt');
  return isInline ? parseInlineTranscript(transcriptUrl) : [];
}

export function QuestionAudio({
  question,
  protectedAudio,
}: {
  question: QuestionAudioSource;
  protectedAudio?: ProtectedAudio;
}) {
  const {
    audio_url: audio,
    transcript_url: transcript,
    transcript_lines,
    package_id: course,
    package_version: version,
  } = question;
  const hasAny = audio || transcript || transcript_lines || protectedAudio?.speeds.length;
  if (!course || !version || !hasAny) return null;

  const isPath = Boolean(
    transcript && (transcript.startsWith('assets/') || transcript.endsWith('.txt')),
  );
  const src = audio ? courseAsset(course, version, audio) : undefined;
  const transcriptSrc = isPath ? courseAsset(course, version, transcript!) : undefined;
  const inlineTranscript = !isPath ? transcript : undefined;
  const dialogueLines = parseDialogueLines(inlineTranscript, transcript_lines);

  return (
    <div className="question-listening">
      {src ? (
        <audio
          className="question-audio"
          aria-label="本题听力录音"
          src={src}
          controls
          preload="metadata"
        />
      ) : dialogueLines.length > 0 ? (
        <DialoguePlayer
          tracks={dialogueLines}
          load={(index, force) => {
            const line = dialogueLines[index]!;
            return tts.synthesize({
              text: line.speech || line.text,
              voice: line.voice,
              force,
            });
          }}
        />
      ) : protectedAudio?.speeds.length ? (
        <DialoguePlayer
          tracks={protectedAudio.speeds.map(speed => ({ speed }))}
          load={protectedAudio.load}
        />
      ) : null}
      {(transcript || dialogueLines.length > 0) && (
        <ListeningTranscript
          url={transcriptSrc}
          inlineText={inlineTranscript}
          dialogueLines={dialogueLines}
        />
      )}
    </div>
  );
}
