import { useId } from 'react';
import type { Question } from '../../api/client';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import type { AttemptResult, PublicQuestion } from '../../api/practice';
import { NumericAnswer } from '../../components/NumericAnswer';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { creditLabel, hasRichContent } from '../question-types/model';
import { assertNever } from '../question-types/registry';
import { WritingReview } from '../question-types/WritingContent';
import { WrittenFeedback } from '../question-types/WrittenFeedback';
import { ChoiceOptions } from './ChoiceOptions';

export function hasDraftAnswer(
  question: PublicQuestion,
  canSubmitExtended: boolean,
  numeric: string,
  selected: number[],
): boolean {
  switch (question.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return canSubmitExtended;
    case 'numeric':
      return numeric.trim() !== '';
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return selected.length > 0;
    default:
      return assertNever(question);
  }
}

export function shouldShowExplanation(question: Question): boolean {
  if (
    Boolean(question.analysis) ||
    hasRichContent(question.analysis_content) ||
    Boolean(question.analysis_audio?.length) ||
    Boolean(question.skill)
  ) {
    return true;
  }
  switch (question.question_type) {
    case 'reading_comprehension':
    case 'writing':
      return true;
    case 'cloze':
      return Boolean(question.question_review?.blanks.length) || !question.question_review;
    case 'listening':
      return (
        Boolean(question.question_review?.sub_questions.length) || !question.question_review
      );
    case 'translation':
      return !question.question_review;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
      return true;
    default:
      return assertNever(question);
  }
}

export function PracticeAnswerBody({
  question,
  presentationId,
  result,
  selected,
  draft,
  onDraft,
  numeric,
  onNumeric,
  pending,
  shortcuts,
  onChoose,
  clozeId,
}: {
  question: PublicQuestion;
  presentationId: string;
  result?: AttemptResult;
  selected: number[];
  draft?: ExtendedResponse;
  onDraft: (draft: ExtendedResponse) => void;
  numeric: string;
  onNumeric: (value: string) => void;
  pending: boolean;
  shortcuts: boolean;
  onChoose: (sign: number) => void;
  clozeId?: string;
}) {
  const fallbackId = useId();
  const partPrefix = clozeId ?? fallbackId;
  const reviewQuestion = result?.detail.question;
  const disabled = pending || !!result;
  const value = result?.attempt.response ?? draft;

  switch (question.question_type) {
    case 'cloze': {
      const review =
        reviewQuestion?.question_type === 'cloze'
          ? reviewQuestion.question_review
          : undefined;
      return (
        <>
          <ExtendedQuestion
            kind="cloze"
            content={question.content}
            value={value}
            disabled={disabled}
            onChange={onDraft}
            partIdPrefix={partPrefix}
            hidePassage
          />
          {review && result && (
            <ExtendedReview
              item={review}
              response={result.attempt.response}
              credit={result.attempt.score}
              hideExplanations
            />
          )}
        </>
      );
    }
    case 'listening': {
      const review =
        reviewQuestion?.question_type === 'listening'
          ? reviewQuestion.question_review
          : undefined;
      return (
        <>
          <ExtendedQuestion
            kind="listening"
            content={question.content}
            value={value}
            disabled={disabled}
            onChange={onDraft}
          />
          {review && result && (
            <ExtendedReview
              item={review}
              response={result.attempt.response}
              credit={result.attempt.score}
              hideExplanations
            />
          )}
        </>
      );
    }
    case 'reading_comprehension': {
      const review =
        reviewQuestion?.question_type === 'reading_comprehension'
          ? reviewQuestion.question_review
          : undefined;
      return (
        <>
          <ExtendedQuestion
            kind="reading_comprehension"
            content={question.content}
            value={value}
            disabled={disabled}
            onChange={onDraft}
            hidePassage
            review={review}
          />
          {result?.attempt.score !== undefined && (
            <p role="status">本题得分比例：{creditLabel(result.attempt.score)}</p>
          )}
        </>
      );
    }
    case 'writing':
      return (
        <>
          {!result && (
            <ExtendedQuestion
              kind="writing"
              content={question.content}
              value={draft}
              disabled={pending}
              onChange={onDraft}
              hideWritingRequirements
            />
          )}
          {result && (
            <WritingReview
              response={result.attempt.response}
              credit={result.attempt.score}
            />
          )}
          {result && <WrittenFeedback presentation={presentationId} writing />}
        </>
      );
    case 'translation': {
      const review =
        reviewQuestion?.question_type === 'translation'
          ? reviewQuestion.question_review
          : undefined;
      return (
        <>
          {!result && (
            <ExtendedQuestion
              kind="translation"
              content={question.content}
              value={draft}
              disabled={pending}
              onChange={onDraft}
              hideSourceText
            />
          )}
          {review && result && (
            <ExtendedReview
              item={review}
              response={result.attempt.response}
              credit={result.attempt.score}
              hideExplanations
            />
          )}
          {result && <WrittenFeedback presentation={presentationId} writing={false} />}
        </>
      );
    }
    case 'numeric':
      return (
        <>
          <NumericAnswer value={numeric} onChange={onNumeric} disabled={disabled} />
          {result && (
            <p className="answer-option correct">
              正确答案：{result.attempt.correct_numeric}
            </p>
          )}
        </>
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return (
        <ChoiceOptions
          question={question}
          selected={selected}
          result={result?.attempt}
          pending={pending}
          shortcuts={shortcuts}
          onChoose={onChoose}
        />
      );
    default:
      return assertNever(question);
  }
}
