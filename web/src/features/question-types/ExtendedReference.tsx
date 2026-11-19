import type { Question } from '../../api/client';
import { ExtendedQuestion } from './ExtendedQuestion';
import { assertNever } from './registry';
import { TranslationReference } from './TranslationContent';
import { WritingSample } from './WritingContent';

export function ExtendedReference({
  question,
  includeWritingSample = true,
}: {
  question: Question;
  includeWritingSample?: boolean;
}) {
  switch (question.question_type) {
    case 'writing':
      return includeWritingSample ? <WritingSample review={question.question_review} /> : null;
    case 'translation':
      return <TranslationReference review={question.question_review} />;
    case 'cloze':
      return (
        <ExtendedQuestion
          kind="cloze"
          content={question.content}
          hidePassage
          review={question.question_review}
        />
      );
    case 'listening':
      return (
        <ExtendedQuestion
          kind="listening"
          content={question.content}
          review={question.question_review}
        />
      );
    case 'reading_comprehension':
      return (
        <ExtendedQuestion
          kind="reading_comprehension"
          content={question.content}
          hidePassage
          review={question.question_review}
        />
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
      return null;
    default:
      return assertNever(question);
  }
}
