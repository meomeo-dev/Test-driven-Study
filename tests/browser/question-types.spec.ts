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
  const bySource = (sourceId: string) => questions.find(q =>
    q.source_item_id === sourceId)?.question_id;
  const link = (kind: string, mode = 'practice') =>
    `/${mode}?subject=${subject}&question=${id(kind)}`;
  return { subject, id, bySource, link };
}

test('cloze, reading, listening and translation can be answered and reviewed', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const card = page.getByRole('article', { name: /./ });
  const stem = card.getByRole('region', { name: '题干与图例' });
  const answer = card.getByRole('region', { name: '作答选项' });
  const analysis = card.getByRole('region', { name: '答案解析', exact: true });
  const submit = () => page.getByRole('button', { name: '提交答案' }).click();
  await page.goto(demo.link('cloze'));
  await expect(stem.getByText(/Every worker/)).toBeVisible();
  await expect(answer.getByText(/Every worker/)).toHaveCount(0);
  await stem.getByRole('button', { name: '跳转到空格 1' }).click();
  await expect(answer.getByRole('radio', { name: 'must', exact: true })).toBeFocused();
  await answer.getByRole('radio', { name: 'must', exact: true }).check();
  await expect(stem.getByRole('button', { name: '跳转到空格 1' })).toHaveText('must');
  await expect(card.getByText('本题得分比例：50%')).toHaveCount(0);
  await submit();
  await expect(answer.getByText(/Every worker/)).toHaveCount(0);
  await expect(answer.getByText('本题得分比例：50%')).toBeVisible();
  await expect(answer.getByText('你的答案：未作答')).toBeVisible();
  await expect(answer.getByText(/must 后接动词原形/)).toHaveCount(0);
  await expect(analysis.getByText(/must 后接动词原形/)).toBeVisible();
  await expect(analysis.getByText(/do not 后接动词原形/)).toBeVisible();

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
  await expect(answer.getByText('本题得分比例：100%')).toBeVisible();
  await expect(answer.getByText(/第二位说话者明确说了 on the second shelf/)).toHaveCount(0);
  await expect(analysis.getByText(/第二位说话者明确说了 on the second shelf/)).toBeVisible();
  await expect(analysis.getByText(/before taking a pair/)).toBeVisible();

  await page.goto(demo.link('translation'));
  await expect(stem.getByText('Leave the signed checklist on the front desk.')).toBeVisible();
  await expect(answer.getByText('Leave the signed checklist on the front desk.')).toHaveCount(0);
  await expect(card.getByText('参考译文', { exact: true })).toHaveCount(0);
  const translationInput = page.getByRole('textbox', { name: '中文译文' });
  await translationInput.fill('请将已签名的清单放在前台。');
  const grading = page.waitForResponse(r => r.url().endsWith('/answer') && r.ok());
  await submit();
  const result: AttemptResult = await (await grading).json();
  expect(result.attempt.correct).toBe(true);
  await expect(translationInput).toHaveCount(0);
  await expect(answer.getByText('参考译文', { exact: true })).toBeVisible();
  await expect(analysis.getByText(/signed 在这里修饰 checklist/)).toBeVisible();
});

