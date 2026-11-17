import { useWorkspace } from '../../app/workspace';
import { useState } from 'react';
import { Link } from 'react-router';
import type { ExamRule, ExamSummary } from '../../api/exams';
import { ExamRulesDialog } from './ExamRulesDialog';
import { TerminalModal } from './TerminalModal';

export function ExamLobby({ rule, history, busy, error, onStart, onRestart, onSelect, onSubject }: {
  rule: ExamRule; history: ExamSummary[]; busy: boolean; error?: string;
  onStart: () => void; onSelect: (value: ExamSummary) => void;
  onRestart: (previous: ExamSummary) => void;
  onSubject: (subject: number) => void;
}) {
  const [dialog, setDialog] = useState<'rules' | 'history' | 'restart' | null>(null);
  const [restartTarget, setRestartTarget] = useState<ExamSummary | null>(null);
  const workspace = useWorkspace(rule.subject_id);
  const active = history.find(row => row.status === 'in_progress');
  const completed = history.filter(row => row.status === 'finished');
  return <section className="terminal-setup" aria-label="考前准备">
    <header className="terminal-banner"><h1>{workspace.unit?.title ?? '课程'}模拟考试系统</h1>
      <small>{workspace.course?.title ?? '课程学习'} · 本地模拟训练</small></header>
    <div className="terminal-preparation">
      <section className="terminal-exam-notes"><h2>考试须知：</h2>
        <ol><li>遵守考场纪律，服从监考人员指挥。</li><li>进入考场，手机关机。禁止抽烟，禁止吃零食。</li>
          <li>未经工作人员允许，考生禁止随意出入考场。</li><li>考场内禁止大声喧哗，禁止随意走动。</li>
          <li>考试中认真答题，不准交头接耳。</li><li>考试中不准冒名顶替，不准弄虚作假。</li>
          <li>注意考场卫生，禁止随地吐痰、乱扔纸屑。</li><li>爱护公物及考试设备。</li></ol>
      </section>
      <section className="terminal-start-panel"><h2>理论模拟考试 01 号考台：</h2>
        <p className="terminal-candidate-line">考生姓名：本地考生</p>
        <div className="terminal-subjects" aria-label="考试科目">{workspace.units.filter(unit => unit.has_practice).map(({subject_id: subject, title}) =>
          <button className="terminal-button" key={subject} aria-pressed={rule.subject_id === subject}
            disabled={busy} onClick={() => onSubject(subject)}>{title}</button>)}</div>
        <p>{rule.count} 题 · {rule.minutes} 分钟 · 满分 {rule.count * rule.points} 分 · {rule.pass_score} 分合格</p>
        <div className="terminal-start-actions">
          <button className="terminal-start" disabled={busy} onClick={() => active ? onSelect(active) : onStart()}>
            {busy ? '正在组卷…' : active ? '继续考试' : '开始考试'}</button>
          {active && <button className="terminal-button terminal-restart" disabled={busy} onClick={() => {
            setRestartTarget(active); setDialog('restart');
          }}>重新开始</button>}
        </div>
        <p className="terminal-start-warning">{active ? '继续使用原试卷、已保存答案与原截止时间。'
          : rule.blueprint?.types.map(q => `${q.name} ${q.count} 题`).join(' · ')}</p>
        <p>操作提示：选好答案后，点击【下一题】保存并判分；答错会显示正确答案，
          已判分的答案不可修改。可以返回漏答题。交卷前请核对未答数量。</p>
        <p>开始后持续计时，刷新或离开页面不会暂停。到时自动交卷。</p>
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
    <footer className="terminal-setup-footer"><Link to={`/practice?subject=${rule.subject_id}`}>返回学习</Link>
      <button onClick={() => setDialog('rules')}>规则与操作说明</button>
      <button onClick={() => setDialog('history')}>考试记录（{completed.length}）</button>
      <span>本地模拟</span></footer>
    {dialog && <TerminalModal title={dialog === 'rules' ? '规则与操作说明' : dialog === 'restart' ? '重新开始考试' : '考试记录'}
      onClose={() => setDialog(null)} wide={dialog !== 'restart'}>
      <div className="terminal-modal-body">{dialog === 'rules' ? <ExamRulesDialog rule={rule}/>
        : dialog === 'restart' ? <><p>重新开始将结束当前考试，保留原试卷、已保存答案和成绩记录。
          未答题按 0 分计，已保存答案仍会计入学习分析。</p>
          <p>随后重新抽题，并从 {rule.minutes} 分钟开始计时。确定重新开始吗？</p></>
        : <div className="terminal-history">{completed.length ? completed.map(row =>
          <button key={row.id} onClick={() => onSelect(row)}><span>{new Date(row.started_at_ms).toLocaleString()}</span>
            <strong>{row.score} 分</strong><span>{row.answered} / {row.total} 已答 · 查看复盘</span></button>)
          : <p>尚无已交卷记录。</p>}</div>}</div>
      <div className="terminal-modal-actions">{dialog === 'restart' ? <>
        <button className="terminal-button" disabled={busy} onClick={() => {
          if (restartTarget) onRestart(restartTarget);
          setDialog(null);
        }}>确认重新开始</button>
        <button className="terminal-button" disabled={busy} onClick={() => setDialog(null)}>取消</button>
      </> : <button className="terminal-button" onClick={() => setDialog(null)}>关闭</button>}</div>
    </TerminalModal>}
  </section>;
}
