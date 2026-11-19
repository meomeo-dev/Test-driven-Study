import { useId } from 'react';
import type {
  BlankPrompt,
  ClozeContent,
  ClozeItemReview,
  ExtendedResponse,
  RichText,
} from '../../../../api/generated/types.gen';
import { AudioControls } from '../../../../components/AudioControls';
import { RichContent } from '../../../../components/RichContent';
import { PartOptions } from '../../shared/PartOptions';
import { creditLabel } from '../../shared/format';

export function ClozePassage({
  passage,
  blanks,
  review,
  value,
  onJump,
}: {
  passage?: RichText;
  blanks?: BlankPrompt[];
  review?: ClozeItemReview;
  value?: ExtendedResponse;
  onJump?: (index: number) => void;
}) {
  if (!passage) return null;
  return (
    <section className="analysis-text extended-passage" aria-label="完形填空短文">
      <RichContent
        content={passage}
        renderBlank={index => {
          if (review) {
            const blank = review.blanks.find(item => item.index === index);
            const correct = blank?.options.find(o =>
              blank.grading.choice_ids?.includes(o.id),
            );
            const label = correct ? `空格 ${index}: ${correct.text}` : `空格 ${index}`;
            return <span className="extended-blank correct">{label}</span>;
          }
          const blank = blanks?.find(item => item.index === index);
          const selected = blank?.options.find(o =>
            value?.blanks?.[index]?.includes(o.id),
          );
          const label = selected?.text ?? `空格 ${index}`;
          if (!onJump) return <span className="extended-blank">{label}</span>;
          return (
            <button
              type="button"
              className="extended-blank"
              aria-label={`跳转到空格 ${index}`}
              onClick={() => onJump(index)}
            >
              {label}
            </button>
          );
        }}
      />
      {review?.passage_tts?.text && (
        <AudioControls
          text={review.passage_tts.text}
          voice={review.passage_tts.voice}
          speed={review.passage_tts.speed}
        />
      )}
    </section>
  );
}

export function ClozeBlankList({
  content,
  value,
  onChange,
  disabled,
  partIdPrefix,
  hidePassage,
  review,
}: {
  content: ClozeContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  partIdPrefix?: string;
  hidePassage?: boolean;
  review?: ClozeItemReview;
}) {
  const fallbackId = useId();
  const id = partIdPrefix ?? fallbackId;
  const readOnly = Boolean(disabled) || !onChange;
  const studyRows = Boolean(review);
  return (
    <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
      {!hidePassage && (
        <ClozePassage
          passage={content.passage}
          blanks={content.blanks}
          value={value}
          onJump={
            readOnly
              ? undefined
              : index => document.getElementById(`${id}-${index}`)?.focus()
          }
        />
      )}
      {content.blanks.map(blank => {
        const expected = review?.blanks.find(item => item.index === blank.index)
          ?.grading.choice_ids;
        return (
          <fieldset key={blank.index} className="extended-part">
            <legend>空格 {blank.index}</legend>
            <PartOptions
              options={blank.options}
              name={`${id}-${blank.index}`}
              selected={value?.blanks?.[blank.index] ?? []}
              disabled={readOnly}
              correct={expected}
              studyRows={studyRows}
              onChoose={choice =>
                onChange?.({
                  blanks: { ...value?.blanks, [blank.index]: [choice] },
                })
              }
            />
          </fieldset>
        );
      })}
    </div>
  );
}

export function ClozeReview({
  item,
  response,
  credit,
  hideExplanations,
}: {
  item: ClozeItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
}) {
  return (
    <section className="extended-review" aria-label="作答反馈">
      {credit !== undefined && <p role="status">本题得分比例：{creditLabel(credit)}</p>}
      {item.blanks.map(({ index, options, grading, explanation }) => (
        <div key={index}>
          <strong>
            空格 {index} ·{' '}
            {options.find(o => grading.choice_ids?.includes(o.id))?.text}
          </strong>
          {response && (
            <p>
              你的答案：
              {options.find(o => response.blanks?.[index]?.includes(o.id))?.text ??
                '未作答'}
            </p>
          )}
          {!hideExplanations && explanation && (
            <p>
              <RichContent content={explanation} />
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
