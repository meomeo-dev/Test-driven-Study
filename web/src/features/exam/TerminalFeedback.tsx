import { useEffect, useState } from 'react';
import type { ExamItem } from '../../api/exams';
import { OptionAudio } from '../../components/OptionAudio';
import { RichContent } from '../../components/RichContent';
import { ClozePassage } from '../question-types/ClozeContent';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { ReadingPassage } from '../question-types/ReadingContent';
import { assertNever } from '../question-types/registry';
import { TranslationSource } from '../question-types/TranslationContent';
import { WritingRequirements } from '../question-types/WritingContent';
import { ReviewAnalysis } from './TerminalDialogs';
import { TerminalImage } from './TerminalImage';
import { TerminalModal } from './TerminalModal';
import { answerSymbols, hasDetailedJudgmentOptions, optionSymbol } from './terminalLabels';

function FeedbackQuestionBody({ item }: { item: ExamItem }) {
  const q = item.detail.question;
  switch (q.question_type) {
    case 'cloze':
      return (
        <ClozePassage
          passage={q.content.passage}
          blanks={q.content.blanks}
          value={item.response}
          review={
            item.review?.question_type === 'cloze' ? item.review.question_review : undefined
          }
        />
      );
    case 'reading_comprehension':
      return <ReadingPassage passage={q.content.passage} />;
    case 'writing':
      return <WritingRequirements content={q.content} />;
    case 'translation':
      return <TranslationSource content={q.content} />;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false': {
      const showOptions =
        q.question_type !== 'true_false' || hasDetailedJudgmentOptions(q);
      if (!showOptions) return null;
      const hasAnyTts = q.items.some(option => Boolean(option.tts));
      return (
        <ol>
          {q.items.map(o => (
            <li key={o.sign}>
              {optionSymbol(q, o.sign)}. {o.item_title}
              <OptionAudio option={o} allOptionsHaveTts={hasAnyTts} />
            </li>
          ))}
        </ol>
      );
    }
    case 'numeric':
    case 'listening':
      return null;
    default:
      return assertNever(q);
  }
}

function FeedbackAnswerSummary({ item }: { item: ExamItem }) {
  const q = item.detail.question;
  switch (q.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation': {
      const review = item.review;
      const itemReview =
        review &&
        (review.question_type === 'cloze' ||
          review.question_type === 'listening' ||
          review.question_type === 'reading_comprehension' ||
          review.question_type === 'writing' ||
          review.question_type === 'translation')
          ? review.question_review
          : undefined;
      return itemReview ? (
        <ExtendedReview
          item={itemReview}
          response={item.response}
          credit={item.credit}
        />
      ) : null;
    }
    case 'numeric':
      return (
        <p>
          正确答案：{item.review?.answer}，你的答案：{item.numeric ?? ''}
        </p>
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return (
        <p>
          正确答案：{answerSymbols(q, item.review?.answer.split(',').map(Number) ?? [])}，
          你的答案：{answerSymbols(q, item.selected)}
        </p>
      );
    default:
      return assertNever(q);
  }
}

export function TerminalFeedback({
  item,
  position,
  onClose,
}: {
  item: ExamItem;
  position: number;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(10);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(n => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!seconds) onClose();
  }, [seconds, onClose]);
  const q = item.detail.question;
  return (
    <TerminalModal title="错题学习" onClose={onClose} wide>
      <div className="terminal-feedback-question">
        <h2>
          {position}. <RichContent content={q.rich_content ?? q.title} />
        </h2>
        <FeedbackQuestionBody item={item} />
      </div>
      <div className="terminal-feedback-image">
        <TerminalImage item={item} />
      </div>
      <div className="terminal-feedback-answer">
        <FeedbackAnswerSummary item={item} />
        {item.review && <ReviewAnalysis review={item.review} allowFallback={false} />}
        {item.review?.skill && <p>{item.review.skill}</p>}
        <button className="terminal-button" onClick={onClose}>
          确定
        </button>
        <small>页面将在 {seconds} 秒后自动关闭，返回考试主界面</small>
      </div>
    </TerminalModal>
  );
}
