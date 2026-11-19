import { useId } from 'react';
import type {
  ExtendedResponse,
  WritingContent,
  WritingItemReview,
} from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { creditLabel } from './model';

const writingSubtypes = {
  sentence_making: '造句',
  short_essay: '小作文',
  full_essay: '大作文',
};

const rubricLabels: Record<string, string> = {
  task_completion: '任务完成度',
  language_accuracy: '语言准确性',
  coherence: '连贯性',
  grammar: '语法',
  keyword_usage: '关键词运用',
};

export function writingRubricLabel(name: string) {
  return Object.hasOwn(rubricLabels, name) ? rubricLabels[name] : name.replaceAll('_', ' ');
}

export function WritingRequirements({ content }: { content: WritingContent }) {
  const wordLimits = [
    content.min_words && `至少 ${content.min_words} 词`,
    content.max_words && `最多 ${content.max_words} 词`,
  ]
    .filter(Boolean)
    .join('，');
  return (
    <section className="writing-requirements" aria-label="写作要求">
      <h3 className="column-label">{writingSubtypes[content.subtype]}要求</h3>
      {!!content.requirements.length && (
        <ul className="extended-requirements analysis-text">
          {content.requirements.map(requirement => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      )}
      {wordLimits && <p className="analysis-text">{wordLimits}</p>}
    </section>
  );
}

export function WritingSample({ review }: { review?: WritingItemReview }) {
  if (!review?.sample_response) return null;
  const sample = review.sample_response;
  const content = review.sample_response_tts
    ? [{ type: 'text' as const, text: sample, tts: review.sample_response_tts }]
    : sample;
  return (
    <section className="writing-sample" aria-label="参考范文">
      <h4 className="column-label">参考范文</h4>
      <p className="analysis-text extended-passage" lang="en">
        <RichContent content={content} />
      </p>
    </section>
  );
}

export function WritingReview({
  response,
  credit,
}: {
  response?: ExtendedResponse;
  credit?: number;
}) {
  return (
    <section className="extended-review" aria-label="作答反馈">
      {credit !== undefined && (
        <div>
          <p role="status">本地检查得分：{creditLabel(credit)}</p>
          <p className="muted">本地检查核对词数和关键词。</p>
        </div>
      )}
      {response?.text && (
        <>
          <h3 className="column-label">你的答案</h3>
          <p className="analysis-text extended-passage" lang="en">
            {response.text}
          </p>
          {response.word_count !== undefined && <p>词数：{response.word_count}</p>}
        </>
      )}
    </section>
  );
}

export function WritingCriteria({ review }: { review?: WritingItemReview }) {
  if (!review) return null;
  return (
    <section className="writing-criteria" aria-label="写作评分细则">
      {!!review.keywords?.length && (
        <p className="analysis-text">关键词：{review.keywords.join('、')}</p>
      )}
      {review.rubric && (
        <>
          <h4 className="column-label">评分细则</h4>
          <ul className="extended-requirements analysis-text">
            {Object.entries(review.rubric).map(([name, weight]) => (
              <li key={name}>
                {writingRubricLabel(name)}（{weight} 分）
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function WritingEditor({
  content,
  value,
  onChange,
  disabled,
  hideWritingRequirements,
}: {
  content: WritingContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  hideWritingRequirements?: boolean;
}) {
  const countId = useId();
  const text = value?.text ?? '';
  // Match the word boundaries used by the server when it grades writing.
  const wordCount = text.match(/[\p{L}\p{N}\p{M}'’]+/gu)?.length ?? 0;
  return (
    <div className="extended-question writing-editor">
      {!hideWritingRequirements && <WritingRequirements content={content} />}
      {(onChange || text) && (
        <>
          <label className="extended-writing">
            写作答案
            <textarea
              rows={content.subtype === 'sentence_making' ? 4 : 6}
              maxLength={12000}
              disabled={disabled || !onChange}
              value={text}
              lang="en"
              aria-describedby={countId}
              onChange={event => onChange?.({ text: event.currentTarget.value })}
            />
          </label>
          <p id={countId} className="muted writing-word-count">
            词数：{wordCount}
          </p>
        </>
      )}
    </div>
  );
}
