import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent } from '../../shared/format';
import { WrittenFeedback } from '../../shared/WrittenFeedback';
import {
  TranslationEditor,
  TranslationReference,
  TranslationReview,
  TranslationSource,
} from './components';

export const translationModule: QuestionTypeModule<'translation'> = {
  spec: {
    type: 'translation',
    label: '翻译题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: true,
    hideAnswerHeading: false,
    isExtended: true,
    hasMedia: false,
  },

  renderStimulus: ({ question }) => (
    <TranslationSource content={question.content} />
  ),

  renderPracticeAnswer: ctx => {
    const review = ctx.reviewQuestion?.question_review;
    return (
      <>
        {!ctx.result && (
          <TranslationEditor
            content={ctx.question.content}
            value={ctx.draft}
            disabled={ctx.pending}
            onChange={ctx.onDraft}
            hideSourceText
          />
        )}
        {review && ctx.result && (
          <TranslationReview
            item={review}
            response={ctx.result.response}
            credit={ctx.result.score}
          />
        )}
        {ctx.result && (
          <WrittenFeedback presentation={ctx.presentationId} writing={false} />
        )}
      </>
    );
  },

  renderExamStem: ({ question, draft, onDraft, disabled }) => (
    <>
      <TranslationSource content={question.content} />
      <TranslationEditor
        content={question.content}
        value={draft}
        onChange={onDraft}
        disabled={disabled}
        hideSourceText
      />
    </>
  ),

  renderExamSelection: () => null,
  renderPreviewBody: question => <TranslationEditor content={question.content} />,

  renderReferenceAnswers: ({ question }) => (
    <TranslationReference review={question.question_review} />
  ),

  renderPalaceAnswers: question => (
    <TranslationReference review={question.question_review} />
  ),

  renderFeedbackBody: question => (
    <TranslationSource content={question.content} />
  ),

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <TranslationReview
        item={review.question_review}
        response={response}
        credit={credit}
      />
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      {review.question_review && (
        <TranslationReview
          item={review.question_review}
          response={response}
          credit={credit}
        />
      )}
      {renderAnalysis()}
    </>
  ),

  renderReview: ({ review, response, credit }) => (
    <TranslationReview item={review} response={response} credit={credit} />
  ),

  getExplanationParts: () => [],

  hasReviewExplanation: ({ question_review: review }) =>
    hasRichContent(review?.analysis) || Boolean(review?.explanation?.trim()),

  shouldShowPracticeExplanation: question => !question.question_review,
  hasDraftAnswer: ctx => ctx.canSubmitExtended,
  normalizeDraft: draft =>
    draft?.translation?.trim() ? { translation: draft.translation.trim() } : undefined,
  formatExamNavValue: ({ response }) => (response ? '已答' : ''),
  formatAttemptSummary: attempt => {
    const score =
      attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    return `翻译作答${score}`;
  },
};
