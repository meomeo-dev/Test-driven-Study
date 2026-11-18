import { useId } from 'react';
import type { CourseGrading, CourseItemReview, CourseOption, ExtendedResponse, QuestionContent,
  QuestionOption, SubAnswers, SubQuestionPrompt } from '../../api/generated/types.gen';
import { AnswerOptionList } from '../../components/AnswerOptionList';
import { AudioControls, ttsConfig } from '../../components/AudioControls';
import { NumericAnswer } from '../../components/NumericAnswer';
import { OptionAudio } from '../../components/OptionAudio';
import { RichContent } from '../../components/RichContent';
import { ClozePassage } from './ClozeContent';
import { WritingRequirements } from './WritingContent';

type Props = {
  content: QuestionContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  review?: CourseItemReview;
  partIdPrefix?: string;
  hidePassage?: boolean;
  hideWritingRequirements?: boolean;
  hideSourceText?: boolean;
};

export function ExtendedQuestion({ content, value, onChange, disabled, review,
  partIdPrefix, hidePassage, hideWritingRequirements, hideSourceText }: Props) {
  const fallbackId = useId();
  const id = partIdPrefix ?? fallbackId;
  const readOnly = disabled || !onChange;
  if (content.blanks) {
    const { blanks } = content;
    const studyRows = !!review;
    return <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
      {!hidePassage && <ClozePassage passage={content.passage} blanks={blanks}
        value={value} onJump={readOnly ? undefined : index =>
          document.getElementById(`${id}-${index}`)?.focus()} />}
      {blanks.map(blank => {
        const expected = review?.blanks?.find(item => item.index === blank.index)?.grading.choice_ids;
        return <fieldset key={blank.index} className="extended-part">
          <legend>空格 {blank.index}</legend>
          <PartOptions options={blank.options} name={`${id}-${blank.index}`}
            selected={value?.blanks?.[blank.index] ?? []} disabled={readOnly}
            correct={expected} studyRows={studyRows}
            onChoose={choice => onChange?.({ blanks: {
              ...value?.blanks, [blank.index]: [choice],
            } })} />
        </fieldset>;
      })}
    </div>;
  }
  if (content.sub_questions) {
    const studyRows = !!content.passage || !!review;
    return <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
      {content.passage && !hidePassage && <div className="extended-passage">
        <RichContent content={content.passage} />
      </div>}
      {content.sub_questions.map((sub, index) => <fieldset key={sub.id} className="extended-part">
        <legend>小题 {index + 1}</legend>
        <div><RichContent content={sub.stem} /></div>
        <SubQuestion sub={sub} name={`${id}-${index}`} disabled={readOnly}
          studyRows={studyRows} submitted={!!value && !!review}
          value={value?.sub_answers?.[sub.id]}
          grading={review?.sub_questions?.find(item => item.id === sub.id)?.grading}
          onChange={answer => onChange?.({ sub_answers: {
            ...value?.sub_answers, [sub.id]: answer,
          } })} />
      </fieldset>)}
    </div>;
  }
  return <WrittenQuestion content={content} value={value} onChange={onChange} disabled={disabled}
    hideWritingRequirements={hideWritingRequirements} hideSourceText={hideSourceText} />;
}

function SubQuestion({ sub, value, disabled, name, onChange, grading, studyRows,
  submitted }: {
  sub: SubQuestionPrompt; value?: SubAnswers[string]; disabled: boolean; name: string;
  onChange: (value: SubAnswers[string]) => void;
  grading?: CourseGrading; studyRows: boolean; submitted: boolean;
}) {
  if (sub.type === 'numeric') {
    if (grading) return <>
      <div className="answer-option correct">正确答案：{grading.value}</div>
      {submitted && <p>你的答案：{value ?? '未作答'}</p>}
    </>;
    if (disabled && value === undefined) return null;
    return <NumericAnswer value={typeof value === 'string' ? value : ''}
      onChange={onChange} disabled={disabled} />;
  }
  const options = sub.options ?? [
    { id: 'true', text: '正确', value: true }, { id: 'false', text: '错误', value: false },
  ];
  const isBoolean = sub.type === 'true_false';
  const multiple = sub.type === 'multiple_choice';
  const selected: string[] = Array.isArray(value) ? value
    : typeof value === 'boolean' && isBoolean ? options.filter(o => o.value === value).map(o => o.id) : [];
  function choose(id: string) {
    if (isBoolean) {
      const choice = options.find(o => o.id === id)?.value;
      if (choice !== undefined) onChange(choice);
    } else if (multiple) {
      onChange(selected.includes(id) ? selected.filter(o => o !== id) : [...selected, id]);
    } else onChange([id]);
  }
  const expected = grading?.boolean ?? grading?.value;
  const correct = typeof expected === 'boolean'
    ? options.filter(o => o.value === expected).map(o => o.id) : grading?.choice_ids;
  const submission = options.filter(o => selected.includes(o.id)).map(o => o.text);
  return <>
    <PartOptions options={options} name={name} selected={selected}
      multiple={multiple} disabled={disabled} onChoose={choose}
      correct={correct} judgment={isBoolean} studyRows={studyRows} />
    {submitted && <p>你的答案：{submission.join('、') || '未作答'}</p>}
  </>;
}

