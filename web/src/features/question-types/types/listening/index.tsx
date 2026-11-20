import { QuestionAudio } from '../../../../components/QuestionAudio';
import type { QuestionTypeModule } from '../../shared/contracts';
import { creditLabel, hasRichContent, normalizeSubAnswers } from '../../shared/format';
import { extractSubQuestionExplanations } from '../../shared/SubQuestionReview';
import { ListeningQuestions, ListeningReview } from './components';

export const listeningModule: QuestionTypeModule<'listening'> = {
  spec: {
    type: 'listening',
    label: '听力题',
    examPrompt: '作答后可切换题目并保存。',
    answerHeading: '作答',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
    hideAnswerHeading: false,
    isExtended: true,
    hasMedia: true,
  },

  renderStimulus: ({ question, protectedAudio, showStudyTranslation }) => {
    const review = 'question_review' in question ? question.question_review : undefined;
    const material = review?.study_translation?.material;
    return (
      <QuestionAudio
        key={`audio-${question.question_id}`}
        question={question}
        protectedAudio={protectedAudio}
        studyTranslation={material && showStudyTranslation !== undefined ? {
          material,
          passage: Array.isArray(review?.transcript) ? undefined : review?.passage,
          visible: showStudyTranslation,
        } : undefined}
      />
    );
  },

  renderPracticeAnswer: ctx => {
    const review = ctx.reviewQuestion?.question_review;
    return (
      <>
        <ListeningQuestions
          content={ctx.question.content}
          value={ctx.result?.response ?? ctx.draft}
          disabled={ctx.pending || Boolean(ctx.result)}
          onChange={ctx.onDraft}
        />
        {review && ctx.result && (
          <ListeningReview
            item={review}
            response={ctx.result.response}
            credit={ctx.result.score}
            hideExplanations
          />
        )}
      </>
    );
  },

  renderExamStem: ({ question, protectedAudio, draft, onDraft, disabled }) => (
    <>
      <QuestionAudio
        key={`audio-${question.question_id}`}
        question={question}
        protectedAudio={protectedAudio}
      />
      <ListeningQuestions
        content={question.content}
        value={draft}
        onChange={onDraft}
        disabled={disabled}
      />
    </>
  ),

  renderExamSelection: () => null,

  renderPreviewBody: question => (
    <>
      <QuestionAudio question={question} />
      <ListeningQuestions content={question.content} />
    </>
  ),

  renderReferenceAnswers: ({ question, showStudyTranslation }) => (
    <ListeningQuestions
      content={question.content}
      review={question.question_review}
      showStudyTranslation={showStudyTranslation}
    />
  ),

  renderPalaceAnswers: question => (
    <ListeningQuestions content={question.content} review={question.question_review} />
  ),

  renderFeedbackBody: () => null,

  renderFeedbackAnswer: ({ review, response, credit }) =>
    review?.question_review ? (
      <ListeningReview
        item={review.question_review}
        response={response}
        credit={credit}
      />
    ) : null,

  renderDialogReview: ({ review, response, credit, renderAnalysis }) => (
    <>
      {review.question_review && (
        <ListeningReview
          item={review.question_review}
          response={response}
          credit={credit}
        />
      )}
      {renderAnalysis()}
    </>
  ),

  renderReview: ({ review, response, credit, hideExplanations }) => (
    <ListeningReview
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

  shouldShowPracticeExplanation: question =>
    Boolean(question.question_review?.sub_questions.length) || !question.question_review,

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
