import { expect, test } from '@playwright/test';

test('the catalog roadmap shows README relations and plans an advisory route', async ({ page }) => {
  await page.goto('/courses');
  await page.getByRole('tab', { name: '学习路线' }).click();
  await expect(page).toHaveURL(/\/courses\?tab=roadmap$/);

  const graph = page.getByRole('group', { name: '课程先修关系图' });
  await graph.getByRole('button', { name: '单片机与嵌入式开发，先修未完成' }).click();
  const embedded = page.getByRole('complementary', { name: '单片机与嵌入式开发详情' });
  await expect(embedded).toContainText('先修：电路基础 + C 语言程序设计');
  await expect(embedded).toContainText('课程说明：先学电路基础与 C 语言的条件、循环和函数。');
  await graph.getByRole('button', { name: 'PCB 设计与调试，先修未完成' }).click();
  await expect(page.getByRole('complementary', { name: 'PCB 设计与调试详情' }))
    .toContainText('建议先修：电路基础 + 单片机与嵌入式开发');
  await page.getByRole('button', { name: /^公差配合与测量/ }).click();
  await expect(page.getByRole('complementary', { name: '公差配合与测量详情' }))
    .toContainText('建议并行参数化建模与 3D 打印');
  await page.getByRole('button', { name: /^零基础英语/ }).click();
  const english = page.getByRole('complementary', { name: /^零基础英语.*详情$/ });
  await expect(english).toContainText('学完全部知识点即完成：已完成 0/33');
  await expect(english.getByRole('link', { name: '学习路径' })).toBeVisible();
  await expect(english.getByRole('button', { name: '标记已学完' })).toHaveCount(0);

  const goal = page.getByRole('form', { name: '路线目标' });
  await goal.getByLabel(/选择课程/).check();
  await goal.getByLabel('PCB 设计与调试').check();
  await goal.getByRole('button', { name: '生成学习路线' }).click();
  const route = page.getByRole('region', { name: '学习路线' });
  const steps = route.locator('.path-step');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('C 语言程序设计');
  await expect(steps.nth(0)).toContainText('下一步');
  await expect(steps.nth(2)).toContainText('先修：电路基础 + C 语言程序设计');
  await expect(steps.nth(3)).toContainText('建议先修：电路基础 + 单片机与嵌入式开发');
  await expect(steps.nth(3)).toContainText('先修不限制打开课程，也可以先开始。');
  await expect(route.getByText('已学完 0 · 剩余 4')).toBeVisible();

  // Courses with concepts complete through their learning paths.
  await expect(steps.nth(0).getByRole('link', { name: '学习路径' })).toBeVisible();
  await expect(route.getByRole('button', { name: '标记已学完' })).toHaveCount(0);

  // Prerequisites never block a course: a waiting course opens its workspace.
  await steps.nth(2).getByRole('link', { name: '打开课程' }).click();
  await expect(page).toHaveURL(/course=embedded-mcu/);

  // A course without concepts completes through its mark.
  await page.goto('/courses?tab=roadmap');
  await route.getByRole('button', { name: '重新规划' }).click();
  await goal.getByLabel('PCB 设计与调试').uncheck();
  await goal.getByLabel('代数、三角与空间几何').check();
  await goal.getByRole('button', { name: '生成学习路线' }).click();
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0)).toContainText('基础数学');
  await expect(steps.nth(1).getByRole('link', { name: '学习路径' })).toBeVisible();
  await steps.nth(0).getByRole('button', { name: '标记已学完' }).click();
  await expect(route.getByText('已学完 1 · 剩余 1')).toBeVisible();
  await expect(steps.nth(1)).toContainText('下一步');
  await expect(steps.nth(0).getByRole('button', { name: '取消已学完' })).toBeVisible();

  await page.reload();
  await expect(steps).toHaveCount(2);
  await expect(route.getByText('已学完 1 · 剩余 1')).toBeVisible();
});
