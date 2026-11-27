import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent, normalizeSubAnswers } from '../../shared/format';
import {
  canDisplayStudyTranslation,
  getStudyTranslation,
  visibleStudyTranslation,
} from '../../shared/study-translation';
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

  renderStimulus: ({
    question,
    reviewQuestion,
    showStudyTranslation,
    translationSurface,
  }) => {
    const reviewSrc = 'question_review' in question ? question : reviewQuestion;
    const surface = translationSurface ?? (reviewQuestion ? 'practice_review' : 'memorize');
    const rawTr = getStudyTranslation(reviewSrc);
    const allowed = canDisplayStudyTranslation(rawTr, surface);
    return (
      <ReadingPassage
        passage={question.content.passage}
        translations={allowed ? rawTr?.material : undefined}
        showStudyTranslation={allowed ? (showStudyTranslation ?? true) : undefined}
      />
    );
  },

  renderPracticeAnswer: ctx => {
    const translations = ctx.result
      ? visibleStudyTranslation(
          ctx.reviewQuestion,
          ctx.translationSurface ?? 'practice_review',
          ctx.showStudyTranslation ?? true,
        )?.sub_questions
      : undefined;
    return (
      <>
        <ReadingQuestions
          content={ctx.question.content}
          value={ctx.result?.response ?? ctx.draft}
          disabled={ctx.pending || Boolean(ctx.result)}
          onChange={ctx.onDraft}
          hidePassage
          review={ctx.reviewQuestion?.question_review}
          translations={translations}
        />
        {ctx.result?.score !== undefined && (
          <p role="status">本题得分比例：{creditLabel(ctx.result.score)}</p>
        )}
      </>
    );
  },

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
  renderReferenceAnswers: ({
    question,
    showStudyTranslation,
    translationSurface = 'memorize',
  }) => (
    <ReadingQuestions
      content={question.content}
      hidePassage
      review={question.question_review}
      translations={
        visibleStudyTranslation(question, translationSurface, showStudyTranslation ?? true)
          ?.sub_questions
      }
    />
  ),
  renderPalaceAnswers: question => (
    <ReadingQuestions
      content={question.content}
      hidePassage
      review={question.question_review}
      translations={visibleStudyTranslation(question, 'palace')?.sub_questions}
    />
  ),

  renderFeedbackBody: (question, _response, review) => {
    const tr = visibleStudyTranslation(review, 'exam_review');
    return (
      <ReadingPassage
        passage={question.content.passage}
        translations={tr?.material}
        showStudyTranslation={tr?.material ? true : undefined}
      />
    );
  },

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <ReadingReview
        item={review.question_review}
        response={response}
        credit={credit}
        translations={visibleStudyTranslation(review, 'exam_review')?.sub_questions}
      />
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      {review.question_review && (
        <ReadingReview
          item={review.question_review}
          response={response}
          credit={credit}
          translations={visibleStudyTranslation(review, 'exam_review')?.sub_questions}
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
