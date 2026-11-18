import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { courseAsset, readCourseTranscript } from '../api/courses';
import * as tts from '../api/tts';
import { AudioControls, registerGlobalAudio, stopGlobalAudio } from './AudioControls';

export interface DialogueLine {
  speaker?: string;
  text: string;
  voice?: 'stella' | 'tide';
}

export function parseDialogueLines(
  transcriptUrl?: string,
  transcriptLinesRaw?: unknown,
): DialogueLine[] {
  if (Array.isArray(transcriptLinesRaw) && transcriptLinesRaw.length > 0) {
    return transcriptLinesRaw
      .map(raw => {
        const item = raw as { speaker?: string; text?: string; tts?: { voice?: string } };
        const speaker = item.speaker?.trim();
        const text = item.text?.trim() || '';
        const voice: DialogueLine['voice'] =
          item.tts?.voice === 'tide' || item.tts?.voice === 'stella'
          ? item.tts.voice : undefined;
        return { speaker, text, voice };
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

export function QuestionAudio({ question }: {
  question: {
    audio_url?: string;
    transcript_url?: string;
    transcript_lines?: unknown;
    package_id?: string;
    package_version?: string;
  };
}) {
  const { audio_url: audio, transcript_url: transcript, transcript_lines, package_id: course,
    package_version: version } = question;
  if (!course || !version || (!audio && !transcript && !transcript_lines)) return null;

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
        <DialoguePlayer lines={dialogueLines} />
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

function DialoguePlayer({ lines }: { lines: DialogueLine[] }) {
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
      for (let i = 0; i < lines.length; i++) {
        if (active.current !== audio) break;
        const line = lines[i];
        if (!line) continue;

        const result = await tts.synthesize({ text: line.text, voice: line.voice, force });
        if (active.current !== audio) break;
        setActiveLine(i);
        setActiveVoice(result.voice);

        await new Promise<void>((resolve, reject) => {
          finishLine = resolve;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error(`播放第 ${i + 1} 句音频失败`));
          audio.src = result.audio_url;
          audio.play().then(() => {
            if (active.current === audio) setStatus('playing');
          }).catch(reject);
        });

        if (i < lines.length - 1 && active.current === audio) {
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

  function handlePlay(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playSequence(false);
  }

  function handleRegenerate(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playSequence(true);
  }

  const currentSpeaker = activeLine >= 0 && lines[activeLine]?.speaker;

  return (
    <div className="question-listening-bar" role="region" aria-label="听力音频播放">
      <span className="listening-bar-label">听力录音</span>
      <span className="tts-audio-controls">
        <span
          role="button"
          tabIndex={0}
          className="tts-btn tts-play-btn"
          data-playing={status === 'playing' ? 'true' : undefined}
          aria-label={status === 'playing' ? '停止发音' : '播放发音'}
          title={status === 'error' ? errorMessage || '语音合成失败' : status === 'playing' ? '停止发音' : '播放听力录音'}
          aria-disabled={status === 'loading'}
          onClick={handlePlay}
        >
          {status === 'loading' ? (
            <LoaderCircle className="spin" size={13} />
          ) : status === 'error' ? (
            <VolumeX size={13} />
          ) : (
            <Volume2 size={13} />
          )}
        </span>
        <span
          role="button"
          tabIndex={0}
          className="tts-btn tts-regen-btn"
          aria-label="重新生成发音"
          title="强制重新合成语音"
          aria-disabled={status === 'loading'}
          onClick={handleRegenerate}
        >
          <RotateCcw size={13} />
        </span>
      </span>
      {status === 'playing' && lines.length > 1 && (
        <span className="listening-bar-progress" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {activeLine + 1}/{lines.length} · {currentSpeaker ? `${currentSpeaker} (` : ''}
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
                <AudioControls text={line.text} voice={line.voice} />
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
