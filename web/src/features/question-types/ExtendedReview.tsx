import type {
  CourseItemReview,
  ExtendedResponse,
  SubQuestionReview,
} from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { creditLabel } from './model';
import { assertNever } from './registry';
import { TranslationReference } from './TranslationContent';
import { WritingCriteria, WritingReview, WritingSample } from './WritingContent';

function subAnswer(
  item: SubQuestionReview,
  value: boolean | string | string[] | undefined,
): string {
  switch (item.type) {
    case 'numeric':
      return value !== undefined ? String(value) : '未作答';
    case 'true_false':
      if (typeof value === 'boolean') {
        return item.options?.find(o => o.value === value)?.text ?? (value ? '正确' : '错误');
      }
      return '未作答';
    case 'single_choice':
    case 'multiple_choice':
      if (Array.isArray(value)) {
        return (
          item.options
            .filter(o => value.includes(o.id))
            .map(o => o.text)
            .join('、') || '未作答'
        );
      }
      return '未作答';
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

export function ExtendedReview({
  item,
  response,
  credit,
  hideExplanations,
}: {
  item: CourseItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
}) {
  switch (item.type) {
    case 'writing':
      return (
        <>
          <WritingReview response={response} credit={credit} />
          <WritingSample review={item} />
          <WritingCriteria review={item} />
        </>
      );
    case 'cloze':
      return (
        <section className="extended-review" aria-label="作答反馈">
          {credit !== undefined && <p role="status">本题得分比例：{creditLabel(credit)}</p>}
          {item.blanks.map(({ index, options, grading, explanation }) => (
            <div key={index}>
              <strong>
                空格 {index} · {options.find(o => grading.choice_ids?.includes(o.id))?.text}
              </strong>
              {response && (
                <p>
                  你的答案：
                  {options.find(o => response.blanks?.[index]?.includes(o.id))?.text ?? '未作答'}
                </p>
              )}
              {!hideExplanations && explanation && (
                <p>
                  <RichContent content={explanation} />
                </p>
              )}
            </div>
          ))}
        </section>
      );
    case 'listening':
    case 'reading_comprehension':
      return (
        <section className="extended-review" aria-label="作答反馈">
          {credit !== undefined && <p role="status">本题得分比例：{creditLabel(credit)}</p>}
          {item.sub_questions.map((sub, index) => (
            <div key={sub.id}>
              <strong>
                小题 {index + 1} · {subAnswer(sub, expectedSubAnswer(sub))}
              </strong>
              {response && <p>你的答案：{subAnswer(sub, response.sub_answers?.[sub.id])}</p>}
              {!hideExplanations && (sub.analysis || sub.explanation) && (
                <p>
                  <RichContent content={sub.analysis ?? sub.explanation} />
                </p>
              )}
            </div>
          ))}
        </section>
      );
    case 'translation':
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
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
      return null;
    default:
      return assertNever(item);
  }
}
