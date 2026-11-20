import type { Question } from '../../../api/generated/types.gen';
import { dispatchFullQuestion } from '../registry';

export function QuestionReferenceAnswers({
  question,
  mode = 'compact',
  includeWritingSample = true,
  showStudyTranslation,
}: {
  question: Question;
  mode?: 'compact' | 'full';
  includeWritingSample?: boolean;
  showStudyTranslation?: boolean;
}) {
  return dispatchFullQuestion(question, (mod, q) =>
    mod.renderReferenceAnswers({ question: q, mode, includeWritingSample, showStudyTranslation }),
  );
}

export function PalaceAnswers({ question }: { question: Question }) {
  return dispatchFullQuestion(question, (mod, q) => mod.renderPalaceAnswers(q));
}
