import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import * as tts from '../api/tts';
import { registerGlobalAudio, stopGlobalAudio } from './AudioControls';

export interface DialogueLine {
  speaker?: string;
  text: string;
  voice?: 'stella' | 'tide';
  speed?: number;
  speech?: string;
}

export type ProtectedAudio = {
  speeds: number[];
  load: (index: number, force: boolean) => ReturnType<typeof tts.synthesize>;
};

type PlayTrack = Pick<DialogueLine, 'speaker' | 'speed'>;
type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error';

function playTrackAudio(
  audio: HTMLAudioElement,
  url: string,
  speed: number | undefined,
  index: number,
  onStart: () => void,
  onFinishRef: (done: () => void) => void,
) {
  return new Promise<void>((resolve, reject) => {
    onFinishRef(resolve);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error(`播放第 ${index + 1} 句音频失败`));
    audio.src = url;
    audio.playbackRate = speed ?? 1;
    audio.play().then(onStart).catch(reject);
  });
}

async function runDialogueTracks(
  audio: HTMLAudioElement,
  activeRef: { current: HTMLAudioElement | null },
  tracks: PlayTrack[],
  load: ProtectedAudio['load'],
  force: boolean,
  onLine: (index: number, voice: DialogueLine['voice']) => void,
  onPlaying: () => void,
  onFinishRef: (done: () => void) => void,
) {
  for (let i = 0; i < tracks.length; i++) {
    const line = tracks[i];
    if (activeRef.current !== audio || !line) continue;
    const result = await load(i, force);
    if (activeRef.current !== audio) break;
    onLine(i, result.voice);
    await playTrackAudio(
      audio,
      result.audio_url,
      line.speed,
      i,
      () => activeRef.current === audio && onPlaying(),
      onFinishRef,
    );
    if (i < tracks.length - 1 && activeRef.current === audio) {
      await new Promise(r => setTimeout(r, 350));
    }
  }
}

function StatusIcon({ status }: { status: PlayerStatus }) {
  if (status === 'loading') return <LoaderCircle className="spin" size={13} />;
  if (status === 'error') return <VolumeX size={13} />;
  return <Volume2 size={13} />;
}

function useDialoguePlayback(tracks: PlayTrack[], load: ProtectedAudio['load']) {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [activeLine, setActiveLine] = useState(-1);
  const [activeVoice, setActiveVoice] = useState<DialogueLine['voice']>();
  const [errorMessage, setErrorMessage] = useState('');
  const active = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (active.current) stopGlobalAudio();
  }, []);

  async function playSequence(force = false) {
    if (active.current && !force) return stopGlobalAudio();
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
      await runDialogueTracks(
        audio,
        active,
        tracks,
        load,
        force,
        (i, voice) => {
          setActiveLine(i);
          setActiveVoice(voice);
        },
        () => setStatus('playing'),
        done => {
          finishLine = done;
        },
      );
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

  return { status, activeLine, activeVoice, errorMessage, playSequence };
}

function DialogueProgress({
  activeLine,
  total,
  speaker,
  voice,
}: {
  activeLine: number;
  total: number;
  speaker?: string | false;
  voice?: DialogueLine['voice'];
}) {
  return (
    <span
      className="listening-bar-progress"
      style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
    >
      {activeLine + 1}/{total} · {speaker ? `${speaker} (` : ''}
      {voice === 'tide' ? '男声' : '女声'}
      {speaker ? ')' : ''}
    </span>
  );
}

export function DialoguePlayer({
  tracks,
  load,
}: {
  tracks: PlayTrack[];
  load: ProtectedAudio['load'];
}) {
  const { status, activeLine, activeVoice, errorMessage, playSequence } =
    useDialoguePlayback(tracks, load);

  function trigger(event: MouseEvent, force: boolean) {
    event.stopPropagation();
    event.preventDefault();
    void playSequence(force);
  }

  const currentSpeaker = activeLine >= 0 && tracks[activeLine]?.speaker;
  const playTitle =
    status === 'error'
      ? errorMessage || '语音合成失败'
      : status === 'playing'
        ? '停止发音'
        : '播放听力录音';

  return (
    <div className="question-listening-bar" role="region" aria-label="听力音频播放">
      <span className="listening-bar-label">听力录音</span>
      <span className="tts-audio-controls">
        <button
          type="button"
          className="tts-btn tts-play-btn"
          data-playing={status === 'playing' ? 'true' : undefined}
          aria-label={status === 'playing' ? '停止发音' : '播放发音'}
          title={playTitle}
          disabled={status === 'loading'}
          onClick={e => trigger(e, false)}
        >
          <StatusIcon status={status} />
        </button>
        <button
          type="button"
          className="tts-btn tts-regen-btn"
          aria-label="重新生成发音"
          title="强制重新合成语音"
          disabled={status === 'loading'}
          onClick={e => trigger(e, true)}
        >
          <RotateCcw size={13} />
        </button>
      </span>
      {status === 'playing' && tracks.length > 1 && (
        <DialogueProgress
          activeLine={activeLine}
          total={tracks.length}
          speaker={currentSpeaker}
          voice={activeVoice}
        />
      )}
      {status === 'error' && (
        <span className="audio-error-text" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
