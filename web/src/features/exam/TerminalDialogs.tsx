import { Link } from 'react-router';
import type { ExamItem, ExamSession } from '../../api/exams';
import { ExplanationAudio } from '../../components/AudioControls';
import { RichContent } from '../../components/RichContent';
import { ExtendedReview } from '../question-types/ExtendedReview';
import { hasRichContent } from '../question-types/model';
import { questionHasReviewExplanation } from '../question-types/QuestionStimulus';
import { assertNever } from '../question-types/registry';
import { WritingCriteria, WritingReview, WritingSample } from '../question-types/WritingContent';
import { ExamNavigation } from './ExamNavigation';
import { answerSymbols, examCounts } from './terminalLabels';
import { TerminalModal } from './TerminalModal';
import type { TerminalDialog } from './useExamTerminal';

export function ReviewAnalysis({
  review,
  allowFallback = true,
}: {
  review: NonNullable<ExamItem['review']>;
  allowFallback?: boolean;
}) {
  const hasAnalysis = hasRichContent(review.analysis_content) || Boolean(review.analysis);
  const hasAudio = Boolean(review.analysis_audio?.length);
  const showFallback =
    allowFallback && !hasAnalysis && !hasAudio && !questionHasReviewExplanation(review);
  if (!hasAnalysis && !hasAudio && !showFallback) return null;
  return (
    <p>
      <RichContent
        content={hasAnalysis ? review.analysis_content ?? review.analysis : '原题暂无解析。'}
      />
      <ExplanationAudio segments={review.analysis_audio} />
    </p>
  );
}

function DialogReviewContent({
  item,
  review,
}: {
  item: ExamItem;
  review: NonNullable<ExamItem['review']>;
}) {
  switch (review.question_type) {
    case 'writing':
      return (
        <>
          <WritingReview response={item.response} credit={item.credit} />
          <WritingSample review={review.question_review} />
          <ReviewAnalysis review={review} />
          <WritingCriteria review={review.question_review} />
        </>
      );
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'translation':
      return (
        <>
          {review.question_review && (
            <ExtendedReview
              item={review.question_review}
              response={item.response}
              credit={item.credit}
            />
          )}
          <ReviewAnalysis review={review} />
        </>
      );
    case 'numeric':
      return (
        <>
          <p>正确答案：{review.answer}</p>
          <ReviewAnalysis review={review} />
        </>
      );
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return (
        <>
          <p>
            正确答案：
            {answerSymbols(item.detail.question, review.answer.split(',').map(Number))}
          </p>
          <ReviewAnalysis review={review} />
        </>
      );
    default:
      return assertNever(review);
  }
}

export function TerminalDialogs({
  dialog,
  session,
  item,
  selected,
  busy,
  enabled,
  onClose,
  onSubmit,
  onMove,
  onPreference,
  onBack,
}: {
  dialog: TerminalDialog;
  session: ExamSession;
  item: ExamItem;
  selected: number[];
  busy: boolean;
  enabled: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onMove: (index: number) => void;
  onPreference: (enabled: boolean) => void;
  onBack: () => void;
}) {
  if (!dialog) return null;
  const counts = examCounts(session);
  const title = {
    submit: '考试确认窗口',
    result: '信息提示',
    help: '考试快捷键',
    navigation: '考试答题卡',
    review: '答案解析',
  }[dialog];
  return (
    <TerminalModal title={title} onClose={onClose} wide={dialog === 'navigation'}>
      <div className="terminal-modal-body">
        {dialog === 'submit' && (
          <>
            <p>操作提示：</p>
            <p>
              你当前考试答对 {counts.correct} 题，答错 {counts.incorrect} 题，未答{' '}
              {counts.unanswered} 题
            </p>
            <p>1、点击【确认交卷】，将提交考试成绩，考试结束！</p>
            <p>2、点击【继续考试】，将关闭本窗口，继续考试！</p>
          </>
        )}
        {dialog === 'result' && (
          <>
            <p>本地考生：</p>
            <p className="terminal-score">
              您本次模拟考试得分 {session.score} 分。
              {(session.score ?? 0) >= session.rule.pass_score ? '合格！' : '不合格。'}
            </p>
            <p>
              {session.reason === 'expired'
                ? '考试时间结束，已自动交卷。'
                : session.reason === 'failed_limit'
                  ? '错题扣分已超过合格上限，考试结束。'
                  : '考试已结束。'}
            </p>
            <p>
              答对 {counts.correct} 题，答错 {counts.incorrect} 题，未答 {counts.unanswered} 题。
            </p>
          </>
        )}
        {dialog === 'navigation' && (
          <ExamNavigation
            session={session}
            index={session.current_index}
            selected={selected}
            busy={busy}
            onSelect={onMove}
          />
        )}
        {dialog === 'help' && (
          <>
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => onPreference(e.target.checked)}
              />
              启用字符快捷键
            </label>
            <p>数字键 1–4 选择；判断题 1 为 √、2 为 ×。多选题按数字键切换。</p>
            <p>Enter 或 →：保存所选答案并下一题；←：保存并上一题；j/k：下一题／上一题。</p>
            <p>n：答题卡；?：帮助。输入框、组合输入和弹窗内不触发全局快捷键。</p>
          </>
        )}
        {dialog === 'review' && item.review && (
          <>
            <DialogReviewContent item={item} review={item.review} />
            {item.review.skill && <p>{item.review.skill}</p>}
            <Link to={`/practice?subject=${session.subject_id}&question=${item.review.question_id}`}>
              到答题模式练习
            </Link>
          </>
        )}
      </div>
      <div className="terminal-modal-actions">
        {dialog === 'submit' ? (
          <>
            <button className="terminal-button" disabled={busy} onClick={onSubmit}>
              确认交卷
            </button>
            <button className="terminal-button" disabled={busy} onClick={onClose}>
              继续考试
            </button>
          </>
        ) : (
          <>
            <button className="terminal-button" onClick={onClose}>
              关闭
            </button>
            {dialog === 'result' && (
              <button className="terminal-button" onClick={onBack}>
                返回考试记录
              </button>
            )}
          </>
        )}
      </div>
    </TerminalModal>
  );
}
