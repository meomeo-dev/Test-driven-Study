import type { CourseItemReview, QuestionContent } from '../../api/generated/types.gen';

export function TranslationSource({ content }: { content?: QuestionContent }) {
  if (!content?.source_text) return null;
  const lang = content.direction === 'en_to_zh' ? 'en'
    : content.direction === 'zh_to_en' ? 'zh-CN' : undefined;
  return <section className="translation-source" aria-label="翻译原文">
    <h3 className="column-label">原文</h3>
    <p className="analysis-text extended-passage" lang={lang}>{content.source_text}</p>
  </section>;
}

export function TranslationReference({ review }: { review?: CourseItemReview }) {
  if (review?.type !== 'translation') return null;
  return <section className="translation-reference" aria-label="参考译文">
    {review.reference_translation && <>
      <h4 className="column-label">参考译文</h4>
      <p className="analysis-text extended-passage">{review.reference_translation}</p>
    </>}
    {!!review.acceptable_alternates?.length && <>
      <h4 className="column-label">可接受译法</h4>
      <ul className="extended-requirements analysis-text">
        {review.acceptable_alternates.map(text => <li key={text}>{text}</li>)}
      </ul>
    </>}
    {!!review.key_terms?.length && <p className="analysis-text">
      关键术语：{review.key_terms.map(term =>
        term.variants?.length ? `${term.term}（${term.variants.join('、')}）` : term.term
      ).join('、')}
    </p>}
  </section>;
}
