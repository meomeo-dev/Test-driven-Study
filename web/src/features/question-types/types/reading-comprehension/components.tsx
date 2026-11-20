import type {
  ExtendedResponse,
  ReadingContent,
  ReadingItemReview,
  RichText,
} from '../../../../api/generated/types.gen';
import { RichContent } from '../../../../components/RichContent';
import { StudyPassage } from '../../../../components/StudyPassage';
import { SubQuestionList } from '../../shared/SubQuestionParts';
import { SubQuestionReviewList } from '../../shared/SubQuestionReview';

export function ReadingPassage({
  passage,
  translations,
  showStudyTranslation,
}: {
  passage?: RichText;
  translations?: string[];
  showStudyTranslation?: boolean;
}) {
  if (!passage) return null;
  return (
    <section className="analysis-text" aria-label="阅读材料">
      {translations && showStudyTranslation !== undefined ? (
        <StudyPassage
          passage={passage}
          translations={translations}
          showTranslation={showStudyTranslation}
        />
      ) : <RichContent content={passage} />}
    </section>
  );
}

export function ReadingQuestions({
  content,
  value,
  onChange,
  disabled,
  hidePassage,
  review,
  showStudyTranslation,
}: {
  content: ReadingContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  review?: ReadingItemReview;
  showStudyTranslation?: boolean;
}) {
  const studyRows = Boolean(content.passage) || Boolean(review);
  return (
    <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
      {content.passage && !hidePassage && (
        <div className="extended-passage">
          <RichContent content={content.passage} />
        </div>
      )}
      <SubQuestionList
        subQuestions={content.sub_questions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        reviewSubs={review?.sub_questions}
        translations={showStudyTranslation ? review?.study_translation?.sub_questions : undefined}
        studyRows={studyRows}
      />
    </div>
  );
}

export function ReadingReview({
  item,
  response,
  credit,
  hideExplanations,
}: {
  item: ReadingItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
}) {
  return (
    <SubQuestionReviewList
      subQuestions={item.sub_questions}
      response={response}
      credit={credit}
      hideExplanations={hideExplanations}
    />
  );
}
