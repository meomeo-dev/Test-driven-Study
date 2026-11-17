import { BookOpen, Check, CircleHelp, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import type { ConceptStatus } from '../../api/learning';
import { guideLink, practiceLink } from './model';
import { useMarkKnown } from './hooks';

// Shared actions for a concept in the path list and the graph details.
export function ConceptActions({ course, concept }: { course: string; concept: ConceptStatus }) {
  const mark = useMarkKnown(course);
  return <div className="concept-actions">
    {concept.item_count > 0 && <Link className="button outline" to={practiceLink(course, concept)}>
      <CircleHelp size={14} />练习本知识点</Link>}
    {concept.lesson && <Link className="button secondary" to={guideLink(course, concept)}>
      <BookOpen size={14} />指南</Link>}
    <button type="button" className="button text" disabled={mark.isPending}
      onClick={() => mark.mutate({ concept: concept.id, known: !concept.known })}>
      {concept.known ? <><Undo2 size={14} />取消自评</> : <><Check size={14} />标记已会（自评）</>}
    </button>
    {mark.error && <span role="alert" className="concept-error">{mark.error.message}</span>}
  </div>;
}
