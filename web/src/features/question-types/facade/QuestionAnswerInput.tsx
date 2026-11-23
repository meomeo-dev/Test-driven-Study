import { useId } from 'react';
import type {
  Attempt,
  AttemptEvaluation,
  ExtendedResponse,
  PublicQuestion,
  Question,
} from '../../../api/generated/types.gen';
import {
  dispatchPublicQuestion,
  dispatchQuestion,
  QUESTION_TYPE_MODULES,
} from '../registry';
import type {
  AnyQuestion,
  DraftCheckContext,
  QuestionOf,
} from '../shared/contracts';

export function PracticeAnswerBody({
  question,
  reviewQuestion,
  presentationId,
  result,
  selected,
  draft,
  numeric,
  pending,
  shortcuts,
  partIdPrefix,
  onChoose,
  onDraft,
  onNumeric,
  onEvaluated,
}: {
  question: PublicQuestion;
  reviewQuestion?: Question;
  presentationId: string;
  result?: {
    score?: number;
    response?: ExtendedResponse;
    correctAnswer?: number[];
    correctNumeric?: string;
  };
  selected: number[];
  draft?: ExtendedResponse;
  numeric: string;
  pending: boolean;
  shortcuts: boolean;
  partIdPrefix?: string;
  onChoose: (sign: number) => void;
  onDraft: (draft: ExtendedResponse) => void;
  onNumeric: (value: string) => void;
  onEvaluated?: (evaluation: AttemptEvaluation) => void;
}) {
  const fallbackId = useId();
  const prefix = partIdPrefix ?? fallbackId;
  return dispatchPublicQuestion(question, (mod, q) => {
    const matchedReview =
      reviewQuestion?.question_type === q.question_type
        ? (reviewQuestion as QuestionOf<typeof q.question_type>)
        : undefined;
    return mod.renderPracticeAnswer({
      question: q,
      reviewQuestion: matchedReview,
      presentationId,
      result,
      selected,
      draft,
      numeric,
      pending,
      shortcuts,
      partIdPrefix: prefix,
      onChoose,
      onDraft,
      onNumeric,
      onEvaluated,
    });
  });
}

export function ExamSelection({
  question,
  selected,
  numeric,
  onNumeric,
  onChoose,
  disabled,
}: {
  question: AnyQuestion;
  selected: number[];
  numeric: string;
  onNumeric: (value: string) => void;
  onChoose: (sign: number) => void;
  disabled: boolean;
}) {
  return dispatchQuestion(question, (mod, q) =>
    mod.renderExamSelection({
      question: q,
      selected,
      numeric,
      onNumeric,
      onChoose,
      disabled,
    }),
  );
}

export function hasDraftAnswer(
  question: PublicQuestion,
  ctx: DraftCheckContext,
): boolean {
  return dispatchPublicQuestion(question, mod => mod.hasDraftAnswer(ctx));
}

export function formatExamNavValue(
  question: AnyQuestion,
  selected: number[],
  numeric?: string,
  response?: ExtendedResponse,
): string {
  return dispatchQuestion(question, (mod, q) =>
    mod.formatExamNavValue({ question: q, selected, numeric, response }),
  );
}

export function formatAttemptSummary(attempt: Attempt): string {
  return QUESTION_TYPE_MODULES[attempt.question_type].formatAttemptSummary(attempt);
}
