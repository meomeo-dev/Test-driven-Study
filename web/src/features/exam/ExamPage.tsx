import { readSubject } from '../../app/workspace';
import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/exams';
import { ExamLobby } from './ExamLobby';
import { ExamWorkspace } from './ExamWorkspace';
import { creationID, freshCreationID } from './examCreation';
export function ExamPage() {
    const [params, setParams] = useSearchParams();
    const subject = readSubject(params);
    const id = params.get('exam') || '';
    const client = useQueryClient();
    const request = useRef<{
        subject: number;
        id: string;
        restartOf?: string;
    } | null>(null);
    const rules = useQuery({ queryKey: ['exam-rules', subject], queryFn: ({ signal }) => api.rules(subject, signal) });
    const history = useQuery({ queryKey: ['exam-history', subject], queryFn: ({ signal }) => api.history(subject, signal),
        staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
        refetchInterval: query => !id && query.state.data?.some(row => row.status === 'in_progress') ? 10000 : false });
    const syncSubject = useCallback((actual: number) => {
        if (actual !== subject)
            setParams({ subject: String(actual), exam: id }, { replace: true });
    }, [id, subject, setParams]);
    function select(value: api.ExamSession | api.ExamSummary) {
        // Recovering a confirmed paper through history also resolves an
        // uncertain creation; the next examination needs a fresh UUID.
        if (request.current?.id === value.id)
            request.current = null;
        try {
            const key = `test-driven-study.exam-create.${value.subject_id}`;
            if (sessionStorage.getItem(key) === value.id)
                sessionStorage.removeItem(key);
        }
        catch { /* The in-memory request was also cleared above. */ }
        setParams({ subject: String(value.subject_id), exam: value.id });
    }
    const create = useMutation({ retry: false, mutationFn: async (previous: api.ExamSummary | undefined) => {
            if (previous && request.current?.restartOf !== previous.id) {
                // Replace any pending ID for the old paper. If either request
                // loses its response, retry keeps the same new paper UUID.
                request.current = { subject: previous.subject_id,
                    id: freshCreationID(previous.subject_id), restartOf: previous.id };
            }
            if (request.current?.subject !== subject)
                request.current = { subject, id: creationID(subject) };
            const pending = request.current;
            if (pending.restartOf)
                await api.submit(pending.restartOf);
            return api.create(pending.id, pending.subject);
        }, onSuccess: value => {
            request.current = null;
            try {
                sessionStorage.removeItem(`test-driven-study.exam-create.${value.subject_id}`);
            }
            catch { /* Optional storage. */ }
            client.setQueryData(['exam', value.id], value);
            select(value);
        }, onSettled: () => {
            void history.refetch();
            // Finalization can succeed even if creating the replacement fails.
            for (const key of ['analysis', 'practice-overview', 'practice-questions'])
                void client.invalidateQueries({ queryKey: [key] });
        } });
    return <main className="exam-terminal" id="exam-main">
    <a className="skip-link" href="#exam-main">跳到模拟考试</a>

      {id ? <ExamWorkspace key={id} id={id} onSubject={syncSubject} onBack={actual => {
            create.reset();
                setParams({ subject: String(actual ?? subject) });
                void history.refetch();
            }}/> : rules.data && history.data ? <ExamLobby rule={rules.data} history={history.data}
              busy={create.isPending} error={create.error?.message}
              onStart={() => create.mutate(undefined)} onRestart={previous => create.mutate(previous)}
              onSelect={select} onSubject={next => { create.reset(); setParams({ subject: String(next) }); }}/>
            : <div className="terminal-state" role={rules.error || history.error ? 'alert' : 'status'}>
          <p>{rules.error?.message || history.error?.message || '读取考试规则与记录…'}</p>
          {(rules.error || history.error) && <button className="terminal-button" onClick={() => {
                        void rules.refetch();
                        void history.refetch();
                    }}>重新读取</button>}
        </div>}
  </main>;
}
