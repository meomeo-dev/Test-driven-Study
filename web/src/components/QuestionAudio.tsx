import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { courseAsset, readCourseTranscript } from '../api/courses';
import * as tts from '../api/tts';
import type { TranscriptLine } from '../api/generated/types.gen';
import type { MediaQuestion } from '../features/question-types/registry';
import { AudioControls, registerGlobalAudio, stopGlobalAudio, ttsConfig } from './AudioControls';

export interface DialogueLine {
  speaker?: string;
  text: string;
  voice?: 'stella' | 'tide';
  speed?: number;
  speech?: string;
}

export function parseDialogueLines(
  transcriptUrl?: string,
  transcriptLinesRaw?: TranscriptLine[],
): DialogueLine[] {
  if (Array.isArray(transcriptLinesRaw) && transcriptLinesRaw.length > 0) {
    return transcriptLinesRaw
      .map(raw => {
        const item = raw;
        const config = ttsConfig(item.tts);
        const speaker = item.speaker?.trim();
        const text = item.text?.trim() || '';
        return { speaker, text, voice: config?.voice, speed: config?.speed, speech: config?.text };
      })
      .filter(l => Boolean(l.text));
  }

  if (transcriptUrl && !transcriptUrl.startsWith('assets/') && !transcriptUrl.endsWith('.txt')) {
    return transcriptUrl
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^([a-zA-Z0-9_\u4e00-\u9fa5]+):\s*(.+)$/);
        if (match && match[1] && match[2]) {
          const speaker = match[1].trim();
          const text = match[2].trim();
          return { speaker, text };
        }
        return { text: line };
      });
  }

  return [];
}

export type ProtectedAudio = {
  speeds: number[];
  load: (index: number, force: boolean) => ReturnType<typeof tts.synthesize>;
};

export function QuestionAudio({ question, protectedAudio }: {
  question: MediaQuestion;
  protectedAudio?: ProtectedAudio;
}) {
  const { audio_url: audio, transcript_url: transcript, transcript_lines, package_id: course,
    package_version: version } = question;
  if (!course || !version || (!audio && !transcript && !transcript_lines && !protectedAudio?.speeds.length)) return null;

  const isPath = Boolean(transcript && (transcript.startsWith('assets/') || transcript.endsWith('.txt')));
  const src = audio ? courseAsset(course, version, audio) : undefined;
  const transcriptSrc = isPath ? courseAsset(course, version, transcript!) : undefined;
  const inlineTranscript = !isPath ? transcript : undefined;
  const dialogueLines = parseDialogueLines(inlineTranscript, transcript_lines);

  return (
    <div className="question-listening">
      {src ? (
        <audio className="question-audio" aria-label="本题听力录音"
          src={src} controls preload="metadata" />
      ) : dialogueLines.length > 0 ? (
        <DialoguePlayer tracks={dialogueLines}
          load={(index, force) => {
            const line = dialogueLines[index]!;
            return tts.synthesize({ text: line.speech || line.text, voice: line.voice, force });
          }} />
      ) : protectedAudio?.speeds.length ? (
        <DialoguePlayer tracks={protectedAudio.speeds.map(speed => ({ speed }))}
          load={protectedAudio.load} />
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

function DialoguePlayer({ tracks, load }: {
  tracks: Pick<DialogueLine, 'speaker' | 'speed'>[];
  load: ProtectedAudio['load'];
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [activeLine, setActiveLine] = useState<number>(-1);
  const [activeVoice, setActiveVoice] = useState<DialogueLine['voice']>();
  const [errorMessage, setErrorMessage] = useState('');
  const active = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (active.current) stopGlobalAudio();
    };
  }, []);

  async function playSequence(force = false) {
    if (active.current && !force) {
      stopGlobalAudio();
      return;
    }

    const audio = new Audio();
    let finishLine: (() => void) | undefined;
    registerGlobalAudio(audio, () => {
      active.current = null;
      audio.onended = null;
      audio.onerror = null;
      finishLine?.();
      setStatus('idle');
      setActiveLine(-1);
    });
    active.current = audio;
    setStatus('loading');
    setErrorMessage('');

    try {
      for (let i = 0; i < tracks.length; i++) {
        if (active.current !== audio) break;
        const line = tracks[i];
        if (!line) continue;

        const result = await load(i, force);
        if (active.current !== audio) break;
        setActiveLine(i);
        setActiveVoice(result.voice);

        await new Promise<void>((resolve, reject) => {
          finishLine = resolve;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error(`播放第 ${i + 1} 句音频失败`));
          audio.src = result.audio_url;
          audio.playbackRate = line.speed ?? 1;
          audio.play().then(() => {
            if (active.current === audio) setStatus('playing');
          }).catch(reject);
        });

        if (i < tracks.length - 1 && active.current === audio) {
          await new Promise(r => setTimeout(r, 350));
        }
      }
    } catch (err) {
      if (active.current === audio) {
        stopGlobalAudio();
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : '语音播放失败');
      }
    } finally {
      if (active.current === audio) stopGlobalAudio();
    }
  }

  function handlePlay(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playSequence(false);
  }

  function handleRegenerate(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playSequence(true);
  }

  const currentSpeaker = activeLine >= 0 && tracks[activeLine]?.speaker;

  return (
    <div className="question-listening-bar" role="region" aria-label="听力音频播放">
      <span className="listening-bar-label">听力录音</span>
      <span className="tts-audio-controls">
        <button
          type="button"
          className="tts-btn tts-play-btn"
          data-playing={status === 'playing' ? 'true' : undefined}
          aria-label={status === 'playing' ? '停止发音' : '播放发音'}
          title={status === 'error' ? errorMessage || '语音合成失败' : status === 'playing' ? '停止发音' : '播放听力录音'}
          disabled={status === 'loading'}
          onClick={handlePlay}
        >
          {status === 'loading' ? (
            <LoaderCircle className="spin" size={13} />
          ) : status === 'error' ? (
            <VolumeX size={13} />
          ) : (
            <Volume2 size={13} />
          )}
        </button>
        <button
          type="button"
          className="tts-btn tts-regen-btn"
          aria-label="重新生成发音"
          title="强制重新合成语音"
          disabled={status === 'loading'}
          onClick={handleRegenerate}
        >
          <RotateCcw size={13} />
        </button>
      </span>
      {status === 'playing' && tracks.length > 1 && (
        <span className="listening-bar-progress" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {activeLine + 1}/{tracks.length} · {currentSpeaker ? `${currentSpeaker} (` : ''}
          {activeVoice === 'tide' ? '男声' : '女声'}
          {currentSpeaker ? ')' : ''}
        </span>
      )}
      {status === 'error' && <span className="audio-error-text" role="alert">{errorMessage}</span>}
    </div>
  );
}

