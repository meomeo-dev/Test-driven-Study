import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search } from 'lucide-react';
import { request } from '../../api/client';
import { courseAsset } from '../../api/courses';
import type { CourseSummary, VocabularyEntry } from '../../api/generated/types.gen';
import { useWorkspace } from '../../app/workspace';
import { Modal } from '../../components/Modal';
import './vocabulary.css';

type Category = VocabularyEntry['category'];
type Scope = 'question' | 'unit' | 'course';

const categories: Record<Category, string> = {
  word: '单词',
  word_group: '词组',
  phrase: '短语',
  collocation: '固定搭配',
  idiom: '习语／惯用语',
  function_phrase: '介词／功能短语',
};

const scopes: Record<Scope, string> = {
  question: '本题',
  unit: '本单元',
  course: '全课程',
};

type ContentsProps = {
  source: string;
  units: CourseSummary['units'];
  unitId: string;
  questionId?: string;
};

function VocabularyContents({ source, units, unitId, questionId }: ContentsProps) {
  const vocabulary = useQuery({
    queryKey: ['course-vocabulary', source],
    queryFn: ({ signal }) => request<VocabularyEntry[]>(source, { signal }),
    staleTime: Infinity,
    retry: false,
  });
  const [scopeOverride, setScope] = useState<Scope>();
  const [category, setCategory] = useState<Category | ''>('');
  const [search, setSearch] = useState('');

  if (vocabulary.isPending) return <p role="status">正在读取词条…</p>;
  if (vocabulary.isError) {
    return (
      <div className="vocabulary-error">
        <p role="alert">无法读取生词本。</p>
        <button type="button" className="button outline"
          onClick={() => void vocabulary.refetch()}>重试</button>
      </div>
    );
  }

  const entries = vocabulary.data;
  const matchesQuestion = (entry: VocabularyEntry) =>
    entry.unit_id === unitId && questionId !== undefined
      && entry.question_ids?.includes(questionId);
  const scope = scopeOverride ?? (entries.some(matchesQuestion) ? 'question' : 'unit');
  const keyword = search.trim().toLowerCase();
  const results = entries.filter(entry => {
    if (scope === 'question' && !matchesQuestion(entry)) return false;
    if (scope === 'unit' && entry.unit_id !== unitId) return false;
    if (category && entry.category !== category) return false;
    return entry.term.toLowerCase().includes(keyword)
      || entry.meaning.toLowerCase().includes(keyword);
  });
  const unitNames = new Map(units.map(unit => [unit.id, unit.title]));

  return (
    <div className="vocabulary-content">
      <div className="vocabulary-scopes" role="group" aria-label="词条范围">
        {(Object.keys(scopes) as Scope[]).map(value => (
          <button key={value} type="button" className="button text"
            aria-pressed={scope === value} disabled={value === 'question' && !questionId}
            onClick={() => setScope(value)}>
            {scopes[value]}
          </button>
        ))}
      </div>
      <div className="vocabulary-filters">
        <label className="vocabulary-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">搜索词条</span>
          <input type="search" placeholder="搜索英文或中文释义" value={search}
            onChange={event => setSearch(event.currentTarget.value)} />
        </label>
        <label>
          <span className="sr-only">词条分类</span>
          <select value={category}
            onChange={event => setCategory(event.currentTarget.value as Category | '')}>
            <option value="">全部词类</option>
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="vocabulary-summary" role="status">
        {results.length > 0 ? `${results.length} 条词汇`
          : scope === 'question' && !entries.some(matchesQuestion)
            ? '本题暂无关联词条，可切换到本单元查看。'
            : '当前范围内没有匹配的词条。'}
      </p>
      {results.length > 0 && (
        <ul className="vocabulary-entries" aria-label="词条">
          {results.map(entry => (
            <li key={entry.id} className="vocabulary-entry">
              <div className="vocabulary-entry-heading">
                <h3 lang="en">{entry.term}</h3>
                <span className="vocabulary-category">{categories[entry.category]}</span>
                {scope === 'course' && (
                  <span className="vocabulary-unit">{unitNames.get(entry.unit_id)}</span>
                )}
              </div>
              <p>{entry.meaning}</p>
              {entry.example && (
                <div className="vocabulary-example">
                  <p lang="en">{entry.example}</p>
                  <p>{entry.example_translation}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotebookFromAsset(props: ContentsProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} type="button" className="button outline vocabulary-trigger"
        aria-label="生词本" title="生词本" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(true)}>
        <BookOpen size={16} aria-hidden="true" /><span>生词本</span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title="生词本" returnFocus={trigger} wide>
        {open && <VocabularyContents {...props} />}
      </Modal>
    </>
  );
}

export function VocabularyNotebook({ subject, questionId }: {
  subject: number;
  questionId?: string;
}) {
  const { course, unit, units } = useWorkspace(subject);
  if (!course?.vocabulary_file || !unit) return null;
  const source = courseAsset(course.id, course.version, course.vocabulary_file);
  return (
    <NotebookFromAsset key={source} source={source} units={units} unitId={unit.id}
      questionId={questionId} />
  );
}
