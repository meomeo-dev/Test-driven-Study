import { useWorkspace } from '../../app/workspace';
import { UserRound } from 'lucide-react';
import { clockText } from './terminalLabels';

export function TerminalCandidate({ subject, seconds, finished }: {
  subject: number; seconds: number; finished: boolean;
}) {
  const workspace = useWorkspace(subject);
  return <aside className="terminal-candidate" aria-label="考生信息与时间">
    <fieldset className="terminal-station"><legend>{workspace.course?.title ?? '课程学习'}</legend>第 01 考台</fieldset>
    <fieldset className="terminal-identity"><legend>考生信息</legend>
      <div className="terminal-avatar" aria-hidden="true"><UserRound/></div>
      <dl><div><dt>姓名：</dt><dd>本地考生</dd></div><div><dt>类型：</dt><dd>课程模拟</dd></div>
        <div><dt>科目：</dt><dd>{workspace.unit?.title ?? '课程'}</dd></div></dl>
    </fieldset>
    <fieldset className="terminal-clock"><legend>{finished ? '考试已结束' : '剩余时间'}</legend>
      <time aria-label="考试剩余时间" data-warning={!finished && seconds <= 300}>{clockText(seconds)}</time>
    </fieldset>
  </aside>;
}
