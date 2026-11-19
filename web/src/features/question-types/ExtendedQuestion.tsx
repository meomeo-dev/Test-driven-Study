import { useId } from 'react';
import type {
  ClozeContent,
  ClozeItemReview,
  ExtendedResponse,
  ListeningContent,
  ListeningItemReview,
  ReadingContent,
  ReadingItemReview,
  TranslationContent,
  TranslationItemReview,
  WritingContent,
  WritingItemReview,
} from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { ClozePassage } from './ClozeContent';
import { assertNever } from './registry';
import { PartOptions, SubQuestion } from './SubQuestionParts';
import { TranslationEditor } from './TranslationContent';
import { WritingEditor } from './WritingContent';

export type ExtendedQuestionInput =
  | { kind: 'cloze'; content: ClozeContent; review?: ClozeItemReview }
  | { kind: 'listening'; content: ListeningContent; review?: ListeningItemReview }
  | {
      kind: 'reading_comprehension';
      content: ReadingContent;
      review?: ReadingItemReview;
    }
  | { kind: 'writing'; content: WritingContent; review?: WritingItemReview }
  | { kind: 'translation'; content: TranslationContent; review?: TranslationItemReview };

type Props = ExtendedQuestionInput & {
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  partIdPrefix?: string;
  hidePassage?: boolean;
  hideWritingRequirements?: boolean;
  hideSourceText?: boolean;
};

export function ExtendedQuestion(props: Props) {
  const fallbackId = useId();
  const id = props.partIdPrefix ?? fallbackId;
  const readOnly = props.disabled || !props.onChange;

  switch (props.kind) {
    case 'cloze': {
      const { blanks, passage } = props.content;
      const studyRows = !!props.review;
      return (
        <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
          {!props.hidePassage && (
            <ClozePassage
              passage={passage}
              blanks={blanks}
              value={props.value}
              onJump={
                readOnly
                  ? undefined
                  : index => document.getElementById(`${id}-${index}`)?.focus()
              }
            />
          )}
          {blanks.map(blank => {
            const expected = props.review?.blanks.find(item => item.index === blank.index)
              ?.grading.choice_ids;
            return (
              <fieldset key={blank.index} className="extended-part">
                <legend>空格 {blank.index}</legend>
                <PartOptions
                  options={blank.options}
                  name={`${id}-${blank.index}`}
                  selected={props.value?.blanks?.[blank.index] ?? []}
                  disabled={readOnly}
                  correct={expected}
                  studyRows={studyRows}
                  onChoose={choice =>
                    props.onChange?.({
                      blanks: { ...props.value?.blanks, [blank.index]: [choice] },
                    })
                  }
                />
              </fieldset>
            );
          })}
        </div>
      );
    }
    case 'listening':
    case 'reading_comprehension': {
      const passage = props.kind === 'reading_comprehension' ? props.content.passage : undefined;
      const studyRows = Boolean(passage) || !!props.review;
      return (
        <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
          {passage && !props.hidePassage && (
            <div className="extended-passage">
              <RichContent content={passage} />
            </div>
          )}
          {props.content.sub_questions.map((sub, index) => (
            <fieldset key={sub.id} className="extended-part">
              <legend>小题 {index + 1}</legend>
              <div>
                <RichContent content={sub.stem} />
              </div>
              <SubQuestion
                sub={sub}
                name={`${id}-${index}`}
                disabled={readOnly}
                studyRows={studyRows}
                submitted={!!props.value && !!props.review}
                value={props.value?.sub_answers?.[sub.id]}
                grading={props.review?.sub_questions.find(item => item.id === sub.id)?.grading}
                onChange={answer =>
                  props.onChange?.({
                    sub_answers: { ...props.value?.sub_answers, [sub.id]: answer },
                  })
                }
              />
            </fieldset>
          ))}
        </div>
      );
    }
    case 'writing':
      return (
        <WritingEditor
          content={props.content}
          value={props.value}
          onChange={props.onChange}
          disabled={props.disabled}
          hideWritingRequirements={props.hideWritingRequirements}
        />
      );
    case 'translation':
      return (
        <TranslationEditor
          content={props.content}
          value={props.value}
          onChange={props.onChange}
          disabled={props.disabled}
          hideSourceText={props.hideSourceText}
        />
      );
    default:
      return assertNever(props);
  }
}
