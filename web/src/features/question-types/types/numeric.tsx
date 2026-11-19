import { NumericAnswer } from '../../../components/NumericAnswer';
import { QuestionAudio } from '../../../components/QuestionAudio';
import type { QuestionTypeModule } from '../shared/contracts';

export const numericModule: QuestionTypeModule<'numeric'> = {
  spec: {
    type: 'numeric',
    label: '数值题',
    examPrompt: '请填写数值答案。',
    answerHeading: '填写答案',
    isChoice: false,
    isMultiple: false,
    isWritten: false,
    hideAnswerHeading: false,
    isExtended: false,
    hasMedia: true,
  },

  renderStimulus: ({ question, protectedAudio }) => (
    <QuestionAudio
      key={`audio-${question.question_id}`}
      question={question}
      protectedAudio={protectedAudio}
    />
  ),

  renderPracticeAnswer: ctx => (
    <>
      <NumericAnswer
        value={ctx.numeric}
        onChange={ctx.onNumeric}
        disabled={ctx.pending || Boolean(ctx.result)}
      />
      {ctx.result && (
        <p className="answer-option correct">
          正确答案：{ctx.result.correctNumeric}
        </p>
      )}
    </>
  ),

  renderExamStem: ({ question, protectedAudio }) => (
    <QuestionAudio
      key={`audio-${question.question_id}`}
      question={question}
      protectedAudio={protectedAudio}
    />
  ),

  renderExamSelection: ({ numeric, onNumeric, disabled }) => (
    <div className="terminal-selection" aria-label="考试选项">
      <NumericAnswer value={numeric} onChange={onNumeric} disabled={disabled} />
    </div>
  ),

  renderPreviewBody: question => <QuestionAudio question={question} />,

  renderReferenceAnswers: ({ question }) => (
    <p className="answer-option correct">正确答案：{question.answer}</p>
  ),

  renderPalaceAnswers: question => (
    <p className="answer-option correct">正确答案：{question.answer}</p>
  ),

  renderFeedbackBody: () => null,

  renderFeedbackAnswer: ({ review, numeric }) => (
    <p>
      正确答案：{review?.answer}，你的答案：{numeric ?? ''}
    </p>
  ),

  renderDialogReview: ({ review, renderAnalysis }) => (
    <>
      <p>正确答案：{review.answer}</p>
      {renderAnalysis()}
    </>
  ),

  renderReview: () => null,
  getExplanationParts: () => [],
  hasReviewExplanation: () => false,
  shouldShowPracticeExplanation: () => true,
  hasDraftAnswer: ctx => ctx.numeric.trim() !== '',
  formatExamNavValue: ({ numeric }) => numeric ?? '',
  formatAttemptSummary: attempt =>
    `你的答案 ${attempt.numeric ?? ''} · 正确答案 ${attempt.correct_numeric ?? ''}`,
};
