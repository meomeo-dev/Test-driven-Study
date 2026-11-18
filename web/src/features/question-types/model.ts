import type { ExtendedResponse, SubAnswers } from '../../api/generated/types.gen';

export const readingQuestionType = 7;
export const writingQuestionType = 8;

export const questionType = (type: number) => ({
  1: '单选题', 2: '多选题', 3: '判断题', 4: '数值题', 5: '完形填空',
  6: '听力题', 7: '阅读理解', 8: '写作题', 9: '翻译题',
})[type] ?? '题目';

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
  new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(credit);
