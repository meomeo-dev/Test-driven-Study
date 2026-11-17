import { Link } from 'react-router';
import type { Analysis, Rate } from '../../api/practice';

export const percentage = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;
export function RateLine({ label, rate }: { label: string; rate: Rate }) {
  return <div className="analysis-rate-line"><span>{label}</span><b>{percentage(rate.accuracy)}</b>
    <small>{rate.correct} / {rate.attempts} 次</small></div>;
}

export function AnalysisMetrics({ data }: { data: Analysis }) {
  const cards = [
    { label: '窗口内作答', value: String(data.overall.attempts), note: `答对 ${data.overall.correct} 次 · 最新仍错 ${data.latest_incorrect} 题` },
    { label: '每题最新 · 近期正确率', value: percentage(data.recent_accuracy), note: `${data.unique_questions} 道不同题 · 按时间加权` },
    { label: '题库覆盖', value: `${data.coverage.toFixed(1)}%`, note: `${data.unique_questions} / ${data.total_questions} 题` },
    { label: '题库预估分数', value: data.forecast.score === null ? '样本不足' : `${data.forecast.score.toFixed(0)} / 100`,
      note: data.forecast.score === null ? `至少 ${data.forecast.minimum_questions} 道题；${data.forecast.missing_chapters} 章无记录`
        : `${data.forecast.sample_questions} 题 · 覆盖 ${data.coverage.toFixed(1)}% · 未校准` },
  ];
  return <section className="analysis-metrics" aria-label="学习指标">
    {cards.map(card => <article className="analysis-metric" key={card.label}>
      <span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small>
    </article>)}
  </section>;
}

export function DailyTrend({ data }: { data: Analysis }) {
  return <section className="analysis-panel trend-panel" aria-label="每日答题趋势">
    <header><h2>每日正确率</h2><span>最近 {data.trend_days} 天 · UTC 日界</span></header>
    <div className="trend-bars" role="img" aria-label="每日作答正确率，空白表示无记录">
      {data.trend.map(day => <div className="trend-day" key={day.day}
        title={`${day.day} UTC：${day.correct} / ${day.attempts} 次答对`}>
        <div className={`trend-bar ${day.attempts ? '' : 'empty'}`}
          style={{ height: `${day.attempts ? Math.max(4, day.correct / day.attempts * 100) : 2}%` }} />
      </div>)}
    </div>
    <div className="trend-labels"><span>{data.trend[0]?.day}</span><span>{data.trend.at(-1)?.day}</span></div>
  </section>;
}

export function ChapterDistribution({ data }: { data: Analysis }) {
  return <section className="analysis-panel chapter-panel" aria-label="章节错题分布">
    <header><h2>章节错题分布</h2><span>错误次数与最近仍错题数分别统计</span></header>
    <div className="analysis-table-scroll"><table className="analysis-table"><thead><tr>
      <th>章节</th><th>作答 / 错误</th><th>错误率</th><th>最近仍错</th><th>覆盖</th><th /></tr></thead>
      <tbody>{data.chapters.map(chapter => <tr key={chapter.chapter_id}>
        <th>{chapter.chapter_name}</th><td>{chapter.attempts} / {chapter.wrong_attempts}</td>
        <td>{percentage(chapter.error_rate)}</td><td>{chapter.latest_incorrect}</td>
        <td>{chapter.unique_questions} / {chapter.total}</td>
        <td>{chapter.latest_incorrect > 0 && <Link className="inline-action"
          to={`/practice?subject=${data.subject_id}&chapter=${chapter.chapter_id}&state=incorrect`}>练错题</Link>}</td>
      </tr>)}</tbody></table></div>
  </section>;
}
