import type {
  CourseItemReview,
  ExtendedResponse,
  QuestionType,
  RichText,
  SubAnswers,
} from '../../../api/generated/types.gen';
import { assertNever } from './contracts';

const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  numeric: '数值题',
  cloze: '完形填空',
  listening: '听力题',
  reading_comprehension: '阅读理解',
  writing: '写作题',
  translation: '翻译题',
};

const rubricLabels: Record<string, string> = {
  task_completion: '任务完成度',
  language_accuracy: '语言准确性',
  coherence: '连贯性',
  grammar: '语法',
  keyword_usage: '关键词运用',
};

export const questionType = (type: QuestionType): string =>
  questionTypeLabels[type] ?? '题目';

export function writingRubricLabel(name: string): string {
  return Object.hasOwn(rubricLabels, name)
    ? rubricLabels[name]!
    : name.replaceAll('_', ' ');
}

export function hasRichContent(content?: RichText): boolean {
  if (!content) return false;
  return Array.isArray(content) ? content.length > 0 : content.trim().length > 0;
}

export function parseAnswerSigns(answer?: string): number[] {
  if (!answer) return [];
  return answer
    .split(',')
    .map(Number)
    .filter(n => !Number.isNaN(n));
}

export function normalizeSubAnswers(subAnswers?: SubAnswers): SubAnswers | undefined {
  if (!subAnswers) return undefined;
  const answers: SubAnswers = {};
  for (const [id, value] of Object.entries(subAnswers)) {
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || (Array.isArray(normalized) && !normalized.length)) continue;
    answers[id] = normalized;
  }
  return Object.keys(answers).length ? answers : undefined;
}

export function readyResponse(draft?: ExtendedResponse): ExtendedResponse | undefined {
  if (!draft) return;
  if (draft.value !== undefined) return { value: draft.value };
  if (draft.blanks && Object.keys(draft.blanks).length) return { blanks: draft.blanks };
  const subAnswers = normalizeSubAnswers(draft.sub_answers);
  if (subAnswers) return { sub_answers: subAnswers };
  if (draft.text?.trim()) return { text: draft.text.trim() };
  if (draft.translation?.trim()) return { translation: draft.translation.trim() };
}

export function hasCourseReviewExplanation(review?: CourseItemReview): boolean {
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

export const creditLabel = (credit: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(
    credit,
  );
