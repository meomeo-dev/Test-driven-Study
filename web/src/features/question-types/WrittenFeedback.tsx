import { useMutation, useQuery } from '@tanstack/react-query';
import * as llm from '../../api/llm';
import * as practice from '../../api/practice';

export function WrittenFeedback({ presentation }: { presentation: string }) {
  const provider = useQuery({ queryKey: ['llm-info'], queryFn: ({ signal }) => llm.info(signal),
    retry: false, staleTime: 30000 });
  const feedback = useMutation({ mutationFn: () => practice.evaluateWritten(presentation), retry: false });
  if (!provider.data?.ready) return null;
  return <div className="extended-review">
    {!feedback.data && <button type="button" className="button outline" disabled={feedback.isPending}
      onClick={() => feedback.mutate()}>{feedback.isPending ? '正在批改…' : '请求 AI 批改'}</button>}
    {feedback.error && <p role="alert">{feedback.error.message}</p>}
    {feedback.data && <div aria-label="AI 批改">
      <p><strong>AI 批改建议</strong>：{feedback.data.summary}</p>
      <ul className="extended-requirements">{feedback.data.criteria.map(row => <li key={row.name}>
        {row.name} {row.points}/{row.max_points}：{row.comment}
      </li>)}</ul>
    </div>}
  </div>;
}
