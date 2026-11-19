import type { ReactNode } from 'react';
import type {
  CourseItemReview,
  ExtendedResponse,
  Question,
} from '../../../api/generated/types.gen';
import {
  dispatchCourseReview,
  dispatchFullQuestion,
  dispatchQuestion,
} from '../registry';
import type { AnyQuestion, AnyQuestionOf, QuestionOf } from '../shared/contracts';

export function ExtendedReview({
  item,
  response,
  credit,
  hideExplanations,
}: {
  item: CourseItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
}) {
  return dispatchCourseReview(item, (mod, review) =>
    mod.renderReview({ review, response, credit, hideExplanations }),
  );
}

export function FeedbackAnswerSummary({
  question,
  review,
  selected,
  numeric,
  response,
  credit,
}: {
  question: AnyQuestion;
  review?: Question;
  selected: number[];
  numeric?: string;
  response?: ExtendedResponse;
  credit?: number;
}) {
  return dispatchQuestion(question, (mod, q) => {
    const matchedReview =
      review?.question_type === q.question_type
        ? (review as QuestionOf<typeof q.question_type>)
        : undefined;
    return mod.renderFeedbackAnswer({
      question: q,
      review: matchedReview,
      selected,
      numeric,
      response,
      credit,
    });
  });
}

export function DialogReviewContent({
  question,
  review,
  response,
  credit,
  renderAnalysis,
}: {
  question: AnyQuestion;
  review: Question;
  response?: ExtendedResponse;
  credit?: number;
  renderAnalysis: () => ReactNode;
}) {
  return dispatchFullQuestion(review, (mod, rev) => {
    const matchedQuestion =
      question.question_type === rev.question_type
        ? (question as AnyQuestionOf<typeof rev.question_type>)
        : rev;
    return mod.renderDialogReview({
      question: matchedQuestion,
      review: rev,
      response,
      credit,
      renderAnalysis,
    });
  });
}
