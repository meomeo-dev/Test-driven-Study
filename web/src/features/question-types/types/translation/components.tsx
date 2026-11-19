import type {
  ExtendedResponse,
  TranslationContent,
  TranslationItemReview,
  TtsConfig,
} from '../../../../api/generated/types.gen';
import { RichContent } from '../../../../components/RichContent';
import { creditLabel } from '../../shared/format';

function speechText(text: string, tts?: TtsConfig) {
  return tts ? [{ type: 'text' as const, text, tts }] : text;
}

export function TranslationSource({ content }: { content: TranslationContent }) {
  if (!content.source_text) return null;
  const lang = content.direction === 'en_to_zh' ? 'en' : 'zh-CN';
  const rich = speechText(content.source_text, content.source_text_tts);
  return (
    <section className="translation-source" aria-label="翻译原文">
      <h3 className="column-label">原文</h3>
      <p className="analysis-text extended-passage" lang={lang}>
        <RichContent content={rich} />
      </p>
    </section>
  );
}

export function TranslationReference({ review }: { review?: TranslationItemReview }) {
  if (!review) return null;
  const referenceLang = review.direction === 'zh_to_en' ? 'en' : 'zh-CN';
  const reference = review.reference_translation
    ? speechText(review.reference_translation, review.reference_translation_tts)
    : undefined;
  return (
    <section className="translation-reference" aria-label="参考译文">
      {reference !== undefined && (
        <>
          <h4 className="column-label">参考译文</h4>
          <p className="analysis-text extended-passage" lang={referenceLang}>
            <RichContent content={reference} />
          </p>
        </>
      )}
      {!!review.acceptable_alternates?.length && (
        <>
          <h4 className="column-label">可接受译法</h4>
          <ul className="extended-requirements analysis-text">
            {review.acceptable_alternates.map(text => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}
      {!!review.key_terms?.length && (
        <p className="analysis-text">
          关键术语：
          {review.key_terms
            .map(term =>
              term.variants?.length
                ? `${term.term}（${term.variants.join('、')}）`
                : term.term,
            )
            .join('、')}
        </p>
      )}
    </section>
  );
}

export function TranslationEditor({
  content,
  value,
  onChange,
  disabled,
  hideSourceText,
}: {
  content: TranslationContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  hideSourceText?: boolean;
}) {
  const showSource = Boolean(content.source_text) && !hideSourceText;
  const text = value?.translation ?? '';
  if (!showSource && !onChange && !text) return null;
  const label = content.direction === 'en_to_zh' ? '中文译文' : '英文译文';
  return (
    <div className="extended-question">
      {showSource && <TranslationSource content={content} />}
      {(onChange || text) && (
        <label className="extended-writing">
          {label}
          <textarea
            rows={6}
            maxLength={12000}
            disabled={disabled || !onChange}
            value={text}
            onChange={event =>
              onChange?.({ translation: event.currentTarget.value })
            }
          />
        </label>
      )}
    </div>
  );
}

export function TranslationReview({
  item,
  response,
  credit,
}: {
  item: TranslationItemReview;
  response?: ExtendedResponse;
  credit?: number;
}) {
  return (
    <section className="extended-review" aria-label="作答反馈">
      {credit !== undefined && <p role="status">本地检查得分：{creditLabel(credit)}</p>}
      {response?.translation && (
        <p className="extended-passage">你的译文：{response.translation}</p>
      )}
      <TranslationReference review={item} />
      {credit !== undefined && (
        <p className="muted">
          本地得分依据词数、关键词或参考译文，可结合范文和评分细则检查表达。
        </p>
      )}
    </section>
  );
}