test('cloze, listening and translation separate stem, answers and explanations in memorization', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  const card = page.locator('article.question-card');
  const stem = card.getByRole('region', { name: '题干与图例' });
  const answers = card.getByRole('region', { name: '参考答案' });
  const analysis = card.getByRole('region', { name: '答案解析', exact: true });

  await page.goto(demo.link('translation', 'memorize'));
  await expect(stem.getByText('Leave the signed checklist on the front desk.')).toBeVisible();
  await expect(answers.getByText('Leave the signed checklist on the front desk.')).toHaveCount(0);
  await expect(answers.getByRole('heading', { name: '参考译文' })).toBeVisible();
  await expect(answers.getByText('把已签字的清单留在前台。', { exact: true })).toBeVisible();
  await expect(answers.getByText('请将已签名的清单放在前台。')).toBeVisible();
  await expect(answers.getByText(/关键术语：/)).toBeVisible();
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(analysis.getByText(/signed 在这里修饰 checklist/)).toBeVisible();

  await page.goto(demo.link('cloze', 'memorize'));
  await expect(stem.getByText(/Every worker/)).toBeVisible();
  await expect(stem.getByText('空格 1: must')).toBeVisible();
  await expect(stem.getByText('空格 2: start')).toBeVisible();
  await expect(answers.getByText(/Every worker/)).toHaveCount(0);
  await expect(answers.getByRole('radio')).toHaveCount(0);
  await expect(answers.getByRole('group', { name: '空格 1' }).getByText('正确答案')).toBeVisible();
  await expect(answers.getByRole('group', { name: '空格 2' }).getByText('正确答案')).toBeVisible();
  await expect(answers.getByText(/must 后接动词原形/)).toHaveCount(0);
  await expect(analysis.getByText(/must 后接动词原形/)).toBeVisible();
  await expect(analysis.getByText(/do not 后接动词原形/)).toBeVisible();

  await page.goto(demo.link('listening', 'memorize'));
  await expect(stem.getByRole('region', { name: '听力音频播放' })).toBeVisible();
  await expect(answers.getByRole('radio')).toHaveCount(0);
  await expect(answers.getByRole('group', { name: '小题 1' }).getByText('On the second shelf.')).toBeVisible();
  await expect(answers.getByRole('group', { name: '小题 1' }).getByText('正确答案')).toBeVisible();
  await expect(answers.getByRole('group', { name: '小题 2' }).getByText('正确答案')).toBeVisible();
  await expect(answers.getByText(/第二位说话者明确说了 on the second shelf/)).toHaveCount(0);
  await expect(analysis.getByText(/第二位说话者明确说了 on the second shelf/)).toBeVisible();
  await expect(analysis.getByText(/before taking a pair/)).toBeVisible();
});

test('writing shows a sample in memorization and an editor in practice', async ({ page, request }) => {
  const demo = await demoUnit(request);
  const feedbackCalls: string[] = [];
  const practiceCalls: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/api/practice/presentations')) practiceCalls.push(r.url());
    if (r.url().endsWith('/feedback')) feedbackCalls.push(r.url());
  });
  const speech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    speech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.goto(demo.link('writing', 'memorize'));
  const card = page.locator('article.question-card');
  const stem = card.getByRole('region', { name: '题干与图例' });
  const reference = card.getByRole('region', { name: '参考答案', exact: true });
  const answer = card.getByRole('region', { name: '作答', exact: true });
  const analysis = card.getByRole('region', { name: '答案解析', exact: true });
  const sample = 'The delivery has been moved to Friday.';
  const response = 'Our delivery is now scheduled for Friday.';
  await expect(stem.getByRole('region', { name: '写作要求' })
    .getByText('至少 5 词，最多 20 词')).toBeVisible();
  await expect(reference.getByRole('heading', { name: '参考范文' })).toBeVisible();
  await expect(reference.getByText(sample, { exact: true })).toBeVisible();
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(card.getByRole('button', { name: '提交答案' })).toHaveCount(0);
  await expect(analysis.getByText(sample, { exact: true })).toHaveCount(0);
  await expect(analysis.getByText('has been moved to Friday', { exact: true })).toBeVisible();
  await expect(analysis.getByText('任务完成度（50 分）')).toBeVisible();
  await expect(analysis.getByText('语言准确性（50 分）')).toBeVisible();
  await stem.getByRole('button', { name: '播放发音', exact: true }).first().click();
  await expect.poll(() => speech[0]).toMatchObject({ text: 'delivery', voice: 'stella' });
  await reference.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech[1]).toMatchObject({ text: sample, voice: 'stella' });
  await card.getByRole('button', { name: '完整题目' }).click();
  await expect(page.getByRole('dialog').getByText(sample, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '完整解析' }).click();
  await expect(page.getByRole('dialog').getByText('语言准确性（50 分）')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(sample, { exact: true })).toHaveCount(0);
  expect(practiceCalls).toEqual([]);

  await page.goto(demo.link('writing'));
  await expect(stem.getByRole('region', { name: '写作要求' })).toBeVisible();
  const sampleRegion = card.getByRole('region', { name: '参考范文' });
  await expect(sampleRegion).toHaveCount(0);
  await expect(analysis).toHaveCount(0);
  const editor = answer.getByRole('textbox', { name: '写作答案' });
  await expect(editor).toHaveValue('');
  await editor.fill(response);
  await expect(card.getByText('词数：7')).toBeVisible();
  await card.getByRole('button', { name: '提交答案' }).click();
  await expect(editor).toHaveCount(0);
  await expect(answer.getByText('词数：7')).toBeVisible();
  await expect(answer.getByText(response, { exact: true })).toBeVisible();
  await expect(answer.getByText('参考范文')).toHaveCount(0);
  await expect(analysis.getByText(sample, { exact: true })).toBeVisible();
  await expect(analysis.getByText('语言准确性（50 分）')).toBeVisible();
  await sampleRegion.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech[2]).toMatchObject({ text: sample, voice: 'stella' });
  expect(feedbackCalls).toEqual([]);
  await card.getByRole('button', { name: '请求 AI 批改' }).click();
  await expect(card.getByText(/表达清楚，符合通知语境/)).toBeVisible();
  await expect(card.getByText(/任务完成度 50\/50/)).toBeVisible();
  expect(feedbackCalls).toHaveLength(1);
  await page.setViewportSize({ width: 620, height: 900 });
  await page.getByRole('button', { name: '查看解析' }).click();
  await expect(page.getByRole('dialog').getByText(sample, { exact: true })).toBeVisible();
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
  const passageSpeech = stem.getByRole('button', { name: '播放发音', exact: true });
  await expect(passageSpeech).toHaveCount(4);
  await passageSpeech.first().click();
  await expect.poll(() => speech[0]).toMatchObject({
    text: 'WORKSHOP NOTICE', voice: 'stella',
  });
  await passageSpeech.nth(1).click();
  await expect.poll(() => speech[1]).toMatchObject({
    text: 'The workshop opens at 8 a.m.', voice: 'stella',
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
  await page.getByRole('region', { name: '听力音频播放' })
    .getByRole('button', { name: '播放发音' }).click();
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

  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.getByRole('button', { name: '确认交卷' }).click();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '查看解析' }).click();
  const reviewDialog = page.getByRole('dialog');
  await expect(reviewDialog.getByText(/第二位说话者明确说了 on the second shelf/)).toBeVisible();
  await expect(reviewDialog.getByText(/before taking a pair/)).toBeVisible();
  await expect(reviewDialog.getByText('原题暂无解析。')).toHaveCount(0);
});

