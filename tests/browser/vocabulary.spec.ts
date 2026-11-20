import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CourseSummary, QuestionSummary } from '../../web/src/api/generated/types.gen';

async function studyTarget(
  request: APIRequestContext, courseId: string, unitId: string, sourceId?: string,
) {
  const catalog = await request.get('/api/courses');
  await expect(catalog).toBeOK();
  const courses: CourseSummary[] = await catalog.json();
  const course = courses.find(course => course.id === courseId);
  const unit = course?.units.find(unit => unit.id === unitId);
  if (!course || !unit) throw new Error(`Missing test course or unit: ${courseId}/${unitId}`);
  const params = new URLSearchParams({ subject: String(unit.subject_id) });
  if (sourceId) {
    const response = await request.get(`/api/questions?${params}`);
    await expect(response).toBeOK();
    const rows: QuestionSummary[] = await response.json();
    const row = rows.find(question => question.source_item_id === sourceId);
    if (!row) throw new Error(`Missing test question: ${sourceId}`);
    params.set('question', String(row.question_id));
  }
  return {
    memorizeUrl: `/memorize?${params}`,
    practiceUrl: `/practice?${params}`,
    vocabularyPath: `/api/courses/${course.id}/versions/${course.version}/${course.vocabulary_file}`,
  };
}

test('memorization opens the current question vocabulary and filters by category and language', async ({
  page, request,
}) => {
  const target = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'sue1-extended-listening',
  );
  let vocabularyRequests = 0;
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path === target.vocabularyPath) vocabularyRequests += 1;
  });
  await page.goto(target.memorizeUrl);
  const trigger = page.getByRole('button', { name: '生词本' });
  const currentQuestion = page.locator('.question-card .source-line');
  await expect(currentQuestion).toContainText('sue1-extended-listening');
  expect(vocabularyRequests).toBe(0);
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: '生词本' });
  await expect(dialog.getByRole('button', { name: '本题' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('heading', { name: 'glove', exact: true })).toBeVisible();
  await expect(dialog.getByText('接触零件前请戴上手套。')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'front desk', exact: true })).toHaveCount(0);
  expect(vocabularyRequests).toBeGreaterThan(0);

  const category = dialog.getByRole('combobox', { name: '词条分类' });
  await category.selectOption('collocation');
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await expect(dialog.getByRole('heading', { name: 'sign the checklist' })).toBeVisible();

  await dialog.getByRole('button', { name: '全课程' }).click();
  await category.selectOption('');
  const search = dialog.getByRole('searchbox', { name: '搜索词条' });
  await search.fill('晚点');
  await expect(dialog.getByRole('heading', { name: 'run late' })).toBeVisible();
  await search.fill('FRONT DESK');
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await expect(dialog.getByRole('heading', { name: 'front desk' })).toBeVisible();
  await search.fill('不存在的词条');
  await expect(dialog.getByRole('status')).toHaveText('当前范围内没有匹配的词条。');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(currentQuestion).toContainText('sue1-extended-listening');
});

