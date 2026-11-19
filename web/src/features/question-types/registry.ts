import type {
  CourseItemReview,
  PublicQuestion,
  Question,
  QuestionType,
} from '../../api/generated/types.gen';
import type {
  AnyQuestion,
  AnyQuestionOf,
  ExtendedQuestionType,
  PublicQuestionOf,
  QuestionOf,
  QuestionTypeModule,
  QuestionTypeSpec,
  ReviewOf,
} from './shared/contracts';
import { clozeModule } from './types/cloze';
import { listeningModule } from './types/listening';
import { multipleChoiceModule } from './types/multiple-choice';
import { numericModule } from './types/numeric';
import { readingModule } from './types/reading-comprehension';
import { singleChoiceModule } from './types/single-choice';
import { translationModule } from './types/translation';
import { trueFalseModule } from './types/true-false';
import { writingModule } from './types/writing';

export type QuestionTypeRegistry = {
  readonly [K in QuestionType]: QuestionTypeModule<K>;
};

export const QUESTION_TYPE_MODULES: QuestionTypeRegistry = {
  single_choice: singleChoiceModule,
  multiple_choice: multipleChoiceModule,
  true_false: trueFalseModule,
  numeric: numericModule,
  cloze: clozeModule,
  listening: listeningModule,
  reading_comprehension: readingModule,
  writing: writingModule,
  translation: translationModule,
};

export const QUESTION_TYPE_REGISTRY: Record<QuestionType, QuestionTypeSpec> = {
  single_choice: singleChoiceModule.spec,
  multiple_choice: multipleChoiceModule.spec,
  true_false: trueFalseModule.spec,
  numeric: numericModule.spec,
  cloze: clozeModule.spec,
  listening: listeningModule.spec,
  reading_comprehension: readingModule.spec,
  writing: writingModule.spec,
  translation: translationModule.spec,
};

// Correlated-union dispatch helpers: runtime check + single internal bridge so
// strict TS callers never face TS2322 contravariance errors.
type AnyQuestionRunner<R> = <T extends QuestionType>(
  mod: QuestionTypeModule<T>,
  q: AnyQuestionOf<T>,
) => R;

export function dispatchQuestion<R>(
  question: AnyQuestion,
  run: AnyQuestionRunner<R>,
): R {
  const mod = QUESTION_TYPE_MODULES[
    question.question_type
  ] as unknown as QuestionTypeModule<typeof question.question_type>;
  if (!mod) {
    throw new Error(`Unhandled question type: ${JSON.stringify(question.question_type)}`);
  }
  return run(mod, question as AnyQuestionOf<typeof question.question_type>);
}

export function dispatchPublicQuestion<R>(
  question: PublicQuestion,
  run: <T extends QuestionType>(mod: QuestionTypeModule<T>, q: PublicQuestionOf<T>) => R,
): R {
  const mod = QUESTION_TYPE_MODULES[
    question.question_type
  ] as unknown as QuestionTypeModule<typeof question.question_type>;
  if (!mod) {
    throw new Error(`Unhandled question type: ${JSON.stringify(question.question_type)}`);
  }
  return run(mod, question as PublicQuestionOf<typeof question.question_type>);
}

export function dispatchFullQuestion<R>(
  question: Question,
  run: <T extends QuestionType>(mod: QuestionTypeModule<T>, q: QuestionOf<T>) => R,
): R {
  const mod = QUESTION_TYPE_MODULES[
    question.question_type
  ] as unknown as QuestionTypeModule<typeof question.question_type>;
  if (!mod) {
    throw new Error(`Unhandled question type: ${JSON.stringify(question.question_type)}`);
  }
  return run(mod, question as QuestionOf<typeof question.question_type>);
}

export function dispatchCourseReview<R>(
  review: CourseItemReview,
  run: <T extends QuestionType>(mod: QuestionTypeModule<T>, r: ReviewOf<T>) => R,
): R {
  const mod = QUESTION_TYPE_MODULES[
    review.type
  ] as unknown as QuestionTypeModule<typeof review.type>;
  if (!mod) {
    throw new Error(`Unhandled question type: ${JSON.stringify(review.type)}`);
  }
  return run(mod, review as ReviewOf<typeof review.type>);
}

export function isExtendedType(type: QuestionType): type is ExtendedQuestionType {
  return QUESTION_TYPE_REGISTRY[type].isExtended;
}
