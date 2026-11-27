import { AnswerOptionList } from '../../../components/AnswerOptionList';
import { QuestionAudio } from '../../../components/QuestionAudio';
import {
  answerSymbols,
  ChoiceOptionButtons,
  ExamChoiceSelection,
  formatAttemptChoiceSummary,
  OptionTextList,
  PalaceChoiceList,
  PreviewChoiceList,
} from '../shared/ChoicePrimitives';
import type { QuestionTypeModule } from '../shared/contracts';
import { parseAnswerSigns } from '../shared/format';
import { optionTranslationsBySign, visibleStudyTranslation } from '../shared/study-translation';

export const multipleChoiceModule: QuestionTypeModule<'multiple_choice'> = {
  spec: {
    type: 'multiple_choice',
    label: '多选题',
    examPrompt: '请选择所有正确答案，全部选对才得分！',
    answerHeading: '可选择多项',
    isChoice: true,
    isMultiple: true,
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

  renderPracticeAnswer: ctx => {
    const translations = ctx.result
      ? optionTranslationsBySign(
          ctx.question.items,
          visibleStudyTranslation(
            ctx.reviewQuestion,
            ctx.translationSurface ?? 'practice_review',
            ctx.showStudyTranslation ?? true,
          ),
        )
      : undefined;
    return (
      <ChoiceOptionButtons
        items={ctx.question.items}
        multiple
        selected={ctx.selected}
        correctAnswer={ctx.result?.correctAnswer}
        submitted={Boolean(ctx.result)}
        disabled={ctx.pending || Boolean(ctx.result)}
        shortcuts={ctx.shortcuts}
        translations={translations}
        onChoose={ctx.onChoose}
      />
    );
  },

  renderExamStem: ({ question, protectedAudio }) => (
    <>
      <QuestionAudio
        key={`audio-${question.question_id}`}
        question={question}
        protectedAudio={protectedAudio}
      />
      <OptionTextList
        question={question}
        className="terminal-option-text"
        ariaLabel="选项内容"
      />
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

  renderReferenceAnswers: ({
    question,
    mode = 'compact',
    showStudyTranslation,
    translationSurface = 'memorize',
  }) => (
    <AnswerOptionList
      options={question.items}
      correct={new Set(parseAnswerSigns(question.answer))}
      judgment={false}
      expanded={mode === 'full'}
      translations={optionTranslationsBySign(
        question.items,
        visibleStudyTranslation(question, translationSurface, showStudyTranslation ?? true),
      )}
    />
  ),

  renderPalaceAnswers: question => (
    <PalaceChoiceList
      items={question.items}
      answers={parseAnswerSigns(question.answer)}
      translations={optionTranslationsBySign(
        question.items,
        visibleStudyTranslation(question, 'palace'),
      )}
    />
  ),

  renderFeedbackBody: (question, _response, review) => (
    <OptionTextList
      question={question}
      translations={optionTranslationsBySign(
        question.items,
        visibleStudyTranslation(review, 'exam_review'),
      )}
    />
  ),

  renderFeedbackAnswer: ({ question, review, selected }) => (
    <p>
      正确答案：{answerSymbols(question, parseAnswerSigns(review?.answer))}，你的答案：
      {answerSymbols(question, selected)}
    </p>
  ),

  renderDialogReview: ({ question, review, renderAnalysis }) => {
    const translations = optionTranslationsBySign(
      question.items,
      visibleStudyTranslation(review, 'exam_review'),
    );
    return (
      <>
        <p>正确答案：{answerSymbols(question, parseAnswerSigns(review.answer))}</p>
        {translations && <OptionTextList question={question} translations={translations} />}
        {renderAnalysis()}
      </>
    );
  },

  renderReview: () => null,
  getExplanationParts: () => [],
  hasReviewExplanation: () => false,
  shouldShowPracticeExplanation: () => true,
  hasDraftAnswer: ctx => ctx.selected.length > 0,
  formatExamNavValue: ({ question, selected }) =>
    answerSymbols(question, selected).replaceAll('、', ''),
  formatAttemptSummary: formatAttemptChoiceSummary,
};
