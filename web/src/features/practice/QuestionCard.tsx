import { useId, type Ref } from 'react';
import { ChevronLeft, ChevronRight, Expand, RotateCcw, Send } from 'lucide-react';
import type { Question } from '../../api/client';
import type { ExtendedResponse } from '../../api/generated/types.gen';
import type { AttemptResult, Presentation } from '../../api/practice';
import { RichContent } from '../../components/RichContent';
import {
  hasDraftAnswer,
  PracticeAnswerBody,
  QUESTION_TYPE_REGISTRY,
  QuestionReferenceAnswers,
  QuestionStimulus,
  shouldShowExplanation,
} from '../question-types';
import { questionType } from './model';
import { QuestionExplanation } from './QuestionExplanation';
import { QuestionImage } from './QuestionImage';
import type { DetailsTab } from './StudyDetails';

export function AnswerOptions({
  question,
  mode = 'compact',
}: {
  question: Question;
  mode?: 'compact' | 'full';
}) {
  return (
    <QuestionReferenceAnswers
      question={question}
      mode={mode}
      includeWritingSample={false}
    />
  );
}

type Props = {
  presentation: Presentation;
  result?: AttemptResult;
  selected: number[];
  draft?: ExtendedResponse;
  onDraft: (draft: ExtendedResponse) => void;
  canSubmitExtended: boolean;
  numeric: string;
  onNumeric: (value: string) => void;
  position: number;
  total: number;
  pending: boolean;
  shortcuts: boolean;
  imageRef: Ref<HTMLButtonElement>;
  onChoose: (sign: number) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onDetails: (tab: DetailsTab, trigger?: HTMLElement) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function QuestionCard({
  presentation,
  result,
  selected,
  position,
  total,
  pending,
  draft,
  onDraft,
  canSubmitExtended,
  numeric,
  onNumeric,
  shortcuts,
  imageRef,
  onChoose,
  onSubmit,
  onRetry,
  onDetails,
  onPrevious,
  onNext,
}: Props) {
  const detail = presentation.detail;
  const question = detail.question;
  const clozeId = useId();
  const spec = QUESTION_TYPE_REGISTRY[question.question_type];
  const written = spec.isWritten && Boolean(result);
  const hint = (key: string) =>
    shortcuts || key === 'Enter' ? <kbd aria-hidden="true">{key}</kbd> : null;
  const ready = hasDraftAnswer(question, { selected, numeric, canSubmitExtended });

  return (
    <article className="question-card" aria-labelledby="question-title" aria-busy={pending}>
      <div className="question-meta">
        <span className="type-badge">{questionType(question.question_type)}</span>
        <span className="chapter-badge question-chapter" title={question.chapter_name.trim()}>
          {question.chapter_name.trim() || '未分章节'}
        </span>
        <span className="question-position">
          {position} <span>/ {total}</span>
        </span>
        <button
          type="button"
          className="read-full"
          onClick={event => onDetails('question', event.currentTarget)}
          aria-keyshortcuts={shortcuts ? 'v' : undefined}
        >
          <Expand size={13} />
          完整题目{hint('v')}
        </button>
      </div>
      <div className="practice-flow">
        <div className="question-stage" data-has-image={!!question.image_url}>
          <section className="question-stem" aria-label="题干与图例">
            <header className="column-label question-stem-heading">
              <span className="source-line">
                题号 #{question.source_item_id ?? question.question_id}
              </span>
              <span
                role="status"
                className={`state-label ${
                  result ? (result.attempt.correct ? 'correct' : 'incorrect') : ''
                }`}
              >
                {result
                  ? written
                    ? '已完成本地检查'
                    : result.attempt.correct
                      ? '回答正确'
                      : result.attempt.score
                        ? '部分正确'
                        : '回答错误'
                  : '未作答'}
              </span>
              {presentation.prior_exposure && (
                <span className="exposure-label">已见过此题</span>
              )}
            </header>
            <h2 id="question-title" className="question-text">
              {question.rich_content && question.rich_content.length > 0 ? (
                <RichContent content={question.rich_content} />
              ) : (
                question.title
              )}
            </h2>
            <QuestionStimulus
              question={question}
              cloze={{
                value: result?.attempt.response ?? draft,
                onJump:
                  pending || result
                    ? undefined
                    : index => document.getElementById(`${clozeId}-${index}`)?.focus(),
              }}
            />
            <QuestionImage
              key={`image-${presentation.id}`}
              detail={detail}
              buttonRef={imageRef}
              shortcuts={shortcuts}
            />
          </section>
          <section
            className="question-answers"
            aria-label={spec.hideAnswerHeading ? '作答' : '作答选项'}
          >
            {!spec.hideAnswerHeading && (
              <h3 className="column-label">{spec.answerHeading}</h3>
            )}
            <PracticeAnswerBody
              question={question}
              reviewQuestion={result?.detail.question}
              presentationId={presentation.id}
              result={
                result
                  ? {
                      score: result.attempt.score,
                      response: result.attempt.response,
                      correctAnswer: result.attempt.correct_answer,
                      correctNumeric: result.attempt.correct_numeric,
                    }
                  : undefined
              }
              selected={selected}
              draft={draft}
              onDraft={onDraft}
              numeric={numeric}
              onNumeric={onNumeric}
              pending={pending}
              shortcuts={shortcuts}
              partIdPrefix={clozeId}
              onChoose={onChoose}
            />
          </section>
        </div>
        <footer className="question-actions">
          <div className="flip-actions">
            <button
              className="button secondary previous"
              disabled={position <= 1 || pending}
              onClick={onPrevious}
            >
              <ChevronLeft size={16} />
              上一题{hint('k')}
            </button>
            <button
              className="button secondary next"
              disabled={position >= total || pending}
              data-practice-confirm={result ? 'true' : undefined}
              aria-keyshortcuts={[shortcuts ? 'j' : '', 'ArrowRight', result ? 'Enter' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={onNext}
            >
              下一题{hint('j')}
              {result && hint('Enter')}
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mark-actions practice-actions">
            {result && (
              <button className="button outline" onClick={onRetry} disabled={pending}>
                <RotateCcw size={16} />
                再答一次{hint('r')}
              </button>
            )}
            <button
              className="button primary practice-primary-action"
              data-practice-confirm="true"
              aria-keyshortcuts="Enter"
              onClick={result ? onNext : onSubmit}
              disabled={pending || (result ? position >= total : !ready)}
            >
              {result ? <ChevronRight size={16} /> : <Send size={16} />}
              {pending ? '正在保存…' : result ? '下一题' : '提交答案'}
              {hint('Enter')}
            </button>
          </div>
        </footer>
        {result && shouldShowExplanation(result.detail.question) && (
          <QuestionExplanation detail={result.detail} onDetails={onDetails} />
        )}
      </div>
    </article>
  );
}
