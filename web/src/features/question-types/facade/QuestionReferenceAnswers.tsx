import type { Question, StudyTranslationSurface } from '../../../api/generated/types.gen';
import { dispatchFullQuestion } from '../registry';

export function QuestionReferenceAnswers({
  question,
  mode = 'compact',
  includeWritingSample = true,
  showStudyTranslation,
  translationSurface,
}: {
  question: Question;
  mode?: 'compact' | 'full';
  includeWritingSample?: boolean;
  showStudyTranslation?: boolean;
  translationSurface?: StudyTranslationSurface;
}) {
  return dispatchFullQuestion(question, (mod, q) =>
    mod.renderReferenceAnswers({
      question: q,
      mode,
      includeWritingSample,
      showStudyTranslation,
      translationSurface,
    }),
  );
}

export function PalaceAnswers({ question }: { question: Question }) {
  return dispatchFullQuestion(question, (mod, q) => mod.renderPalaceAnswers(q));
}
