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

test('cloze, reading, listening and translation can be answered and reviewed', async ({ page, request }) => {
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

test('writing separates the requirements, sample and grading criteria', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const feedbackCalls: string[] = [];
  page.on('request', r => { if (r.url().endsWith('/feedback')) feedbackCalls.push(r.url()); });
  const speech: string[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    speech.push(route.request().postDataJSON().text);
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.goto(demo.link('writing', 'memorize'));
  const card = page.locator('article.question-card');
  const stem = card.getByRole('region', { name: '题干与图例' });
  const reference = card.getByRole('region', { name: '参考答案' });
  const analysis = card.getByRole('region', { name: '答案解析', exact: true });
  await expect(stem.getByRole('region', { name: '写作要求' })
    .getByText('至少 5 词，最多 20 词')).toBeVisible();
  await expect(reference.getByText('The delivery has been moved to Friday.')).toBeVisible();
  await expect(reference.getByText('评分细则')).toHaveCount(0);
  await expect(analysis.getByText('has been moved to Friday', { exact: true })).toBeVisible();
  await expect(analysis.getByText('任务完成度（50 分）')).toBeVisible();
  await expect(analysis.getByText('语言准确性（50 分）')).toBeVisible();
  await stem.getByRole('button', { name: '播放发音', exact: true }).first().click();
  await expect.poll(() => speech[0]).toBe('delivery');

  await page.goto(demo.link('writing'));
  await expect(stem.getByRole('region', { name: '写作要求' })).toBeVisible();
  await expect(card.getByText('参考范文')).toHaveCount(0);
  await expect(analysis).toHaveCount(0);
  const editor = card.getByRole('textbox', { name: '写作答案' });
  await editor.fill('Our delivery is now scheduled for Friday.');
  await expect(card.getByText('词数：7')).toBeVisible();
  await card.getByRole('button', { name: '提交答案' }).click();
  await expect(editor).toHaveCount(0);
  await expect(card.getByText('词数：7')).toBeVisible();
  await expect(card.getByText('参考范文')).toBeVisible();
  await expect(analysis.getByText('语言准确性（50 分）')).toBeVisible();
  expect(feedbackCalls).toEqual([]);
  await card.getByRole('button', { name: '请求 AI 批改' }).click();
  await expect(card.getByText(/表达清楚，符合通知语境/)).toBeVisible();
  await expect(card.getByText(/任务完成度 50\/50/)).toBeVisible();
  expect(feedbackCalls).toHaveLength(1);
});

test('reading separates the article, sub-questions and explanations', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const speech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    speech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });
  await page.goto(demo.link('reading', 'memorize'));
  const card = page.locator('article.question-card');
  const stem = card.getByRole('region', { name: '题干与图例' });
  const answers = card.getByRole('region', { name: '参考答案' });
  const analysis = card.getByRole('region', { name: '答案解析', exact: true });
  await expect(stem.getByText(/WORKSHOP NOTICE/)).toBeVisible();
  await expect(stem.getByText('查看逐字稿')).toHaveCount(0);
  await expect(answers.getByText(/WORKSHOP NOTICE/)).toHaveCount(0);
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech[0]).toMatchObject({
    text: expect.stringMatching(/^WORKSHOP NOTICE\nThe workshop opens/), voice: 'stella',
  });
  await expect(answers.getByRole('group', { name: '小题 1' }).getByText('正确答案：8')).toBeVisible();
  const reviewedChoices = answers.getByRole('group', { name: '小题 2' });
  const reviewedRows = reviewedChoices.getByRole('listitem');
  await expect(reviewedRows.locator('.option-letter')).toHaveText(['A', 'B', 'C']);
  await expect(reviewedChoices.locator('.answer-option .tts-audio-controls')).toHaveCount(3);
  await expect(reviewedChoices.getByText('Collect the badges.')).toBeVisible();
  await expect(analysis.getByText('8 a.m. 表示上午八点。')).toBeVisible();
  await expect(analysis.getByText(/回收访客证的是主管/)).toBeVisible();

  await page.goto(demo.link('reading'));
  await expect(card.getByRole('region', { name: '阅读材料' })).toBeVisible();
  await expect(card.getByRole('region', { name: '答案解析', exact: true })).toHaveCount(0);
  const numericPart = card.getByRole('group', { name: '小题 1' });
  await expect(numericPart.getByRole('button', { name: '播放发音', exact: true })).toHaveCount(1);
  const choicePart = card.getByRole('group', { name: '小题 2' });
  await expect(choicePart.getByRole('button', { name: '播放发音', exact: true })).toHaveCount(4);
  const distractor = choicePart.getByRole('listitem')
    .filter({ has: page.getByRole('checkbox', { name: 'Collect the badges.' }) });
  await distractor.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech.at(-1)).toMatchObject({
    text: 'Collect the badges.', voice: 'stella',
  });
  await card.getByRole('textbox', { name: '数值答案' }).fill('8');
  await card.getByRole('checkbox', { name: 'Wear a visitor badge.' }).check();
  await card.getByRole('checkbox', { name: 'Sign in at the front desk.' }).check();
  await card.getByRole('button', { name: '提交答案' }).click();
  await expect(card.getByText('本题得分比例：100%')).toBeVisible();
  await expect(card.getByRole('region', { name: '答案解析', exact: true })
    .getByText(/回收访客证的是主管/)).toBeVisible();
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
