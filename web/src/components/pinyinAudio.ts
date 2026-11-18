import playbackGain from '../../../assets/audio/pinyin/playback-gain.json';

const gainByClip: Record<string, number> = playbackGain;
let context: AudioContext | undefined;

export function connectPinyinOutput(audio: HTMLAudioElement) {
  if (typeof AudioContext === 'undefined') return;

  context ??= new AudioContext();
  const source = context.createMediaElementSource(audio);
  const gain = context.createGain();
  source.connect(gain).connect(context.destination);

  return {
    ready: context.resume(),
    setClip(clip?: string) {
      gain.gain.value = clip ? gainByClip[clip] ?? 1 : 1;
    },
    disconnect() {
      source.disconnect();
      gain.disconnect();
    },
  };
}
