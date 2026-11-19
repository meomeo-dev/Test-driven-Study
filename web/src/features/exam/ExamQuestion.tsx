import { playLine, type ExamItem } from '../../api/exams';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { ExamSelection, ExamStem } from '../question-types';

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
        <ExamStem
          question={q}
          protectedAudio={protectedAudio}
          draft={draft}
          onDraft={onDraft}
          disabled={disabled}
        />
      </div>
      <ExamSelection
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
