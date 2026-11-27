import type { Question, StudyTranslationSurface } from '../../../api/generated/types.gen';
import { RichContent } from '../../../components/RichContent';
import { dispatchFullQuestion } from '../registry';
import { hasRichContent } from '../shared/format';

export function QuestionExtendedExplanations({ question }: { question: Question }) {
  const parts = dispatchFullQuestion(question, (mod, q) => mod.getExplanationParts(q));
  if (!parts.length) return null;
  return (
    <div className="extended-review">
      {parts.map(part => (
        <div key={part.key}>
          <h4 className="column-label">{part.label}</h4>
          <p className="analysis-text">
            <RichContent content={part.content} />
          </p>
        </div>
      ))}
    </div>
  );
}

export function QuestionWritingSample({
  question,
  showStudyTranslation,
  translationSurface,
}: {
  question: Question;
  showStudyTranslation?: boolean;
  translationSurface?: StudyTranslationSurface;
}) {
  return dispatchFullQuestion(
    question,
    (mod, q) =>
      mod.renderWritingSample?.(q, { showStudyTranslation, translationSurface }) ?? null,
  );
}

export function QuestionWritingCriteria({ question }: { question: Question }) {
  return dispatchFullQuestion(
    question,
    (mod, q) => mod.renderWritingCriteria?.(q) ?? null,
  );
}

export function questionHasReviewExplanation(question: Question): boolean {
  return dispatchFullQuestion(question, (mod, q) => mod.hasReviewExplanation(q));
}

export function questionHasWritingCriteria(question: Question): boolean {
  return dispatchFullQuestion(
    question,
    (mod, q) => mod.hasWritingCriteria?.(q) ?? false,
  );
}

export function shouldShowExplanation(question: Question): boolean {
  if (
    Boolean(question.analysis) ||
    hasRichContent(question.analysis_content) ||
    Boolean(question.analysis_audio?.length) ||
    Boolean(question.skill)
  ) {
    return true;
  }
  return dispatchFullQuestion(question, (mod, q) =>
    mod.shouldShowPracticeExplanation(q),
  );
}
