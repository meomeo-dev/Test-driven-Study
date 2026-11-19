import type {
  ExtendedResponse,
  ListeningContent,
  ListeningItemReview,
} from '../../../../api/generated/types.gen';
import { SubQuestionList } from '../../shared/SubQuestionParts';
import { SubQuestionReviewList } from '../../shared/SubQuestionReview';

export function ListeningQuestions({
  content,
  value,
  onChange,
  disabled,
  review,
}: {
  content: ListeningContent;
  value?: ExtendedResponse;
  onChange?: (value: ExtendedResponse) => void;
  disabled?: boolean;
  review?: ListeningItemReview;
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
}: {
  item: ListeningItemReview;
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