test('beginner English vocabulary falls back to the unit and stays usable on mobile', async ({
  page, request,
}) => {
  const target = await studyTarget(request, 'beginner-english', 'intro', 'greetings-1');
  await page.setViewportSize({ width: 375, height: 810 });
  let assetAvailable = false;
  await page.route(url => url.pathname === target.vocabularyPath, route => {
    if (assetAvailable) return route.continue();
    return route.fulfill({ status: 503, json: { error: 'Fixture temporarily unavailable' } });
  });
  await page.goto(target.memorizeUrl);
  await expect(page.locator('.question-card .source-line')).toContainText('greetings-1');
  const trigger = page.getByRole('button', { name: '生词本' });
  await expect(trigger).toBeInViewport();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: '生词本' });
  await expect(dialog.getByRole('alert')).toHaveText('无法读取生词本。');
  assetAvailable = true;
  await dialog.getByRole('button', { name: '重试' }).click();
  await expect(dialog.getByRole('button', { name: '本单元' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('heading', { name: 'teammate' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'tray' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '本题' }).click();
  await expect(dialog.getByRole('status')).toHaveText('本题暂无关联词条，可切换到本单元查看。');
  await dialog.getByRole('button', { name: '全课程' }).click();
  await dialog.getByRole('searchbox', { name: '搜索词条' }).fill('托盘');
  await expect(dialog.getByRole('heading', { name: 'tray' })).toBeVisible();
  await expect(dialog).toBeInViewport({ ratio: 1 });
});

test('the vocabulary button is limited to supported subjects in memorization', async ({
  page, request,
}) => {
  const math = await studyTarget(request, 'basic-math', 'intro');
  await page.goto(math.memorizeUrl);
  await expect(page.locator('.question-card')).toBeVisible();
  await expect(page.getByRole('button', { name: '生词本' })).toHaveCount(0);

  const english = await studyTarget(request, 'golden-course-template', 'extended-practice');
  await page.goto(english.practiceUrl);
  await expect(page.locator('.question-card')).toBeVisible();
  await expect(page.getByRole('button', { name: '生词本' })).toHaveCount(0);
});

test('vocabulary entries play term and example TTS, render selective grammar, and handle errors on mobile', async ({
  page, request,
}) => {
  const target = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'sue1-extended-listening',
  );
  const speechRequests: { text: string; voice?: string; force?: boolean }[] = [];
  let failWith: { status: number; error: string } | undefined;
  await page.route('**/api/tts/synthesize', async route => {
    speechRequests.push(route.request().postDataJSON());
    if (failWith) {
      return route.fulfill({ status: failWith.status, json: { error: failWith.error } });
    }
    return route.fulfill({ json: { audio_url: '/api/audio/pinyin/ri4.mp3', voice: 'stella' } });
  });

  await page.route(url => url.pathname === target.vocabularyPath, async route => {
    await route.fulfill({
      json: [
        {
          id: 'shelf',
          unit_id: 'extended-practice',
          term: 'shelf',
          meaning: '搁板；置物架的一层',
          category: 'word',
          pos: 'n',
          grammar_note: '可数名词，复数 shelves（变 f 为 ves）',
          question_ids: ['sue1-extended-listening'],
          example: 'The spare parts are on the top shelf.',
          example_translation: '备用零件在最上层搁板上。',
        },
        {
          id: 'glove',
          unit_id: 'extended-practice',
          term: 'glove',
          meaning: '手套',
          category: 'word',
          question_ids: ['sue1-extended-listening'],
          example: 'Put on your gloves before you touch the parts.',
          example_translation: '接触零件前请戴上手套。',
        },
        {
          id: 'my-name-is',
          unit_id: 'extended-practice',
          term: 'My name is …',
          meaning: '我叫……',
          category: 'phrase',
          question_ids: ['sue1-extended-listening'],
          term_tts: { voice: 'tide', speed: 0.9 },
          example: 'My name is Mia Chen.',
          example_translation: '我叫陈米娅。',
        },
      ],
    });
  });

  await page.setViewportSize({ width: 375, height: 810 });
  await page.goto(target.memorizeUrl);
  await page.getByRole('button', { name: '生词本' }).click();

  const dialog = page.getByRole('dialog', { name: '生词本' });
  const items = dialog.getByRole('listitem');
  await expect(items).toHaveCount(3);

  const shelfItem = items.nth(0);
  await expect(shelfItem.locator('.vocabulary-pos')).toHaveText('名词');
  await expect(shelfItem.locator('.vocabulary-grammar-note'))
    .toHaveText('可数名词，复数 shelves（变 f 为 ves）');

  const gloveItem = items.nth(1);
  await expect(gloveItem.locator('.vocabulary-pos')).toHaveCount(0);
  await expect(gloveItem.locator('.vocabulary-grammar-note')).toHaveCount(0);

  const termPlay = gloveItem.getByRole('button', { name: '播放词条发音：glove' });
  const termRegen = gloveItem.getByRole('button', { name: '重新生成词条发音：glove' });
  const examplePlay = gloveItem.getByRole('button', { name: '播放例句发音：glove' });
  const exampleRegen = gloveItem.getByRole('button', { name: '重新生成例句发音：glove' });
  await expect(termPlay).toBeInViewport();
  await expect(termRegen).toBeInViewport();
  await expect(examplePlay).toBeInViewport();
  await expect(exampleRegen).toBeInViewport();

  await termPlay.click();
  await expect.poll(() => speechRequests[0]).toEqual({ text: 'glove', force: false });
  await termRegen.click();
  await expect.poll(() => speechRequests[1]).toEqual({ text: 'glove', force: true });
  await examplePlay.click();
  await expect.poll(() => speechRequests[2]).toEqual({
    text: 'Put on your gloves before you touch the parts.',
    force: false,
  });

  await items.nth(2).getByRole('button', { name: '播放词条发音：My name is …' }).click();
  await expect.poll(() => speechRequests[3]).toEqual({
    text: 'My name is',
    voice: 'tide',
    force: false,
  });

  failWith = { status: 503, error: 'TTS 语音服务未启用' };
  await shelfItem.getByRole('button', { name: '播放词条发音：shelf' }).click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('TTS 语音服务未启用');
  await expect(shelfItem.getByRole('button', { name: '播放词条发音：shelf' })).toBeEnabled();

  await dialog.getByRole('button', { name: '关闭语音提示' }).click();
  await expect(alert).toHaveCount(0);

  failWith = { status: 500, error: 'TTS 服务尚未配置 API Key，请在「服务设置」中配置' };
  await shelfItem.getByRole('button', { name: '播放例句发音：shelf' }).click();
  await expect(alert).toContainText('TTS 服务尚未配置 API Key');
  await dialog.getByRole('button', { name: '本单元' }).click();
  await expect(alert).toHaveCount(0);

  const overflow = await dialog.evaluate(el => ({
    dialogOverflow: el.scrollWidth > el.clientWidth,
    bodyOverflow: (el.querySelector('.modal-body')?.scrollWidth ?? 0)
      > (el.querySelector('.modal-body')?.clientWidth ?? 0),
  }));
  expect(overflow).toEqual({ dialogOverflow: false, bodyOverflow: false });
});

