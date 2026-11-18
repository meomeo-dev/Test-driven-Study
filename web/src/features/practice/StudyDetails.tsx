import { ClozePassage } from '../question-types/ClozeContent';
import { ExtendedExplanations } from '../question-types/ExtendedExplanations';
import { ReadingPassage } from '../question-types/ReadingContent';
import { TranslationSource } from '../question-types/TranslationContent';
import { WritingCriteria, WritingRequirements, WritingSample } from
  '../question-types/WritingContent';
import { clozeQuestionType, hasRichContent, readingQuestionType } from '../question-types/model';
import { QuestionAudio } from '../../components/QuestionAudio';
import { ExplanationAudio } from '../../components/AudioControls';
import { RichContent } from '../../components/RichContent';
import type { RefObject } from 'react';
import { useWorkspace } from '../../app/workspace';
import { Modal } from '../../components/Modal';
import { Tabs } from '../../components/Tabs';
import type { Detail } from '../../api/client';
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
  const entries = [['原题号', `#${q.source_item_id ?? q.question_id}`], ['科目', unit?.title],
    ['题型', questionType(q.question_type)], ['难度', `${q.difficulty}/5`], ['章节', q.chapter_name],
    ['子章节', q.sub_chapter_name], ['课程', q.course_name || course?.title], ['背题标记', stateLabel(detail.state)]];
  return <dl className="question-metadata">{entries.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function FullExplanation({ detail }: { detail: Detail }) {
  const hasAnalysis = hasRichContent(detail.question.analysis_content) ||
    Boolean(detail.question.analysis);
  return <section className="full-explanation" aria-label="完整答案解析"><h3>答案解析</h3>
    <WritingSample review={detail.question.question_review} />
    {(hasAnalysis || Boolean(detail.question.analysis_audio?.length)) && (
      <p><RichContent content={detail.question.analysis_content ?? detail.question.analysis} />
        <ExplanationAudio segments={detail.question.analysis_audio} /></p>
    )}
    <ExtendedExplanations review={detail.question.question_review} />
    <WritingCriteria review={detail.question.question_review} />
    {detail.question.skill && <><h3>记忆提示</h3><p>{detail.question.skill}</p></>}
  </section>;
}

export function StudyDetails({ detail, tab, onTab, returnFocus }: Props) {
  if (!detail) return null;
  return <Modal open={tab !== null} onOpenChange={open => { if (!open) onTab(null); }}
    title="题目详情" returnFocus={returnFocus} wide>
    <Tabs prefix="details" label="题目详情内容" items={tabs} value={tab ?? 'question'} onChange={value => onTab(value as DetailsTab)} />
    <section role="tabpanel" tabIndex={0} id={`details-panel-${tab ?? 'question'}`}
      aria-labelledby={`details-tab-${tab ?? 'question'}`}>
      {tab === 'question' && <div className="full-question"><h3 className="question-text">
        <RichContent content={detail.question.rich_content ?? detail.question.title} />
      </h3>
        {detail.question.question_type === clozeQuestionType &&
          <ClozePassage passage={detail.question.content?.passage} review={detail.question.question_review} />}
        {detail.question.question_type === readingQuestionType &&
          <ReadingPassage passage={detail.question.content?.passage} />}
        <WritingRequirements content={detail.question.content} />
        <TranslationSource content={detail.question.content} />
        <QuestionAudio key={`audio-${detail.question.question_id}`} question={detail.question} />
        <QuestionImage key={`image-${detail.question.question_id}`} detail={detail} /><AnswerOptions question={detail.question} mode="full" /></div>}
      {tab === 'analysis' && <FullExplanation detail={detail} />}
      {tab === 'metadata' && <QuestionMetadata detail={detail} />}
    </section>
  </Modal>;
}
