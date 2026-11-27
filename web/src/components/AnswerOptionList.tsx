import { Check, Circle, CircleCheck } from 'lucide-react';
import type { QuestionOption } from '../api/generated/types.gen';
import { OptionAudio } from './OptionAudio';

type Props = {
  options: QuestionOption[];
  correct: ReadonlySet<number>;
  selected?: ReadonlySet<number>;
  judgment?: boolean;
  expanded?: boolean;
  translations?: Readonly<Record<number, string | undefined>>;
};

export function AnswerOptionList({
  options, correct, selected, judgment, expanded, translations,
}: Props) {
  const hasAnyTts = options.some(option => Boolean(option.tts));
  return <div className={`answer-options${expanded ? ' expanded-options' : ''}`}
    role="list" aria-label="选项与答案">
    {options.map(option => {
      const right = correct.has(option.sign);
      const state = right ? ' correct' : selected?.has(option.sign) ? ' choice-option selected' : '';
      const translation = translations?.[option.sign];
      return <div role="listitem" key={option.sign} className={`answer-option${state}`}>
        {judgment ? (right ? <CircleCheck size={19} /> : <Circle size={19} />)
          : <span className="option-letter">{String.fromCharCode(64 + option.sign)}</span>}
        <span className="option-text">
          {translation ? (
            <>
              <span>{option.item_title}</span>
              <span className="study-translation" lang="zh-Hans">{translation}</span>
            </>
          ) : option.item_title}
        </span>
        {(hasAnyTts || right) && (
          <span className="option-trailing">
            {right && <span className="correct-label"><Check size={13} />正确答案</span>}
            <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
          </span>
        )}
      </div>;
    })}
  </div>;
}
