import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CourseSummary, PracticeSummary } from '../../web/src/api/generated/types.gen';

async function subjectOf(request: APIRequestContext, course: string, unit: string) {
  const catalog: CourseSummary[] = await (await request.get('/api/courses')).json();
  const value = catalog.find(item => item.id === course)?.units.find(item => item.id === unit);
  expect(value).toBeDefined();
  return value!.subject_id;
}

// Answers every item tagged with a concept through the practice API.
async function answerConcept(request: APIRequestContext, subject: number, concept: string,
  answers: Record<string, string>) {
  const rows: PracticeSummary[] = await (await request.get(
    `/api/practice/questions?subject=${subject}&concept=${concept}`)).json();
  expect(rows.map(row => row.source_item_id).sort()).toEqual(Object.keys(answers).sort());
  for (const row of rows) {
    const id = `learning-path-${row.source_item_id}-${Date.now()}`;
    await request.post('/api/practice/presentations', { data: { id, question_id: row.question_id } });
    const result = await request.post(`/api/practice/presentations/${id}/answer`,
      { data: { selected: [], numeric: answers[row.source_item_id!] } });
    expect(result.ok()).toBe(true);
  }
}

test('a learner plans, practices, marks and replans a concept path', async ({ page, request }) => {
  const basics = await subjectOf(request, 'concept-graph', 'basics');
  await page.goto('/courses');
  await page.getByRole('link', { name: /知识图谱样例/ }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '学习路径' }).click();
  await expect(page.getByRole('heading', { name: '学习路径', exact: true })).toBeVisible();
  const goal = page.getByRole('form', { name: '学习目标' });
  await goal.getByLabel(/选择知识点/).check();
  await goal.getByLabel('文字题').check();
  await goal.getByRole('spinbutton').fill('20');
  await goal.getByRole('button', { name: '生成学习路径' }).click();

  const steps = page.locator('.path-step');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('计数');
  await expect(steps.nth(0)).toContainText('下一步');
  await expect(steps.nth(2)).toContainText('先修：加法');
  await expect(page.getByText('已掌握 0 · 自评 0 · 剩余 3')).toBeVisible();

  await steps.nth(0).getByRole('link', { name: '练习本知识点' }).click();
  await expect(page.getByRole('button', { name: '取消知识点筛选：计数' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /数一数/ })).toBeVisible();
  await answerConcept(request, basics, 'counting',
    { 'counting-1': '3', 'counting-2': '4', 'counting-3': '2' });
  await page.getByRole('button', { name: '取消知识点筛选：计数' }).click();
  await expect(page.getByRole('button', { name: /取消知识点筛选/ })).toHaveCount(0);

  await navigation.getByRole('link', { name: '学习路径' }).click();
  await expect(page.getByText('已掌握 1 · 自评 0 · 剩余 2')).toBeVisible();
  await expect(steps.nth(1)).toContainText('下一步');
  await steps.nth(1).getByRole('button', { name: '标记已会（自评）' }).click();
  await expect(page.getByText('已掌握 1 · 自评 1 · 剩余 1')).toBeVisible();
  await expect(steps.nth(1).getByRole('button', { name: '取消自评' })).toBeVisible();

  await page.getByRole('tab', { name: '知识图谱' }).click();
  await page.getByRole('button', { name: '文字题，可学习' }).click();
  const details = page.getByRole('complementary', { name: '文字题详情' });
  await expect(details).toContainText('加法；或 减法');
  await expect(details).toContainText('已作答 0/3 题');
  await expect(page.getByText(/虚线：可替代的先修组之一/)).toBeVisible();

  await page.getByRole('tab', { name: '学习路径' }).click();
  await page.getByRole('button', { name: '重新规划' }).click();
  await goal.getByLabel('整门课程').check();
  await goal.getByRole('button', { name: '生成学习路径' }).click();
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('减法');
  await page.reload();
  await expect(steps).toHaveCount(4);
});

test('the golden course template demonstrates learning paths and tagged practice', async ({
  page, request,
}) => {
  const subject = await subjectOf(request, 'golden-course-template', 'extended-practice');
  await page.goto('/courses/golden-course-template');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '学习路径', exact: true }).click();
  await page.getByRole('tab', { name: '知识图谱' }).click();
  await page.getByRole('button', { name: '交班复述（自评），未解锁' }).click();
  const details = page.getByRole('complementary', { name: '交班复述（自评）详情' });
  await expect(details).toContainText('读懂车间通知；或 撰写交班信息');
  await expect(details).toContainText('完成后可标记为已会');
  await expect(details.getByRole('link', { name: '指南' })).toBeVisible();

  await page.getByRole('tab', { name: '学习路径' }).click();
  const goal = page.getByRole('form', { name: '学习目标' });
  await goal.getByLabel(/选择知识点/).check();
  await goal.getByLabel('读懂车间通知').check();
  await goal.getByRole('button', { name: '生成学习路径' }).click();
  const steps = page.locator('.path-step');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('车间数字与数量');
  await expect(steps.nth(1)).toContainText('交班指令与用语');
  await expect(steps.nth(2)).toContainText('先修：车间数字与数量 + 交班指令与用语');
  await steps.nth(2).getByRole('link', { name: '练习本知识点' }).click();
  await expect(page.getByRole('button', { name: '取消知识点筛选：读懂车间通知' }))
    .toBeVisible();

  const rows: PracticeSummary[] = await (await request.get(
    `/api/practice/questions?subject=${subject}&concept=workplace-notices`)).json();
  expect(rows.map(row => row.source_item_id).sort()).toEqual([
    'sue1-extended-listening-passage', 'sue1-extended-listening-recording',
    'sue1-extended-reading', 'sue1-extended-reading-single-choice',
  ]);
});

test('courses without concepts show no learning path entry and an empty state', async ({ page, request }) => {
  const subject = await subjectOf(request, 'elementary-chinese', 'grade-1-term-1-pinyin');
  await page.goto(`/practice?subject=${subject}&course=elementary-chinese`);
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('link', { name: '答题模式' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '学习路径' })).toHaveCount(0);
  await page.goto(`/learning?subject=${subject}&course=elementary-chinese`);
  await expect(page.getByRole('heading', { name: '本课程尚未定义知识图谱' })).toBeVisible();
});
