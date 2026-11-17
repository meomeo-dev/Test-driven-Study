import {
  BookOpen, ChartNoAxesCombined, CircleHelp, GraduationCap, LibraryBig, Map, NotebookPen, Route,
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useEffect } from 'react';
import { useWorkspace, workspaceLink } from '../app/workspace';

type Mode = 'memorize' | 'practice' | 'analysis' | 'palace' | 'guide' | 'exam' | 'learning';
export function Sidebar({ subject, onSubject, mode = 'memorize', question }: {
  subject: number; onSubject: (subject: number) => void; mode?: Mode; question?: number;
}) {
  const links = [{ mode: 'memorize', title: '背题模式', path: '/memorize', icon: BookOpen },
    { mode: 'practice', title: '答题模式', path: '/practice', icon: CircleHelp },
    { mode: 'analysis', title: '学习分析', path: '/analysis', icon: ChartNoAxesCombined },
    { mode: 'palace', title: '记忆宫殿', path: '/palace', icon: Map },
    { mode: 'guide', title: '科目指南', path: '/guide', icon: GraduationCap },
    { mode: 'exam', title: '模拟考试', path: '/exam', icon: NotebookPen }];
  const { course, units, logo } = useWorkspace(subject);
  // Learning paths are course-wide, so the entry has no unit sub-navigation and
  // appears only for courses that declare a concept graph.
  if (course && course.concept_count > 0) {
    links.push({ mode: 'learning', title: '学习路径', path: '/learning', icon: Route });
  }
  const title = links.find(link => link.mode === mode)?.title ?? '学习中心';
  const brand = course?.title ?? '课程学习';
  const practiceSubject = units.find(unit => unit.subject_id === subject && unit.has_practice)
    ?.subject_id ?? units.find(unit => unit.has_practice)?.subject_id ?? subject;
  useEffect(() => { document.title = `${title} · ${brand}`; }, [title, brand]);
  return <aside className="sidebar">
    <NavLink className="brand" to={workspaceLink('memorize', practiceSubject, course?.id)} aria-label={`${brand}首页`}>
      {logo && <img src={logo} width={36} height={36} alt="" />}
      <strong>{brand}</strong>
    </NavLink>
    <nav aria-label="主导航" className="side-nav">
      {links.map(({ mode: value, title, path, icon: Icon }) => <div className="nav-group" key={value}>
        <NavLink to={workspaceLink(path.slice(1), value === 'guide' ? subject : practiceSubject, course?.id,
            value === 'palace' ? question : undefined)}
          className={`nav-item ${mode === value ? 'active' : ''}`}>
          <Icon size={19} /><span>{title}</span>
        </NavLink>
        {mode === value && value !== 'learning' && <div className="subject-subnav" role="group"
          aria-label="选择科目">
          {units.filter(unit => mode === 'guide' || unit.has_practice).map(unit =>
            <button type="button" key={unit.id} aria-pressed={subject === unit.subject_id}
              onClick={() => onSubject(unit.subject_id)}>{unit.title}</button>)}
        </div>}
      </div>)}
      <NavLink to="/courses" className="nav-item">
        <LibraryBig size={19} /><span>所有课程</span>
      </NavLink>
    </nav>
  </aside>;
}
