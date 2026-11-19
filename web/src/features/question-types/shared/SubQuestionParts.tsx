import { useId } from 'react';
import type {
  CourseGrading,
  CourseOption,
  ExtendedResponse,
  SubAnswers,
  SubQuestionPrompt,
  SubQuestionReview,
} from '../../../api/generated/types.gen';
import { NumericAnswer } from '../../../components/NumericAnswer';
import { RichContent } from '../../../components/RichContent';
import { PartOptions } from './PartOptions';

const defaultTrueFalseOptions: CourseOption[] = [
  { id: 'true', text: '正确', value: true },
  { id: 'false', text: '错误', value: false },
];

function SubQuestionNumeric({
  value,
  disabled,
  grading,
  submitted,
  onChange,
}: {
  value?: SubAnswers[string];
  disabled: boolean;
  grading?: CourseGrading;
  submitted: boolean;
  onChange: (value: SubAnswers[string]) => void;
}) {
  if (grading) {
    return (
      <>
        <div className="answer-option correct">正确答案：{grading.value}</div>
        {submitted && <p>你的答案：{value ?? '未作答'}</p>}
      </>
    );
  }
  if (disabled && value === undefined) return null;
  return (
    <NumericAnswer
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function resolveSubChoiceState(
  sub: SubQuestionPrompt,
  value: SubAnswers[string] | undefined,
  grading?: CourseGrading,
) {
  const options = sub.options ?? defaultTrueFalseOptions;
  const isBoolean = sub.type === 'true_false';
  const multiple = sub.type === 'multiple_choice';
  const selected: string[] = Array.isArray(value)
    ? value
    : typeof value === 'boolean' && isBoolean
      ? options.filter(o => o.value === value).map(o => o.id)
      : [];
  const expected = grading?.boolean ?? grading?.value;
  const correct =
    typeof expected === 'boolean'
      ? options.filter(o => o.value === expected).map(o => o.id)
      : grading?.choice_ids;
  return { options, isBoolean, multiple, selected, correct };
}

export function SubQuestionRow({
  sub,
  value,
  disabled,
  name,
  onChange,
  grading,
  studyRows,
  submitted,
}: {
  sub: SubQuestionPrompt;
  value?: SubAnswers[string];
  disabled: boolean;
  name: string;
  onChange: (value: SubAnswers[string]) => void;
  grading?: CourseGrading;
  studyRows: boolean;
  submitted: boolean;
}) {
  if (sub.type === 'numeric') {
    return (
      <SubQuestionNumeric
        value={value}
        disabled={disabled}
        grading={grading}
        submitted={submitted}
        onChange={onChange}
      />
    );
  }
  const { options, isBoolean, multiple, selected, correct } = resolveSubChoiceState(
    sub,
    value,
    grading,
  );
  function choose(id: string) {
    if (isBoolean) {
      const choice = options.find(o => o.id === id)?.value;
      if (choice !== undefined) onChange(choice);
    } else if (multiple) {
      onChange(
        selected.includes(id) ? selected.filter(o => o !== id) : [...selected, id],
      );
    } else {
      onChange([id]);
    }
  }
  const submission = options.filter(o => selected.includes(o.id)).map(o => o.text);
  return (
    <>
      <PartOptions
        options={options}
        name={name}
        selected={selected}
        multiple={multiple}
        disabled={disabled}
        onChoose={choose}
        correct={correct}
        judgment={isBoolean}
        studyRows={studyRows}
      />
      {submitted && <p>你的答案：{submission.join('、') || '未作答'}</p>}
    </>
  );
}

export function SubQuestionList({
  subQuestions,
  value,
  onChange,
  disabled,
  partIdPrefix,
  reviewSubs,
  studyRows,
}: {
  subQuestions: SubQuestionPrompt[];
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  partIdPrefix?: string;
  reviewSubs?: SubQuestionReview[];
  studyRows: boolean;
}) {
  const fallbackId = useId();
  const id = partIdPrefix ?? fallbackId;
  const readOnly = Boolean(disabled) || !onChange;
  const submitted = Boolean(value) && Boolean(reviewSubs);
  return (
    <>
      {subQuestions.map((sub, index) => (
        <fieldset key={sub.id} className="extended-part">
          <legend>小题 {index + 1}</legend>
          <div>
            <RichContent content={sub.stem} />
          </div>
          <SubQuestionRow
            sub={sub}
            name={`${id}-${index}`}
            disabled={readOnly}
            studyRows={studyRows}
            submitted={submitted}
            value={value?.sub_answers?.[sub.id]}
            grading={reviewSubs?.find(item => item.id === sub.id)?.grading}
            onChange={answer =>
              onChange?.({
                sub_answers: { ...value?.sub_answers, [sub.id]: answer },
              })
            }
          />
        </fieldset>
      ))}
    </>
  );
}
