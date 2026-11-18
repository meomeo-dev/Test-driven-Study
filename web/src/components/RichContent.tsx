import type { ContentSegment } from '../api/generated/types.gen';
import { AudioControls } from './AudioControls';

type RichContentProps = {
  content?: string | ContentSegment[];
  defaultVoice?: 'stella' | 'tide';
  className?: string;
};

export function RichContent({
  content,
  defaultVoice = 'stella',
  className,
}: RichContentProps) {
  if (!content) return null;

  if (typeof content === 'string') {
    return <span className={`rich-content-text ${className || ''}`}>{content}</span>;
  }

  if (Array.isArray(content)) {
    return (
      <span className={`rich-content-mixed ${className || ''}`}>
        {content.map((segment, index) => {
          if (segment.type === 'blank') {
            const hasTts = Boolean(segment.tts) || Boolean(segment.tts_text);
            const ttsConfig = typeof segment.tts === 'object' && segment.tts !== null ? segment.tts : {};
            const voice = ttsConfig.voice || defaultVoice;
            const textToSpeak = segment.tts_text || ttsConfig.text || '';

            return (
              <span
                key={index}
                className={`rich-segment-blank ${hasTts ? 'rich-segment-speech' : ''}`}
                aria-label={`填空${segment.index ?? ''}`}
              >
                <span>___</span>
                {hasTts && <AudioControls text={textToSpeak} voice={voice} />}
              </span>
            );
          }

          const hasTts = Boolean(segment.tts) || Boolean(segment.tts_text);
          if (!hasTts) {
            return (
              <span key={index} className="rich-segment-text">
                {segment.text}
              </span>
            );
          }

          const ttsConfig =
            typeof segment.tts === 'object' && segment.tts !== null ? segment.tts : {};
          const voice = ttsConfig.voice || defaultVoice;
          const textToSpeak = segment.tts_text || ttsConfig.text || segment.text || '';

          return (
            <span key={index} className="rich-segment-speech">
              <span className="rich-speech-text">{segment.text}</span>
              <AudioControls text={textToSpeak} voice={voice} />
            </span>
          );
        })}
      </span>
    );
  }

  return null;
}
