import { readSubject } from '../../app/workspace';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { BookOpen, GraduationCap } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { ThemeToggle } from '../../components/ThemeToggle';
import { request } from '../../api/client';
import type { CourseGuide } from '../../api/generated/types.gen';
import { LessonReader } from './LessonReader';

export function GuidePage() {
  const [params] = useSearchParams();
  const subject = readSubject(params);
  const guide = useQuery({
    queryKey: ['course-guide', subject],
    queryFn: ({ signal }) => request<CourseGuide>(`/api/guide?subject=${subject}`, { signal }),
  });
  if (guide.error) return <p role="alert">{guide.error.message}</p>;
  if (!guide.data) return <p role="status">正在读取科目指南…</p>;
  return <GuideContent guide={guide.data} />;
}

function GuideContent({ guide }: { guide: CourseGuide }) {
  const { stages } = guide;
  const [params, setParams] = useSearchParams();
  const stageID = Number(params.get('stage') ?? params.get('subject'));
  const stage = stages.find(item => item.id === stageID) ?? stages[0];

  function change(key: string, value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set(key, value);
      return next;
    });
  }

  if (!stage) return <p role="alert">科目指南没有可用阶段。</p>;

  const notes = [
    { title: '学习建议', items: Object.values(stage.prerequisites).flat() },
    { title: '考试内容', items: stage.exam },
  ].filter(note => note.items.length > 0);

  return (
    <div className="app-shell guide-shell">
      <a href="#guide-main" className="skip-link">跳到科目指南</a>
      <Sidebar mode="guide" subject={stage.id} onSubject={id => change('stage', String(id))} />
      <main id="guide-main" className="workspace guide-workspace">
        <header className="guide-heading">
          <h1><GraduationCap size={21} />科目指南</h1>
          <span>{stage.title}</span>
          <ThemeToggle />
        </header>
        <nav className="guide-stages" aria-label="学习单元">
          {stages.map(item => (
            <button
              key={item.id}
              aria-pressed={item.id === stage.id}
              onClick={() => change('stage', String(item.id))}
            >
              <b>{item.title}</b>
              {item.short && <span>{item.short}</span>}
            </button>
          ))}
        </nav>
        <article className="guide-article" aria-label={`${stage.title}指南`}>
          <header className="guide-stage-heading">
            <div>
              <h2>{stage.title}{stage.short && ` · ${stage.short}`}</h2>
              <p>{stage.official}</p>
            </div>
            <BookOpen size={25} />
          </header>
          <dl className="guide-metrics" data-notes={true}>
            <div><dt>考试形式</dt><dd>{stage.format}</dd></div>
            {notes.map(note => (
              <div key={note.title}>
                <dt>{note.title}</dt>
                <dd>{note.items.join(' ')}</dd>
              </div>
            ))}
          </dl>
          <LessonReader key={stage.id} lessons={stage.learning} />
        </article>
      </main>
    </div>
  );
}
