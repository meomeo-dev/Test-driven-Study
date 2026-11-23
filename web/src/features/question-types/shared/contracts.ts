import type { ReactNode } from 'react';
import type {
  Attempt,
  AttemptEvaluation,
  CourseItemReview,
  ExtendedResponse,
  PublicQuestion,
  Question,
  QuestionType,
  RichText,
} from '../../../api/generated/types.gen';
import type { ProtectedAudio, QuestionAudioSource } from '../../../components/QuestionAudio';

export type QuestionOf<T extends QuestionType> = Extract<Question, { question_type: T }>;
export type PublicQuestionOf<T extends QuestionType> = Extract<
  PublicQuestion,
  { question_type: T }
>;
export type ReviewOf<T extends QuestionType> = Extract<CourseItemReview, { type: T }>;
export type AnyQuestion = Question | PublicQuestion;
export type AnyQuestionOf<T extends QuestionType> = QuestionOf<T> | PublicQuestionOf<T>;

export type MediaQuestion = QuestionAudioSource;

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
  readonly type: QuestionType;
  readonly label: string;
  readonly examPrompt: string;
  readonly answerHeading: string;
  readonly isChoice: boolean;
  readonly isMultiple: boolean;
  readonly isWritten: boolean;
  readonly hideAnswerHeading: boolean;
  readonly isExtended: boolean;
  readonly hasMedia: boolean;
};

export type StimulusContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  reviewQuestion?: QuestionOf<T>;
  cloze?: { value?: ExtendedResponse; onJump?: (index: number) => void };
  protectedAudio?: ProtectedAudio;
  showStudyTranslation?: boolean;
};

export type PracticeAnswerContext<T extends QuestionType> = {
  question: PublicQuestionOf<T>;
  reviewQuestion?: QuestionOf<T>;
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
  partIdPrefix: string;
  onChoose: (sign: number) => void;
  onDraft: (draft: ExtendedResponse) => void;
  onNumeric: (value: string) => void;
  onEvaluated?: (evaluation: AttemptEvaluation) => void;
};

export type ExamStemContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  protectedAudio?: ProtectedAudio;
  draft?: ExtendedResponse;
  onDraft: (value: ExtendedResponse) => void;
  disabled: boolean;
};

export type ExamSelectionContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  selected: number[];
  numeric: string;
  onNumeric: (value: string) => void;
  onChoose: (sign: number) => void;
  disabled: boolean;
};

export type ExamFeedbackAnswerContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  review?: QuestionOf<T>;
  selected: number[];
  numeric?: string;
  response?: ExtendedResponse;
  credit?: number;
};

export type ExamDialogReviewContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  review: QuestionOf<T>;
  response?: ExtendedResponse;
  credit?: number;
  renderAnalysis: () => ReactNode;
};

export type ExamNavValueContext<T extends QuestionType> = {
  question: AnyQuestionOf<T>;
  selected: number[];
  numeric?: string;
  response?: ExtendedResponse;
};

export type ReferenceContext<T extends QuestionType> = {
  question: QuestionOf<T>;
  mode?: 'compact' | 'full';
  includeWritingSample?: boolean;
  showStudyTranslation?: boolean;
};

export type ReviewContext<T extends QuestionType> = {
  review: ReviewOf<T>;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
};

export type ExplanationPart = {
  key: string | number;
  label: string;
  content: RichText;
};

export type DraftCheckContext = {
  selected: number[];
  numeric: string;
  canSubmitExtended: boolean;
};

export interface QuestionTypeModule<T extends QuestionType> {
  readonly spec: QuestionTypeSpec;

  renderStimulus: (ctx: StimulusContext<T>) => ReactNode;
  renderPracticeAnswer: (ctx: PracticeAnswerContext<T>) => ReactNode;
  renderExamStem: (ctx: ExamStemContext<T>) => ReactNode;
  renderExamSelection: (ctx: ExamSelectionContext<T>) => ReactNode;
  renderPreviewBody: (question: PublicQuestionOf<T>) => ReactNode;
  renderReferenceAnswers: (ctx: ReferenceContext<T>) => ReactNode;
  renderPalaceAnswers: (question: QuestionOf<T>) => ReactNode;
  renderFeedbackBody: (
    question: AnyQuestionOf<T>,
    response?: ExtendedResponse,
    review?: QuestionOf<T>,
  ) => ReactNode;
  renderFeedbackAnswer: (ctx: ExamFeedbackAnswerContext<T>) => ReactNode;
  renderDialogReview: (ctx: ExamDialogReviewContext<T>) => ReactNode;
  renderReview: (ctx: ReviewContext<T>) => ReactNode;

  getExplanationParts: (question: QuestionOf<T>) => ExplanationPart[];
  hasReviewExplanation: (question: QuestionOf<T>) => boolean;
  shouldShowPracticeExplanation: (question: QuestionOf<T>) => boolean;
  renderWritingSample?: (question: QuestionOf<T>) => ReactNode;
  renderWritingCriteria?: (question: QuestionOf<T>) => ReactNode;
  hasWritingCriteria?: (question: QuestionOf<T>) => boolean;

  hasDraftAnswer: (ctx: DraftCheckContext) => boolean;
  normalizeDraft?: (draft?: ExtendedResponse) => ExtendedResponse | undefined;
  formatExamNavValue: (ctx: ExamNavValueContext<T>) => string;
  formatAttemptSummary: (attempt: Attempt) => string;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled question type: ${JSON.stringify(value)}`);
}
