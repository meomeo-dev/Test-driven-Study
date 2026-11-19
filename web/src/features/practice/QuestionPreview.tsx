import type { RefObject } from 'react';
import type { Detail } from '../../api/practice';
import { Modal } from '../../components/Modal';
import { RichContent } from '../../components/RichContent';
import { PreviewBody } from '../question-types';
import { QuestionImage } from './QuestionImage';

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
