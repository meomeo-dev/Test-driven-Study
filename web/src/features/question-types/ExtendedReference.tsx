import type { Question } from '../../api/client';
import { ExtendedQuestion } from './ExtendedQuestion';
import { ExtendedReview } from './ExtendedReview';
import { TranslationReference } from './TranslationContent';
import { WritingSample } from './WritingContent';
import { clozeQuestionType, listeningQuestionType, readingQuestionType,
  translationQuestionType, writingQuestionType } from './model';

export function ExtendedReference({ question, includeWritingSample = true }: {
  question: Question;
  includeWritingSample?: boolean;
}) {
  if (question.question_type === writingQuestionType) {
    return includeWritingSample ? <WritingSample review={question.question_review} /> : null;
  }
  if (question.question_type === translationQuestionType) {
    return <TranslationReference review={question.question_review} />;
  }
  if ((question.question_type === clozeQuestionType ||
    question.question_type === listeningQuestionType ||
    question.question_type === readingQuestionType) && question.content) {
    return <ExtendedQuestion content={question.content}
      hidePassage={question.question_type !== listeningQuestionType}
      review={question.question_review} />;
  }
  if (question.content) {
    return <>
      <ExtendedQuestion content={question.content} />
      {question.question_review && <ExtendedReview item={question.question_review} />}
    </>;
  }
  return null;
}
