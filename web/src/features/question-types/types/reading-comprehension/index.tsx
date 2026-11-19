import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent, normalizeSubAnswers } from '../../shared/format';
import { extractSubQuestionExplanations } from '../../shared/SubQuestionReview';
import { ReadingPassage, ReadingQuestions, ReadingReview } from './components';

export const readingModule: QuestionTypeModule<'reading_comprehension'> = {
  spec: {
    type: 'reading_comprehension',
    label: '阅读理解',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
    hideAnswerHeading: false,
    isExtended: true,
    hasMedia: false,
  },

  renderStimulus: ({ question }) => (
    <ReadingPassage passage={question.content.passage} />
  ),

  renderPracticeAnswer: ctx => (
    <>
      <ReadingQuestions
        content={ctx.question.content}
        value={ctx.result?.response ?? ctx.draft}
        disabled={ctx.pending || Boolean(ctx.result)}
        onChange={ctx.onDraft}
        hidePassage
        review={ctx.reviewQuestion?.question_review}
      />
      {ctx.result?.score !== undefined && (
        <p role="status">本题得分比例：{creditLabel(ctx.result.score)}</p>
      )}
    </>
  ),

  renderExamStem: ({ question, draft, onDraft, disabled }) => (
    <ReadingQuestions
      content={question.content}
      value={draft}
      onChange={onDraft}
      disabled={disabled}
    />
  ),

  renderExamSelection: () => null,
  renderPreviewBody: question => <ReadingQuestions content={question.content} />,
  renderReferenceAnswers: ({ question }) => (
    <ReadingQuestions
      content={question.content}
      hidePassage
      review={question.question_review}
    />
  ),
  renderPalaceAnswers: question => (
    <ReadingQuestions
      content={question.content}
      hidePassage
      review={question.question_review}
    />
  ),

  renderFeedbackBody: question => (
    <ReadingPassage passage={question.content.passage} />
  ),

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <ReadingReview item={review.question_review} response={response} credit={credit} />
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      {review.question_review && (
        <ReadingReview
          item={review.question_review}
          response={response}
          credit={credit}
        />
      )}
      {renderAnalysis()}
    </>
  ),

  renderReview: ({ review, response, credit, hideExplanations }) => (
    <ReadingReview
      item={review}
      response={response}
      credit={credit}
      hideExplanations={hideExplanations}
    />
  ),

  getExplanationParts: question =>
    extractSubQuestionExplanations(question.question_review?.sub_questions),

  hasReviewExplanation: ({ question_review: review }) =>
    hasRichContent(review?.analysis) ||
    Boolean(review?.explanation?.trim()) ||
    Boolean(
      review?.sub_questions.some(
        sub => hasRichContent(sub.analysis) || Boolean(sub.explanation?.trim()),
      ),
    ),

  shouldShowPracticeExplanation: () => true,
  hasDraftAnswer: ctx => ctx.canSubmitExtended,
  normalizeDraft: draft => {
    const subAnswers = normalizeSubAnswers(draft?.sub_answers);
    return subAnswers ? { sub_answers: subAnswers } : undefined;
  },
  formatExamNavValue: ({ response }) => (response ? '已答' : ''),
  formatAttemptSummary: attempt => {
    const score =
      attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    const count = Object.keys(attempt.response?.sub_answers ?? {}).length;
    return `小题作答（${count} 题）${score}`;
  },
};
