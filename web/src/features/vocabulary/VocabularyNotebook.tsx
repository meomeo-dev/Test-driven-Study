import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, X } from 'lucide-react';
import { request } from '../../api/client';
import { courseAsset } from '../../api/courses';
import type { CourseSummary, VocabularyEntry } from '../../api/generated/types.gen';
import { useWorkspace } from '../../app/workspace';
import { AudioControls } from '../../components/AudioControls';
import { Modal } from '../../components/Modal';
import {
  categories,
  filterVocabularyEntries,
  matchesQuestionEntry,
  posLabels,
  resolveExampleSpeech,
  resolveTermSpeech,
  scopes,
  type Category,
  type Scope,
} from './model';
import './vocabulary.css';

type ContentsProps = {
  source: string;
  units: CourseSummary['units'];
  unitId: string;
  questionId?: string;
};

function VocabularyEntryItem({
  entry,
  unitName,
  onTtsError,
}: {
  entry: VocabularyEntry;
  unitName?: string;
  onTtsError: (message?: string) => void;
}) {
  const termSpeech = resolveTermSpeech(entry);
  const exampleSpeech = resolveExampleSpeech(entry);
  return (
    <li className="vocabulary-entry">
      <div className="vocabulary-entry-heading">
        <span className="vocabulary-term-row">
          <h3 lang="en">{entry.term}</h3>
          {termSpeech && (
            <AudioControls text={termSpeech.text} voice={termSpeech.voice}
              speed={termSpeech.speed} allowRegenerate={false}
              targetLabel={`词条发音：${entry.term}`} onError={onTtsError} />
          )}
        </span>
        <span className="vocabulary-category">{categories[entry.category]}</span>
        {entry.pos && <span className="vocabulary-pos">{posLabels[entry.pos]}</span>}
        {unitName && <span className="vocabulary-unit">{unitName}</span>}
      </div>
      <p>{entry.meaning}</p>
      {entry.grammar_note && (
        <p className="vocabulary-grammar-note">{entry.grammar_note}</p>
      )}
      {entry.example && (
        <div className="vocabulary-example">
          <div className="vocabulary-example-line">
            <p lang="en">{entry.example}</p>
            {exampleSpeech && (
              <AudioControls text={exampleSpeech.text} voice={exampleSpeech.voice}
                speed={exampleSpeech.speed} allowRegenerate={false}
                targetLabel={`例句发音：${entry.term}`} onError={onTtsError} />
            )}
          </div>
          <p>{entry.example_translation}</p>
        </div>
      )}
    </li>
  );
}

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
  const [ttsError, setTtsError] = useState<string>();

  if (vocabulary.isPending) return <p role="status">正在读取词条…</p>;
  if (vocabulary.isError) {
    return (
      <div className="vocabulary-error">
        <p role="alert">无法读取生词本。</p>
        <button type="button" className="button outline"
          onClick={() => { setTtsError(undefined); void vocabulary.refetch(); }}>重试</button>
      </div>
    );
  }

  const entries = vocabulary.data;
  const hasQuestionEntries = entries.some(entry =>
    matchesQuestionEntry(entry, unitId, questionId));
  const scope = scopeOverride ?? (hasQuestionEntries ? 'question' : 'unit');
  const results = filterVocabularyEntries(entries, {
    scope, unitId, questionId, category, search,
  });
  const unitNames = new Map(units.map(unit => [unit.id, unit.title]));

  return (
    <div className="vocabulary-content">
      <div className="vocabulary-scopes" role="group" aria-label="词条范围">
        {(Object.keys(scopes) as Scope[]).map(value => (
          <button key={value} type="button" className="button text"
            aria-pressed={scope === value} disabled={value === 'question' && !questionId}
            onClick={() => { setScope(value); setTtsError(undefined); }}>
            {scopes[value]}
          </button>
        ))}
      </div>
      <div className="vocabulary-filters">
        <label className="vocabulary-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">搜索词条</span>
          <input type="search" placeholder="搜索英文或中文释义" value={search}
            onChange={e => { setSearch(e.currentTarget.value); setTtsError(undefined); }} />
        </label>
        <label>
          <span className="sr-only">词条分类</span>
          <select value={category} onChange={e => {
            setCategory(e.currentTarget.value as Category | '');
            setTtsError(undefined);
          }}>
            <option value="">全部词类</option>
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {ttsError && (
        <div className="vocabulary-tts-error" role="alert">
          <span>{ttsError}</span>
          <button type="button" className="icon-button" aria-label="关闭语音提示"
            onClick={() => setTtsError(undefined)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="vocabulary-summary" role="status">
        {results.length > 0 ? `${results.length} 条词汇`
          : scope === 'question' && !hasQuestionEntries
            ? '本题暂无关联词条，可切换到本单元查看。'
            : '当前范围内没有匹配的词条。'}
      </p>
      {results.length > 0 && (
        <ul className="vocabulary-entries" aria-label="词条">
          {results.map(entry => (
            <VocabularyEntryItem key={entry.id} entry={entry}
              unitName={scope === 'course' ? unitNames.get(entry.unit_id) : undefined}
              onTtsError={setTtsError} />
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
