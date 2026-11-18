import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { ContentSegment } from '../api/generated/types.gen';
import * as tts from '../api/tts';
import { connectPinyinOutput } from './pinyinAudio';

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

export function registerGlobalAudio(audio: HTMLAudioElement, onStop: () => void) {
  stopGlobalAudio();
  currentAudio = audio;
  currentStopCallback = onStop;
}

type Voice = 'stella' | 'tide';
type Track = { clip: string } | { text: string; voice?: Voice };
type AudioControlsProps =
  | { text: string; voice?: Voice; pinyin?: never; sequence?: never }
  | { text: string; pinyin: string[]; voice?: never; sequence?: never }
  | { sequence: ContentSegment[]; text?: never; voice?: never; pinyin?: never };

function audioTracks({ text, voice, pinyin, sequence }: AudioControlsProps): Track[] {
  if (sequence) {
    return sequence.flatMap((segment): Track[] => {
      if (segment.pinyin?.length) return segment.pinyin.map(clip => ({ clip }));
      const speech = segment.tts?.text || segment.text;
      return speech ? [{ text: speech, voice: segment.tts?.voice }] : [];
    });
  }
  if (pinyin) return pinyin.map(clip => ({ clip }));
  return text ? [{ text, voice }] : [];
}

export function AudioControls(props: AudioControlsProps) {
  const { text, pinyin, sequence } = props;
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const active = useRef<HTMLAudioElement | null>(null);
  const tracks = audioTracks(props);
  const hasSpeech = tracks.some(track => 'text' in track);
  const trackKey = JSON.stringify(tracks);

  useEffect(() => () => {
    if (active.current && active.current === currentAudio) stopGlobalAudio();
  }, [trackKey]);

  async function playAudio(force = false) {
    if (active.current && !force) {
      stopGlobalAudio();
      return;
    }
    const audio = new Audio();
    let output: ReturnType<typeof connectPinyinOutput>;
    registerGlobalAudio(audio, () => {
      audio.onended = null;
      audio.onerror = null;
      output?.disconnect();
      active.current = null;
      setStatus('idle');
    });
    active.current = audio;
    setStatus('loading');
    setErrorMessage('');

    function fail(message: string) {
      if (active.current !== audio) return;
      stopGlobalAudio();
      setStatus('error');
      setErrorMessage(message);
    }

    let index = 0;
    async function playNext() {
      const track = tracks[index++];
      if (!track) {
        stopGlobalAudio();
        return;
      }
      const clip = 'clip' in track ? track.clip : undefined;
      try {
        const url = 'clip' in track
          ? `/api/audio/pinyin/${encodeURIComponent(track.clip)}.mp3`
          : (await tts.synthesize({ text: track.text, voice: track.voice, force })).audio_url;
        if (active.current !== audio) return;
        output?.setClip(clip);
        audio.onerror = () => fail(clip ? '暂无这段拼音的本地录音' : '播放音频失败');
        audio.src = url;
        await audio.play();
        if (active.current === audio) setStatus('playing');
      } catch (error) {
        fail(clip ? '暂无这段拼音的本地录音'
          : error instanceof Error ? error.message : '语音播放失败');
      }
    }

    try {
      if (tracks.some(track => 'clip' in track)) {
        output = connectPinyinOutput(audio);
        void output?.ready.catch(() => fail('无法启用拼音音频输出'));
      }
      audio.onended = () => { void playNext(); };
      await playNext();
    } catch (error) {
      fail(error instanceof Error ? error.message : '语音合成失败');
    }
  }

  function handleClick(event: MouseEvent, force = false) {
    event.stopPropagation();
    void playAudio(force);
  }

  const playing = status === 'playing';
  const label = sequence ? (playing ? '停止解析' : '播放解析')
    : playing ? '停止发音' : pinyin ? `播放拼音：${text}` : '播放发音';
  return (
    <span className="tts-audio-controls">
      <button
        type="button"
        className={`tts-btn tts-play-btn${sequence ? ' tts-explanation-btn' : ''}`}
        data-playing={playing ? 'true' : undefined}
        aria-label={label}
        title={errorMessage || label}
        disabled={status === 'loading'}
        onClick={handleClick}
      >
        {status === 'loading' ? (
          <LoaderCircle className="spin" size={13} />
        ) : status === 'error' ? (
          <VolumeX size={13} />
        ) : (
          <Volume2 size={13} />
        )}
        {sequence && label}
      </button>
      {hasSpeech && <button
        type="button"
        className="tts-btn tts-regen-btn"
        aria-label={sequence ? '重新生成解析语音' : '重新生成发音'}
        title={sequence ? '强制重新合成解析语音' : '强制重新合成语音'}
        disabled={status === 'loading'}
        onClick={event => handleClick(event, true)}
      >
        <RotateCcw size={11} />
      </button>}
      {(pinyin || sequence) && errorMessage && <span role="status">{errorMessage}</span>}
    </span>
  );
}

export function ExplanationAudio({ segments }: { segments?: ContentSegment[] }) {
  return segments?.length ? <AudioControls sequence={segments} /> : null;
}
