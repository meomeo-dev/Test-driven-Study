import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AttemptEvaluation,
  LlmInfo,
  TranslationItemReview,
  WrittenFeedback as WrittenFeedbackPayload,
  WritingItemReview,
} from '../../api/generated/types.gen';
import * as practiceApi from '../../api/practice';
import {
  evaluationOutcomeLabel,
  evaluationSourceLabel,
  evaluationStateBadgeLabel,
  WrittenFeedback,
} from './index';
import {
  attemptEvaluationKey,
  buildTranslationSelfCheckCriteria,
  buildWritingSelfCheckCriteria,
  invalidateEvaluationQueries,
  pickLatestEvaluation,
  resolveCheckedCriteria,
  shouldPromoteEvaluation,
  writtenFeedbackToEvaluation,
} from './shared/written-evaluation';

const writingReviewFixture: WritingItemReview = {
  id: 'w-1',
  stem: 'Write a short notice about the delivery date.',
  type: 'writing',
  subtype: 'sentence_making',
  requirements: ['Mention the new delivery day clearly.'],
  sample_response: 'The delivery has been moved to Friday.',
  keywords: ['delivery', 'Friday'],
  rubric: { task_completion: 50, language_accuracy: 50 },
};

const translationReviewFixture: TranslationItemReview = {
  id: 't-1',
  stem: 'Translate the notice into Chinese.',
  type: 'translation',
  direction: 'en_to_zh',
  source_text: 'Leave the signed checklist on the front desk.',
  reference_translation: '把已签字的清单留在前台。',
  acceptable_alternates: ['请将已签名的清单放在前台。'],
  key_terms: [
    { term: 'checklist', variants: ['清单', '检查表'] },
    { term: 'front desk' },
  ],
};

const llmReadyFixture: LlmInfo = {
  ready: true,
  models: ['gpt-5.4'],
  default_model: 'gpt-5.4',
  reasoning_effort: 'medium',
  max_output_tokens_k: 64,
  efforts: ['medium'],
  message: 'ok',
};

const llmUnavailableFixture: LlmInfo = {
  ...llmReadyFixture,
  ready: false,
  message: 'not configured',
};

