import type {
  ExtendedResponse,
  ListeningContent,
  ListeningItemReview,
  StudySubQuestionTranslation,
} from '../../../../api/generated/types.gen';
import { SubQuestionList } from '../../shared/SubQuestionParts';
import { SubQuestionReviewList } from '../../shared/SubQuestionReview';

export function ListeningQuestions({
  content,
  value,
  onChange,
  disabled,
  review,
  translations,
}: {
  content: ListeningContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  review?: ListeningItemReview;
  translations?: Readonly<Record<string, StudySubQuestionTranslation>>;
}) {
  const studyRows = Boolean(review);
  return (
    <div className={studyRows ? 'extended-question reading-parts' : 'extended-question'}>
      <SubQuestionList
        subQuestions={content.sub_questions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        reviewSubs={review?.sub_questions}
        translations={translations}
        studyRows={studyRows}
      />
    </div>
  );
}

export function ListeningReview({
  item,
  response,
  credit,
  hideExplanations,
  translations,
}: {
  item: ListeningItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
  translations?: Readonly<Record<string, StudySubQuestionTranslation>>;
}) {
  return (
    <SubQuestionReviewList
      subQuestions={item.sub_questions}
      response={response}
      credit={credit}
      hideExplanations={hideExplanations}
      translations={translations}
    />
  );
}
