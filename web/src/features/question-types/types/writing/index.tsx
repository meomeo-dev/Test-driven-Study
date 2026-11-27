import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent } from '../../shared/format';
import { visibleStudyTranslation } from '../../shared/study-translation';
import { WrittenFeedback } from '../../shared/WrittenFeedback';
import {
  WritingCriteria,
  WritingEditor,
  WritingRequirements,
  WritingReview,
  WritingSample,
} from './components';

export const writingModule: QuestionTypeModule<'writing'> = {
  spec: {
    type: 'writing',
    label: '写作题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: true,
    hideAnswerHeading: true,
    isExtended: true,
    hasMedia: false,
  },

  renderStimulus: ({ question }) => (
    <WritingRequirements content={question.content} />
  ),

  renderPracticeAnswer: ctx => (
    <>
      {!ctx.result && (
        <WritingEditor
          content={ctx.question.content}
          value={ctx.draft}
          disabled={ctx.pending}
          onChange={ctx.onDraft}
          hideWritingRequirements
        />
      )}
      {ctx.result && (
        <>
          <WritingReview
            response={ctx.result.response}
            credit={ctx.result.score}
          />
          <WrittenFeedback
            presentation={ctx.presentationId}
            writing
            writingReview={ctx.reviewQuestion?.question_review}
            onEvaluated={ctx.onEvaluated}
          />
        </>
      )}
    </>
  ),

  renderExamStem: ({ question, draft, onDraft, disabled }) => (
    <WritingEditor
      content={question.content}
      value={draft}
      onChange={onDraft}
      disabled={disabled}
    />
  ),

  renderExamSelection: () => null,
  renderPreviewBody: question => <WritingEditor content={question.content} />,

  renderReferenceAnswers: ({
    question,
    includeWritingSample = true,
    showStudyTranslation,
    translationSurface = 'memorize',
  }) =>
    includeWritingSample ? (
      <WritingSample
        review={question.question_review}
        translations={
          visibleStudyTranslation(question, translationSurface, showStudyTranslation ?? true)
            ?.sample_response
        }
      />
    ) : null,

  renderPalaceAnswers: question => (
    <WritingSample
      review={question.question_review}
      translations={visibleStudyTranslation(question, 'palace')?.sample_response}
    />
  ),

  renderFeedbackBody: question => (
    <WritingRequirements content={question.content} />
  ),

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <>
        <WritingReview response={response} credit={credit} />
        <WritingSample
          review={review.question_review}
          translations={visibleStudyTranslation(review, 'exam_review')?.sample_response}
        />
        <WritingCriteria review={review.question_review} />
      </>
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      <WritingReview response={response} credit={credit} />
      <WritingSample
        review={review.question_review}
        translations={visibleStudyTranslation(review, 'exam_review')?.sample_response}
      />
      {renderAnalysis()}
      <WritingCriteria review={review.question_review} />
    </>
  ),

  renderReview: ({ review, response, credit }) => (
    <>
      <WritingReview response={response} credit={credit} />
      <WritingSample review={review} />
      <WritingCriteria review={review} />
    </>
  ),

  getExplanationParts: () => [],

  hasReviewExplanation: ({ question_review: review }) =>
    hasRichContent(review?.analysis) || Boolean(review?.explanation?.trim()),

  shouldShowPracticeExplanation: () => true,
  renderWritingSample: (question, options) => (
    <WritingSample
      review={question.question_review}
      translations={
        visibleStudyTranslation(
          question,
          options?.translationSurface ?? 'practice_review',
          options?.showStudyTranslation ?? true,
        )?.sample_response
      }
    />
  ),
  renderWritingCriteria: question => (
    <WritingCriteria review={question.question_review} />
  ),
  hasWritingCriteria: ({ question_review: review }) =>
    Boolean(review?.keywords?.length || review?.rubric),

  hasDraftAnswer: ctx => ctx.canSubmitExtended,
  normalizeDraft: draft =>
    draft?.text?.trim() ? { text: draft.text.trim() } : undefined,
  formatExamNavValue: ({ response }) => (response ? '已答' : ''),
  formatAttemptSummary: attempt => {
    const score =
      attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    return `写作作答（${attempt.response?.word_count ?? 0} 词）${score}`;
  },
};
