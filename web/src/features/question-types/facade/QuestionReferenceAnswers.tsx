import type { Question } from '../../../api/generated/types.gen';
import { dispatchFullQuestion } from '../registry';

export function QuestionReferenceAnswers({
  question,
  mode = 'compact',
  includeWritingSample = true,
}: {
  question: Question;
  mode?: 'compact' | 'full';
  includeWritingSample?: boolean;
}) {
  return dispatchFullQuestion(question, (mod, q) =>
    mod.renderReferenceAnswers({ question: q, mode, includeWritingSample }),
  );
}

export function PalaceAnswers({ question }: { question: Question }) {
  return dispatchFullQuestion(question, (mod, q) => mod.renderPalaceAnswers(q));
}
