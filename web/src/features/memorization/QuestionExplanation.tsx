import { ChevronDown, FileText, Lightbulb } from 'lucide-react';
import type { Detail } from '../../api/client';
import { ExplanationAudio } from '../../components/AudioControls';
import { RichContent } from '../../components/RichContent';
import { hasRichContent } from '../question-types/model';
import {
  QuestionExtendedExplanations,
  QuestionWritingCriteria,
} from '../question-types/QuestionStimulus';
import type { DetailsTab } from './StudyDetails';

type Props = {
  detail: Detail;
  onDetails: (tab: DetailsTab, trigger?: HTMLElement) => void;
};

export function QuestionExplanation({ detail, onDetails }: Props) {
  const question = detail.question;
  const hasAnalysis = hasRichContent(question.analysis_content) || Boolean(question.analysis);
  return (
    <section className="question-analysis" aria-label="答案解析">
      <header className="analysis-heading">
        <h3 className="column-label">
          <FileText size={14} />
          答案解析
        </h3>
        <button
          type="button"
          className="inline-action"
          onClick={event => onDetails('analysis', event.currentTarget)}
        >
          完整解析
        </button>
      </header>
      <div
        key={question.question_id}
        className="question-explanation-body"
        role="region"
        aria-label="解析正文"
        aria-keyshortcuts="ArrowUp ArrowDown"
        tabIndex={0}
      >
        {(hasAnalysis || Boolean(question.analysis_audio?.length)) && (
          <p className="analysis-text">
            <RichContent content={question.analysis_content ?? question.analysis} />
            <ExplanationAudio segments={question.analysis_audio} />
          </p>
        )}
        <QuestionExtendedExplanations question={question} />
        <QuestionWritingCriteria question={question} />
        {question.skill && (
          <details className="memory-tip" open>
            <summary>
              <Lightbulb size={15} />
              记忆提示
              <ChevronDown size={14} className="disclosure-chevron" />
            </summary>
            <p>{question.skill}</p>
          </details>
        )}
      </div>
      <div className="question-metadata-summary">
        <span>难度 {question.difficulty}/5</span>
        <button
          type="button"
          className="inline-action"
          onClick={event => onDetails('metadata', event.currentTarget)}
        >
          题目信息
        </button>
      </div>
    </section>
  );
}
