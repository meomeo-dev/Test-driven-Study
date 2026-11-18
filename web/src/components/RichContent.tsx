import type { ContentSegment } from '../api/generated/types.gen';
import { AudioControls } from './AudioControls';

type RichContentProps = {
  content?: string | ContentSegment[];
  className?: string;
};

export function RichContent({
  content,
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
          const blank = segment.type === 'blank';
          const text = segment.text || (blank ? '___' : '');
          const textToSpeak = segment.tts_text || segment.tts?.text || (blank ? '' : text);
          const audio = segment.pinyin?.length
            ? <AudioControls text={text} pinyin={segment.pinyin} />
            : (segment.tts || segment.tts_text) && textToSpeak
              ? <AudioControls text={textToSpeak} voice={segment.tts?.voice} />
              : null;
          if (!audio && !blank) {
            return (
              <span key={index} className="rich-segment-text">
                {text}
              </span>
            );
          }

          return (
            <span key={index} className="rich-segment-speech">
              <span className={blank ? 'rich-segment-blank' : 'rich-speech-text'}>{text}</span>
              {audio}
            </span>
          );
        })}
      </span>
    );
  }

  return null;
}
