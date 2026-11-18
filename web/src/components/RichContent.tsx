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
            return (
              <span
                key={index}
                className="rich-segment-blank"
                aria-label={`填空${segment.index ?? ''}`}
              >
                ___
              </span>
            );
          }

          const hasTts = Boolean(segment.tts);
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
          const textToSpeak = ttsConfig.text || segment.text || '';

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
