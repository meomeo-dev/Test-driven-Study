import { useEffect, useState } from 'react';
import type { ExamItem } from '../../api/exams';
import { RichContent } from '../../components/RichContent';
import {
  FeedbackAnswerSummary,
  FeedbackQuestionBody,
  visibleStudyTranslation,
} from '../question-types';
import { ReviewAnalysis } from './TerminalDialogs';
import { TerminalImage } from './TerminalImage';
import { TerminalModal } from './TerminalModal';

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
  const stemTranslation = visibleStudyTranslation(item.review, 'exam_review')?.stem;
  return (
    <TerminalModal title="错题学习" onClose={onClose} wide>
      <div className="terminal-feedback-question">
        <h2>
          {position}. <RichContent content={q.rich_content ?? q.title} />
        </h2>
        {stemTranslation && (
          <p className="study-translation" lang="zh-Hans">{stemTranslation}</p>
        )}
        <FeedbackQuestionBody
          question={q}
          response={item.response}
          review={item.review}
        />
      </div>
      <div className="terminal-feedback-image">
        <TerminalImage item={item} />
      </div>
      <div className="terminal-feedback-answer">
        <FeedbackAnswerSummary
          question={q}
          review={item.review}
          selected={item.selected}
          numeric={item.numeric}
          response={item.response}
          credit={item.credit}
        />
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
