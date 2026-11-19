import type { ExtendedResponse } from '../../api/generated/types.gen';
import type { Question } from '../../api/client';
import { AnswerOptionList } from '../../components/AnswerOptionList';
import { QuestionAudio, type ProtectedAudio } from '../../components/QuestionAudio';
import { ClozePassage } from './ClozeContent';
import { ExtendedExplanations } from './ExtendedExplanations';
import { ExtendedReference } from './ExtendedReference';
import { hasReviewExplanation } from './model';
import { ReadingPassage } from './ReadingContent';
import { assertNever, type AnyQuestion } from './registry';
import { TranslationSource } from './TranslationContent';
import { WritingCriteria, WritingRequirements, WritingSample } from './WritingContent';

export function QuestionStimulus({
  question,
  cloze,
  protectedAudio,
}: {
  question: AnyQuestion;
  cloze?: { value?: ExtendedResponse; onJump?: (index: number) => void };
  protectedAudio?: ProtectedAudio;
}) {
  switch (question.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
    case 'listening':
      return (
        <QuestionAudio
          key={`audio-${question.question_id}`}
          question={question}
          protectedAudio={protectedAudio}
        />
      );
    case 'cloze':
      return (
        <ClozePassage
          passage={question.content.passage}
          blanks={question.content.blanks}
          review={'question_review' in question ? question.question_review : undefined}
          value={cloze?.value}
          onJump={cloze?.onJump}
        />
      );
    case 'reading_comprehension':
      return <ReadingPassage passage={question.content.passage} />;
    case 'writing':
      return <WritingRequirements content={question.content} />;
    case 'translation':
      return <TranslationSource content={question.content} />;
    default:
      return assertNever(question);
  }
}

export function QuestionReferenceAnswers({
  question,
  mode = 'compact',
  includeWritingSample = true,
}: {
  question: Question;
  mode?: 'compact' | 'full';
  includeWritingSample?: boolean;
}) {
  switch (question.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return (
        <ExtendedReference
          question={question}
          includeWritingSample={includeWritingSample}
        />
      );
    case 'numeric':
      return <p className="answer-option correct">正确答案：{question.answer}</p>;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false': {
      const correct = new Set(question.answer.split(',').map(Number));
      return (
        <AnswerOptionList
          options={question.items}
          correct={correct}
          judgment={question.question_type === 'true_false'}
          expanded={mode === 'full'}
        />
      );
    }
    default:
      return assertNever(question);
  }
}

export function QuestionWritingSample({ question }: { question: Question }) {
  return question.question_type === 'writing' ? (
    <WritingSample review={question.question_review} />
  ) : null;
}

export function QuestionExtendedExplanations({ question }: { question: Question }) {
  switch (question.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
      return <ExtendedExplanations review={question.question_review} />;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
    case 'writing':
    case 'translation':
      return null;
    default:
      return assertNever(question);
  }
}

export function QuestionWritingCriteria({ question }: { question: Question }) {
  return question.question_type === 'writing' ? (
    <WritingCriteria review={question.question_review} />
  ) : null;
}

export function questionHasReviewExplanation(question: Question): boolean {
  switch (question.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return hasReviewExplanation(question.question_review);
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
      return false;
    default:
      return assertNever(question);
  }
}

export function questionHasWritingCriteria(question: Question): boolean {
  return (
    question.question_type === 'writing' &&
    Boolean(question.question_review?.keywords?.length || question.question_review?.rubric)
  );
}
