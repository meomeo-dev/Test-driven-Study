import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent } from '../../shared/format';
import { ClozeBlankList, ClozePassage, ClozeReview } from './components';

export const clozeModule: QuestionTypeModule<'cloze'> = {
  spec: {
    type: 'cloze',
    label: '完形填空',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
    hideAnswerHeading: false,
    isExtended: true,
    hasMedia: false,
  },

  renderStimulus: ({ question, reviewQuestion, cloze }) => (
    <ClozePassage
      passage={question.content.passage}
      blanks={question.content.blanks}
      review={
        'question_review' in question
          ? question.question_review
          : reviewQuestion?.question_review
      }
      value={cloze?.value}
      onJump={cloze?.onJump}
    />
  ),

  renderPracticeAnswer: ctx => {
    const review = ctx.reviewQuestion?.question_review;
    return (
      <>
        <ClozeBlankList
          content={ctx.question.content}
          value={ctx.result?.response ?? ctx.draft}
          disabled={ctx.pending || Boolean(ctx.result)}
          onChange={ctx.onDraft}
          partIdPrefix={ctx.partIdPrefix}
          hidePassage
        />
        {review && ctx.result && (
          <ClozeReview
            item={review}
            response={ctx.result.response}
            credit={ctx.result.score}
            hideExplanations
          />
        )}
      </>
    );
  },

  renderExamStem: ({ question, draft, onDraft, disabled }) => (
    <ClozeBlankList
      content={question.content}
      value={draft}
      onChange={onDraft}
      disabled={disabled}
    />
  ),

  renderExamSelection: () => null,
  renderPreviewBody: question => <ClozeBlankList content={question.content} />,
  renderReferenceAnswers: ({ question }) => (
    <ClozeBlankList
      content={question.content}
      hidePassage
      review={question.question_review}
    />
  ),
  renderPalaceAnswers: question => (
    <ClozeBlankList
      content={question.content}
      hidePassage
      review={question.question_review}
    />
  ),

  renderFeedbackBody: (question, response, review) => (
    <ClozePassage
      passage={question.content.passage}
      blanks={question.content.blanks}
      value={response}
      review={review?.question_review}
    />
  ),

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <ClozeReview item={review.question_review} response={response} credit={credit} />
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      {review.question_review && (
        <ClozeReview item={review.question_review} response={response} credit={credit} />
      )}
      {renderAnalysis()}
    </>
  ),

  renderReview: ({ review, response, credit, hideExplanations }) => (
    <ClozeReview
      item={review}
      response={response}
      credit={credit}
      hideExplanations={hideExplanations}
    />
  ),

  getExplanationParts: question =>
    question.question_review?.blanks.flatMap(blank =>
      hasRichContent(blank.explanation)
        ? [
            {
              key: blank.index,
              label: `空格 ${blank.index}`,
              content: blank.explanation!,
            },
          ]
        : [],
    ) ?? [],

  hasReviewExplanation: ({ question_review: review }) =>
    hasRichContent(review?.analysis) ||
    Boolean(review?.explanation?.trim()) ||
    Boolean(review?.blanks.some(blank => hasRichContent(blank.explanation))),

  shouldShowPracticeExplanation: question =>
    Boolean(question.question_review?.blanks.length) || !question.question_review,

  hasDraftAnswer: ctx => ctx.canSubmitExtended,
  normalizeDraft: draft =>
    draft?.blanks && Object.keys(draft.blanks).length
      ? { blanks: draft.blanks }
      : undefined,
  formatExamNavValue: ({ response }) => (response ? '已答' : ''),
  formatAttemptSummary: attempt => {
    const score =
      attempt.score !== undefined ? ` · 得分 ${creditLabel(attempt.score)}` : '';
    const count = Object.keys(attempt.response?.blanks ?? {}).length;
    return `完形作答（${count} 空）${score}`;
  },
};
