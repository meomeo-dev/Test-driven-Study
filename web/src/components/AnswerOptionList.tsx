import { Check, Circle, CircleCheck } from 'lucide-react';
import type { QuestionOption } from '../api/generated/types.gen';
import { OptionAudio } from './OptionAudio';

type Props = {
  options: QuestionOption[];
  correct: ReadonlySet<number>;
  selected?: ReadonlySet<number>;
  judgment?: boolean;
  expanded?: boolean;
};

export function AnswerOptionList({ options, correct, selected, judgment, expanded }: Props) {
  const hasAnyTts = options.some(option => Boolean(option.tts));
  return <div className={`answer-options${expanded ? ' expanded-options' : ''}`}
    role="list" aria-label="选项与答案">
    {options.map(option => {
      const right = correct.has(option.sign);
      const state = right ? ' correct' : selected?.has(option.sign) ? ' choice-option selected' : '';
      return <div role="listitem" key={option.sign} className={`answer-option${state}`}>
        {judgment ? (right ? <CircleCheck size={19} /> : <Circle size={19} />)
          : <span className="option-letter">{String.fromCharCode(64 + option.sign)}</span>}
        <span className="option-text">{option.item_title}</span>
        <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
        {right && <span className="correct-label"><Check size={13} />正确答案</span>}
      </div>;
    })}
  </div>;
}
