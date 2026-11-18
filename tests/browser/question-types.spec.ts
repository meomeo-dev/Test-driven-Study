import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import type { AttemptResult, CourseSummary, ExamSession, PracticeSummary } from
  '../../web/src/api/generated/types.gen';

async function demoUnit(request: APIRequestContext) {
  const courses: CourseSummary[] = await (await request.get('/api/courses')).json();
  const subject = courses.find(c => c.id === 'step-up-english-1')
    ?.units.find(u => u.id === 'extended-practice')?.subject_id;
  expect(subject).toBeDefined();
  const questions: PracticeSummary[] =
    await (await request.get(`/api/practice/questions?subject=${subject}`)).json();
  const id = (kind: string) => questions.find(q =>
    q.source_item_id === `sue1-extended-${kind}`)?.question_id;
  const link = (kind: string, mode = 'practice') =>
    `/${mode}?subject=${subject}&question=${id(kind)}`;
  return { subject, id, link };
}

test('all five types can be answered and reviewed in practice', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const card = page.getByRole('article', { name: /./ });
  const submit = () => page.getByRole('button', { name: '提交答案' }).click();
  await page.goto(demo.link('cloze'));
  await page.getByRole('button', { name: '跳转到空格 1' }).click();
  await expect(page.getByRole('radio', { name: 'must', exact: true })).toBeFocused();
  await page.getByRole('radio', { name: 'must', exact: true }).check();
  await expect(page.getByRole('button', { name: '跳转到空格 1' })).toHaveText('must');
  await expect(card.getByText('本题得分比例：50%')).toHaveCount(0);
  await submit();
  await expect(card.getByText('本题得分比例：50%')).toBeVisible();
  await expect(card.getByText('你的答案：未作答')).toBeVisible();

  await page.goto(demo.link('reading'));
  await expect(card.getByText(/WORKSHOP NOTICE/)).toBeVisible();
  await page.getByRole('textbox', { name: '数值答案' }).fill('8.0');
  await page.getByRole('checkbox', { name: 'Wear a visitor badge.' }).check();
  await page.getByRole('checkbox', { name: 'Sign in at the front desk.' }).check();
  await submit();
  await expect(card.getByText('本题得分比例：100%')).toBeVisible();

  await page.goto(demo.link('listening'));
  await expect(page.getByRole('region', { name: '听力音频播放' })).toBeVisible();
  await page.getByRole('radio', { name: 'On the second shelf.' }).check();
  await page.getByRole('radio', { name: '错误' }).check();
  await submit();
  await expect(card.getByText('本题得分比例：100%')).toBeVisible();

  const feedbackCalls: string[] = [];
  page.on('request', r => { if (r.url().endsWith('/feedback')) feedbackCalls.push(r.url()); });
  await page.goto(demo.link('writing'));
  await expect(card.getByText('参考范文')).toHaveCount(0);
  await page.getByRole('textbox', { name: '写作答案' })
    .fill('The delivery has been moved to Friday.');
  await submit();
  await expect(card.getByText('词数：7')).toBeVisible();
  await expect(card.getByText('参考范文')).toBeVisible();
  expect(feedbackCalls).toEqual([]);
  await page.getByRole('button', { name: '请求 AI 批改' }).click();
  await expect(card.getByText(/表达清楚，符合通知语境/)).toBeVisible();
  expect(feedbackCalls).toHaveLength(1);

  await page.goto(demo.link('translation'));
  await expect(card.getByText('参考译文', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '中文译文' }).fill('请将已签名的清单放在前台。');
  const grading = page.waitForResponse(r => r.url().endsWith('/answer') && r.ok());
  await submit();
  const result: AttemptResult = await (await grading).json();
  expect(result.attempt.correct).toBe(true);
  await expect(card.getByText('参考译文', { exact: true })).toBeVisible();

  await page.goto(demo.link('translation', 'memorize'));
  await expect(page.getByText('Leave the signed checklist on the front desk.')).toBeVisible();
  await expect(page.getByText('把已签字的清单留在前台。', { exact: true })).toBeVisible();
});

test('a listening paper plays audio without exposing the active transcript', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const id = randomUUID();
  const created = await request.post('/api/exams', { data: { id, subject_id: demo.subject } });
  expect(created.ok()).toBe(true);
  const paper: ExamSession = await created.json();
  const index = paper.items.findIndex(row => row.detail.question.question_id === demo.id('listening'));
  expect(index).toBeGreaterThanOrEqual(0);
  expect(paper.items[index]?.detail.question).not.toHaveProperty('transcript_lines');
  expect(paper.items[index]).not.toHaveProperty('review');
  expect((await request.post(`/api/exams/${id}/audio`, {
    data: { index, line: 99 },
  })).status()).toBe(400);
  const cursor = await request.put(`/api/exams/${id}/cursor`, { data: { index } });
  expect(cursor.ok()).toBe(true);

  const lines: number[] = [];
  await page.route(`**/api/exams/${id}/audio`, async route => {
    const data = route.request().postDataJSON();
    expect(data).toEqual({ index, line: lines.length, force: false });
    lines.push(data.line);
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3' } });
  });
  await page.goto(`/exam?subject=${demo.subject}&exam=${id}`);
  await expect(page.getByText('查看逐字稿')).toHaveCount(0);
  await page.getByRole('button', { name: '播放发音' }).click();
  await expect.poll(() => lines).toEqual([0, 1]);

  await page.getByRole('radio', { name: 'On the second shelf.' }).check();
  await page.getByRole('radio', { name: '错误' }).check();
  const saving = page.waitForResponse(r => r.url().endsWith('/navigate') && r.ok());
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  const saved: ExamSession = await (await saving).json();
  expect(saved.items[index]?.response?.sub_answers).toEqual({ location: ['second'], checklist: false });
  expect(saved.items[index]?.review).not.toHaveProperty('transcript_lines');
  await page.getByRole('button', { name: '继续考试' }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: '错误' })).toBeChecked();
  await expect(page.getByRole('radio', { name: '错误' })).toBeDisabled();
});
