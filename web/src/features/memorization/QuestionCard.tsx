import { ReadingPassage } from '../question-types/ReadingContent';
import { WritingRequirements, WritingSample } from '../question-types/WritingContent';
import { readingQuestionType, writingQuestionType } from '../question-types/model';
import { QuestionAudio } from '../../components/QuestionAudio';
import type { Ref } from 'react';
import { BookOpenCheck, Bookmark, ChevronLeft, ChevronRight, Expand, LoaderCircle, Undo2 } from 'lucide-react';
import type { Detail, ProgressState, Question } from '../../api/client';
import { answerSigns, questionType, stateLabel } from './model';
import { QuestionImage } from './QuestionImage';
import { QuestionExplanation } from './QuestionExplanation';
import type { DetailsTab } from './StudyDetails';
import { RichContent } from '../../components/RichContent';
import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { AnswerOptionList } from '../../components/AnswerOptionList';

type Props = {
  detail: Detail;
  position: number;
  total: number;
  pending: boolean;
  shortcuts: boolean;
  imageRef: Ref<HTMLButtonElement>;
  onDetails: (tab: DetailsTab, trigger?: HTMLElement) => void;
  onPrevious: () => void;
  onNext: () => void;
  onMark: (state: ProgressState, advance?: boolean) => void;
};

export function AnswerOptions({ question, mode = 'compact' }: { question: Question; mode?: 'compact' | 'full' }) {
  if (question.question_type === readingQuestionType && question.content) {
    return <ExtendedQuestion content={question.content} hidePassage
      readingReview={question.question_review} />;
  }
  if (question.question_type === writingQuestionType) {
    return <WritingSample review={question.question_review} />;
  }
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

export function QuestionCard({ detail, position, total, pending, shortcuts, imageRef,
  onDetails, onPrevious, onNext, onMark }: Props) {
  const question = detail.question;
  const reading = question.question_type === readingQuestionType;
  const writing = question.question_type === writingQuestionType;
  const hint = (key: string) => shortcuts ? <kbd aria-hidden="true">{key}</kbd> : null;
  return <article className="question-card" aria-labelledby="question-title"
    aria-busy={pending}>
    <div className="question-meta"><span className="type-badge">{questionType(question.question_type)}</span>
      <span className="chapter-badge question-chapter" title={question.chapter_name.trim()}>
        {question.chapter_name.trim() || '未分章节'}</span>
      <span className="question-position">{position} <span>/ {total}</span></span>
      <button type="button" className="read-full" onClick={event => onDetails('question', event.currentTarget)} aria-keyshortcuts={shortcuts ? 'v' : undefined}>
        <Expand size={13} />完整题目{hint('v')}</button>
    </div>
    <div className="question-stage" data-reading={reading || undefined} data-writing={writing || undefined}>
      <section className="question-stem" aria-label="题干与图例">
        <header className="column-label question-stem-heading">
          <span className="source-line">题号 #{question.source_item_id ?? question.question_id}</span>
          <span className={`state-label ${detail.state}`}>{stateLabel(detail.state)}</span>
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
        <QuestionImage key={`image-${question.question_id}`} detail={detail} buttonRef={imageRef} shortcuts={shortcuts} />
      </section>
      <section className="question-answers" aria-label="参考答案">
        {!writing && <h3 className="column-label">选项与答案</h3>}
        <AnswerOptions question={question} />
      </section>
      <QuestionExplanation detail={detail} onDetails={onDetails} />
    </div>
    <footer className="question-actions">
      <div className="flip-actions"><button type="button" className="button secondary previous" disabled={position <= 1 || pending}
        onClick={onPrevious} aria-keyshortcuts={shortcuts ? 'k ArrowLeft' : 'ArrowLeft'}><ChevronLeft size={16} />上一题{hint('k')}</button>
        <button type="button" className="button secondary next" disabled={position >= total || pending}
          onClick={onNext} aria-keyshortcuts={shortcuts ? 'j ArrowRight' : 'ArrowRight'}>下一题{hint('j')}<ChevronRight size={16} /></button></div>
      <div className="mark-actions"><button type="button" className={`button outline ${detail.state === 'review' ? 'review-selected' : ''}`}
        disabled={pending} onClick={() => onMark(detail.state === 'review' ? 'unlearned' : 'review')}
        aria-keyshortcuts={shortcuts ? 'r' : undefined}><Bookmark size={16} />
        {detail.state === 'review' ? '取消待复习' : '待复习'}{hint('r')}</button>
        <button type="button" className="button primary" disabled={pending} onClick={() => onMark('mastered', true)}
          aria-keyshortcuts={shortcuts ? 'm' : undefined}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <BookOpenCheck size={16} />}
          已记住，下一题{hint('m')}</button>
        <button type="button" className="icon-button reset-mark" disabled={pending || detail.state === 'unlearned'}
          aria-label="撤销当前标记"
          title={shortcuts ? '撤销当前标记 (u)' : '撤销当前标记'}
          onClick={() => onMark('unlearned')}
          aria-keyshortcuts={shortcuts ? 'u' : undefined}><Undo2 size={17} /></button></div>
    </footer>
  </article>;
}
