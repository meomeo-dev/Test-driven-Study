import type { ContentSegment, RichText } from '../api/generated/types.gen';
import { RichContent } from './RichContent';

export function StudyPassage({
  passage,
  translations,
  showTranslation,
}: {
  passage: RichText;
  translations: string[];
  showTranslation: boolean;
}) {
  const segments: ContentSegment[] = typeof passage === 'string'
    ? [{ type: 'text', text: passage }]
    : passage;
  const textSegments = segments.filter(segment => segment.text?.trim());
  if (textSegments.length !== translations.length) return <RichContent content={passage} />;

  let translationIndex = 0;
  return (
    <div className="study-passage">
      {segments.map((segment, index) => {
        const hasText = Boolean(segment.text?.trim());
        const translation = hasText ? translations[translationIndex++] : undefined;
        const hasAudio = segment.pinyin?.length || segment.tts_text
          || (typeof segment.tts === 'object' && segment.tts?.text);
        if (!hasText && !hasAudio && segment.type !== 'blank') return null;
        return (
          <div key={index}>
            <RichContent content={[segment]} />
            {showTranslation && translation && (
              <span className="study-translation" lang="zh-Hans">{translation}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
