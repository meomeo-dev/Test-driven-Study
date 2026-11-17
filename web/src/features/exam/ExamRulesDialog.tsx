import { Link } from 'react-router';
import type { ExamRule } from '../../api/exams';

export function ExamRulesDialog({ rule }: { rule: ExamRule }) {
  const blueprint = rule.blueprint;
  return (
    <div className="exam-rule-notes">
      <p>{blueprint?.scope ?? '按当前课程题库抽题的本地模拟考试'}。本功能为自研课程本地练习与模拟考试。</p>
      <h3>考试大纲与组卷</h3>
      {blueprint ? (
        <>
          <p>
            题型配额已执行：{blueprint.types.map(item => `${item.name} ${item.count} 题`).join('、')}。
            每题 {rule.points} 分，{rule.minutes} 分钟，{rule.pass_score} 分合格。
          </p>
          {blueprint.topics.length > 0 && (
            <div className="exam-blueprint-table">
              <table>
                <caption>考点目标分布</caption>
                <thead>
                  <tr>
                    <th scope="col">考试内容</th>
                    <th scope="col">比例</th>
                    <th scope="col">题数</th>
                  </tr>
                </thead>
                <tbody>
                  {blueprint.topics.map(topic => (
                    <tr key={topic.name}>
                      <th scope="row">{topic.name}</th>
                      <td>{((topic.count / rule.count) * 100).toFixed(0)}%</td>
                      <td>{topic.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p>
          本单元模拟试卷包含 {rule.count} 题，限时 {rule.minutes} 分钟，
          满分 {rule.count * rule.points} 分，{rule.pass_score} 分合格。
        </p>
      )}
      <h3>本地模拟器操作与评分</h3>
      <p>
        数字键 1–4 选择；多选按数字键切换。Enter 或下一题保存并判分后翻题。
        ←/→ 或 k/j 保存并翻题，n 查看答题卡。字符快捷键可停用。
      </p>
      <p>
        判分前可修改，判分后锁定；离开已选择答案的题目时保存，未选择时可跳过。
        答错显示正确答案，交卷后可查看完整解析。
        多选完全匹配才得分；漏选、错选、未答均为0分。计分为实际答对题数乘每题分值。
      </p>
      <p>倒计时不会因离开或刷新暂停，到时交卷。</p>
      <h3>来源与适用范围</h3>
      <p>规则版本：{rule.version}。</p>
      {blueprint?.sources && (
        <ul>
          {blueprint.sources.map(source => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link to={`/guide?subject=${rule.subject_id}`}>查看科目指南</Link>。
      </p>
    </div>
  );
}
