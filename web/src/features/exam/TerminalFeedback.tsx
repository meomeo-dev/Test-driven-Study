import { ExtendedReview } from '../question-types/ExtendedReview';
import { RichContent } from '../../components/RichContent';
import { useEffect, useState } from 'react';
import type { ExamItem } from '../../api/exams';
import { TerminalModal } from './TerminalModal';
import { TerminalImage } from './TerminalImage';
import { answerSymbols } from './terminalLabels';

export function TerminalFeedback({ item, position, onClose }: {
  item: ExamItem; position: number; onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(10);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(n => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (!seconds) onClose(); }, [seconds, onClose]);
  const q = item.detail.question;
  return <TerminalModal title="错题学习" onClose={onClose} wide>
    <div className="terminal-feedback-question"><h2>{position}. <RichContent content={q.rich_content ?? q.title} /></h2>
      {q.question_type < 3 && <ol>{q.items.map((o, i) => <li key={o.sign}>
        {String.fromCharCode(65 + i)}. {o.item_title}</li>)}</ol>}
    </div>
    <div className="terminal-feedback-image"><TerminalImage item={item}/></div>
    <div className="terminal-feedback-answer">
      {item.review?.question_review ? <ExtendedReview item={item.review.question_review}
        response={item.response} credit={item.credit} /> : <p>正确答案：{q.question_type === 4 ? item.review?.answer :
        answerSymbols(q, item.review?.answer.split(',').map(Number) ?? [])}，
        你的答案：{item.numeric ?? answerSymbols(q, item.selected)}</p>}
      <button className="terminal-button" onClick={onClose}>确定</button>
      <small>页面将在 {seconds} 秒后自动关闭，返回考试主界面</small>
    </div>
  </TerminalModal>;
}
