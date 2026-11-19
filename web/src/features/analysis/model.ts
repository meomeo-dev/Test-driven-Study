import type { Attempt } from '../../api/practice';
import { creditLabel } from '../question-types/model';
import { assertNever } from '../question-types/registry';

/** Format a human-readable summary of a submitted attempt across all 9 question types. */
export function attemptSummary(attempt: Attempt): string {
  const score = attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
  const response = attempt.response;
  switch (attempt.question_type) {
    case 'single_choice':
    case 'multiple_choice':
      return `你的选择 ${attempt.selected.join(', ')} · 正确选项 ${attempt.correct_answer.join(', ')}`;
    case 'true_false':
      if (response?.value !== undefined) {
        return `你的判断 ${response.value ? '正确' : '错误'}${score}`;
      }
      return `你的选择 ${attempt.selected.join(', ')} · 正确选项 ${attempt.correct_answer.join(', ')}`;
    case 'numeric':
      return `你的答案 ${attempt.numeric ?? ''} · 正确答案 ${attempt.correct_numeric ?? ''}`;
    case 'cloze':
      return `完形作答（${Object.keys(response?.blanks ?? {}).length} 空）${score}`;
    case 'listening':
    case 'reading_comprehension':
      return `小题作答（${Object.keys(response?.sub_answers ?? {}).length} 题）${score}`;
    case 'writing':
      return `写作作答（${response?.word_count ?? 0} 词）${score}`;
    case 'translation':
      return `翻译作答${score}`;
    default:
      return assertNever(attempt.question_type);
  }
}
