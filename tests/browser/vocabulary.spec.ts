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
