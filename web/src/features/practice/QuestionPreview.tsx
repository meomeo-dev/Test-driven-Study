import type { RefObject } from 'react';
import { Modal } from '../../components/Modal';
import type { Detail } from '../../api/practice';
import { QuestionImage } from './QuestionImage';

export function QuestionPreview({ detail, open, onOpenChange, returnFocus }: {
  detail: Detail; open: boolean; onOpenChange: (open: boolean) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  return <Modal title="完整题目" open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} wide>
    <div className="full-question"><h3>{detail.question.title}</h3>
      <QuestionImage detail={detail} />
      <ol className="preview-options">{detail.question.items.map(option =>
        <li key={option.sign}>{option.sign}. {option.item_title}</li>)}</ol>
    </div>
  </Modal>;
}
