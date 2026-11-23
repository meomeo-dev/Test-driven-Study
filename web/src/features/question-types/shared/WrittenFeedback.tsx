import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttemptEvaluation,
  TranslationItemReview,
  WritingItemReview,
} from '../../../api/generated/types.gen';
import * as llm from '../../../api/llm';
import * as practice from '../../../api/practice';
import { writingRubricLabel } from './format';
import {
  attemptEvaluationKey,
  buildTranslationSelfCheckCriteria,
  buildWritingSelfCheckCriteria,
  evaluationOutcomeLabel,
  evaluationSourceLabel,
  invalidateEvaluationQueries,
  pickLatestEvaluation,
  resolveCheckedCriteria,
  shouldPromoteEvaluation,
  writtenFeedbackToEvaluation,
} from './written-evaluation';

export type WrittenFeedbackProps = {
  presentation: string;
  writing?: boolean;
  writingReview?: WritingItemReview;
  translationReview?: TranslationItemReview;
  onEvaluated?: (evaluation: AttemptEvaluation) => void;
};

export function WrittenFeedback({
  presentation,
  writing,
  writingReview,
  translationReview,
  onEvaluated,
}: WrittenFeedbackProps) {
  const client = useQueryClient();
  const [checkedKeys, setCheckedKeys] = useState<Set<string> | null>(null);
  const [latest, setLatest] = useState<AttemptEvaluation | null>(null);

  const provider = useQuery({
    queryKey: ['llm-info'],
    queryFn: ({ signal }) => llm.info(signal),
    retry: false,
    staleTime: 30000,
  });

  const persisted = useQuery({
    queryKey: attemptEvaluationKey(presentation),
    queryFn: ({ signal }) => practice.attemptEvaluation(presentation, signal),
    retry: false,
    staleTime: 0,
  });

  const criteria = writing
    ? buildWritingSelfCheckCriteria(writingReview)
    : buildTranslationSelfCheckCriteria(translationReview);

  const persistedEval = persisted.data?.evaluation ?? null;
  const activeEvaluation =
    latest && persistedEval
      ? pickLatestEvaluation(persistedEval, latest)
      : latest ?? persistedEval;
  const restoredChecked =
    activeEvaluation?.source === 'self_check'
      ? new Set(activeEvaluation.checked_criteria ?? [])
      : new Set<string>();
  const selectedKeys = checkedKeys ?? restoredChecked;

  const lastNotifiedId = useRef<number | null>(null);
  useEffect(() => {
    if (!activeEvaluation || lastNotifiedId.current === activeEvaluation.id) return;
    lastNotifiedId.current = activeEvaluation.id;
    onEvaluated?.(activeEvaluation);
  }, [activeEvaluation, onEvaluated]);

  const selfCheck = useMutation({
    mutationFn: (passed: boolean) =>
      practice.selfCheckWritten(presentation, {
        passed,
        checked_criteria: resolveCheckedCriteria(criteria, selectedKeys),
      }),
    retry: false,
    onSuccess: async saved => {
      setLatest(prev => pickLatestEvaluation(prev, saved));
      client.setQueryData<practice.AttemptEvaluationView>(
        attemptEvaluationKey(presentation),
        prev => ({ evaluation: pickLatestEvaluation(prev?.evaluation, saved) }),
      );
      await invalidateEvaluationQueries(client);
    },
  });

  const feedback = useMutation({
    mutationFn: () => practice.evaluateWritten(presentation),
    retry: false,
    onSuccess: async result => {
      const saved = writtenFeedbackToEvaluation(result);
      const cachedEval = client.getQueryData<practice.AttemptEvaluationView>(
        attemptEvaluationKey(presentation),
      )?.evaluation;
      const authoritative =
        activeEvaluation && cachedEval
          ? pickLatestEvaluation(activeEvaluation, cachedEval)
          : activeEvaluation ?? cachedEval ?? null;
      if (shouldPromoteEvaluation(authoritative, saved)) {
        setLatest(prev => pickLatestEvaluation(prev, saved));
        client.setQueryData<practice.AttemptEvaluationView>(
          attemptEvaluationKey(presentation),
          prev => ({ evaluation: pickLatestEvaluation(prev?.evaluation, saved) }),
        );
        await invalidateEvaluationQueries(client);
      }
    },
  });

  const llmDetails = feedback.data
    ? writtenFeedbackToEvaluation(feedback.data)
    : activeEvaluation?.source === 'llm' && activeEvaluation.summary
      ? activeEvaluation
      : null;

  const busy = selfCheck.isPending || feedback.isPending;
  const errorMessage = selfCheck.error?.message || feedback.error?.message;
  const activeSelfCheck =
    activeEvaluation?.source === 'self_check' ? activeEvaluation : null;

  function toggleCriterion(key: string, checked: boolean) {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    setCheckedKeys(next);
  }

  return (
    <div className="extended-review written-evaluation">
      {activeEvaluation && (
        <div
          role="status"
          aria-label="评估状态"
          className={`written-evaluation-status ${
            activeEvaluation.passed ? 'is-passed' : 'is-needs-work'
          }`}
        >
          <span className="written-evaluation-badge">
            {evaluationSourceLabel(activeEvaluation.source)}
          </span>
          <strong>{evaluationOutcomeLabel(activeEvaluation.passed)}</strong>
          <span className="written-evaluation-meta">
            得分 {activeEvaluation.score_pct}%
          </span>
          {activeEvaluation.source === 'llm' && activeEvaluation.cached && (
            <span className="written-evaluation-meta">已复用缓存</span>
          )}
          {activeEvaluation.source === 'self_check' &&
            Boolean(activeEvaluation.checked_criteria?.length) && (
              <span className="written-evaluation-meta">
                已勾选 {activeEvaluation.checked_criteria?.length} 项要点
              </span>
            )}
        </div>
      )}

      <section className="written-self-check" aria-label="离线自评">
        <h4 className="column-label">离线自评</h4>
        <p className="muted written-self-check-guide">
          {writing
            ? '对照下方范文与评分细则勾选已达标要点，然后记录本次自评结果；通过将计入学习掌握度。'
            : '对照上方参考译文、可接受译法与关键术语勾选已达标要点，然后记录本次自评结果；通过将计入学习掌握度。'}
        </p>
        <ul className="written-self-check-list">
          {criteria.map(item => (
            <li key={item.key}>
              <label className="written-self-check-item">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selectedKeys.has(item.key)}
                  onChange={event =>
                    toggleCriterion(item.key, event.currentTarget.checked)
                  }
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="written-evaluation-actions">
          <button
            type="button"
            className="button primary"
            disabled={busy}
            aria-pressed={activeSelfCheck?.passed === true}
            onClick={() => {
              feedback.reset();
              selfCheck.mutate(true);
            }}
          >
            {selfCheck.isPending && selfCheck.variables === true
              ? '正在保存…'
              : '自评通过（计入掌握）'}
          </button>
          <button
            type="button"
            className="button outline"
            disabled={busy}
            aria-pressed={activeSelfCheck?.passed === false}
            onClick={() => {
              feedback.reset();
              selfCheck.mutate(false);
            }}
          >
            {selfCheck.isPending && selfCheck.variables === false
              ? '正在保存…'
              : '仍需改进'}
          </button>
          {provider.data?.ready && !llmDetails && (
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => {
                selfCheck.reset();
                feedback.mutate();
              }}
            >
              {feedback.isPending ? '正在批改…' : '请求 AI 批改'}
            </button>
          )}
        </div>
        {errorMessage && (
          <p role="alert" className="written-evaluation-error">
            {errorMessage}
          </p>
        )}
      </section>

      {llmDetails && (
        <div className="written-ai-feedback" aria-label="AI 批改">
          <p>
            <strong>AI 批改建议</strong>：{llmDetails.summary}
          </p>
          {!!llmDetails.criteria?.length && (
            <ul className="extended-requirements">
              {llmDetails.criteria.map(row => (
                <li key={row.name}>
                  {writing ? writingRubricLabel(row.name) : row.name} {row.points}/
                  {row.max_points}：{row.comment}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
