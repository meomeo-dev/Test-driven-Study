import { QuestionAudio } from '../../components/QuestionAudio';
import { NumericAnswer } from '../../components/NumericAnswer';
import { playLine, type ExamItem } from '../../api/exams';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { OptionAudio } from '../../components/OptionAudio';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { answerSymbols, optionSymbol } from './terminalLabels';

export function ExamQuestion({ examID, draft, onDraft, item, index, selected, busy, finished, onChoose, numeric, onNumeric }: {
  examID: string; draft?: ExtendedResponse; onDraft: (value: ExtendedResponse) => void;
  item: ExamItem; index: number; selected: number[]; busy: boolean;
  finished: boolean; onChoose: (sign: number) => void;
  numeric: string; onNumeric: (value: string) => void;
}) {
  const q = item.detail.question;
  return <fieldset className="terminal-question" aria-label="考试题干">
    <legend>考试题目</legend>
    <div className="terminal-stem" tabIndex={0}>
      <h2 className="question-text">{index + 1}. <RichContent content={q.rich_content ?? q.title} /></h2>
      <QuestionAudio key={`audio-${q.question_id}`} question={q}
        protectedAudio={item.audio_speeds && { speeds: item.audio_speeds,
          load: (line, force) => playLine(examID, index, line, force) }} />
      {q.content && <ExtendedQuestion content={q.content} value={draft} onChange={onDraft}
        disabled={busy || item.answered || finished} />}
      {q.question_type < 3 && <ol className="terminal-option-text" aria-label="选项内容">
        {q.items.map(option => <li key={option.sign}>
          {optionSymbol(q, option.sign)}. {option.item_title}
          <OptionAudio option={option} allOptionsHaveTts={q.items.some(o => !!o.tts)} />
        </li>)}
      </ol>}
    </div>
    {!q.content && <div className="terminal-selection" aria-label="考试选项">
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
    </div>}
  </fieldset>;
}
