import { AlertCircle, LoaderCircle, Route as RouteIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Sidebar } from '../../components/Sidebar';
import { Tabs } from '../../components/Tabs';
import { ThemeToggle } from '../../components/ThemeToggle';
import { readSubject, useWorkspace, workspaceLink } from '../../app/workspace';
import { GraphPanel } from './GraphPanel';
import { PathPanel } from './PathPanel';
import { useConceptGraph, useLearningPath } from './hooks';

const tabs = [{ id: 'path', label: '学习路径' }, { id: 'graph', label: '知识图谱' }] as const;

export function LearningPage() {
  const [params, setParams] = useSearchParams();
  const subject = readSubject(params);
  const { course } = useWorkspace(subject);
  const tab = params.get('tab') === 'graph' ? 'graph' : 'path';
  return <div className="app-shell learning-shell">
    <a href="#learning-main" className="skip-link">跳到学习路径</a>
    <Sidebar mode="learning" subject={subject} onSubject={value => setParams({ subject: String(value) })} />
    <main id="learning-main" className="workspace learning-workspace">
      <header className="learning-heading">
        <h1><RouteIcon size={21} />学习路径</h1>
        <span className="muted">{course?.title}</span><ThemeToggle />
      </header>
      {course && course.concept_count > 0 && <Tabs prefix="learning" label="学习路径视图" items={tabs}
        value={tab} onChange={value => setParams(current => {
          const next = new URLSearchParams(current); next.set('tab', value); return next;
        })} />}
      {!course ? <div className="page-state" role="status"><LoaderCircle className="spin" size={26} />
        <p>正在读取课程…</p></div>
        : course.concept_count === 0 ? <div className="page-state">
          <h2>本课程尚未定义知识图谱</h2>
          <p>课程作者在课程包中声明知识点和先修关系后，这里会生成学习路径。</p>
          <Link className="button outline" to={workspaceLink('practice', subject, course.id)}>去答题</Link>
        </div>
        : <LearningContent course={course.id} tab={tab} />}
    </main>
  </div>;
}

function LearningContent({ course, tab }: { course: string; tab: 'path' | 'graph' }) {
  const graph = useConceptGraph(course);
  const path = useLearningPath(course);
  const error = graph.error ?? path.error;
  if (error) {
    return <div className="page-state" role="alert"><AlertCircle size={26} /><p>{error.message}</p>
      <button className="button outline" onClick={() => { void graph.refetch(); void path.refetch(); }}>
        重新读取</button></div>;
  }
  if (!graph.data || !path.data) {
    return <div className="page-state" role="status"><LoaderCircle className="spin" size={26} />
      <p>正在读取知识图谱…</p></div>;
  }
  return <div id={`learning-panel-${tab}`} role="tabpanel" aria-labelledby={`learning-tab-${tab}`}
    className="learning-content">
    {tab === 'path' ? <PathPanel course={course} graph={graph.data} path={path.data.path ?? null} />
      : <GraphPanel course={course} graph={graph.data} />}
  </div>;
}
