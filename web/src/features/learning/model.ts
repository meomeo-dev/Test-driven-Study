import type { ConceptGraph, ConceptStatus, LearningPathStep } from '../../api/learning';
import { workspaceLink } from '../../app/workspace';

export const stateLabels: Record<LearningPathStep['state'], string> = {
  mastered: '已掌握', known: '已会（自评）', learning: '学习中', ready: '可学习',
  locked: '未解锁', missing: '已从课程移除',
};

export const maxTargets = 16;
export const minDailyMinutes = 10;
export const maxDailyMinutes = 480;

// A known mark that a wrong latest answer overrides; the learner should
// practice again or clear the mark.
export function markConflict(concept: ConceptStatus) {
  return concept.known && concept.state === 'learning';
}

export function conceptTitles(graph: ConceptGraph) {
  return new Map(graph.concepts.map(concept => [concept.id, concept.title]));
}

// Describes alternative prerequisite groups, e.g. "加法 + 减法；或 计数".
export function prerequisiteText(groups: string[][], titles: Map<string, string>) {
  if (groups.length === 0) return '无先修要求';
  return groups.map(group => group.map(id => titles.get(id) ?? id).join(' + '))
    .join('；或 ');
}

export function practiceLink(course: string, concept: Pick<ConceptStatus, 'id' | 'subject_id'>) {
  return `${workspaceLink('practice', concept.subject_id, course)}&concept=${encodeURIComponent(concept.id)}`;
}

export function guideLink(course: string, concept: Pick<ConceptStatus, 'subject_id'>) {
  return workspaceLink('guide', concept.subject_id, course);
}

export function evidenceText(concept: ConceptStatus) {
  if (concept.item_count === 0) return '本知识点没有练习题，完成后可标记为已会。';
  return `已作答 ${concept.attempted}/${concept.item_count} 题，最近答对 ${concept.correct} 题；`
    + `需答对 ${concept.required_correct} 题且正确率不低于 75%。`;
}
