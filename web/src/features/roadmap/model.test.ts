import { describe, expect, it } from 'vitest';
import type { RoadmapCourse } from '../../api/roadmap';
import {
  advisoryHint, completionText, edgeStrength, relatedCourseIds, relationText,
} from './model';

function course(id: string, prerequisites: RoadmapCourse['prerequisites'] = []): RoadmapCourse {
  return { id, title: id.toUpperCase(), version: '1.0.0', prerequisites, parallel_with: [],
    missing: [], concept_count: 0, satisfied_concepts: 0, marked_completed: false,
    completed: false, prerequisites_met: true, state: 'ready' };
}

describe('roadmap model', () => {
  const embedded = course('mcu', [{ all_of: ['circuit', 'c'], strength: 'required' }]);
  const pcb = course('pcb', [{ all_of: ['circuit', 'sensor'], strength: 'recommended' },
    { all_of: ['mcu'], strength: 'required' }]);
  const courses = [course('c'), course('circuit'), embedded, pcb, course('english')];

  it('describes groups with strengths and courses that are not installed', () => {
    const titles = new Map(courses.map(value => [value.id, value.title]));
    expect(relationText([], titles)).toBe('无先修课程');
    expect(relationText(pcb.prerequisites, titles))
      .toBe('建议先修：CIRCUIT + sensor（未安装）；或 先修：MCU');
  });

  it('keeps only courses with installed prerequisite relations in the graph', () => {
    expect([...relatedCourseIds(courses)].sort()).toEqual(['c', 'circuit', 'mcu', 'pcb']);
  });

  it('marks an edge required only when a required group names the member', () => {
    expect(edgeStrength(embedded, 'c')).toBe('required');
    expect(edgeStrength(pcb, 'circuit')).toBe('recommended');
    expect(edgeStrength(pcb, 'mcu')).toBe('required');
  });

  it('explains how a course is completed', () => {
    expect(completionText({ ...course('english'), concept_count: 16, satisfied_concepts: 3 }))
      .toBe('学完全部知识点即完成：已完成 3/16');
    expect(completionText({ ...course('c'), marked_completed: true })).toBe('已手动标记学完');
  });

  it('states that unmet prerequisites never block a course', () => {
    expect(advisoryHint('waiting')).toBe('先修不限制打开课程，也可以先开始。');
    expect(advisoryHint('in_progress')).toBe('先修未完成，也可以继续学习。');
  });
});
