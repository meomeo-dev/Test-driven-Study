import { readSubject } from '../../app/workspace';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Info, RefreshCw } from 'lucide-react';
import * as api from '../../api/practice';
import { Sidebar } from '../../components/Sidebar';
import { Modal } from '../../components/Modal';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Tabs } from '../../components/Tabs';
import { ReviewBookPanel } from './ReviewBookPanel';
import { AnalysisMetrics, ChapterDistribution, DailyTrend, RateLine } from './AnalysisPanels';
import { attemptSummary } from './model';

const tabs = [{ id: 'overview', label: '学习概览' }, { id: 'review', label: '错题本' }];

const localTime = (stamp: number) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
}).format(stamp);

export function AnalysisPage() {
  const [params, setParams] = useSearchParams();
  const subject = readSubject(params);
  const tab = params.get('tab') === 'review' ? 'review' : 'overview';
  const raw = Number(params.get('days') ?? 30);
  const days = [0, 7, 30, 90].includes(raw) ? raw : 30;
  const query = useQuery({ queryKey: ['analysis', subject, days],
    queryFn: ({ signal }) => api.analysis(subject, days, signal), enabled: tab === 'overview' });
  const [dialog, setDialog] = useState<'history' | 'method' | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const data = query.data;
  function open(value: 'history' | 'method', trigger: HTMLElement) {
    returnFocus.current = trigger; setDialog(value);
  }
  return <div className="app-shell analysis-shell">
    <Sidebar mode="analysis" subject={subject} onSubject={value => setParams({ subject: String(value), days: String(days), tab })} />
    <main className="workspace analysis-workspace">
      <header className="analysis-toolbar"><h1>学习分析</h1>
        <ThemeToggle />
        {tab === 'overview' && <><select aria-label="统计时间窗口" value={days}
          onChange={event => setParams({ subject: String(subject), days: event.target.value })}>
          <option value="7">最近 7 天</option><option value="30">最近 30 天</option>
          <option value="90">最近 90 天</option><option value="0">全部记录</option>
        </select>
        <button className="button text" onClick={() => { void query.refetch(); }} aria-label="刷新分析"><RefreshCw size={16} /></button>
        <button className="button outline" onClick={event => open('history', event.currentTarget)}><Clock3 size={15} />答题记录</button>
        <button className="button text" onClick={event => open('method', event.currentTarget)} aria-label="计算说明"><Info size={17} /></button></>}
      </header>
      <Tabs prefix="analysis" label="学习分析内容" items={tabs} value={tab}
        onChange={value => setParams({ subject: String(subject), days: String(days), tab: value })} />
      <div className="analysis-tab-panel" role="tabpanel" id={`analysis-panel-${tab}`}
        aria-labelledby={`analysis-tab-${tab}`} tabIndex={0}>
      {tab === 'review' ? <ReviewBookPanel key={subject} subject={subject} />
        : query.error ? <div className="page-state" role="alert">{query.error.message}</div>
        : !data ? <div className="page-state" role="status">正在统计学习记录…</div>
        : <><AnalysisMetrics data={data} />
          <div className="analysis-main-grid">
            <div className="analysis-left"><DailyTrend data={data} /><ChapterDistribution data={data} /></div>
            <div className="analysis-right">
              <section className="analysis-panel advice-panel" aria-label="提分建议">
                <header><h2>提分建议</h2><span>基于实际答题记录</span></header>
                <ul>{data.advice.map(advice => <li key={advice}>{advice}</li>)}</ul>
                <p className="analysis-muted">从错到对：{data.improved_questions} 题</p>
              </section>
              <section className="analysis-panel rate-panel" aria-label="学习效果">
                <header><h2>学习效果</h2></header>
                <RateLine label="窗口内首次作答" rate={data.first} />
                <RateLine label="窗口内重复练习" rate={data.repeat} />
                <RateLine label="最近 7 天" rate={data.comparison.current} />
                <RateLine label="前一个 7 天" rate={data.comparison.previous} />
                <p className="analysis-muted">{data.comparison.change_pp === null ? '两个时段均达到 5 次作答后显示变化。'
                  : `变化 ${data.comparison.change_pp >= 0 ? '+' : ''}${data.comparison.change_pp.toFixed(1)} 个百分点；题目构成可能不同。`}</p>
                <p className="analysis-muted">已见题作答 {data.prior_exposure_attempts} 次；
                  {data.last_attempt_ms === null ? '尚无作答记录' : `最近作答 ${localTime(data.last_attempt_ms)}`}</p>
              </section>
            </div>
          </div>
          <p className="analysis-footnote">预估分数基于题库章节比例与近期练习表现，未经真实考试或模拟考校准；不表示通过概率。</p>
        </>}
      </div>
      <Modal title={dialog === 'history' ? '答题记录' : '计算说明'} open={dialog !== null}
        onOpenChange={value => { if (!value) setDialog(null); }} returnFocus={returnFocus} wide>
        {dialog === 'history' ? <><p className="dialog-note">当前科目和时间窗口内最近 20 次提交；重复练习保留原记录。时间使用本地时区。</p>
          {!data?.recent_attempts.length ? <p>当前时间窗口没有答题记录。</p>
            : <div className="history-records">{data.recent_attempts.map(attempt => <article key={attempt.id}>
              <header><b className={attempt.correct ? 'correct' : 'incorrect'}>{attempt.correct ? '正确' : '错误'}</b>
                <span>#{attempt.question_id} · {localTime(attempt.answered_at_ms)}</span></header>
              <p>{attempt.question_title}</p><small>{attemptSummary(attempt)}
                {' · '}{attempt.first_attempt ? '首次作答' : '重复练习'}{attempt.prior_exposure ? ' · 此前已见题' : ''}</small>
            </article>)}</div>}</>
          : <div className="analysis-method">
            <p>只统计服务器保存的答题提交。背题浏览和手动标记不计分；数字键选择尚未提交也不计分。</p>
            <p>时间窗口是截至服务器当前时刻的滚动 7 / 30 / 90 天，或全部记录。日趋势按 UTC 日期归组。</p>
            <p>近期正确率仅使用窗口内每道题最新的一次作答。权重为 2 的「负题龄天数 / 14」次方。
              14 天半衰期是产品默认值，不是经过验证的遗忘规律；没有新答题时不会自动推断知识下降。</p>
            <p>章节错误率 = 错误提交次数 / 总提交次数；最近仍错题数按不同题目的最新一次结果计算。
              首次与重复分开，保留历史错误，后来答对不会删除旧记录。</p>
            <p>预估分数至少需要 20 道不同题，且每个题库章节都有记录。它按章节题量比例加权近期正确率，
              估计的是当前题库表现，不是正式考试分数；选择性刷题、见过答案和低覆盖率都会影响代表性。</p>
            <p>历史背题浏览未完整记录，首次作答不等于首次见题。新浏览会记录已见题上下文。
              建议是基于记录的规则分析，不是已验证的心理测量模型。</p>
          </div>}
      </Modal>
    </main>
  </div>;
}
