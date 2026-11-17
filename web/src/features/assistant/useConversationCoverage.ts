import { useQuery } from '@tanstack/react-query';
import { conversationCoverage } from '../../api/conversations';

export function useConversationCoverage(subject: number) {
  const query = useQuery({ queryKey: ['conversation-coverage', subject],
    queryFn: ({ signal }) => conversationCoverage(subject, signal),
    staleTime: 5000, refetchInterval: 5000, retry: false });
  return new Set((query.data ?? []).map(row => row.question_id));
}
