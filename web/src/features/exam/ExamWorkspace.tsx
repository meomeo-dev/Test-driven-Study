import { useEffect } from 'react';
import { useShortcutPreference } from '../practice/useStudyShortcuts';
import { QUESTION_TYPE_REGISTRY } from '../question-types/registry';
import { ExamNavigation } from './ExamNavigation';
import { ExamQuestion } from './ExamQuestion';
import { TerminalCandidate } from './TerminalCandidate';
import { TerminalDialogs } from './TerminalDialogs';
import { TerminalFeedback } from './TerminalFeedback';
import { TerminalImage } from './TerminalImage';
import { judgmentOptionAt, questionType } from './terminalLabels';
import { useExamTerminal } from './useExamTerminal';
import { useTerminalKeys } from './useTerminalKeys';

export function ExamWorkspace({
  id,
  onBack,
  onSubject,
}: {
  id: string;
  onBack: (subject?: number) => void;
  onSubject: (subject: number) => void;
}) {
  const terminal = useExamTerminal(id);
  const {
    query,
    action,
    session,
    item,
    index,
    selected,
    finished,
    remaining,
    busy,
    dialog,
    setDialog,
    feedback,
    closeFeedback,
    choose,
    numeric,
    onNumeric,
    draft,
    onDraft,
    navigate,
    next,
    submit,
  } = terminal;
  const shortcuts = useShortcutPreference();
  useEffect(() => {
    if (session) onSubject(session.subject_id);
  }, [session?.subject_id, onSubject]);
  useTerminalKeys({
    enabled: shortcuts.enabled,
    choose: position => {
      if (!item) return;
      const option = judgmentOptionAt(item.detail.question, position);
      if (option) choose(option.sign);
    },
    next,
    previous: () => {
      void navigate(index - 1);
    },
    help: () => setDialog('help'),
    card: () => setDialog('navigation'),
  });
  if (!session || !item) {
    return (
      <div className="terminal-state" role={query.error ? 'alert' : 'status'}>
        <p>{query.error?.message ?? '读取试卷…'}</p>
        <button className="terminal-button" onClick={() => void query.refetch()}>
          重新读取
        </button>
        <button className="terminal-button" onClick={() => onBack()}>
          返回考前准备
        </button>
      </div>
    );
  }
  const seconds = remaining ?? session.rule.minutes * 60;
  const q = item.detail.question;
  return (
    <section className="terminal-paper" aria-label="模拟考试终端">
      <div className="terminal-upper">
        <TerminalCandidate subject={session.subject_id} seconds={seconds} finished={finished} />
        <ExamQuestion
          key={`${id}-${index}`}
          examID={id}
          item={item}
          draft={draft}
          onDraft={onDraft}
          index={index}
          selected={selected}
          busy={busy}
          finished={finished}
          onChoose={choose}
          numeric={numeric}
          onNumeric={onNumeric}
        />
        <div className="terminal-table-region">
          <ExamNavigation
            session={session}
            index={index}
            selected={selected}
            onSelect={target => void navigate(target)}
            busy={busy}
          />
        </div>
      </div>
      <div className="terminal-operations">
        <div className="terminal-prompt">
          <strong>操作提示：{questionType(q)}</strong>
          <p>
            {finished
              ? '考试已结束，可查看作答记录。'
              : QUESTION_TYPE_REGISTRY[q.question_type].examPrompt}
          </p>
        </div>
        <div className="terminal-primary-actions">
          <button
            className="terminal-button"
            disabled={index === 0 || busy}
            onClick={() => void navigate(index - 1)}
          >
            上一题
          </button>
          <button
            className="terminal-button terminal-next"
            disabled={busy || index === session.items.length - 1}
            onClick={next}
            aria-keyshortcuts="Enter ArrowRight"
          >
            下一题
          </button>
          <button
            className="terminal-button"
            disabled={busy}
            onClick={() => {
              if (finished) setDialog('result');
              else void navigate(index, true);
            }}
          >
            {finished ? '查看成绩' : '交卷'}
          </button>
        </div>
      </div>
      <div className="terminal-picture" aria-label="题目配图">
        <TerminalImage key={q.question_id} item={item} />
      </div>
      <footer className="terminal-footer">
        <span className="terminal-position">
          第 {index + 1} / {session.items.length} 题 · {item.answered ? '已作答' : '未作答'}
        </span>
        <span role={action.error || query.error ? 'alert' : 'status'}>
          {action.error?.message ||
            query.error?.message ||
            (!finished && seconds <= 300
              ? '剩余不足5分钟，到时自动交卷。'
              : session.subject_id <= 4
                ? '本地模拟 · C1/C2'
                : '本地模拟')}
        </span>
        {(action.error || query.error) && (
          <button onClick={() => void query.refetch()}>重新同步</button>
        )}
        <button className="terminal-card-trigger" onClick={() => setDialog('navigation')}>
          答题卡
        </button>
        <button onClick={() => setDialog('help')}>快捷键</button>
        {finished && <button onClick={() => setDialog('review')}>查看解析</button>}
        <button onClick={() => onBack(session.subject_id)}>
          {finished ? '返回考试记录' : '离开（继续计时）'}
        </button>
      </footer>
      {feedback && (
        <TerminalFeedback
          item={feedback}
          position={
            session.items.findIndex(
              row => row.detail.question.question_id === feedback.detail.question.question_id,
            ) + 1
          }
          onClose={closeFeedback}
        />
      )}
      {!feedback && (
        <TerminalDialogs
          dialog={dialog}
          session={session}
          item={item}
          selected={selected}
          busy={busy}
          enabled={shortcuts.enabled}
          onClose={() => setDialog(null)}
          onSubmit={() => void submit()}
          onMove={target => void navigate(target)}
          onPreference={shortcuts.change}
          onBack={() => onBack(session.subject_id)}
        />
      )}
    </section>
  );
}
