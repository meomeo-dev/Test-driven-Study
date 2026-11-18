import { ClozePassage } from '../question-types/ClozeContent';
import { ExtendedExplanations } from '../question-types/ExtendedExplanations';
import { ExtendedReference } from '../question-types/ExtendedReference';
import { ReadingPassage } from '../question-types/ReadingContent';
import { TranslationSource } from '../question-types/TranslationContent';
import { WritingCriteria, WritingRequirements } from '../question-types/WritingContent';
import {
  clozeQuestionType, hasReviewExplanation, hasRichContent, readingQuestionType,
  translationQuestionType, writingQuestionType,
} from '../question-types/model';
import { RichContent } from '../../components/RichContent';
import { QuestionAudio } from '../../components/QuestionAudio';
import { ExplanationAudio } from '../../components/AudioControls';
import { OptionAudio } from '../../components/OptionAudio';
import type { Detail } from '../../api/client';
import { QuestionImage } from '../memorization/QuestionImage';
import { questionType } from '../memorization/model';

export function PalaceSource({ detail }: { detail: Detail }) {
  const q = detail.question;
  const answers = q.answer.split(',').map(Number);
  const cloze = q.question_type === clozeQuestionType;
  const reading = q.question_type === readingQuestionType;
  const writing = q.question_type === writingQuestionType;
  const translation = q.question_type === translationQuestionType;
  const hasAnalysis = hasRichContent(q.analysis_content) || Boolean(q.analysis);
  const hasAudio = Boolean(q.analysis_audio?.length);
  const hasCriteria = q.question_review?.type === 'writing' &&
    Boolean(q.question_review.keywords?.length || q.question_review.rubric);
  const showFallback = !hasAnalysis && !hasAudio &&
    !hasReviewExplanation(q.question_review) && !hasCriteria;
  const hasAnyTts = q.items.some(option => Boolean(option.tts));
  return <div className="palace-source">
    <div className="palace-source-meta"><span>题号 #{q.source_item_id ?? q.question_id}</span>
      <span>{questionType(q.question_type)}</span>
      <span>{q.chapter_name || '未分章节'}</span></div>
    <h2 className="question-text"><RichContent content={q.rich_content ?? q.title} /></h2>
    {cloze && <ClozePassage passage={q.content?.passage} review={q.question_review} />}
    {reading && <ReadingPassage passage={q.content?.passage} />}
    {writing && <WritingRequirements content={q.content} />}
    <TranslationSource content={q.content} />
    <QuestionAudio key={`audio-${q.question_id}`} question={q} />
    <QuestionImage key={`image-${q.question_id}`} detail={detail} />
    {q.content || writing || translation ? <ExtendedReference question={q} />
      : q.question_type === 4
        ? <p className="answer-option correct">正确答案：{q.answer}</p>
        : <ol className="palace-options">{q.items.map(item => <li key={item.sign}
          className={answers.includes(item.sign) ? 'correct' : ''}>
          <span>{item.sign}. {item.item_title}</span>
          <OptionAudio option={item} allOptionsHaveTts={hasAnyTts} />
          {answers.includes(item.sign) && <b>正确</b>}
        </li>)}</ol>}
    <details className="palace-explanation"><summary>原题解析</summary>
      {(hasAnalysis || hasAudio || showFallback) && <p>
        <RichContent content={hasAnalysis ? (q.analysis_content ?? q.analysis) : '题库未提供讲解。'} />
        <ExplanationAudio segments={q.analysis_audio} />
      </p>}
      <ExtendedExplanations review={q.question_review} />
      <WritingCriteria review={q.question_review} />
      {q.skill && <p>{q.skill}</p>}
    </details>
    <p className="dialog-note">画面会包含正确答案。看完后可回到答题模式检验记忆。</p>
  </div>;
}
