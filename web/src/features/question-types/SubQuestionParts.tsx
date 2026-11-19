import type {
  CourseGrading,
  CourseOption,
  QuestionOption,
  SubAnswers,
  SubQuestionPrompt,
} from '../../api/generated/types.gen';
import { AnswerOptionList } from '../../components/AnswerOptionList';
import { AudioControls, ttsConfig } from '../../components/AudioControls';
import { NumericAnswer } from '../../components/NumericAnswer';
import { OptionAudio } from '../../components/OptionAudio';

export function SubQuestion({
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
  const options = sub.options ?? [
    { id: 'true', text: '正确', value: true },
    { id: 'false', text: '错误', value: false },
  ];
  const isBoolean = sub.type === 'true_false';
  const multiple = sub.type === 'multiple_choice';
  const selected: string[] = Array.isArray(value)
    ? value
    : typeof value === 'boolean' && isBoolean
      ? options.filter(o => o.value === value).map(o => o.id)
      : [];
  function choose(id: string) {
    if (isBoolean) {
      const choice = options.find(o => o.id === id)?.value;
      if (choice !== undefined) onChange(choice);
    } else if (multiple) {
      onChange(selected.includes(id) ? selected.filter(o => o !== id) : [...selected, id]);
    } else {
      onChange([id]);
    }
  }
  const expected = grading?.boolean ?? grading?.value;
  const correct =
    typeof expected === 'boolean'
      ? options.filter(o => o.value === expected).map(o => o.id)
      : grading?.choice_ids;
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

function questionOption(option: CourseOption, index: number): QuestionOption {
  return {
    sign: index + 1,
    item_title: option.text,
    pinyin: option.pinyin,
    tts: option.tts ? ttsConfig(option.tts) ?? {} : undefined,
  };
}

export function PartOptions({
  options,
  name,
  selected,
  multiple,
  disabled,
  onChoose,
  correct,
  judgment,
  studyRows,
}: {
  options: CourseOption[];
  name: string;
  selected: string[];
  multiple?: boolean;
  disabled: boolean;
  onChoose: (id: string) => void;
  correct?: string[];
  judgment?: boolean;
  studyRows?: boolean;
}) {
  const studyOptions = studyRows ? options.map(questionOption) : [];
  if (studyRows && correct) {
    const signs = (ids: string[]) =>
      new Set(options.flatMap((option, index) => (ids.includes(option.id) ? [index + 1] : [])));
    return (
      <AnswerOptionList
        options={studyOptions}
        correct={signs(correct)}
        selected={signs(selected)}
        judgment={judgment}
      />
    );
  }
  const hasAnyTts = studyOptions.some(option => Boolean(option.tts));
  return (
    <ul className={studyRows ? 'answer-options reading-options' : 'extended-options'}>
      {options.map((option, index) => {
        const config = ttsConfig(option.tts);
        const chosen = selected.includes(option.id);
        const row = `answer-option choice-option ${chosen ? 'selected' : ''}`;
        const studyOption = studyOptions[index];
        return (
          <li key={option.id} className={studyRows ? 'choice-option-row' : undefined}>
            <label className={studyRows ? row : undefined}>
              <input
                id={index === 0 ? name : undefined}
                name={name}
                type={multiple ? 'checkbox' : 'radio'}
                disabled={disabled}
                checked={chosen}
                onChange={() => onChoose(option.id)}
              />
              <span className={studyRows ? 'option-text' : undefined}>{option.text}</span>
            </label>
            {studyOption ? (
              <OptionAudio option={studyOption} allOptionsHaveTts={hasAnyTts} />
            ) : option.pinyin?.length ? (
              <AudioControls text={option.text} pinyin={option.pinyin} />
            ) : (
              option.tts && (
                <AudioControls
                  text={config?.text ?? option.text}
                  voice={config?.voice}
                  speed={config?.speed}
                />
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
