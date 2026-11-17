import { QuestionAudio } from '../../components/QuestionAudio';
import { NumericAnswer } from '../../components/NumericAnswer';
import type { ExamItem } from '../../api/exams';
import { answerSymbols, optionSymbol } from './terminalLabels';

export function ExamQuestion({ item, index, selected, busy, finished, onChoose, numeric, onNumeric }: {
  item: ExamItem; index: number; selected: number[]; busy: boolean;
  finished: boolean; onChoose: (sign: number) => void;
  numeric: string; onNumeric: (value: string) => void;
}) {
  const q = item.detail.question;
  return <fieldset className="terminal-question" aria-label="考试题干">
    <legend>考试题目</legend>
    <div className="terminal-stem" tabIndex={0}>
      <h2 className="question-text">{index + 1}. {q.title}</h2>
      <QuestionAudio question={q} />
      {q.question_type < 3 && <ol className="terminal-option-text" aria-label="选项内容">
        {q.items.map(option => <li key={option.sign}>
          {optionSymbol(q, option.sign)}. {option.item_title}
        </li>)}
      </ol>}
    </div>
    <div className="terminal-selection" aria-label="考试选项">
      {q.question_type === 4 ? <NumericAnswer value={numeric} onChange={onNumeric}
        disabled={busy || item.answered || finished} /> : <>
      <strong>您选择的答案：<span>{answerSymbols(q, selected)}</span></strong>
      <div className="terminal-option-buttons"><span>选项：</span>
        {q.items.map(option => <button key={option.sign} className="terminal-choice"
          aria-label={`${optionSymbol(q, option.sign)} ${option.item_title}`}
          aria-pressed={selected.includes(option.sign)}
          disabled={busy || item.answered || finished} onClick={() => onChoose(option.sign)}>
          {optionSymbol(q, option.sign)}
        </button>)}
      </div>
      </>}
    </div>
  </fieldset>;
}
