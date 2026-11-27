import type {
  QuestionOption,
  StudyTranslation,
  StudyTranslationSurface,
} from '../../../api/generated/types.gen';
import type { AnyQuestion } from './contracts';

export function getStudyTranslation(
  question?: AnyQuestion,
): StudyTranslation | undefined {
  if (!question) return undefined;
  if ('study_translation' in question && question.study_translation) {
    return question.study_translation;
  }
  if ('question_review' in question && question.question_review?.study_translation) {
    return question.question_review.study_translation;
  }
  return undefined;
}

export function canDisplayStudyTranslation(
  translation: StudyTranslation | undefined,
  surface: StudyTranslationSurface,
): boolean {
  if (!translation) return false;
  if (!translation.display_in?.length) return true;
  return translation.display_in.includes(surface);
}

export function visibleStudyTranslation(
  question: AnyQuestion | undefined,
  surface: StudyTranslationSurface,
  enabled = true,
): StudyTranslation | undefined {
  if (!enabled) return undefined;
  const translation = getStudyTranslation(question);
  return canDisplayStudyTranslation(translation, surface) ? translation : undefined;
}

export function optionTranslationsBySign(
  items: readonly QuestionOption[],
  translation?: StudyTranslation,
): Record<number, string> | undefined {
  const byId = translation?.options;
  if (!byId) return undefined;
  const mapped: Record<number, string> = {};
  let count = 0;
  for (const item of items) {
    if (item.id && Object.hasOwn(byId, item.id) && byId[item.id]) {
      mapped[item.sign] = byId[item.id]!;
      count += 1;
    }
  }
  return count > 0 ? mapped : undefined;
}
