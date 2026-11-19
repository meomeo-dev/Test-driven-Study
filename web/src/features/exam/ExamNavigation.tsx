import type { ExamItem, ExamSession } from '../../api/exams';
import { assertNever } from '../question-types/registry';
import { answerSymbols } from './terminalLabels';

function cellText(item: ExamItem, value: number[]): string {
  const q = item.detail.question;
  switch (q.question_type) {
    case 'cloze':
    case 'listening':
    case 'reading_comprehension':
    case 'writing':
    case 'translation':
      return item.response ? '已答' : '';
    case 'numeric':
      return item.numeric ?? '';
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false':
      return answerSymbols(q, value).replaceAll('、', '');
    default:
      return assertNever(q);
  }
}

export function ExamNavigation({
  session,
  index,
  selected,
  onSelect,
  busy,
}: {
  session: ExamSession;
  index: number;
  selected: number[];
  onSelect: (index: number) => void;
  busy: boolean;
}) {
  return (
    <table className="terminal-answer-table" aria-label="考试答题卡">
      <thead>
        <tr>
          <th scope="col">题目</th>
          {Array.from({ length: 10 }, (_, i) => (
            <th key={i} scope="col">
              {i + 1}列
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: Math.ceil(session.items.length / 10) }, (_, row) => (
          <tr key={row}>
            <th scope="row">{row + 1}行</th>
            {session.items.slice(row * 10, row * 10 + 10).map((item, col) => {
              const position = row * 10 + col;
              const value = position === index && !item.answered ? selected : item.selected;
              const state = item.answered ? (item.correct ? '正确' : '错误') : '未答';
              return (
                <td key={position}>
                  <button
                    aria-label={`第${position + 1}题，${state}`}
                    aria-current={position === index ? 'step' : undefined}
                    data-multiple={item.detail.question.question_type === 'multiple_choice'}
                    data-incorrect={item.correct === false && item.answered}
                    disabled={busy}
                    onClick={() => onSelect(position)}
                  >
                    {cellText(item, value)}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
