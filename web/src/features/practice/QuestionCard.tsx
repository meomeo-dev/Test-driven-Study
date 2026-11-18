import { QuestionAudio } from '../../components/QuestionAudio';
import type { Ref } from 'react';
import { Check, ChevronLeft, ChevronRight, Circle, CircleCheck, Expand, Send, RotateCcw } from 'lucide-react';
import type { Question } from '../../api/client';
import type { Presentation, AttemptResult } from '../../api/practice';
import { answerSigns, questionType } from './model';
import { QuestionImage } from './QuestionImage';
import { QuestionExplanation } from './QuestionExplanation';
import { ChoiceOptions } from './ChoiceOptions';
import type { DetailsTab } from './StudyDetails';
import { NumericAnswer } from '../../components/NumericAnswer';
import { RichContent } from '../../components/RichContent';
import { AudioControls } from '../../components/AudioControls';

export function AnswerOptions({ question, mode = 'compact' }: { question: Question; mode?: 'compact' | 'full' }) {
  if (question.question_type === 4) {
    return <p className="answer-option correct">正确答案：{question.answer}</p>;
  }
  const correct = answerSigns(question.answer);
  const hasAnyTts = question.items.some(opt => Boolean(opt.tts));

  return <div className={`answer-options ${mode === 'full' ? 'expanded-options' : ''}`} role="list" aria-label="选项与答案">
    {question.items.map(option => {
      const optionTts = option.tts || (hasAnyTts ? { voice: 'stella' } : undefined);
      return <div role="listitem" key={option.sign}
        className={`answer-option ${correct.has(option.sign) ? 'correct' : ''}`}>
        {question.question_type === 3 ? (correct.has(option.sign) ? <CircleCheck size={19} /> : <Circle size={19} />)
          : <span className="option-letter">{String.fromCharCode(64 + option.sign)}</span>}
        <span className="option-text">{option.item_title}</span>
        {optionTts && <AudioControls text={optionTts.text || option.item_title} voice={optionTts.voice || 'stella'} />}
        {correct.has(option.sign) && <span className="correct-label"><Check size={13} />正确答案</span>}
      </div>;
    })}
  </div>;
}


type Props = {
  presentation: Presentation; result?: AttemptResult; selected: number[];
  numeric: string; onNumeric: (value: string) => void;
  position: number; total: number; pending: boolean; shortcuts: boolean;
  imageRef: Ref<HTMLButtonElement>; onChoose: (sign: number) => void;
  onSubmit: () => void; onRetry: () => void;
  onDetails: (tab: DetailsTab, trigger?: HTMLElement) => void;
  onPrevious: () => void; onNext: () => void;
};

export function QuestionCard({ presentation, result, selected, position, total, pending,
  numeric, onNumeric, shortcuts, imageRef, onChoose, onSubmit, onRetry, onDetails, onPrevious,
  onNext }: Props) {
  const detail = presentation.detail;
  const question = detail.question;
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
              {result ? (result.attempt.correct ? '回答正确' : '回答错误') : '未作答'}</span>
            {presentation.prior_exposure && <span className="exposure-label">已见过此题</span>}
          </header>
          <h2 id="question-title" className="question-text">
            {question.rich_content && question.rich_content.length > 0 ? (
              <RichContent content={question.rich_content} />
            ) : (
              question.title
            )}
          </h2>
          <QuestionAudio key={question.question_id} question={question} />
          <QuestionImage key={presentation.id} detail={detail} buttonRef={imageRef} shortcuts={shortcuts} />
        </section>
        <section className="question-answers" aria-label="作答选项">
          <h3 className="column-label">{isNumeric ? '填写答案'
            : question.question_type === 2 ? '可选择多项' : '选择答案'}</h3>
          {isNumeric ? <>
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
              isNumeric ? numeric.trim() === '' : selected.length === 0)}>
            {result ? <ChevronRight size={16} /> : <Send size={16} />}
            {pending ? '正在保存…' : result ? '下一题' : '提交答案'}{hint('Enter')}
          </button>
        </div>
      </footer>
      {result && <QuestionExplanation detail={result.detail} onDetails={onDetails} />}
    </div>
  </article>;
}
