import type { RefObject } from 'react';
import type { Detail } from '../../api/client';
import { useWorkspace } from '../../app/workspace';
import { ExplanationAudio } from '../../components/AudioControls';
import { Modal } from '../../components/Modal';
import { RichContent } from '../../components/RichContent';
import { Tabs } from '../../components/Tabs';
import { hasRichContent } from '../question-types/model';
import {
  QuestionExtendedExplanations,
  QuestionStimulus,
  QuestionWritingCriteria,
  QuestionWritingSample,
} from '../question-types/QuestionStimulus';
import { questionType, stateLabel } from './model';
import { AnswerOptions } from './QuestionCard';
import { QuestionImage } from './QuestionImage';

export type DetailsTab = 'question' | 'analysis' | 'metadata';
const tabs = [
  { id: 'question', label: '完整原题' },
  { id: 'analysis', label: '完整解析' },
  { id: 'metadata', label: '题目信息' },
];
type Props = {
  detail?: Detail;
  tab: DetailsTab | null;
  onTab: (tab: DetailsTab | null) => void;
  returnFocus: RefObject<HTMLElement | null>;
};

export function QuestionMetadata({ detail }: { detail: Detail }) {
  const q = detail.question;
  const { course, unit } = useWorkspace(q.subject_id);
  const entries = [
    ['原题号', `#${q.source_item_id ?? q.question_id}`],
    ['科目', unit?.title],
    ['题型', questionType(q.question_type)],
    ['难度', `${q.difficulty}/5`],
    ['章节', q.chapter_name],
    ['子章节', q.sub_chapter_name],
    ['课程', q.course_name || course?.title],
    ['背题标记', stateLabel(detail.state)],
  ];
  return (
    <dl className="question-metadata">
      {entries
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function FullExplanation({ detail }: { detail: Detail }) {
  const hasAnalysis =
    hasRichContent(detail.question.analysis_content) || Boolean(detail.question.analysis);
  return (
    <section className="full-explanation" aria-label="完整答案解析">
      <h3>答案解析</h3>
      <QuestionWritingSample question={detail.question} />
      {(hasAnalysis || Boolean(detail.question.analysis_audio?.length)) && (
        <p>
          <RichContent content={detail.question.analysis_content ?? detail.question.analysis} />
          <ExplanationAudio segments={detail.question.analysis_audio} />
        </p>
      )}
      <QuestionExtendedExplanations question={detail.question} />
      <QuestionWritingCriteria question={detail.question} />
      {detail.question.skill && (
        <>
          <h3>记忆提示</h3>
          <p>{detail.question.skill}</p>
        </>
      )}
    </section>
  );
}

export function StudyDetails({ detail, tab, onTab, returnFocus }: Props) {
  if (!detail) return null;
  return (
    <Modal
      open={tab !== null}
      onOpenChange={open => {
        if (!open) onTab(null);
      }}
      title="题目详情"
      returnFocus={returnFocus}
      wide
    >
      <Tabs
        prefix="details"
        label="题目详情内容"
        items={tabs}
        value={tab ?? 'question'}
        onChange={value => onTab(value as DetailsTab)}
      />
      <section
        role="tabpanel"
        tabIndex={0}
        id={`details-panel-${tab ?? 'question'}`}
        aria-labelledby={`details-tab-${tab ?? 'question'}`}
      >
        {tab === 'question' && (
          <div className="full-question">
            <h3 className="question-text">
              <RichContent content={detail.question.rich_content ?? detail.question.title} />
            </h3>
            <QuestionStimulus question={detail.question} />
            <QuestionImage key={`image-${detail.question.question_id}`} detail={detail} />
            <AnswerOptions question={detail.question} mode="full" />
          </div>
        )}
        {tab === 'analysis' && <FullExplanation detail={detail} />}
        {tab === 'metadata' && <QuestionMetadata detail={detail} />}
      </section>
    </Modal>
  );
}
