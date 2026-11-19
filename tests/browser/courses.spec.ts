import { expect, test } from '@playwright/test';
import type { ExamSession } from '../../web/src/api/exams';
import type { CourseSummary, QuestionSummary } from '../../web/src/api/generated/types.gen';

test('both bundled courses use the existing workspace and keep their own practice history', async ({ page }) => {
  await page.goto('/courses');
  await page.getByRole('link', { name: /基础数学/ }).click();
  await expect(page.getByRole('link', { name: '基础数学首页' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /1 ÷ 4/ })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const modes = ['背题模式', '答题模式', '学习分析', '记忆宫殿', '科目指南', '模拟考试'];
  for (const mode of modes) await expect(navigation.getByRole('link', { name: mode })).toBeVisible();
  await navigation.getByRole('link', { name: '答题模式' }).click();
  await expect(page.getByText('题号 #4', { exact: true })).toBeVisible();
  const numeric = page.getByRole('textbox', { name: '数值答案' });
  await numeric.fill('0.26');
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('回答错误', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '再答一次' }).click();
  await numeric.fill('0.250');
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('回答正确', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: '学习分析' }).click();
  await page.getByRole('tab', { name: '错题本' }).click();
  await expect(page.getByText(/1 ÷ 4/).first()).toBeVisible();
  await navigation.getByRole('link', { name: '所有课程' }).click();
  await page.getByRole('link', { name: /小学语文/ }).click();
  await expect(page.getByRole('link', { name: '小学语文首页' })).toBeVisible();
  const diagram = page.getByRole('button', { name: '放大题目图片' }).getByRole('img');
  await expect(diagram).toHaveAttribute('src',
    /elementary-chinese\/versions\/1\.0\.4\/assets\/textbook/);
  await expect.poll(() => diagram.evaluate(image =>
    (image as HTMLImageElement).naturalWidth)).toBe(1024);
  for (const mode of modes) await expect(navigation.getByRole('link', { name: mode })).toBeVisible();
  await expect(page.getByText(/1 ÷ 4/)).toHaveCount(0);
  await page.goto('/memorize?subject=1');
  await expect(page).toHaveURL(/\/courses$/);
});

