import { Check, Circle, CircleCheck } from 'lucide-react';
import type { Attempt, QuestionOption } from '../../../api/generated/types.gen';
import { OptionAudio } from '../../../components/OptionAudio';
import type { AnyQuestionOf, ChoiceQuestion } from './contracts';
import { creditLabel } from './format';

const defaultJudgmentLabels = new Set(['正确', '错误', '对', '错']);

export function optionSymbol(q: ChoiceQuestion, sign: number): string {
  if (q.question_type === 'true_false') {
    const option = q.items.find(item => item.sign === sign);
    const value =
      option?.boolean_value ??
      (option?.item_title === '正确' || option?.item_title === '对');
    return value ? '√' : '×';
  }
  const index = q.items.findIndex(option => option.sign === sign);
  return index < 0 ? '' : String.fromCharCode(65 + index);
}

export function answerSymbols(q: ChoiceQuestion, selected: number[]): string {
  return q.items
    .filter(option => selected.includes(option.sign))
    .map(option => optionSymbol(q, option.sign))
    .join('、');
}

export function hasDetailedJudgmentOptions(
  q: AnyQuestionOf<'true_false'>,
): boolean {
  return q.items.some(
    option =>
      Boolean(option.tts) ||
      Boolean(option.pinyin?.length) ||
      !defaultJudgmentLabels.has(option.item_title),
  );
}

export function judgmentOptionAt(q: ChoiceQuestion, position: number) {
  if (q.question_type === 'true_false' && (position === 0 || position === 1)) {
    const matched = q.items.find(option => option.boolean_value === (position === 0));
    if (matched) return matched;
  }
  return q.items[position];
}

export function formatAttemptChoiceSummary(attempt: Attempt): string {
  if (attempt.question_type === 'true_false' && attempt.response?.value !== undefined) {
    const score =
      attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    return `你的判断 ${attempt.response.value ? '正确' : '错误'}${score}`;
  }
  return `你的选择 ${attempt.selected.join(', ')} · 正确选项 ${attempt.correct_answer.join(', ')}`;
}

function ChoiceOptionRow({
  option,
  multiple,
  chosen,
  right,
  wrong,
  disabled,
  shortcuts,
  hasAnyTts,
  onChoose,
}: {
  option: QuestionOption;
  multiple: boolean;
  chosen: boolean;
  right: boolean;
  wrong: boolean;
  disabled: boolean;
  shortcuts: boolean;
  hasAnyTts: boolean;
  onChoose: (sign: number) => void;
}) {
  const cls = `answer-option choice-option ${chosen ? 'selected' : ''} ${
    right ? 'correct' : ''
  } ${wrong ? 'wrong' : ''}`;
  return (
    <div className="choice-option-row">
      <button
        type="button"
        className={cls}
        data-sign={option.sign}
        aria-label={`选项${option.sign}：${option.item_title}`}
        aria-pressed={chosen}
        aria-keyshortcuts={shortcuts ? String(option.sign) : undefined}
        disabled={disabled}
        onClick={() => onChoose(option.sign)}
      >
        <span className="option-letter">{option.sign}</span>
        {multiple && (chosen ? <CircleCheck size={16} /> : <Circle size={16} />)}
        <span className="option-text">{option.item_title}</span>
        {right && (
          <span className="correct-label">
            <Check size={13} />
            正确答案
          </span>
        )}
        {wrong && <span className="wrong-label">你的选择</span>}
      </button>
      <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
    </div>
  );
}

export function ChoiceOptionButtons({
  items,
  multiple,
  selected,
  correctAnswer,
  submitted,
  disabled,
  shortcuts,
  onChoose,
}: {
  items: QuestionOption[];
  multiple: boolean;
  selected: number[];
  correctAnswer?: number[];
  submitted: boolean;
  disabled: boolean;
  shortcuts: boolean;
  onChoose: (sign: number) => void;
}) {
  const correct = new Set(correctAnswer ?? []);
  const hasAnyTts = items.some(opt => Boolean(opt.tts));
  return (
    <div className="answer-options" role="group" aria-label="选择答案">
      {items.map(option => {
        const chosen = selected.includes(option.sign);
        const right = submitted && correct.has(option.sign);
        const wrong = submitted && chosen && !right;
        return (
          <ChoiceOptionRow
            key={option.sign}
            option={option}
            multiple={multiple}
            chosen={chosen}
            right={right}
            wrong={wrong}
            disabled={disabled}
            shortcuts={shortcuts}
            hasAnyTts={hasAnyTts}
            onChoose={onChoose}
          />
        );
      })}
    </div>
  );
}

export function OptionTextList({
  question,
  className,
  ariaLabel,
}: {
  question: ChoiceQuestion;
  className?: string;
  ariaLabel?: string;
}) {
  const hasAnyTts = question.items.some(option => Boolean(option.tts));
  return (
    <ol className={className} aria-label={ariaLabel}>
      {question.items.map(option => (
        <li key={option.sign}>
          {optionSymbol(question, option.sign)}. {option.item_title}
          <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
        </li>
      ))}
    </ol>
  );
}

export function PreviewChoiceList({ items }: { items: QuestionOption[] }) {
  const hasAnyTts = items.some(option => Boolean(option.tts));
  return (
    <ol className="preview-options">
      {items.map(option => (
        <li key={option.sign}>
          <span>
            {option.sign}. {option.item_title}
          </span>
          <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
        </li>
      ))}
    </ol>
  );
}

export function PalaceChoiceList({
  items,
  answers,
}: {
  items: QuestionOption[];
  answers: number[];
}) {
  const hasAnyTts = items.some(option => Boolean(option.tts));
  return (
    <ol className="palace-options">
      {items.map(item => (
        <li key={item.sign} className={answers.includes(item.sign) ? 'correct' : ''}>
          <span>
            {item.sign}. {item.item_title}
          </span>
          <OptionAudio option={item} allOptionsHaveTts={hasAnyTts} />
          {answers.includes(item.sign) && <b>正确</b>}
        </li>
      ))}
    </ol>
  );
}

export function ExamChoiceSelection({
  question,
  selected,
  disabled,
  onChoose,
}: {
  question: ChoiceQuestion;
  selected: number[];
  disabled: boolean;
  onChoose: (sign: number) => void;
}) {
  return (
    <div className="terminal-selection" aria-label="考试选项">
      <strong>
        您选择的答案：<span>{answerSymbols(question, selected)}</span>
      </strong>
      <div className="terminal-option-buttons">
        <span>选项：</span>
        {question.items.map(option => (
          <button
            key={option.sign}
            className="terminal-choice"
            aria-label={`${optionSymbol(question, option.sign)} ${option.item_title}`}
            aria-pressed={selected.includes(option.sign)}
            disabled={disabled}
            onClick={() => onChoose(option.sign)}
          >
            {optionSymbol(question, option.sign)}
          </button>
        ))}
      </div>
    </div>
  );
}
