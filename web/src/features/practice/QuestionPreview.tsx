import type { RefObject } from 'react';
import type { Detail, PublicQuestion } from '../../api/practice';
import { Modal } from '../../components/Modal';
import { OptionAudio } from '../../components/OptionAudio';
import { QuestionAudio } from '../../components/QuestionAudio';
import { RichContent } from '../../components/RichContent';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { assertNever } from '../question-types/registry';
import { QuestionImage } from './QuestionImage';

function PreviewBody({ question }: { question: PublicQuestion }) {
  switch (question.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false': {
      const hasAnyTts = question.items.some(option => Boolean(option.tts));
      return (
        <>
          <QuestionAudio question={question} />
          <ol className="preview-options">
            {question.items.map(option => (
              <li key={option.sign}>
                <span>
                  {option.sign}. {option.item_title}
                </span>
                <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
              </li>
            ))}
          </ol>
        </>
      );
    }
    case 'numeric':
      return <QuestionAudio question={question} />;
    case 'listening':
      return (
        <>
          <QuestionAudio question={question} />
          <ExtendedQuestion kind="listening" content={question.content} />
        </>
      );
    case 'cloze':
      return <ExtendedQuestion kind="cloze" content={question.content} />;
    case 'reading_comprehension':
      return <ExtendedQuestion kind="reading_comprehension" content={question.content} />;
    case 'writing':
      return <ExtendedQuestion kind="writing" content={question.content} />;
    case 'translation':
      return <ExtendedQuestion kind="translation" content={question.content} />;
    default:
      return assertNever(question);
  }
}

export function QuestionPreview({
  detail,
  open,
  onOpenChange,
  returnFocus,
}: {
  detail: Detail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  return (
    <Modal title="完整题目" open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} wide>
      <div className="full-question">
        <h3>
          <RichContent content={detail.question.rich_content ?? detail.question.title} />
        </h3>
        <QuestionImage detail={detail} />
        <PreviewBody question={detail.question} />
      </div>
    </Modal>
  );
}
