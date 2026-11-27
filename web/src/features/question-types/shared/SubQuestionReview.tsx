import type {
  ExtendedResponse,
  StudySubQuestionTranslation,
  SubQuestionReview,
} from '../../../api/generated/types.gen';
import { RichContent } from '../../../components/RichContent';
import { assertNever, type ExplanationPart } from './contracts';
import { creditLabel, hasRichContent } from './format';

function subAnswer(
  item: SubQuestionReview,
  value: boolean | string | string[] | undefined,
): string {
  switch (item.type) {
    case 'numeric':
      return value !== undefined ? String(value) : '未作答';
    case 'true_false':
      if (typeof value === 'boolean') {
        return (
          item.options?.find(o => o.value === value)?.text ?? (value ? '正确' : '错误')
        );
      }
      return '未作答';
    case 'single_choice':
    case 'multiple_choice':
      if (!Array.isArray(value)) return '未作答';
      return (
        item.options
          .filter(o => value.includes(o.id))
          .map(o => o.text)
          .join('、') || '未作答'
      );
    default:
      return assertNever(item);
  }
}

function expectedSubAnswer(item: SubQuestionReview) {
  switch (item.type) {
    case 'single_choice':
    case 'multiple_choice':
      return item.grading.choice_ids;
    case 'true_false':
      return item.grading.boolean ?? item.grading.value;
    case 'numeric':
      return item.grading.value;
    default:
      return assertNever(item);
  }
}

export function SubQuestionReviewList({
  subQuestions,
  response,
  credit,
  hideExplanations,
  translations,
}: {
  subQuestions: SubQuestionReview[];
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
  translations?: Readonly<Record<string, StudySubQuestionTranslation>>;
}) {
  return (
    <section className="extended-review" aria-label="作答反馈">
      {credit !== undefined && <p role="status">本题得分比例：{creditLabel(credit)}</p>}
      {subQuestions.map((sub, index) => {
        const subTr = translations && Object.hasOwn(translations, sub.id)
          ? translations[sub.id]
          : undefined;
        return (
          <div key={sub.id}>
            <strong>
              小题 {index + 1} · {subAnswer(sub, expectedSubAnswer(sub))}
            </strong>
            {subTr?.stem && (
              <span className="study-translation" lang="zh-Hans">{subTr.stem}</span>
            )}
            {response && (
              <p>你的答案：{subAnswer(sub, response.sub_answers?.[sub.id])}</p>
            )}
            {!hideExplanations && (sub.analysis || sub.explanation) && (
              <p>
                <RichContent content={sub.analysis ?? sub.explanation} />
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function extractSubQuestionExplanations(
  subQuestions?: SubQuestionReview[],
): ExplanationPart[] {
  if (!subQuestions) return [];
  return subQuestions.flatMap((sub, index) => {
    const content = sub.analysis ?? sub.explanation;
    return hasRichContent(content)
      ? [{ key: sub.id, label: `小题 ${index + 1}`, content: content! }]
      : [];
  });
}
