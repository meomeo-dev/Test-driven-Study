import { ReadingPassage } from '../question-types/ReadingContent';
import { WritingRequirements, WritingReview } from '../question-types/WritingContent';
import { readingQuestionType, writingQuestionType, creditLabel } from '../question-types/model';
import { QuestionAudio } from '../../components/QuestionAudio';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import { WrittenFeedback } from '../question-types/WrittenFeedback';
import type { Ref } from 'react';
import { ChevronLeft, ChevronRight, Expand, Send, RotateCcw } from 'lucide-react';
import type { Question } from '../../api/client';
import type { Presentation, AttemptResult } from '../../api/practice';
import { answerSigns, questionType } from './model';
import { QuestionImage } from './QuestionImage';
import { QuestionExplanation } from './QuestionExplanation';
import { ChoiceOptions } from './ChoiceOptions';
import type { DetailsTab } from './StudyDetails';
import { NumericAnswer } from '../../components/NumericAnswer';
import { RichContent } from '../../components/RichContent';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { AnswerOptionList } from '../../components/AnswerOptionList';

export function AnswerOptions({ question, mode = 'compact' }: { question: Question; mode?: 'compact' | 'full' }) {
  if (question.question_type === readingQuestionType && question.content) {
    return <ExtendedQuestion content={question.content} hidePassage
      readingReview={question.question_review} />;
  }
  if (question.question_type === writingQuestionType) return null;
  if (question.content) {
    return <>
      <ExtendedQuestion content={question.content} />
      {question.question_review && <ExtendedReview item={question.question_review} />}
    </>;
  }
  if (question.question_type === 4) {
    return <p className="answer-option correct">正确答案：{question.answer}</p>;
  }
  return <AnswerOptionList options={question.items} correct={answerSigns(question.answer)}
    judgment={question.question_type === 3} expanded={mode === 'full'} />;
}


type Props = {
  presentation: Presentation; result?: AttemptResult; selected: number[];
  draft?: ExtendedResponse; onDraft: (draft: ExtendedResponse) => void;
  canSubmitExtended: boolean; numeric: string; onNumeric: (value: string) => void;
  position: number; total: number; pending: boolean; shortcuts: boolean;
  imageRef: Ref<HTMLButtonElement>; onChoose: (sign: number) => void;
  onSubmit: () => void; onRetry: () => void;
  onDetails: (tab: DetailsTab, trigger?: HTMLElement) => void;
  onPrevious: () => void; onNext: () => void;
};

