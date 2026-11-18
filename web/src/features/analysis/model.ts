import type { Attempt } from '../../api/practice';
import { creditLabel } from '../question-types/model';

/** Format a human-readable summary of a submitted attempt across all 9 question types. */
export function attemptSummary(attempt: Attempt): string {
  if (attempt.numeric !== undefined) {
    return `你的答案 ${attempt.numeric} · 正确答案 ${attempt.correct_numeric ?? ''}`;
  }
  const response = attempt.response;
  if (response) {
    const score = attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    if (response.value !== undefined) {
      return `你的判断 ${response.value ? '正确' : '错误'}${score}`;
    }
    if (response.text !== undefined) {
      return `写作作答（${response.word_count ?? 0} 词）${score}`;
    }
    if (response.translation !== undefined) {
      return `翻译作答${score}`;
    }
    if (response.blanks) {
      return `完形作答（${Object.keys(response.blanks).length} 空）${score}`;
    }
    if (response.sub_answers) {
      return `小题作答（${Object.keys(response.sub_answers).length} 题）${score}`;
    }
    return score ? score.slice(3) : '已作答';
  }
  return `你的选择 ${attempt.selected.join(', ')} · 正确选项 ${attempt.correct_answer.join(', ')}`;
}