test('palace source and exam feedback render numeric answers, stimuli, and explanations', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  const source = page.getByRole('region', { name: '原题内容' });

  await page.goto(`/palace?subject=${demo.subject}&question=${demo.bySource('numbers-5')}`);
  await expect(source.getByText('正确答案：15')).toBeVisible();

  await page.goto(demo.link('cloze', 'palace'));
  await expect(source.getByText('空格 1: must')).toBeVisible();
  await expect(source.getByRole('radio')).toHaveCount(0);
  await source.getByText('原题解析').click();
  await expect(source.getByText(/must 后接动词原形/)).toBeVisible();

  await page.goto(demo.link('writing', 'palace'));
  await expect(source.getByRole('textbox')).toHaveCount(0);
  await expect(source.getByRole('heading', { name: '参考范文' })).toBeVisible();
  await source.getByText('原题解析').click();
  await expect(source.getByText('语言准确性（50 分）')).toBeVisible();

  const id = randomUUID();
  const created = await request.post('/api/exams', { data: { id, subject_id: demo.subject } });
  expect(created.ok()).toBe(true);
  const paper: ExamSession = await created.json();
  const clozeIdx = paper.items.findIndex(row => row.detail.question.question_id === demo.id('cloze'));
  expect(clozeIdx).toBeGreaterThanOrEqual(0);
  expect((await request.put(`/api/exams/${id}/cursor`, { data: { index: clozeIdx } })).ok()).toBe(true);
  await page.goto(`/exam?subject=${demo.subject}&exam=${id}`);
  await page.getByRole('radio', { name: 'has', exact: true }).check();
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  const feedback = page.getByRole('dialog', { name: '错题学习' });
  await expect(feedback.getByText(/Every worker/)).toBeVisible();
  await expect(feedback.getByText(/两处空格均考查情态动词 must/)).toBeVisible();
});
