import type { Detail } from '../../api/client';
import { ExplanationAudio } from '../../components/AudioControls';
import { RichContent } from '../../components/RichContent';
import { questionType } from '../memorization/model';
import { QuestionImage } from '../memorization/QuestionImage';
import {
  hasRichContent,
  PalaceAnswers,
  QuestionExtendedExplanations,
  questionHasReviewExplanation,
  questionHasWritingCriteria,
  QuestionStimulus,
  QuestionWritingCriteria,
} from '../question-types';

export function PalaceSource({ detail }: { detail: Detail }) {
  const q = detail.question;
  const hasAnalysis = hasRichContent(q.analysis_content) || Boolean(q.analysis);
  const hasAudio = Boolean(q.analysis_audio?.length);
  const showFallback =
    !hasAnalysis &&
    !hasAudio &&
    !questionHasReviewExplanation(q) &&
    !questionHasWritingCriteria(q);

  return (
    <div className="palace-source">
      <div className="palace-source-meta">
        <span>题号 #{q.source_item_id ?? q.question_id}</span>
        <span>{questionType(q.question_type)}</span>
        <span>{q.chapter_name || '未分章节'}</span>
      </div>
      <h2 className="question-text">
        <RichContent content={q.rich_content ?? q.title} />
      </h2>
      <QuestionStimulus question={q} />
      <QuestionImage key={`image-${q.question_id}`} detail={detail} />
      <PalaceAnswers question={q} />
      <details className="palace-explanation">
        <summary>原题解析</summary>
        {(hasAnalysis || hasAudio || showFallback) && (
          <p>
            <RichContent content={hasAnalysis ? q.analysis_content ?? q.analysis : '题库未提供讲解。'} />
            <ExplanationAudio segments={q.analysis_audio} />
          </p>
        )}
        <QuestionExtendedExplanations question={q} />
        <QuestionWritingCriteria question={q} />
        {q.skill && <p>{q.skill}</p>}
      </details>
      <p className="dialog-note">画面会包含正确答案。看完后可回到答题模式检验记忆。</p>
    </div>
  );
}