function ListeningTranscript({
  url,
  inlineText,
  dialogueLines,
}: {
  url?: string;
  inlineText?: string;
  dialogueLines?: DialogueLine[];
}) {
  const [expanded, setExpanded] = useState(false);
  const script = useQuery({
    queryKey: ['listening-transcript', url],
    queryFn: ({ signal }) => readCourseTranscript(url!, signal),
    enabled: expanded && Boolean(url),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <details
      className="question-transcript"
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary>查看逐字稿</summary>
      {expanded && (
        dialogueLines && dialogueLines.length > 0 ? (
          <div className="question-transcript-text" role="region" aria-label="本题逐字稿" tabIndex={0}>
            {dialogueLines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '4px 0',
                  lineHeight: '1.6',
                }}
              >
                {line.speaker && (
                  <span style={{ fontWeight: 600, color: 'var(--primary)', minWidth: '22px' }}>
                    {line.speaker}:
                  </span>
                )}
                <span style={{ flex: 1 }}>{line.text}</span>
                <AudioControls text={line.speech || line.text} voice={line.voice} speed={line.speed} />
              </div>
            ))}
          </div>
        ) : inlineText ? (
          <div
            className="question-transcript-text"
            role="region"
            aria-label="本题逐字稿"
            tabIndex={0}
            style={{ whiteSpace: 'pre-line' }}
          >
            {inlineText}
          </div>
        ) : script.isPending ? (
          <p role="status">正在读取逐字稿…</p>
        ) : script.isError ? (
          <p role="alert">
            {script.error.message}{' '}
            <button type="button" onClick={() => void script.refetch()}>重试</button>
          </p>
        ) : (
          <div className="question-transcript-text" role="region" aria-label="本题逐字稿" tabIndex={0}>
            {script.data}
          </div>
        )
      )}
    </details>
  );
}
