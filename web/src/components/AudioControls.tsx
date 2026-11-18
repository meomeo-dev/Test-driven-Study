import { useEffect, useState, type MouseEvent, type KeyboardEvent } from 'react';
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import * as tts from '../api/tts';

let currentAudio: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

export function stopGlobalAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore audio pause errors
    }
    currentAudio = null;
  }
  if (currentStopCallback) {
    const cb = currentStopCallback;
    currentStopCallback = null;
    cb();
  }
}

type AudioControlsProps = {
  text: string;
  voice?: 'stella' | 'tide';
  className?: string;
};

export function AudioControls({ text, voice = 'stella', className }: AudioControlsProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    return () => {
      // Clean up when unmounting if this instance was playing
      if (status === 'playing') {
        stopGlobalAudio();
      }
    };
  }, [status]);

  async function playAudio(force = false) {
    if (status === 'playing' && !force) {
      stopGlobalAudio();
      return;
    }
    stopGlobalAudio();
    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await tts.synthesize({ text, voice, force });
      const audio = new Audio(result.audio_url);
      currentAudio = audio;
      currentStopCallback = () => {
        setStatus('idle');
      };

      audio.onended = () => {
        stopGlobalAudio();
      };
      audio.onerror = () => {
        stopGlobalAudio();
        setStatus('error');
        setErrorMessage('播放音频失败');
      };

      await audio.play();
      setStatus('playing');
    } catch (err) {
      stopGlobalAudio();
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '语音合成失败');
    }
  }

  function handlePlay(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playAudio(false);
  }

  function handleRegenerate(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    event.preventDefault();
    void playAudio(true);
  }

  function handlePlayKeyDown(event: KeyboardEvent) {
    if (event.key === ' ' || event.key === 'Enter') {
      handlePlay(event);
    }
  }

  function handleRegenKeyDown(event: KeyboardEvent) {
    if (event.key === ' ' || event.key === 'Enter') {
      handleRegenerate(event);
    }
  }

  return (
    <span
      className={`tts-audio-controls ${className || ''}`}
      onClick={event => event.stopPropagation()}
    >
      <span
        role="button"
        tabIndex={0}
        className="tts-btn tts-play-btn"
        data-playing={status === 'playing' ? 'true' : undefined}
        aria-label={status === 'playing' ? '停止发音' : '播放发音'}
        title={status === 'error' ? errorMessage || '语音合成失败' : status === 'playing' ? '停止发音' : `播放发音 (${voice})`}
        aria-disabled={status === 'loading'}
        onClick={handlePlay}
        onKeyDown={handlePlayKeyDown}
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
        onKeyDown={handleRegenKeyDown}
      >
        <RotateCcw size={11} />
      </span>
    </span>
  );
}