function stubFetchJson(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(
    JSON.stringify(payload),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderFeedback(
  client: QueryClient,
  props: Parameters<typeof WrittenFeedback>[0],
) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(WrittenFeedback, props),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('written evaluation helpers and criteria', () => {
  it('builds writing criteria from rubric and keywords with fallback and no sample-heading text', () => {
    const items = buildWritingSelfCheckCriteria(writingReviewFixture);
    expect(items).toEqual([
      { key: 'task_completion', label: '任务完成度（50 分）' },
      { key: 'language_accuracy', label: '语言准确性（50 分）' },
      { key: 'keywords', label: '准确使用关键词：delivery、Friday' },
    ]);
    expect(items.every(item => !item.label.includes('参考范文'))).toBe(true);

    const fallback = buildWritingSelfCheckCriteria({
      id: 'w-2',
      stem: 'Write a short essay.',
      type: 'writing',
      subtype: 'short_essay',
      requirements: [],
    });
    expect(fallback).toHaveLength(2);
    expect(resolveCheckedCriteria(items, new Set(['keywords', 'task_completion']))).toEqual([
      'task_completion',
      'keywords',
    ]);
  });

  it('builds translation criteria from reference, alternates, and key terms', () => {
    const items = buildTranslationSelfCheckCriteria(translationReviewFixture);
    expect(items).toEqual([
      { key: 'meaning_accuracy', label: '核心语义与参考译文或可接受译法一致' },
      { key: 'term:checklist', label: '关键术语准确：checklist（清单、检查表）' },
      { key: 'term:front desk', label: '关键术语准确：front desk' },
      { key: 'fluency_grammar', label: '语序自然通顺，语法与标点无误' },
    ]);
  });

  it('formats evaluation labels and converts WrittenFeedback into AttemptEvaluation', () => {
    const feedback: WrittenFeedbackPayload = {
      id: 9,
      presentation_id: 'pres-1',
      source: 'llm',
      passed: true,
      score_pct: 90,
      evaluated_at_ms: 1700000000000,
      cached: true,
      summary: '表达清楚，符合通知语境。',
      criteria: [
        { name: 'task_completion', points: 50, max_points: 50, comment: '要点完整' },
      ],
    };
    const evaluation = writtenFeedbackToEvaluation(feedback);
    expect(evaluation).toMatchObject({
      id: 9,
      source: 'llm',
      passed: true,
      score_pct: 90,
      cached: true,
      summary: '表达清楚，符合通知语境。',
    });
    expect(evaluationSourceLabel('llm')).toBe('AI 评分');
    expect(evaluationSourceLabel('self_check')).toBe('离线自评');
    expect(evaluationOutcomeLabel(true)).toBe('已通过（计入掌握）');
    expect(evaluationOutcomeLabel(false)).toBe('仍需改进');
    expect(evaluationStateBadgeLabel(evaluation)).toBe('AI 评分 · 已通过');
  });

  it('does not promote an older cached LLM evaluation over a newer self-check', () => {
    const olderCachedLlm = writtenFeedbackToEvaluation({
      id: 10,
      presentation_id: 'pres-order',
      source: 'llm',
      passed: false,
      score_pct: 50,
      evaluated_at_ms: 1700000001000,
      cached: true,
      summary: '初版缺少关键信息。',
      criteria: [],
    });
    const newerSelfCheck: AttemptEvaluation = {
      id: 15,
      presentation_id: 'pres-order',
      source: 'self_check',
      passed: true,
      score_pct: 100,
      evaluated_at_ms: 1700000002000,
      checked_criteria: ['task_completion'],
    };
    const freshLlm = writtenFeedbackToEvaluation({
      id: 16,
      presentation_id: 'pres-order',
      source: 'llm',
      passed: true,
      score_pct: 92,
      evaluated_at_ms: 1700000003000,
      cached: false,
      summary: '完整准确。',
      criteria: [],
    });

    expect(shouldPromoteEvaluation(null, olderCachedLlm)).toBe(true);
    expect(shouldPromoteEvaluation(newerSelfCheck, olderCachedLlm)).toBe(false);
    expect(pickLatestEvaluation(newerSelfCheck, olderCachedLlm)).toEqual(newerSelfCheck);
    expect(shouldPromoteEvaluation(newerSelfCheck, freshLlm)).toBe(true);
    expect(pickLatestEvaluation(newerSelfCheck, freshLlm)).toEqual(freshLlm);
  });
});

describe('practice evaluation API client and query invalidation', () => {
  it('calls GET /evaluation, POST /self-check, and POST /feedback with expected payloads', async () => {
    const savedSelfCheck: AttemptEvaluation = {
      id: 12,
      presentation_id: 'pres-abc',
      source: 'self_check',
      passed: true,
      score_pct: 100,
      evaluated_at_ms: 1700000001000,
      checked_criteria: ['meaning_accuracy', 'term:checklist'],
    };

    const getMock = stubFetchJson({ evaluation: savedSelfCheck });
    const view = await practiceApi.attemptEvaluation('pres-abc');
    expect(view.evaluation).toEqual(savedSelfCheck);
    expect(getMock).toHaveBeenCalledWith(
      '/api/practice/presentations/pres-abc/evaluation',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const selfCheckMock = stubFetchJson(savedSelfCheck);
    const saved = await practiceApi.selfCheckWritten('pres-abc', {
      passed: true,
      checked_criteria: ['meaning_accuracy', 'term:checklist'],
    });
    expect(saved).toEqual(savedSelfCheck);
    expect(selfCheckMock).toHaveBeenCalledWith(
      '/api/practice/presentations/pres-abc/self-check',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(selfCheckMock.mock.calls[0]?.[1]?.body))).toEqual({
      passed: true,
      checked_criteria: ['meaning_accuracy', 'term:checklist'],
    });

    const feedbackMock = stubFetchJson({
      id: 13,
      presentation_id: 'pres-abc',
      source: 'llm',
      passed: true,
      score_pct: 88,
      evaluated_at_ms: 1700000002000,
      cached: false,
      summary: '准确流畅',
      criteria: [],
    });
    const ai = await practiceApi.evaluateWritten('pres-abc');
    expect(ai.passed).toBe(true);
    expect(ai.score_pct).toBe(88);
    expect(feedbackMock).toHaveBeenCalledWith(
      '/api/practice/presentations/pres-abc/feedback',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('invalidates practice, analysis, learning, and roadmap queries after saving evaluation', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await invalidateEvaluationQueries(client);

    const keys = spy.mock.calls.map(call => call[0]?.queryKey);
    expect(keys).toEqual([
      ['practice-overview'],
      ['practice-questions'],
      ['analysis'],
      ['concepts'],
      ['learning-path'],
      ['roadmap'],
      ['roadmap-path'],
    ]);
    expect(keys).not.toContainEqual(['practice-review-queue']);
  });
});

describe('WrittenFeedback UI rendering across offline, AI, and persisted states', () => {
  it('renders offline self-check controls even when LLM is unavailable and avoids writing sample heading', () => {
    const client = new QueryClient();
    client.setQueryData(['llm-info'], llmUnavailableFixture);
    client.setQueryData(attemptEvaluationKey('pres-offline'), { evaluation: null });

    const html = renderFeedback(client, {
      presentation: 'pres-offline',
      writing: true,
      writingReview: writingReviewFixture,
    });
    expect(html).toContain('离线自评');
    expect(html).toContain('任务完成度（50 分）');
    expect(html).toContain('准确使用关键词：delivery、Friday');
    expect(html).toContain('自评通过（计入掌握）');
    expect(html).toContain('仍需改进');
    expect(html).not.toContain('请求 AI 批改');
    expect(html).not.toContain('参考范文');
  });

  it('renders both offline self-check and optional AI grading when LLM is ready', () => {
    const client = new QueryClient();
    client.setQueryData(['llm-info'], llmReadyFixture);
    client.setQueryData(attemptEvaluationKey('pres-trans'), { evaluation: null });

    const html = renderFeedback(client, {
      presentation: 'pres-trans',
      writing: false,
      translationReview: translationReviewFixture,
    });
    expect(html).toContain('核心语义与参考译文或可接受译法一致');
    expect(html).toContain('关键术语准确：checklist（清单、检查表）');
    expect(html).toContain('自评通过（计入掌握）');
    expect(html).toContain('仍需改进');
    expect(html).toContain('请求 AI 批改');
  });

  it('restores persisted self-check and cached LLM evaluations cleanly', () => {
    const selfClient = new QueryClient();
    selfClient.setQueryData(['llm-info'], llmUnavailableFixture);
    selfClient.setQueryData(attemptEvaluationKey('pres-restored-self'), {
      evaluation: {
        id: 21,
        presentation_id: 'pres-restored-self',
        source: 'self_check',
        passed: true,
        score_pct: 100,
        evaluated_at_ms: 1700000003000,
        checked_criteria: ['task_completion'],
      } satisfies AttemptEvaluation,
    });

    const selfHtml = renderFeedback(selfClient, {
      presentation: 'pres-restored-self',
      writing: true,
      writingReview: writingReviewFixture,
    });
    expect(selfHtml).toContain('written-evaluation-status is-passed');
    expect(selfHtml).toContain('离线自评');
    expect(selfHtml).toContain('已通过（计入掌握）');
    expect(selfHtml).toContain('得分 100%');
    expect(selfHtml).toContain('已勾选 1 项要点');
    expect(selfHtml).toContain('checked=""');
    expect(selfHtml).toContain('aria-pressed="true"');

    const aiClient = new QueryClient();
    aiClient.setQueryData(['llm-info'], llmUnavailableFixture);
    aiClient.setQueryData(attemptEvaluationKey('pres-restored-ai'), {
      evaluation: {
        id: 22,
        presentation_id: 'pres-restored-ai',
        source: 'llm',
        passed: false,
        score_pct: 55,
        evaluated_at_ms: 1700000004000,
        cached: true,
        summary: '关键词遗漏，建议补充具体时间。',
        criteria: [
          { name: 'task_completion', points: 25, max_points: 50, comment: '缺少周五信息' },
        ],
      } satisfies AttemptEvaluation,
    });

    const aiHtml = renderFeedback(aiClient, {
      presentation: 'pres-restored-ai',
      writing: true,
      writingReview: writingReviewFixture,
    });
    expect(aiHtml).toContain('written-evaluation-status is-needs-work');
    expect(aiHtml).toContain('AI 评分');
    expect(aiHtml).toContain('仍需改进');
    expect(aiHtml).toContain('得分 55%');
    expect(aiHtml).toContain('已复用缓存');
    expect(aiHtml).toContain('AI 批改建议');
    expect(aiHtml).toContain('任务完成度 25/50：缺少周五信息');
  });
});
