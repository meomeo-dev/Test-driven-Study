import { AnswerOptionList } from '../../../components/AnswerOptionList';
import { QuestionAudio } from '../../../components/QuestionAudio';
import {
  answerSymbols,
  ChoiceOptionButtons,
  ExamChoiceSelection,
  formatAttemptChoiceSummary,
  hasDetailedJudgmentOptions,
  OptionTextList,
  PalaceChoiceList,
  PreviewChoiceList,
} from '../shared/ChoicePrimitives';
import type { QuestionTypeModule } from '../shared/contracts';
import { parseAnswerSigns } from '../shared/format';

export const trueFalseModule: QuestionTypeModule<'true_false'> = {
  spec: {
    type: 'true_false',
    label: '判断题',
    examPrompt: '本题为判断题，请判断对错！',
    answerHeading: '选择答案',
    isChoice: true,
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
    <ChoiceOptionButtons
      items={ctx.question.items}
      multiple={false}
      selected={ctx.selected}
      correctAnswer={ctx.result?.correctAnswer}
      submitted={Boolean(ctx.result)}
      disabled={ctx.pending || Boolean(ctx.result)}
      shortcuts={ctx.shortcuts}
      onChoose={ctx.onChoose}
    />
  ),

  renderExamStem: ({ question, protectedAudio }) => (
    <>
      <QuestionAudio
        key={`audio-${question.question_id}`}
        question={question}
        protectedAudio={protectedAudio}
      />
      {hasDetailedJudgmentOptions(question) && (
        <OptionTextList
          question={question}
          className="terminal-option-text"
          ariaLabel="选项内容"
        />
      )}
    </>
  ),

  renderExamSelection: ({ question, selected, disabled, onChoose }) => (
    <ExamChoiceSelection
      question={question}
      selected={selected}
      disabled={disabled}
      onChoose={onChoose}
    />
  ),

  renderPreviewBody: question => (
    <>
      <QuestionAudio question={question} />
      <PreviewChoiceList items={question.items} />
    </>
  ),

  renderReferenceAnswers: ({ question, mode = 'compact' }) => (
    <AnswerOptionList
      options={question.items}
      correct={new Set(parseAnswerSigns(question.answer))}
      judgment
      expanded={mode === 'full'}
    />
  ),

  renderPalaceAnswers: question => (
    <PalaceChoiceList
      items={question.items}
      answers={parseAnswerSigns(question.answer)}
    />
  ),

  renderFeedbackBody: question =>
    hasDetailedJudgmentOptions(question) ? <OptionTextList question={question} /> : null,

  renderFeedbackAnswer: ({ question, review, selected }) => (
    <p>
      正确答案：{answerSymbols(question, parseAnswerSigns(review?.answer))}，你的答案：
      {answerSymbols(question, selected)}
    </p>
  ),

  renderDialogReview: ({ question, review, renderAnalysis }) => (
    <>
      <p>正确答案：{answerSymbols(question, parseAnswerSigns(review.answer))}</p>
      {renderAnalysis()}
    </>
  ),

  renderReview: () => null,
  getExplanationParts: () => [],
  hasReviewExplanation: () => false,
  shouldShowPracticeExplanation: () => true,
  hasDraftAnswer: ctx => ctx.selected.length > 0,
  normalizeDraft: draft =>
    draft?.value !== undefined ? { value: draft.value } : undefined,
  formatExamNavValue: ({ question, selected }) =>
    answerSymbols(question, selected).replaceAll('、', ''),
  formatAttemptSummary: formatAttemptChoiceSummary,
};
