import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerInput } from '../../api/generated/types.gen';
import * as api from '../../api/exams';
type Action = {
    kind: 'navigate';
    from: number;
    target: number;
    response: AnswerInput;
} | {
    kind: 'answer';
    index: number;
    selected: number[];
} | {
    kind: 'move';
    index: number;
    flagged?: boolean;
} | {
    kind: 'submit';
};
export function useExamSession(id: string) {
    const client = useQueryClient();
    const query = useQuery({ queryKey: ['exam', id], queryFn: ({ signal }) => api.get(id, signal),
        staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, retry: false,
        refetchInterval: query => query.state.data?.status === 'in_progress' ? 10000 : false });
    const action = useMutation({ retry: false,
        // Cancel an older poll before committing so its delayed response cannot
        // replace a newly saved answer or cursor in the local cache.
        onMutate: () => client.cancelQueries({ queryKey: ['exam', id] }),
        mutationFn: (input: Action) => {
            if (input.kind === 'navigate')
                return api.navigate(id, input.from, input.target, input.response);
            if (input.kind === 'answer')
                return api.answer(id, input.index, input.selected);
            if (input.kind === 'move')
                return api.move(id, input.index, input.flagged);
            return api.submit(id);
        }, onSuccess: session => {
            client.setQueryData(['exam', id], session);
            for (const key of ['exam-history', 'analysis', 'practice-overview', 'practice-questions']) {
                if (session.status === 'finished' || key === 'exam-history') {
                    void client.invalidateQueries({ queryKey: [key] });
                }
            }
        }, onError: () => { void query.refetch(); } });
    return { query, action };
}
export function useExamClock(session?: api.ExamSession) {
    const [remaining, setRemaining] = useState<number | null>(null);
    const anchor = useRef({ now: 0, received: 0, deadline: 0 });
    useEffect(() => {
        if (!session)
            return;
        if (session.status === 'finished') {
            setRemaining(Math.max(0, Math.ceil((session.deadline_at_ms - session.finished_at_ms) / 1000)));
            return;
        }
        anchor.current = { now: session.server_now_ms, received: performance.now(), deadline: session.deadline_at_ms };
        function tick() {
            const a = anchor.current;
            setRemaining(Math.max(0, Math.ceil((a.deadline - a.now - (performance.now() - a.received)) / 1000)));
        }
        tick();
        const timer = window.setInterval(tick, 250);
        return () => window.clearInterval(timer);
    }, [session?.server_now_ms, session?.deadline_at_ms, session?.status, session?.finished_at_ms]);
    return remaining;
}
