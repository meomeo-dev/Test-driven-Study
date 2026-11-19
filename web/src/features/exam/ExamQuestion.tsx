import { playLine, type ExamItem } from '../../api/exams';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import { NumericAnswer } from '../../components/NumericAnswer';
import { OptionAudio } from '../../components/OptionAudio';
import { QuestionAudio, type ProtectedAudio } from '../../components/QuestionAudio';
import { RichContent } from '../../components/RichContent';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { assertNever, type ChoiceQuestion } from '../question-types/registry';
import { TranslationSource } from '../question-types/TranslationContent';
import { answerSymbols, hasDetailedJudgmentOptions, optionSymbol } from './terminalLabels';

function OptionTextList({ question }: { question: ChoiceQuestion }) {
  const hasAnyTts = question.items.some(option => Boolean(option.tts));
  return (
    <ol className="terminal-option-text" aria-label="选项内容">
      {question.items.map(option => (
        <li key={option.sign}>
          {optionSymbol(question, option.sign)}. {option.item_title}
          <OptionAudio option={option} allOptionsHaveTts={hasAnyTts} />
        </li>
      ))}
    </ol>
  );
}

function ExamStemBody({
  question,
  protectedAudio,
  draft,
  onDraft,
  disabled,
}: {
  question: ExamItem['detail']['question'];
  protectedAudio?: ProtectedAudio;
  draft?: ExtendedResponse;
  onDraft: (value: ExtendedResponse) => void;
  disabled: boolean;
}) {
  switch (question.question_type) {
    case 'single_choice':
    case 'multiple_choice':
      return (
        <>
          <QuestionAudio
            key={`audio-${question.question_id}`}
            question={question}
            protectedAudio={protectedAudio}
          />
          <OptionTextList question={question} />
        </>
      );
    case 'true_false':
      return (
        <>
          <QuestionAudio
            key={`audio-${question.question_id}`}
            question={question}
            protectedAudio={protectedAudio}
          />
          {hasDetailedJudgmentOptions(question) && <OptionTextList question={question} />}
        </>
      );
    case 'numeric':
      return (
        <QuestionAudio
          key={`audio-${question.question_id}`}
          question={question}
          protectedAudio={protectedAudio}
        />
      );
    case 'listening':
      return (
        <>
          <QuestionAudio
            key={`audio-${question.question_id}`}
            question={question}
            protectedAudio={protectedAudio}
          />
          <ExtendedQuestion
            kind="listening"
            content={question.content}
            value={draft}
            onChange={onDraft}
            disabled={disabled}
          />
        </>
      );
    case 'cloze':
      return (
        <ExtendedQuestion
          kind="cloze"
          content={question.content}
          value={draft}
          onChange={onDraft}
          disabled={disabled}
        />
      );
    case 'reading_comprehension':
      return (
        <ExtendedQuestion
          kind="reading_comprehension"
          content={question.content}
          value={draft}
          onChange={onDraft}
          disabled={disabled}
        />
      );
    case 'writing':
      return (
        <ExtendedQuestion
          kind="writing"
          content={question.content}
          value={draft}
          onChange={onDraft}
          disabled={disabled}
        />
      );
    case 'translation':
      return (
        <>
          <TranslationSource content={question.content} />
          <ExtendedQuestion
            kind="translation"
            content={question.content}
            value={draft}
            onChange={onDraft}
            disabled={disabled}
            hideSourceText
          />
        </>
      );
    default:
      return assertNever(question);
  }
}

function ExamSelectionBody({
  question,
  selected,
  numeric,
  onNumeric,
  onChoose,
  disabled,
}: {
  question: ExamItem['detail']['question'];
  selected: number[];
  numeric: string;
  onNumeric: (value: string) => void;
  onChoose: (sign: number) => void;
  disabled: boolean;
}) {
  switch (question.question_type) {
    case 'numeric':
      return (
        <div className="terminal-selection" aria-label="考试选项">
          <NumericAnswer value={numeric} onChange={onNumeric} disabled={disabled} />
        </div>
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
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
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return null;
    default:
      return assertNever(question);
  }
}

export function ExamQuestion({
  examID,
  draft,
  onDraft,
  item,
  index,
  selected,
  busy,
  finished,
  onChoose,
  numeric,
  onNumeric,
}: {
  examID: string;
  draft?: ExtendedResponse;
  onDraft: (value: ExtendedResponse) => void;
  item: ExamItem;
  index: number;
  selected: number[];
  busy: boolean;
  finished: boolean;
  onChoose: (sign: number) => void;
  numeric: string;
  onNumeric: (value: string) => void;
}) {
  const q = item.detail.question;
  const disabled = busy || item.answered || finished;
  const protectedAudio = item.audio_speeds
    ? {
        speeds: item.audio_speeds,
        load: (line: number, force: boolean) => playLine(examID, index, line, force),
      }
    : undefined;
  return (
    <fieldset className="terminal-question" aria-label="考试题干">
      <legend>考试题目</legend>
      <div className="terminal-stem" tabIndex={0}>
        <h2 className="question-text">
          {index + 1}. <RichContent content={q.rich_content ?? q.title} />
        </h2>
        <ExamStemBody
          question={q}
          protectedAudio={protectedAudio}
          draft={draft}
          onDraft={onDraft}
          disabled={disabled}
        />
      </div>
      <ExamSelectionBody
        question={q}
        selected={selected}
        numeric={numeric}
        onNumeric={onNumeric}
        onChoose={onChoose}
        disabled={disabled}
      />
    </fieldset>
  );
}
