import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/conversations';

export function useConversation(questionID: number, enabled: boolean) {
  const client = useQueryClient();
  const newID = useRef(crypto.randomUUID());
  const [selected, setSelected] = useState('');
  const boot = useQuery({
    queryKey: ['assistant-selection', questionID],
    queryFn: () => api.restoreConversation(questionID, newID.current),
    enabled, staleTime: Infinity, retry: false,
  });
  const id = selected || boot.data?.id || '';
  const current = useQuery({
    queryKey: ['assistant-conversation', id], queryFn: () => api.conversation(id),
    enabled: !!id, initialData: boot.data?.id === id ? boot.data : undefined,
    retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.active_turn_id ? 500 : false,
  });
  function select(record: api.ConversationRecord) {
    api.rememberConversation(questionID, record.id);
    client.setQueryData(['assistant-conversation', record.id], record);
    client.setQueryData(['assistant-selection', questionID], record);
    setSelected(record.id);
  }
  const fresh = useMutation({ mutationFn: () => api.createConversation(questionID),
    onSuccess: record => {
      select(record);
      void client.invalidateQueries({ queryKey: ['assistant-history'] });
    } });
  const started = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['conversation-coverage'] });
    void client.invalidateQueries({ queryKey: ['analysis', 'review'] });
  }, [client]);
  const settled = useCallback(() => {
    started();
    void client.invalidateQueries({ queryKey: ['assistant-conversation', id] });
    void client.invalidateQueries({ queryKey: ['assistant-history'] });
  }, [client, id, started]);
  // Initialize a mounted runtime only after its current server snapshot arrives.
  // Returning to a cached question must not seed it with an obsolete transcript.
  return { record: current.isFetchedAfterMount ? current.data : undefined,
    error: boot.error || current.error || fresh.error,
    creating: fresh.isPending, fresh: () => fresh.mutate(), select, started, settled,
    retry: () => { void boot.refetch(); if (id) void current.refetch(); } };
}
