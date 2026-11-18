import { ClozePassage } from '../question-types/ClozeContent';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { ReadingPassage } from '../question-types/ReadingContent';
import { TranslationSource } from '../question-types/TranslationContent';
import { WritingRequirements } from '../question-types/WritingContent';
import {
  clozeQuestionType, readingQuestionType, writingQuestionType,
} from '../question-types/model';
import { OptionAudio } from '../../components/OptionAudio';
import { RichContent } from '../../components/RichContent';
import { useEffect, useState } from 'react';
import type { ExamItem } from '../../api/exams';
import { ReviewAnalysis } from './TerminalDialogs';
import { TerminalModal } from './TerminalModal';
import { TerminalImage } from './TerminalImage';
import { answerSymbols, hasDetailedJudgmentOptions, optionSymbol } from './terminalLabels';

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
  const showOptions = q.question_type < 3 || hasDetailedJudgmentOptions(q);
  const hasAnyTts = q.items.some(option => Boolean(option.tts));
  return <TerminalModal title="错题学习" onClose={onClose} wide>
    <div className="terminal-feedback-question">
      <h2>{position}. <RichContent content={q.rich_content ?? q.title} /></h2>
      {q.question_type === clozeQuestionType && <ClozePassage passage={q.content?.passage}
        blanks={q.content?.blanks} value={item.response} review={item.review?.question_review} />}
      {q.question_type === readingQuestionType && <ReadingPassage passage={q.content?.passage} />}
      {q.question_type === writingQuestionType && <WritingRequirements content={q.content} />}
      <TranslationSource content={q.content} />
      {showOptions && <ol>{q.items.map(o => <li key={o.sign}>
        {optionSymbol(q, o.sign)}. {o.item_title}
        <OptionAudio option={o} allOptionsHaveTts={hasAnyTts} />
      </li>)}</ol>}
    </div>
    <div className="terminal-feedback-image"><TerminalImage item={item}/></div>
    <div className="terminal-feedback-answer">
      {item.review?.question_review ? <ExtendedReview item={item.review.question_review}
        response={item.response} credit={item.credit} /> : <p>正确答案：{q.question_type === 4 ? item.review?.answer :
        answerSymbols(q, item.review?.answer.split(',').map(Number) ?? [])}，
        你的答案：{item.numeric ?? answerSymbols(q, item.selected)}</p>}
      {item.review && <ReviewAnalysis review={item.review} allowFallback={false} />}
      {item.review?.skill && <p>{item.review.skill}</p>}
      <button className="terminal-button" onClick={onClose}>确定</button>
      <small>页面将在 {seconds} 秒后自动关闭，返回考试主界面</small>
    </div>
  </TerminalModal>;
}
