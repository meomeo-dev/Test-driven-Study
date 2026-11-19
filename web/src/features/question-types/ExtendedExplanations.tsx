import type { CourseItemReview, RichText } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { hasRichContent } from './model';
import { assertNever } from './registry';

type ExplanationPart = {
  key: string | number;
  label: string;
  content: RichText;
};

function explanationParts(review?: CourseItemReview): ExplanationPart[] {
  if (!review) return [];
  switch (review.type) {
    case 'cloze':
      return review.blanks.flatMap(blank =>
        hasRichContent(blank.explanation)
          ? [{ key: blank.index, label: `空格 ${blank.index}`, content: blank.explanation! }]
          : [],
      );
    case 'reading_comprehension':
    case 'listening':
      return review.sub_questions.flatMap((sub, index) => {
        const content = sub.analysis ?? sub.explanation;
        return hasRichContent(content)
          ? [{ key: sub.id, label: `小题 ${index + 1}`, content: content! }]
          : [];
      });
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
    case 'numeric':
    case 'writing':
    case 'translation':
      return [];
    default:
      return assertNever(review);
  }
}

export function ExtendedExplanations({ review }: { review?: CourseItemReview }) {
  const parts = explanationParts(review);
  if (!parts.length) return null;
  return (
    <div className="extended-review">
      {parts.map(part => (
        <div key={part.key}>
          <h4 className="column-label">{part.label}</h4>
          <p className="analysis-text">
            <RichContent content={part.content} />
          </p>
        </div>
      ))}
    </div>
  );
}
