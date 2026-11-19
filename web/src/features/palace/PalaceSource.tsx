import type { Detail, Question } from '../../api/client';
import { ExplanationAudio } from '../../components/AudioControls';
import { OptionAudio } from '../../components/OptionAudio';
import { RichContent } from '../../components/RichContent';
import { questionType } from '../memorization/model';
import { QuestionImage } from '../memorization/QuestionImage';
import { ExtendedReference } from '../question-types/ExtendedReference';
import { hasRichContent } from '../question-types/model';
import {
  QuestionExtendedExplanations,
  questionHasReviewExplanation,
  questionHasWritingCriteria,
  QuestionStimulus,
  QuestionWritingCriteria,
} from '../question-types/QuestionStimulus';
import { assertNever } from '../question-types/registry';

function PalaceAnswers({ question }: { question: Question }) {
  switch (question.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return <ExtendedReference question={question} />;
    case 'numeric':
      return <p className="answer-option correct">正确答案：{question.answer}</p>;
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false': {
      const answers = question.answer.split(',').map(Number);
      const hasAnyTts = question.items.some(option => Boolean(option.tts));
      return (
        <ol className="palace-options">
          {question.items.map(item => (
            <li key={item.sign} className={answers.includes(item.sign) ? 'correct' : ''}>
              <span>
                {item.sign}. {item.item_title}
              </span>
              <OptionAudio option={item} allOptionsHaveTts={hasAnyTts} />
              {answers.includes(item.sign) && <b>正确</b>}
            </li>
          ))}
        </ol>
      );
    }
    default:
      return assertNever(question);
  }
}

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