test('vocabulary TTS enforces mutual exclusion and stops on modal close', async ({
  page, request,
}) => {
  await page.addInitScript(() => {
    const win = window as typeof window & { __audioLog?: string[] };
    win.__audioLog = [];
    HTMLAudioElement.prototype.play = function () {
      win.__audioLog?.push(`play:${this.src}`);
      return Promise.resolve();
    };
    HTMLAudioElement.prototype.pause = function () {
      if (this.src) win.__audioLog?.push(`pause:${this.src}`);
    };
  });

  const target = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'sue1-extended-listening',
  );
  await page.route('**/api/tts/synthesize', async route => {
    const { text } = route.request().postDataJSON() as { text: string };
    const slug = text.split(/\s+/)[0]?.toLowerCase() || 'clip';
    await route.fulfill({
      json: {
        audio_url: `/api/audio/pinyin/ri4.mp3?clip=${encodeURIComponent(slug)}`,
        voice: 'stella',
      },
    });
  });

  await page.goto(target.memorizeUrl);
  await page.getByRole('button', { name: '生词本' }).click();
  const dialog = page.getByRole('dialog', { name: '生词本' });

  const inlineGap = await dialog.locator('.vocabulary-example-line').first().evaluate(line => {
    const text = line.querySelector('span')?.getBoundingClientRect();
    const controls = line.querySelector('.tts-audio-controls')?.getBoundingClientRect();
    if (!text || !controls) return null;
    return controls.left - text.right;
  });
  expect(inlineGap).not.toBeNull();
  expect(Math.abs(inlineGap!)).toBeLessThan(20);

  await dialog.getByRole('button', { name: '播放词条发音：glove' }).click();
  const stopGlove = dialog.getByRole('button', { name: '停止词条发音：glove' });
  await expect(stopGlove).toHaveAttribute('data-playing', 'true');

  await dialog.getByRole('button', { name: '播放例句发音：glove' }).click();
  await expect(dialog.getByRole('button', { name: '播放词条发音：glove' }))
    .not.toHaveAttribute('data-playing', 'true');
  await expect(dialog.getByRole('button', { name: '停止例句发音：glove' }))
    .toHaveAttribute('data-playing', 'true');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __audioLog?: string[] }).__audioLog)).toEqual([
    expect.stringContaining('play:'),
    expect.stringContaining('pause:'),
    expect.stringContaining('play:'),
    expect.stringContaining('pause:'),
  ]);
});
