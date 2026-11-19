import type {
  CourseItemReview,
  ExtendedResponse,
  QuestionType,
  RichText,
  SubAnswers,
} from '../../api/generated/types.gen';
import { assertNever, QUESTION_TYPE_REGISTRY } from './registry';

export function hasRichContent(content?: RichText): boolean {
  if (!content) return false;
  return Array.isArray(content) ? content.length > 0 : content.trim().length > 0;
}

export function hasReviewExplanation(review?: CourseItemReview): boolean {
  if (!review) return false;
  if (hasRichContent(review.analysis) || Boolean(review.explanation?.trim())) return true;
  switch (review.type) {
    case 'cloze':
      return review.blanks.some(blank => hasRichContent(blank.explanation));
    case 'listening':
    case 'reading_comprehension':
      return review.sub_questions.some(
        sub => hasRichContent(sub.analysis) || Boolean(sub.explanation?.trim()),
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
    case 'writing':
    case 'translation':
      return false;
    default:
      return assertNever(review);
  }
}

export const questionType = (type: QuestionType): string =>
  QUESTION_TYPE_REGISTRY[type]?.label ?? '题目';

export function readyResponse(draft?: ExtendedResponse): ExtendedResponse | undefined {
  if (!draft) return;
  if (draft.value !== undefined) return { value: draft.value };
  if (draft.blanks && Object.keys(draft.blanks).length) return { blanks: draft.blanks };
  if (draft.sub_answers) {
    const answers: SubAnswers = {};
    for (const [id, value] of Object.entries(draft.sub_answers)) {
      const normalized = typeof value === 'string' ? value.trim() : value;
      if (normalized === '' || (Array.isArray(normalized) && !normalized.length)) continue;
      answers[id] = normalized;
    }
    if (Object.keys(answers).length) return { sub_answers: answers };
  }
  if (draft.text?.trim()) return { text: draft.text.trim() };
  if (draft.translation?.trim()) return { translation: draft.translation.trim() };
}

export const creditLabel = (credit: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(
    credit,
  );
