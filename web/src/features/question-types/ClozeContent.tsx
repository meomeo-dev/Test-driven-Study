import type {
  BlankPrompt,
  ClozeItemReview,
  ExtendedResponse,
  RichText,
} from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';

type ClozePassageProps = {
  passage?: RichText;
  blanks?: BlankPrompt[];
  review?: ClozeItemReview;
  value?: ExtendedResponse;
  onJump?: (index: number) => void;
};

export function ClozePassage({
  passage,
  blanks,
  review,
  value,
  onJump,
}: ClozePassageProps) {
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
    </section>
  );
}
