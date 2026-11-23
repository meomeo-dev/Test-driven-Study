import type { QueryClient } from '@tanstack/react-query';
import type {
  AttemptEvaluation,
  TranslationItemReview,
  WrittenFeedback,
  WritingItemReview,
} from '../../../api/generated/types.gen';
import { writingRubricLabel } from './format';

export type SelfCheckCriterion = {
  key: string;
  label: string;
};

export const EVALUATION_INVALIDATION_KEYS = [
  ['practice-overview'],
  ['practice-questions'],
  ['analysis'],
  ['concepts'],
  ['learning-path'],
  ['roadmap'],
  ['roadmap-path'],
] as const;

export const attemptEvaluationKey = (presentation: string) =>
  ['attempt-evaluation', presentation] as const;

export function buildWritingSelfCheckCriteria(
  review?: WritingItemReview,
): SelfCheckCriterion[] {
  const items: SelfCheckCriterion[] = [];
  if (review?.rubric) {
    for (const [name, weight] of Object.entries(review.rubric)) {
      items.push({
        key: name,
        label: `${writingRubricLabel(name)}（${weight} 分）`,
      });
    }
  }
  if (review?.keywords?.length) {
    items.push({
      key: 'keywords',
      label: `准确使用关键词：${review.keywords.join('、')}`,
    });
  }
  if (items.length === 0) {
    items.push(
      { key: 'task_completion', label: '内容完整切题，符合字数与写作要求' },
      { key: 'language_accuracy', label: '语言表达准确，语法与拼写无误' },
    );
  }
  return items;
}

export function buildTranslationSelfCheckCriteria(
  review?: TranslationItemReview,
): SelfCheckCriterion[] {
  const items: SelfCheckCriterion[] = [];
  if (review?.reference_translation || review?.acceptable_alternates?.length) {
    items.push({
      key: 'meaning_accuracy',
      label: review.acceptable_alternates?.length
        ? '核心语义与参考译文或可接受译法一致'
        : '核心语义与参考译文一致',
    });
  }
  for (const term of review?.key_terms ?? []) {
    const variants = term.variants?.length ? `（${term.variants.join('、')}）` : '';
    items.push({
      key: `term:${term.term}`,
      label: `关键术语准确：${term.term}${variants}`,
    });
  }
  items.push({
    key: 'fluency_grammar',
    label: '语序自然通顺，语法与标点无误',
  });
  return items;
}

export function evaluationSourceLabel(source: AttemptEvaluation['source']): string {
  return source === 'llm' ? 'AI 评分' : '离线自评';
}

export function evaluationOutcomeLabel(passed: boolean): string {
  return passed ? '已通过（计入掌握）' : '仍需改进';
}

export function evaluationStateBadgeLabel(evaluation: AttemptEvaluation): string {
  return `${evaluationSourceLabel(evaluation.source)} · ${evaluation.passed ? '已通过' : '仍需改进'}`;
}

export function writtenFeedbackToEvaluation(
  feedback: WrittenFeedback,
): AttemptEvaluation {
  return {
    id: feedback.id,
    presentation_id: feedback.presentation_id,
    source: feedback.source,
    passed: feedback.passed,
    score_pct: feedback.score_pct,
    evaluated_at_ms: feedback.evaluated_at_ms,
    cached: feedback.cached,
    summary: feedback.summary,
    criteria: feedback.criteria,
  };
}

export function shouldPromoteEvaluation(
  current: AttemptEvaluation | null | undefined,
  candidate: AttemptEvaluation,
): boolean {
  return !current || candidate.id >= current.id;
}

export function pickLatestEvaluation(
  current: AttemptEvaluation | null | undefined,
  candidate: AttemptEvaluation,
): AttemptEvaluation {
  return shouldPromoteEvaluation(current, candidate) ? candidate : current!;
}

export function resolveCheckedCriteria(
  criteria: SelfCheckCriterion[],
  selected: ReadonlySet<string>,
): string[] {
  return criteria.filter(item => selected.has(item.key)).map(item => item.key);
}

export async function invalidateEvaluationQueries(client: QueryClient): Promise<void> {
  await Promise.all(
    EVALUATION_INVALIDATION_KEYS.map(queryKey =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}
