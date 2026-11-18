import type { ContentSegment } from '../api/generated/types.gen';
import type { ReactNode } from 'react';
import { AudioControls, ttsConfig } from './AudioControls';

type RichContentProps = {
  content?: string | ContentSegment[];
  className?: string;
  renderBlank?: (index: number) => ReactNode;
};

export function RichContent({
  content,
  className,
  renderBlank,
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
          if (blank && segment.index !== undefined && renderBlank) {
            return <span key={index}>{renderBlank(segment.index)}</span>;
          }
          const text = segment.text || (blank ? '___' : '');
          const config = ttsConfig(segment.tts);
          const textToSpeak = segment.tts_text || config?.text || text;
          const audio = blank ? null : segment.pinyin?.length
            ? <AudioControls text={text} pinyin={segment.pinyin} />
            : (segment.tts || segment.tts_text) && textToSpeak
              ? <AudioControls text={textToSpeak} voice={config?.voice} speed={config?.speed} />
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
