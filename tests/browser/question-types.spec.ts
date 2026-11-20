import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import type { AttemptResult, CourseSummary, ExamSession, PracticeSummary, QuestionDetail } from
  '../../web/src/api/generated/types.gen';

async function demoUnit(request: APIRequestContext) {
  const courses: CourseSummary[] = await (await request.get('/api/courses')).json();
  const subject = courses.find(c => c.id === 'golden-course-template')
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
  const clozeSpeech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    clozeSpeech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });
  await page.goto(demo.link('cloze'));
  await expect(stem.getByText(/Every worker/)).toBeVisible();
  await expect(stem.getByRole('button', { name: '播放发音', exact: true })).toHaveCount(0);
  await expect(answer.getByText(/Every worker/)).toHaveCount(0);
  await stem.getByRole('button', { name: '跳转到空格 1' }).click();
  await expect(answer.getByRole('radio', { name: 'must', exact: true })).toBeFocused();
  await answer.getByRole('radio', { name: 'must', exact: true }).check();
  await expect(stem.getByRole('button', { name: '跳转到空格 1' })).toHaveText('must');
  await expect(card.getByText('本题得分比例：50%')).toHaveCount(0);
  await submit();
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => clozeSpeech[0]).toMatchObject({
    text: 'Every worker must sign the checklist. Do not start the equipment without permission.',
    voice: 'stella',
  });
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

  const translationSpeech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    translationSpeech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.goto(demo.link('translation'));
  await expect(stem.getByText('Leave the signed checklist on the front desk.')).toBeVisible();
  await expect(answer.getByText('Leave the signed checklist on the front desk.')).toHaveCount(0);
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => translationSpeech[0]).toMatchObject({
    text: 'Leave the signed checklist on the front desk.',
    voice: 'stella',
  });
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

  const translationSpeech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    translationSpeech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.goto(demo.link('translation', 'memorize'));
  await expect(stem.getByText('Leave the signed checklist on the front desk.')).toBeVisible();
  await expect(answers.getByText('Leave the signed checklist on the front desk.')).toHaveCount(0);
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => translationSpeech[0]).toMatchObject({
    text: 'Leave the signed checklist on the front desk.',
    voice: 'stella',
  });
  await expect(answers.getByRole('heading', { name: '参考译文' })).toBeVisible();
  await expect(answers.getByText('把已签字的清单留在前台。', { exact: true })).toBeVisible();
  await expect(answers.getByText('请将已签名的清单放在前台。')).toBeVisible();
  await expect(answers.getByText(/关键术语：/)).toBeVisible();
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(analysis.getByText(/signed 在这里修饰 checklist/)).toBeVisible();

  await page.goto(`/memorize?subject=${demo.subject}&question=${demo.bySource('sue1-extended-translation-zh-to-en')}`);
  await answers.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => translationSpeech[1]).toMatchObject({
    text: 'Please hand the signed checklist to the next shift and put the empty boxes by the loading door before three p.m.',
    voice: 'stella',
  });

  await page.goto(demo.link('cloze', 'memorize'));
  await expect(stem.getByText(/Every worker/)).toBeVisible();
  await expect(stem.getByText('空格 1: must')).toBeVisible();
  await expect(stem.getByText('空格 2: start')).toBeVisible();
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => translationSpeech[2]).toMatchObject({
    text: 'Every worker must sign the checklist. Do not start the equipment without permission.',
    voice: 'stella',
  });
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

  await page.goto(`/memorize?subject=${demo.subject}&question=${demo.bySource('sue1-extended-writing-full')}`);
  const sampleButtons = reference.getByRole('button', { name: '播放发音', exact: true });
  await expect(sampleButtons).toHaveCount(3);
  await sampleButtons.first().click();
  await expect.poll(() => speech[3]).toMatchObject({
    text: 'A clear handover helps the next shift start work without guessing. Both paper and digital checklists can help, but they have different strengths.',
    voice: 'stella',
  });
  await sampleButtons.nth(2).click();
  await expect.poll(() => speech[4]).toMatchObject({
    text: 'I would use the digital checklist every day and keep printed copies as a backup. If the tablet stops working, workers can write the date, time, and any unfinished tasks on paper. The shift lead can add those notes to the digital record later.',
    voice: 'stella',
  });

  await page.goto(demo.link('judgment', 'memorize'));
  await stem.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech[5]).toMatchObject({
    text: 'The word equipment normally takes the plural form equipments.',
    voice: 'stella',
  });

  await page.goto(`/memorize?subject=${demo.subject}&question=${demo.bySource('sue1-extended-reading-single-choice')}`);
  await stem.getByRole('button', { name: '播放发音', exact: true }).first().click();
  await expect.poll(() => speech[6]).toMatchObject({
    text: 'Locker room notice.',
    voice: 'stella',
  });
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
  await expect(passageSpeech).toHaveCount(3);
  await passageSpeech.first().click();
  await expect.poll(() => speech[0]).toMatchObject({
    text: 'The workshop opens at 8 a.m.', voice: 'stella',
  });
  await passageSpeech.nth(1).click();
  await expect.poll(() => speech[1]).toMatchObject({
    text: 'Visitors must sign in at the front desk and wear a visitor badge.', voice: 'stella',
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

test('reading translation stays aligned and shares the full-question switch', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  const card = page.locator('article.question-card');
  const passage = card.getByRole('region', { name: '阅读材料' });
  const answers = card.getByRole('region', { name: '参考答案' });
  const toggle = card.getByRole('switch', { name: '英中对照' });
  const translatedSentence = '车间上午八点开放。';
  const translatedOption = '收回访客证。';
  await page.setViewportSize({ width: 375, height: 820 });
  await page.goto(demo.link('reading', 'memorize'));
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const pairs = passage.locator('.study-passage > div');
  await expect(pairs).toHaveCount(4);
  await expect(pairs.nth(1)).toContainText('The workshop opens at 8 a.m.');
  await expect(pairs.nth(1).getByText(translatedSentence, { exact: true })).toBeVisible();
  const distractor = answers.getByRole('listitem').filter({
    has: page.getByText('Collect the badges.', { exact: true }),
  });
  await expect(distractor.getByText(translatedOption, { exact: true })).toBeVisible();
  await expect(answers.getByText('访客必须做什么？', { exact: true })).toBeVisible();
  await expect.poll(() => passage.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveText('仅原文');
  await expect(passage.getByText(translatedSentence, { exact: true })).toHaveCount(0);
  await expect(distractor.getByText(translatedOption, { exact: true })).toHaveCount(0);
  await expect(pairs.nth(1)).toContainText('The workshop opens at 8 a.m.');
  await card.getByRole('button', { name: '完整题目' }).click();
  const dialog = page.getByRole('dialog');
  const dialogToggle = dialog.getByRole('switch', { name: '英中对照' });
  await expect(dialogToggle).toHaveAttribute('aria-checked', 'false');
  await expect(dialog.getByText(translatedSentence, { exact: true })).toHaveCount(0);
  await dialogToggle.click();
  await expect(dialog.getByText(translatedSentence, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(passage.getByText(translatedSentence, { exact: true })).toBeVisible();

  await page.goto(demo.link('reading'));
  await expect(passage.getByText('The workshop opens at 8 a.m.', { exact: true })).toBeVisible();
  await expect(passage.getByText(translatedSentence, { exact: true })).toHaveCount(0);
  await expect(toggle).toHaveCount(0);
});

test('memorization transcript translation preserves dialogue, monologue and recording audio', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  const card = page.locator('article.question-card');
  const stem = card.getByRole('region', { name: '题干与图例' });
  const audio = stem.getByRole('region', { name: '听力音频播放' });
  const transcript = stem.getByRole('region', { name: '本题逐字稿' });
  const speech: { text: string; voice: string }[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    speech.push(route.request().postDataJSON());
    await route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.goto(demo.link('listening', 'memorize'));
  await stem.getByText('查看英中逐字稿', { exact: true }).click();
  const translatedLine = '下一班要用的手套放在哪里？';
  await expect(transcript.getByText(translatedLine, { exact: true })).toBeVisible();
  await card.getByRole('switch', { name: '英中对照' }).click();
  await expect(transcript.getByText(translatedLine, { exact: true })).toHaveCount(0);
  await expect(transcript.getByText('Where are the gloves for the new shift?')).toBeVisible();
  await audio.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => speech).toMatchObject([
    { text: 'Where are the gloves for the new shift?', voice: 'tide' },
    {
      text: 'They are on the second shelf. Please sign the checklist before taking a pair.',
      voice: 'stella',
    },
  ]);

  await page.goto(demo.link('listening-passage', 'memorize'));
  await stem.getByText('查看英中逐字稿', { exact: true }).click();
  await expect(transcript.getByText('库房今天四点关门。', { exact: true })).toBeVisible();
  await expect(transcript.getByText('备用手套在门旁的蓝色柜子里。', { exact: true })).toBeVisible();
  await expect(transcript.getByRole('button', { name: '播放发音', exact: true })).toHaveCount(1);
  await audio.getByRole('button', { name: '播放发音', exact: true }).click();
  const monologue = 'The storeroom will close at four today. '
    + 'If you need new gloves, collect them before three thirty. '
    + 'The spare gloves are in the blue cabinet next to the door.';
  await expect.poll(() => speech.slice(2)).toMatchObject([{ text: monologue, voice: 'stella' }]);

  await page.goto(demo.link('listening-recording', 'memorize'));
  const recording = stem.locator('audio.question-audio');
  await expect(recording).toHaveAttribute('src', /delivery-delay\.mp3$/);
  await stem.getByText('查看英中逐字稿', { exact: true }).click();
  await expect(transcript.getByText(/今天早上的送货晚点了。/)).toBeVisible();
  await expect.poll(() => recording.evaluate(el => (el as HTMLAudioElement).readyState))
    .toBeGreaterThanOrEqual(1);
});

test('memorization keeps the original transcript on a legacy question payload', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  await page.route(`**/api/questions/${demo.id('listening')}`, async route => {
    const response = await route.fetch();
    const detail: QuestionDetail = await response.json();
    if (detail.question.question_type === 'listening' && detail.question.question_review) {
      delete detail.question.question_review.study_translation;
    }
    await route.fulfill({ response, json: detail });
  });
  await page.goto(demo.link('listening', 'memorize'));
  const card = page.locator('article.question-card');
  await expect(card.getByRole('switch', { name: '英中对照' })).toHaveCount(0);
  await card.getByText('查看逐字稿', { exact: true }).click();
  await expect(card.getByRole('region', { name: '本题逐字稿' })
    .getByText('Where are the gloves for the new shift?')).toBeVisible();
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

test('all 9 question types render cleanly and non-media types isolate audio in practice, memorization, and exam', async ({
  page,
  request,
}) => {
  const demo = await demoUnit(request);
  const items: PracticeSummary[] =
    await (await request.get(`/api/practice/questions?subject=${demo.subject}`)).json();

  const expectedTypes: Array<[string, PracticeSummary['question_type'], string]> = [
    ['numbers-1', 'single_choice', '单选题'],
    ['numbers-3', 'multiple_choice', '多选题'],
    ['sue1-extended-judgment', 'true_false', '判断题'],
    ['numbers-5', 'numeric', '数值题'],
    ['sue1-extended-cloze', 'cloze', '完形填空'],
    ['sue1-extended-listening', 'listening', '听力题'],
    ['sue1-extended-reading', 'reading_comprehension', '阅读理解'],
    ['sue1-extended-writing', 'writing', '写作题'],
    ['sue1-extended-translation', 'translation', '翻译题'],
  ];

  const nonMediaTypes = new Set<PracticeSummary['question_type']>([
    'cloze',
    'reading_comprehension',
    'writing',
    'translation',
  ]);

  for (const [sourceId, expectedType, label] of expectedTypes) {
    const summary = items.find(row => row.source_item_id === sourceId);
    expect(summary?.question_type).toBe(expectedType);

    for (const mode of ['practice', 'memorize'] as const) {
      await page.goto(`/${mode}?subject=${demo.subject}&question=${summary!.question_id}`);
      const card = page.locator('article.question-card');
      await expect(card.locator('.type-badge')).toHaveText(label);

      if (nonMediaTypes.has(expectedType)) {
        await expect(card.getByRole('region', { name: '听力音频播放' })).toHaveCount(0);
        await expect(card.getByText('查看逐字稿')).toHaveCount(0);
        await expect(card.locator('audio.question-audio')).toHaveCount(0);
      }
    }
  }

  // Positive listening check in practice & memorization.
  await page.goto(demo.link('listening'));
  await expect(page.getByRole('region', { name: '听力音频播放' })).toBeVisible();
  await expect(page.getByText('查看逐字稿')).toBeVisible();

  // Negative cross-type isolation & 9-type prompt verification in Exam.
  const existingExams: { id: string; status: string }[] =
    await (await request.get(`/api/exams?subject=${demo.subject}`)).json();
  for (const active of existingExams.filter(e => e.status === 'in_progress')) {
    await request.post(`/api/exams/${active.id}/submit`, { data: {} });
  }
  const examId = randomUUID();
  const created = await request.post('/api/exams', {
    data: { id: examId, subject_id: demo.subject },
  });
  expect(created.ok()).toBe(true);
  const paper: ExamSession = await created.json();

  for (const [sourceId, expectedType, label] of expectedTypes) {
    const qid = demo.bySource(sourceId);
    const idx = paper.items.findIndex(row => row.detail.question.question_id === qid);
    expect(idx).toBeGreaterThanOrEqual(0);
    const examQuestion = paper.items[idx]!.detail.question;
    expect(examQuestion.question_type).toBe(expectedType);

    if (nonMediaTypes.has(expectedType)) {
      expect(examQuestion).not.toHaveProperty('audio_url');
      expect(examQuestion).not.toHaveProperty('transcript_url');
      expect(examQuestion).not.toHaveProperty('transcript_lines');
    }

    const moved = await request.put(`/api/exams/${examId}/cursor`, { data: { index: idx } });
    expect(moved.ok()).toBe(true);
    await page.goto(`/exam?subject=${demo.subject}&exam=${examId}`);
    await expect(page.getByText(`操作提示：${label}`)).toBeVisible();

    if (nonMediaTypes.has(expectedType)) {
      await expect(page.getByRole('region', { name: '听力音频播放' })).toHaveCount(0);
      await expect(page.getByText('查看逐字稿')).toHaveCount(0);
      await expect(page.locator('audio.question-audio')).toHaveCount(0);
    } else if (expectedType === 'listening') {
      await expect(page.getByRole('region', { name: '听力音频播放' })).toBeVisible();
      await expect(page.getByText('查看逐字稿')).toHaveCount(0);
    }
  }
  await request.post(`/api/exams/${examId}/submit`, { data: {} });
});
