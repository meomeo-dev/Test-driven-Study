import type {
  ExtendedResponse,
  PublicQuestion,
  Question,
} from '../../../api/generated/types.gen';
import type { ProtectedAudio } from '../../../components/QuestionAudio';
import { dispatchPublicQuestion, dispatchQuestion } from '../registry';
import type { AnyQuestion, QuestionOf } from '../shared/contracts';

export function QuestionStimulus({
  question,
  reviewQuestion,
  cloze,
  protectedAudio,
  showStudyTranslation,
}: {
  question: AnyQuestion;
  reviewQuestion?: Question;
  cloze?: { value?: ExtendedResponse; onJump?: (index: number) => void };
  protectedAudio?: ProtectedAudio;
  showStudyTranslation?: boolean;
}) {
  return dispatchQuestion(question, (mod, q) => {
    const matched =
      reviewQuestion?.question_type === q.question_type
        ? (reviewQuestion as QuestionOf<typeof q.question_type>)
        : undefined;
    return mod.renderStimulus({
      question: q,
      reviewQuestion: matched,
      cloze,
      protectedAudio,
      showStudyTranslation,
    });
  });
}

export function ExamStem({
  question,
  protectedAudio,
  draft,
  onDraft,
  disabled,
}: {
  question: AnyQuestion;
  protectedAudio?: ProtectedAudio;
  draft?: ExtendedResponse;
  onDraft: (value: ExtendedResponse) => void;
  disabled: boolean;
}) {
  return dispatchQuestion(question, (mod, q) =>
    mod.renderExamStem({ question: q, protectedAudio, draft, onDraft, disabled }),
  );
}

export function FeedbackQuestionBody({
  question,
  response,
  review,
}: {
  question: AnyQuestion;
  response?: ExtendedResponse;
  review?: Question;
}) {
  return dispatchQuestion(question, (mod, q) => {
    const matched =
      review?.question_type === q.question_type
        ? (review as QuestionOf<typeof q.question_type>)
        : undefined;
    return mod.renderFeedbackBody(q, response, matched);
  });
}

export function PreviewBody({ question }: { question: PublicQuestion }) {
  return dispatchPublicQuestion(question, (mod, q) => mod.renderPreviewBody(q));
}