test('elementary Chinese plays local Pinyin and sends only Han text to TTS', async ({ page }) => {
  const synthesized: string[] = [];
  const forceSynthesis: boolean[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    const input = route.request().postDataJSON();
    expect(input).not.toHaveProperty('voice');
    synthesized.push(input.text);
    forceSynthesis.push(input.force);
    await route.fulfill({
      json: { audio_url: '/api/audio/pinyin/ri4.mp3' },
    });
  });
  await page.goto('/courses/elementary-chinese');
  const stem = page.getByRole('region', { name: '题干与图例' });
  await expect(stem).toContainText('l___ yǔ');
  for (const [final, clip] of [['ie', 'ye1'], ['ei', 'ei1']]) {
    const playback = page.waitForResponse(r => r.url().endsWith(`/api/audio/pinyin/${clip}.mp3`));
    await stem.getByRole('button', { name: `播放拼音：${final}`, exact: true }).click();
    expect((await playback).ok()).toBe(true);
  }
  const lei = page.waitForResponse(r => r.url().endsWith('/api/audio/pinyin/lei2.mp3'));
  const yu = page.waitForResponse(r => r.url().endsWith('/api/audio/pinyin/yu3.mp3'));
  await stem.getByRole('button', { name: /播放拼音：\s*l___ yǔ/ }).click();
  expect((await lei).ok()).toBe(true);
  expect((await yu).ok()).toBe(true);
  expect((await page.request.get('/api/audio/pinyin/yi1fu5.mp3')).ok()).toBe(true);
  await expect(stem.getByRole('button', { name: '重新生成发音' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '播放解析' })).toBeVisible();
  expect(synthesized).toEqual([]);

  const presented = page.waitForResponse(r =>
    r.url().endsWith('/api/practice/presentations') && r.ok());
  await page.getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '答题模式' }).click();
  const presentation = await (await presented).json();
  expect(presentation.detail.question).not.toHaveProperty('analysis_audio');
  await expect(page.getByRole('button', { name: '播放解析' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新生成解析语音' })).toHaveCount(0);
  const choices = page.getByRole('group', { name: '选择答案' });
  await expect(choices.getByRole('button', { name: /^播放拼音：/ })).toHaveCount(4);
  const localClip = page.waitForResponse(r => r.url().endsWith('/api/audio/pinyin/ye2.mp3'));
  await choices.getByRole('button', { name: '播放拼音：ié', exact: true }).click();
  expect((await localClip).headers()['content-type']).toBe('audio/mpeg');
  await expect(choices.getByRole('button', { name: '停止发音', exact: true })).toBeVisible();
  await expect(choices.getByRole('button', { name: '选项1：ié', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
  expect(synthesized).toEqual([]);

  await choices.getByRole('button', { name: '选项3：éi', exact: true }).click();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await page.getByRole('button', { name: '播放解析', exact: true }).click();
  const explanation = [
    '雷雨读。',
    '雷是第二声，声调标在这个字母上。',
  ];
  await expect.poll(() => synthesized).toEqual(explanation);
  expect(forceSynthesis).toEqual([false, false]);

  await page.getByRole('button', { name: '重新生成解析语音' }).click();
  await expect.poll(() => synthesized).toEqual([...explanation, ...explanation]);
  expect(forceSynthesis).toEqual([false, false, true, true]);

  const url = new URL(page.url());
  const subject = url.searchParams.get('subject');
  const list = await (await page.request.get(`/api/practice/questions?subject=${subject}`)).json();
  const butterfly = list.find((row: { source_item_id: string }) =>
    row.source_item_id === 'pinyin-04-4-2');
  url.searchParams.set('question', String(butterfly.question_id));
  await page.goto(url.href);
  const first = page.waitForResponse(r => r.url().endsWith('/api/audio/pinyin/hu2.mp3'));
  const next = page.waitForResponse(r => r.url().endsWith('/api/audio/pinyin/die2.mp3'));
  await choices.getByRole('button', { name: '播放拼音：hú dié', exact: true }).click();
  expect((await first).ok()).toBe(true);
  expect((await next).ok()).toBe(true);
  expect(synthesized).toHaveLength(4);
});

test('English dialogue plays all three turns in the authored voices', async ({ page, request }) => {
  const courses: CourseSummary[] = await (await request.get('/api/courses')).json();
  const subject = courses.find(course => course.id === 'beginner-english')
    ?.units.find(unit => unit.id === 'tools-equipment')?.subject_id;
  expect(subject).toBeDefined();
  const questions: QuestionSummary[] =
    await (await request.get(`/api/questions?subject=${subject}`)).json();
  const question = questions.find(item => item.source_item_id === 'te-mc-03');
  expect(question).toBeDefined();

  const voices: string[] = [];
  await page.route('**/api/tts/synthesize', async route => {
    voices.push(route.request().postDataJSON().voice);
    await route.fulfill({
      json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: voices.at(-1) },
    });
  });
  await page.goto(`/memorize?subject=${subject}&question=${question?.question_id}`);
  const listening = page.getByRole('region', { name: '听力音频播放' });
  await listening.getByRole('button', { name: '播放发音' }).click();
  await expect.poll(() => voices, { timeout: 10_000 })
    .toEqual(['stella', 'tide', 'stella']);
  await expect(listening.getByRole('button', { name: '播放发音' })).toBeVisible();
});

test('long original question IDs stay inside navigation tiles', async ({ page, request }) => {
  const courses: CourseSummary[] = await (await request.get('/api/courses')).json();
  const subject = courses.find(course => course.id === 'beginner-english')
    ?.units.find(unit => unit.id === 'intro')?.subject_id;
  expect(subject).toBeDefined();
  const questions: QuestionSummary[] =
    await (await request.get(`/api/questions?subject=${subject}`)).json();
  const originalID = 'self-introduction-5';
  const question = questions.find(item => item.source_item_id === originalID);
  expect(question).toBeDefined();

  await page.goto(`/practice?subject=${subject}&question=${question?.question_id}`);
  await page.getByRole('button', { name: '题目导航', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '题目导航', exact: true });
  const tiles = drawer.getByRole('button', { name: /^第\d+题，原题号/ });
  const current = drawer.getByRole('button', { name: /原题号self-introduction-5，/ });
  await expect(tiles).toHaveCount(questions.length);
  await expect(current).toHaveAttribute('aria-current', 'true');
  await expect(current.getByText(`#${originalID}`, { exact: true })).toBeVisible();

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await drawer.getByRole('button', { name: '定位当前题' }).click();
    await expect(current).toBeInViewport({ ratio: 1 });
    await expect(current).toBeFocused();
    const overflowing = await tiles.evaluateAll(buttons => buttons.filter(button => {
      const bounds = button.getBoundingClientRect();
      const content = document.createRange();
      content.selectNodeContents(button);
      return Array.from(content.getClientRects()).some(rect =>
        rect.left < bounds.left || rect.right > bounds.right ||
        rect.top < bounds.top || rect.bottom > bounds.bottom);
    }).map(button => button.getAttribute('aria-label')));
    expect(overflowing, `tile content at viewport width ${width}`).toEqual([]);
  }
});

test('math uses the shared guide, exam terminal, assistant and memory palace', async ({ page, request }) => {
  await page.goto('/courses/basic-math');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '科目指南' }).click();
  await expect(page.getByRole('heading', { name: '科目指南', exact: true })).toBeVisible();
  await expect(page.getByText('四分之一', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: '模拟考试' }).click();
  await expect(page.getByRole('heading', { name: '分数与小数模拟考试系统' })).toBeVisible();
  const creating = page.waitForResponse(r =>
    r.url().endsWith('/api/exams') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '开始考试', exact: true }).click();
  const exam: ExamSession = await (await creating).json();
  expect(exam.items).toHaveLength(4);
  const index = exam.items.findIndex(item => item.detail.question.source_item_id === '4');
  expect(index).toBeGreaterThanOrEqual(0);
  const card = page.getByRole('table', { name: '考试答题卡' });
  await card.getByRole('button', { name: `第${index + 1}题，未答` }).click();
  const answer = page.getByRole('textbox', { name: '数值答案' });
  await answer.fill('0.250');
  await card.getByRole('button', { name: `第${index === 0 ? 2 : 1}题，未答` }).click();
  await expect(card.getByRole('button', { name: `第${index + 1}题，正确` })).toBeVisible();
  await page.reload();
  await expect(card.getByRole('button', { name: `第${index + 1}题，正确` })).toBeVisible();
  const resumed: ExamSession = await (await request.get(`/api/exams/${exam.id}`)).json();
  expect(resumed.deadline_at_ms).toBe(exam.deadline_at_ms);
  expect(resumed.items[index]?.numeric).toBe('0.250');

  const markedQuestion = exam.items[index]!.detail.question.question_id;
  await page.goto(`/memorize?subject=${exam.subject_id}&question=${markedQuestion}`);
  await page.getByRole('button', { name: '询问本题 · 学习助手' }).click();
  const tutor = page.getByRole('dialog', { name: '学习助手 AI' });
  await tutor.getByRole('textbox', { name: '向学习助手提问' }).fill('请解释这个分数');
  await tutor.getByRole('button', { name: '发送问题' }).click();
  await expect(tutor.locator('.tutor-reply-note')).toContainText('已检索参考资料');
  await expect(tutor.getByRole('link', { name: '分数测试来源' }))
    .toHaveAttribute('href', 'https://example.edu/fractions');
  await page.keyboard.press('Escape');
  await navigation.getByRole('link', { name: '记忆宫殿' }).click();
  await page.getByRole('button', { name: '查看完整提示词' }).click();
  await expect(page.getByRole('textbox', { name: '完整提示词' }))
    .toHaveValue(/把换算关系画成一个清楚的数学模型[\s\S]*1 ÷ 4[\s\S]*0\.25/);
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  const marker = 'math-model-fixture';
  await page.getByLabel('宫殿地址（可选）').fill(marker);
  const creatingImage = page.waitForResponse(r =>
    r.url().endsWith('/api/palaces/jobs') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '生成一张', exact: true }).click();
  const created = await (await creatingImage).json();
  await expect(page.getByRole('button', { name: '放大记忆宫殿图片' })).toBeVisible();
  const job = await (await request.get(`/api/palaces/jobs/${created.id}`)).json();
  expect(job.snapshot.ai_profile_version)
    .toEqual({ course_id: 'basic-math', course_version: '1.2.0' });
  const events: { kind: string; source: string; has_search?: boolean; instructions?: string }[] =
    await (await request.get('http://127.0.0.1:43289/test/events')).json();
  const relevant = events.filter(event => event.source.includes(marker));
  const planning = relevant.filter(event => event.kind === 'llm');
  expect(planning.map(event => event.has_search)).toEqual([true, false]);
  expect(planning[0]?.instructions).toContain('the whole that represents 1 or 100%');
  expect(planning[1]?.instructions).toContain('Hand off one countable diagram');
  const image = relevant.find(event => event.kind === 'image')!;
  expect(JSON.parse(image.source).prompt).toBe(job.snapshot.prompt);
  expect(job.snapshot.prompt).toContain('四个同宽格的条带');
  expect(job.snapshot.prompt).toContain('1/4 = 0.25');

  await test.step('the question drawer preserves each study mode', async () => {
    const nextQuestion = exam.items.find(item =>
      item.detail.question.source_item_id === '5')!.detail.question.question_id;
    const trigger = page.getByRole('button', { name: '题目导航', exact: true });
    const drawer = page.getByRole('dialog', { name: '题目导航', exact: true });
    const marked = drawer.getByRole('button', { name: /^第1题，原题号4，/ });
    const next = drawer.getByRole('button', { name: /^第2题，原题号5，/ });

    for (const mode of ['memorize', 'practice', 'palace']) {
      const practice = mode === 'practice';
      const params = new URLSearchParams({
        subject: String(exam.subject_id), question: String(markedQuestion),
      });
      if (practice) params.set('q', '等于');
      await page.goto(`/${mode}?${params}`);
      if (mode === 'memorize') {
        await expect(page.getByRole('heading', { name: /1 ÷ 4/ })).toBeVisible();
      }
      await trigger.click();
      const states = practice ? ['未作答', '最近答对', '最近答错'] : ['未学习', '已记住', '待复习'];
      for (const state of states) {
        await expect(drawer.getByText(state, { exact: true })).toBeVisible();
      }
      await expect(drawer.getByRole('button', { name: /^第\d+题，原题号/ }))
        .toHaveCount(practice ? 3 : 4);
      await expect(marked).toHaveAttribute('aria-current', 'true');
      await expect(marked.getByText('#4', { exact: true })).toBeVisible();
      await expect(marked).toHaveAccessibleName(/有记忆画面/);
      await expect(marked).toHaveAccessibleName(/有对话记录/);

      if (mode === 'memorize') {
        await expect(marked).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(next).toBeFocused();
        await drawer.getByRole('button', { name: '定位当前题' }).click();
        await expect(marked).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
        await expect(trigger).toBeFocused();
        await page.keyboard.press('n');
        await expect(marked).toBeFocused();
      }
      await next.click();
      await expect(drawer).toBeHidden();
      await expect(page).toHaveURL(url => url.pathname === `/${mode}`
        && url.searchParams.get('subject') === params.get('subject')
        && url.searchParams.get('question') === String(nextQuestion)
        && url.searchParams.get('q') === params.get('q'));
    }
  });
});