export function QuestionCard({ presentation, result, selected, position, total, pending,
  draft, onDraft, canSubmitExtended, numeric, onNumeric, shortcuts, imageRef, onChoose, onSubmit, onRetry, onDetails, onPrevious,
  onNext }: Props) {
  const detail = presentation.detail;
  const question = detail.question;
  const reading = question.question_type === readingQuestionType;
  const writing = question.question_type === writingQuestionType;
  const review = result?.detail.question.question_review;
  const written = review?.type === 'writing' || review?.type === 'translation';
  const isNumeric = question.question_type === 4;
  const hint = (key: string) => shortcuts || key === 'Enter' ? <kbd aria-hidden="true">{key}</kbd> : null;
  return <article className="question-card" aria-labelledby="question-title" aria-busy={pending}>
    <div className="question-meta">
      <span className="type-badge">{questionType(question.question_type)}</span>
      <span className="chapter-badge question-chapter" title={question.chapter_name.trim()}>
        {question.chapter_name.trim() || '未分章节'}</span>
      <span className="question-position">{position} <span>/ {total}</span></span>
      <button type="button" className="read-full" onClick={event => onDetails('question', event.currentTarget)}
        aria-keyshortcuts={shortcuts ? 'v' : undefined}><Expand size={13} />完整题目{hint('v')}</button>
    </div>
    <div className="practice-flow">
      <div className="question-stage" data-has-image={!!question.image_url}>
        <section className="question-stem" aria-label="题干与图例">
          <header className="column-label question-stem-heading">
            <span className="source-line">题号 #{question.source_item_id ?? question.question_id}</span>
            <span role="status" className={`state-label ${result ? (result.attempt.correct ? 'correct' : 'incorrect') : ''}`}>
              {result ? (written ? '已完成本地检查' : result.attempt.correct ? '回答正确'
                : result.attempt.score ? '部分正确' : '回答错误') : '未作答'}</span>
            {presentation.prior_exposure && <span className="exposure-label">已见过此题</span>}
          </header>
          <h2 id="question-title" className="question-text">
            {question.rich_content && question.rich_content.length > 0 ? (
              <RichContent content={question.rich_content} />
            ) : (
              question.title
            )}
          </h2>
          {reading && <ReadingPassage passage={question.content?.passage} />}
          {writing && <WritingRequirements content={question.content} />}
          <QuestionAudio key={`audio-${question.question_id}`} question={question} />
          <QuestionImage key={`image-${presentation.id}`} detail={detail} buttonRef={imageRef} shortcuts={shortcuts} />
        </section>
        <section className="question-answers" aria-label={writing ? '作答' : '作答选项'}>
          {!writing && <h3 className="column-label">{question.content ? '作答'
            : isNumeric ? '填写答案'
              : question.question_type === 2 ? '可选择多项' : '选择答案'}</h3>}
          {question.content ? <>
            {(!writing || !result) && <ExtendedQuestion content={question.content}
              value={result?.attempt.response ?? draft} disabled={pending || !!result}
              onChange={onDraft} hidePassage={reading} hideWritingRequirements={writing}
              readingReview={reading ? review : undefined} />}
            {reading && result?.attempt.score !== undefined && <p role="status">
              本题得分比例：{creditLabel(result.attempt.score)}
            </p>}
            {writing && result && <WritingReview
              response={result.attempt.response} credit={result.attempt.score} />}
            {!writing && !reading && review && result && <ExtendedReview item={review}
              response={result.attempt.response} credit={result.attempt.score} />}
            {written && <WrittenFeedback presentation={presentation.id} writing={writing} />}
          </> : isNumeric ? <>
            <NumericAnswer value={numeric} onChange={onNumeric} disabled={pending || !!result} />
            {result && <p className="answer-option correct">正确答案：{result.attempt.correct_numeric}</p>}
          </> : <ChoiceOptions question={question} selected={selected} result={result?.attempt}
            pending={pending} shortcuts={shortcuts} onChoose={onChoose} />}
        </section>
      </div>
      <footer className="question-actions">
        <div className="flip-actions">
          <button className="button secondary previous" disabled={position <= 1 || pending}
            onClick={onPrevious}><ChevronLeft size={16} />上一题{hint('k')}</button>
          <button className="button secondary next" disabled={position >= total || pending}
            data-practice-confirm={result ? 'true' : undefined}
            aria-keyshortcuts={[shortcuts ? 'j' : '', 'ArrowRight', result ? 'Enter' : ''].filter(Boolean).join(' ')}
            onClick={onNext}>下一题{hint('j')}{result && hint('Enter')}<ChevronRight size={16} /></button>
        </div>
        <div className="mark-actions practice-actions">
          {result && <button className="button outline" onClick={onRetry} disabled={pending}>
            <RotateCcw size={16} />再答一次{hint('r')}</button>}
          <button className="button primary practice-primary-action" data-practice-confirm="true"
            aria-keyshortcuts="Enter" onClick={result ? onNext : onSubmit}
            disabled={pending || (result ? position >= total :
              question.content ? !canSubmitExtended : isNumeric ? numeric.trim() === '' : selected.length === 0)}>
            {result ? <ChevronRight size={16} /> : <Send size={16} />}
            {pending ? '正在保存…' : result ? '下一题' : '提交答案'}{hint('Enter')}
          </button>
        </div>
      </footer>
      {result && (reading || writing || !review || result.detail.question.analysis) && <QuestionExplanation detail={result.detail} onDetails={onDetails} />}
    </div>
  </article>;
}
