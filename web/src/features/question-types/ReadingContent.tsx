import type { CourseItemReview, RichText } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';

export function ReadingPassage({ passage }: { passage?: RichText }) {
  if (!passage) return null;
  return <section className="analysis-text" aria-label="阅读材料">
    <RichContent content={passage} />
  </section>;
}

export function ReadingExplanations({ review }: { review?: CourseItemReview }) {
  if (review?.type !== 'reading_comprehension') return null;
  return <div className="extended-review">{review.sub_questions?.map((sub, index) => {
    const explanation = sub.analysis ?? sub.explanation;
    if (!explanation) return null;
    return <div key={sub.id}>
      <h4 className="column-label">小题 {index + 1}</h4>
      <p className="analysis-text"><RichContent content={explanation} /></p>
    </div>;
  })}</div>;
}
