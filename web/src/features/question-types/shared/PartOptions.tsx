import type { CourseOption, QuestionOption } from '../../../api/generated/types.gen';
import { AnswerOptionList } from '../../../components/AnswerOptionList';
import { AudioControls, ttsConfig } from '../../../components/AudioControls';
import { OptionAudio } from '../../../components/OptionAudio';

function toQuestionOption(option: CourseOption, index: number): QuestionOption {
  return {
    sign: index + 1,
    item_title: option.text,
    pinyin: option.pinyin,
    tts: option.tts ? ttsConfig(option.tts) ?? {} : undefined,
  };
}

function PartOptionAudio({
  option,
  studyOption,
  hasAnyTts,
}: {
  option: CourseOption;
  studyOption?: QuestionOption;
  hasAnyTts: boolean;
}) {
  if (studyOption) {
    return <OptionAudio option={studyOption} allOptionsHaveTts={hasAnyTts} />;
  }
  if (option.pinyin?.length) {
    return <AudioControls text={option.text} pinyin={option.pinyin} />;
  }
  if (!option.tts) return null;
  const config = ttsConfig(option.tts);
  return (
    <AudioControls
      text={config?.text ?? option.text}
      voice={config?.voice}
      speed={config?.speed}
    />
  );
}

function PartOptionRow({
  option,
  index,
  name,
  chosen,
  multiple,
  disabled,
  studyRows,
  studyOption,
  hasAnyTts,
  onChoose,
}: {
  option: CourseOption;
  index: number;
  name: string;
  chosen: boolean;
  multiple?: boolean;
  disabled: boolean;
  studyRows?: boolean;
  studyOption?: QuestionOption;
  hasAnyTts: boolean;
  onChoose: (id: string) => void;
}) {
  const row = `answer-option choice-option ${chosen ? 'selected' : ''}`;
  return (
    <li className={studyRows ? 'choice-option-row' : undefined}>
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
      <PartOptionAudio
        option={option}
        studyOption={studyOption}
        hasAnyTts={hasAnyTts}
      />
    </li>
  );
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
  const studyOptions = studyRows ? options.map(toQuestionOption) : [];
  if (studyRows && correct) {
    const signs = (ids: string[]) =>
      new Set(
        options.flatMap((option, index) => (ids.includes(option.id) ? [index + 1] : [])),
      );
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
      {options.map((option, index) => (
        <PartOptionRow
          key={option.id}
          option={option}
          index={index}
          name={name}
          chosen={selected.includes(option.id)}
          multiple={multiple}
          disabled={disabled}
          studyRows={studyRows}
          studyOption={studyOptions[index]}
          hasAnyTts={hasAnyTts}
          onChoose={onChoose}
        />
      ))}
    </ul>
  );
}