test('a question-only package joins the shared workspace after installation', async ({ page, request }) => {
  await page.goto('/courses');
  await page.getByRole('link', { name: /平面图形/ }).click();
  await expect(page.getByRole('heading', { name: /平面三角形的内角和/ })).toBeVisible();
  const subject = Number(new URL(page.url()).searchParams.get('subject'));
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '答题模式' }).click();
  await expect(page.getByText('题号 #4', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '数值答案' }).fill('180');
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('回答正确', { exact: true })).toBeVisible();

  await navigation.getByRole('link', { name: '科目指南' }).click();
  await expect(page.getByText('模拟考试从本单元题库抽题。', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: '模拟考试' }).click();
  await expect(page.getByRole('heading', { name: '三角形模拟考试系统' })).toBeVisible();
  await expect(page.getByText('1 题 · 5 分钟 · 满分 1 分 · 1 分合格')).toBeVisible();
  const rows = await (await request.get(`/api/analysis?subject=${subject}&days=0`)).json();
  expect(rows.overall.attempts).toBe(1);

  await page.getByRole('link', { name: '返回学习' }).click();
  await navigation.getByRole('link', { name: '记忆宫殿' }).click();
  await page.getByRole('button', { name: '查看完整提示词' }).click();
  await expect(page.getByRole('textbox', { name: '完整提示词' })).toHaveValue(/内角和[\s\S]*180/);
});
