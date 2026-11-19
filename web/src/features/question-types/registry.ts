import type { PublicQuestion, Question, QuestionType } from '../../api/generated/types.gen';

export type QuestionOf<T extends QuestionType> = Extract<Question, { question_type: T }>;
export type PublicQuestionOf<T extends QuestionType> = Extract<
  PublicQuestion,
  { question_type: T }
>;
export type AnyQuestion = Question | PublicQuestion;
export type MediaQuestion = Extract<
  AnyQuestion,
  {
    question_type:
      | 'single_choice'
      | 'multiple_choice'
      | 'true_false'
      | 'numeric'
      | 'listening';
  }
>;
export type ChoiceQuestion = Extract<
  AnyQuestion,
  { question_type: 'single_choice' | 'multiple_choice' | 'true_false' }
>;
export type ExtendedQuestionType =
  | 'cloze'
  | 'listening'
  | 'reading_comprehension'
  | 'writing'
  | 'translation';

export type QuestionTypeSpec = {
  label: string;
  examPrompt: string;
  answerHeading: string;
  isChoice: boolean;
  isMultiple: boolean;
  isWritten: boolean;
};

export const QUESTION_TYPE_REGISTRY: Record<QuestionType, QuestionTypeSpec> = {
  single_choice: {
    label: '单选题',
    examPrompt: '请在备选答案中选择你认为正确的答案！',
    answerHeading: '选择答案',
    isChoice: true,
    isMultiple: false,
    isWritten: false,
  },
  multiple_choice: {
    label: '多选题',
    examPrompt: '请选择所有正确答案，全部选对才得分！',
    answerHeading: '可选择多项',
    isChoice: true,
    isMultiple: true,
    isWritten: false,
  },
  true_false: {
    label: '判断题',
    examPrompt: '本题为判断题，请判断对错！',
    answerHeading: '选择答案',
    isChoice: true,
    isMultiple: false,
    isWritten: false,
  },
  numeric: {
    label: '数值题',
    examPrompt: '请填写数值答案。',
    answerHeading: '填写答案',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
  },
  cloze: {
    label: '完形填空',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
  },
  listening: {
    label: '听力题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
  },
  reading_comprehension: {
    label: '阅读理解',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
  },
  writing: {
    label: '写作题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: true,
  },
  translation: {
    label: '翻译题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: true,
  },
};

export function assertNever(value: never): never {
  throw new Error(`Unhandled question type: ${JSON.stringify(value)}`);
}

export function isExtendedType(type: QuestionType): type is ExtendedQuestionType {
  switch (type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return true;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
      return false;
    default:
      return assertNever(type);
  }
}