function questionOption(option: CourseOption, index: number): QuestionOption {
  return {
    sign: index + 1,
    item_title: option.text,
    pinyin: option.pinyin,
    tts: option.tts ? ttsConfig(option.tts) ?? {} : undefined,
  };
}

function PartOptions({ options, name, selected, multiple, disabled, onChoose,
  correct, judgment, studyRows }: {
  options: CourseOption[]; name: string; selected: string[]; multiple?: boolean; disabled: boolean;
  onChoose: (id: string) => void; correct?: string[]; judgment?: boolean; studyRows?: boolean;
}) {
  const studyOptions = studyRows ? options.map(questionOption) : [];
  if (studyRows && correct) {
    const signs = (ids: string[]) => new Set(options.flatMap((option, index) =>
      ids.includes(option.id) ? [index + 1] : []));
    return <AnswerOptionList options={studyOptions} correct={signs(correct)}
      selected={signs(selected)} judgment={judgment} />;
  }
  const hasAnyTts = studyOptions.some(option => Boolean(option.tts));
  return <ul className={studyRows ? 'answer-options reading-options' : 'extended-options'}>
    {options.map((option, index) => {
      const config = ttsConfig(option.tts);
      const chosen = selected.includes(option.id);
      const row = `answer-option choice-option ${chosen ? 'selected' : ''}`;
      const studyOption = studyOptions[index];
      return <li key={option.id} className={studyRows ? 'choice-option-row' : undefined}>
        <label className={studyRows ? row : undefined}>
          <input id={index === 0 ? name : undefined} name={name}
            type={multiple ? 'checkbox' : 'radio'} disabled={disabled}
            checked={chosen} onChange={() => onChoose(option.id)} />
          <span className={studyRows ? 'option-text' : undefined}>{option.text}</span>
        </label>
        {studyOption ? <OptionAudio option={studyOption} allOptionsHaveTts={hasAnyTts} />
          : option.pinyin?.length
          ? <AudioControls text={option.text} pinyin={option.pinyin} />
          : option.tts && <AudioControls text={config?.text ?? option.text}
            voice={config?.voice} speed={config?.speed} />}
      </li>;
    })}
  </ul>;
}

function WrittenQuestion({ content, value, onChange, disabled, hideWritingRequirements,
  hideSourceText }: Props) {
  const countId = useId();
  const writing = !!content.subtype;
  const showSource = Boolean(content.source_text) && !hideSourceText;
  const showRequirements = !writing && !!content.requirements?.length;
  const label = content.direction === 'en_to_zh' ? '中文译文'
    : content.direction === 'zh_to_en' ? '英文译文' : '写作答案';
  const text = value?.text ?? value?.translation ?? '';
  if (!writing && !showSource && !showRequirements && !onChange && !text) return null;
  // Match the word boundaries used by the server when it grades writing.
  const wordCount = writing ? text.match(/[\p{L}\p{N}\p{M}'’]+/gu)?.length ?? 0 : 0;
  return <div className={writing ? 'extended-question writing-editor' : 'extended-question'}>
    {writing && !hideWritingRequirements && <WritingRequirements content={content} />}
    {showSource && <div className="extended-passage">{content.source_text}</div>}
    {showRequirements && <ul className="extended-requirements">
      {content.requirements!.map(requirement => <li key={requirement}>{requirement}</li>)}
    </ul>}
    {(onChange || text) && <>
      <label className="extended-writing">
        {label}
        <textarea rows={content.subtype === 'sentence_making' ? 4 : 6} maxLength={12000}
          disabled={disabled || !onChange} value={text} lang={writing ? 'en' : undefined}
          aria-describedby={writing ? countId : undefined}
          onChange={event => onChange?.(content.direction
            ? { translation: event.currentTarget.value } : { text: event.currentTarget.value })} />
      </label>
      {writing && <p id={countId} className="muted writing-word-count">词数：{wordCount}</p>}
    </>}
  </div>;
}
