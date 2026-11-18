import { ExtendedQuestion } from '../question-types/ExtendedQuestion';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { TranslationSource } from '../question-types/TranslationContent';
import { hasReviewExplanation, hasRichContent } from '../question-types/model';
import { RichContent } from '../../components/RichContent';
import { QuestionAudio } from '../../components/QuestionAudio';
import { ExplanationAudio } from '../../components/AudioControls';
import type { Detail } from '../../api/client';
import { QuestionImage } from '../memorization/QuestionImage';
import { questionType } from '../memorization/model';

export function PalaceSource({ detail }: { detail: Detail }) {
  const q = detail.question;
  const answers = q.answer.split(',').map(Number);
  const hasAnalysis = hasRichContent(q.analysis_content) || Boolean(q.analysis);
  const hasAudio = Boolean(q.analysis_audio?.length);
  const showFallback = !hasAnalysis && !hasAudio && !hasReviewExplanation(q.question_review);
  return <div className="palace-source">
    <div className="palace-source-meta"><span>题号 #{q.source_item_id ?? q.question_id}</span>
      <span>{questionType(q.question_type)}</span>
      <span>{q.chapter_name || '未分章节'}</span></div>
    <h2 className="question-text"><RichContent content={q.rich_content ?? q.title} /></h2>
    <QuestionAudio key={`audio-${q.question_id}`} question={q} />
    <QuestionImage key={`image-${q.question_id}`} detail={detail} />
    <TranslationSource content={q.content} />
    {q.content && <ExtendedQuestion content={q.content} hideSourceText />}
    {q.question_review && <ExtendedReview item={q.question_review} />}
    <ol className="palace-options">{q.items.map(item => <li key={item.sign}
      className={answers.includes(item.sign) ? 'correct' : ''}>
      <span>{item.sign}. {item.item_title}</span>{answers.includes(item.sign) && <b>正确</b>}
    </li>)}</ol>
    {(hasAnalysis || hasAudio || Boolean(q.skill) || showFallback) && (
      <details className="palace-explanation"><summary>原题解析</summary>
        {(hasAnalysis || hasAudio || showFallback) && <p>
          <RichContent content={hasAnalysis ? (q.analysis_content ?? q.analysis) : '题库未提供讲解。'} />
          <ExplanationAudio segments={q.analysis_audio} />
        </p>}
        {q.skill && <p>{q.skill}</p>}
      </details>
    )}
    <p className="dialog-note">画面会包含正确答案。看完后可回到答题模式检验记忆。</p>
  </div>;
}
