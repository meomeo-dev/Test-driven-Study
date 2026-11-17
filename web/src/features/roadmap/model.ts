import type { CourseState, RoadmapCourse, RoadmapGroup } from '../../api/roadmap';

export const courseStateLabels: Record<CourseState | 'missing', string> = {
  completed: '已学完', in_progress: '学习中', ready: '可开始', waiting: '先修未完成',
  missing: '未安装',
};

export const strengthLabels: Record<RoadmapGroup['strength'], string> = {
  required: '先修', recommended: '建议先修',
};

export const maxTargetCourses = 16;

export function courseTitles(courses: RoadmapCourse[]) {
  return new Map(courses.map(course => [course.id, course.title]));
}

// Joins course titles; a course that is not installed keeps its ID and says so.
export function memberText(ids: string[], titles: Map<string, string>) {
  return ids.map(id => titles.get(id) ?? `${id}（未安装）`).join(' + ');
}

// Describes alternative groups with their strength, e.g. "先修：电路基础 + C 语言程序设计".
export function relationText(groups: RoadmapGroup[], titles: Map<string, string>) {
  if (groups.length === 0) return '无先修课程';
  return groups.map(group => `${strengthLabels[group.strength]}：${memberText(group.all_of, titles)}`)
    .join('；或 ');
}

// Courses that take part in an installed prerequisite relation on either side.
export function relatedCourseIds(courses: RoadmapCourse[]) {
  const installed = new Set(courses.map(course => course.id));
  const related = new Set<string>();
  for (const course of courses) {
    for (const member of course.prerequisites.flatMap(group => group.all_of)) {
      if (!installed.has(member)) continue;
      related.add(member);
      related.add(course.id);
    }
  }
  return related;
}

// An edge is required when a required group of the dependent course names the
// prerequisite; otherwise the README only recommends it.
export function edgeStrength(course: RoadmapCourse | undefined, member: string) {
  const required = course?.prerequisites.some(group =>
    group.strength === 'required' && group.all_of.includes(member));
  return required ? 'required' : 'recommended';
}

export function completionText(course: RoadmapCourse) {
  if (course.concept_count > 0) {
    return `学完全部知识点即完成：已完成 ${course.satisfied_concepts}/${course.concept_count}`;
  }
  return course.marked_completed ? '已手动标记学完' : '学完后手动标记';
}

// The badge already shows 先修未完成 for a waiting course, so the hint states
// that prerequisites are advisory; a started course may continue.
export function advisoryHint(state: string) {
  return state === 'waiting' ? '先修不限制打开课程，也可以先开始。' : '先修未完成，也可以继续学习。';
}
