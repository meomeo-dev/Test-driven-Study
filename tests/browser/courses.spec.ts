import { expect, test } from '@playwright/test';
import type { ExamSession } from '../../web/src/api/exams';

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
  await expect(diagram).toHaveAttribute('src', /elementary-chinese\/versions\/1\.0\.1\/assets\/textbook/);
  await expect.poll(() => diagram.evaluate(image =>
    (image as HTMLImageElement).naturalWidth)).toBe(1024);
  for (const mode of modes) await expect(navigation.getByRole('link', { name: mode })).toBeVisible();
  await expect(page.getByText(/1 ÷ 4/)).toHaveCount(0);
  await page.goto('/memorize?subject=1');
  await expect(page).toHaveURL(/\/courses$/);
});

test('math uses the shared guide, exam terminal, assistant and memory palace', async ({ page, request }) => {
  await page.goto('/courses/basic-math');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '科目指南' }).click();
  await expect(page.getByRole('heading', { name: '科目指南', exact: true })).toBeVisible();
  await expect(page.getByText('四分之一', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: '模拟考试' }).click();
  await expect(page.getByRole('heading', { name: '分数与小数考试系统' })).toBeVisible();
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

  await page.goto(`/memorize?subject=${exam.subject_id}&question=${exam.items[index]!.detail.question.question_id}`);
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
  await expect(page.getByRole('heading', { name: '三角形考试系统' })).toBeVisible();
  await expect(page.getByText('1 题 · 5 分钟 · 满分 1 分 · 1 分合格')).toBeVisible();
  const rows = await (await request.get(`/api/analysis?subject=${subject}&days=0`)).json();
  expect(rows.overall.attempts).toBe(1);

  await page.getByRole('link', { name: '返回学习' }).click();
  await navigation.getByRole('link', { name: '记忆宫殿' }).click();
  await page.getByRole('button', { name: '查看完整提示词' }).click();
  await expect(page.getByRole('textbox', { name: '完整提示词' })).toHaveValue(/内角和[\s\S]*180/);
});
