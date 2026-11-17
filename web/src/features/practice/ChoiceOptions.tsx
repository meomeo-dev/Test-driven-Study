import { Check, Circle, CircleCheck } from 'lucide-react';
import type { Attempt, PublicQuestion } from '../../api/practice';

type Props = {
  question: PublicQuestion;
  selected: number[];
  result?: Pick<Attempt, 'correct_answer'>;
  pending: boolean;
  shortcuts: boolean;
  onChoose: (sign: number) => void;
};

export function ChoiceOptions({ question, selected, result, pending, shortcuts, onChoose }: Props) {
  const correct = new Set(result?.correct_answer ?? []);
  return <div className="answer-options" role="group" aria-label="选择答案">
    {question.items.map(option => {
      const chosen = selected.includes(option.sign);
      const right = !!result && correct.has(option.sign);
      const wrong = !!result && chosen && !right;
      return <button type="button" key={option.sign}
        className={`answer-option choice-option ${chosen ? 'selected' : ''} ${right ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
        data-sign={option.sign} aria-label={`选项${option.sign}：${option.item_title}`} aria-pressed={chosen}
        aria-keyshortcuts={shortcuts ? String(option.sign) : undefined}
        disabled={pending || !!result} onClick={() => onChoose(option.sign)}>
        <span className="option-letter">{option.sign}</span>
        {question.question_type === 2 && (chosen ? <CircleCheck size={16} /> : <Circle size={16} />)}
        <span className="option-text">{option.item_title}</span>
        {right && <span className="correct-label"><Check size={13} />正确答案</span>}
        {wrong && <span className="wrong-label">你的选择</span>}
      </button>;
    })}
  </div>;
}
