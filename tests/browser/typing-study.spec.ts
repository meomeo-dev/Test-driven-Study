import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CourseSummary, QuestionSummary } from '../../web/src/api/generated/types.gen';

async function studyTarget(
  request: APIRequestContext, courseId: string, unitId: string, sourceId: string,
) {
  const catalog = await request.get('/api/courses');
  await expect(catalog).toBeOK();
  const courses: CourseSummary[] = await catalog.json();
  const course = courses.find(item => item.id === courseId);
  const unit = course?.units.find(item => item.id === unitId);
  if (!course || !unit) throw new Error(`Missing test course or unit: ${courseId}/${unitId}`);
  const params = new URLSearchParams({ subject: String(unit.subject_id) });
  const response = await request.get(`/api/questions?${params}`);
  await expect(response).toBeOK();
  const rows: QuestionSummary[] = await response.json();
  const row = rows.find(item => item.source_item_id === sourceId);
  if (!row) throw new Error(`Missing test question: ${sourceId}`);
  params.set('question', String(row.question_id));
  return {
    memorizeUrl: `/memorize?${params}`,
    practiceUrl: `/practice?${params}`,
    palaceUrl: `/palace?${params}`,
  };
}

test('floating typing study extracts cloze answers, supports recall/hint, and auto-scrolls long writing', async ({
  page, request,
}) => {
  const cloze = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'sue1-extended-cloze',
  );
  await page.goto(cloze.memorizeUrl);
  const launcher = page.getByRole('button', { name: '打开打字学习浮窗' });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const dialog = page.getByRole('dialog', { name: /打字学习/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '仅英文' }).click();

  const firstActive = dialog.locator('.typing-line-active');
  await expect(firstActive).toContainText('Every worker must sign the checklist.');
  await expect(firstActive.locator('.blank-answer')).toHaveCount(4);

  await dialog.getByRole('button', { name: '跟打原文' }).click();
  await expect(dialog.getByRole('button', { name: '默写提示' })).toHaveAttribute('aria-pressed', 'true');
  await expect(firstActive.locator('.typing-prompt')).toContainText('E____');

  const input = firstActive.locator('textarea.typing-underline-input');
  await input.press('Tab');
  await expect(input).toHaveValue('Every');

  await input.fill('Every worker must sign the checklist.');
  await expect(dialog.locator('.typing-line-active')).toContainText('D_ n__ s____');
  await dialog.getByRole('button', { name: '默写提示' }).click();
  await expect(dialog.locator('.typing-line-active')).toContainText(
    'Do not start the equipment without permission.',
  );
  await dialog.locator('.typing-line-active textarea.typing-underline-input').fill(
    'Do not start the equipment without permission.',
  );
  await expect(dialog.getByTestId('typing-complete')).toBeVisible();

  const essay = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'sue1-extended-writing-full',
  );
  await page.goto(essay.memorizeUrl);
  await page.getByRole('button', { name: '打开打字学习浮窗' }).click();
  const essayDialog = page.getByRole('dialog', { name: /打字学习/ });
  await essayDialog.getByRole('button', { name: '仅英文' }).click();

  const roll = essayDialog.getByTestId('typing-roll');
  for (let i = 0; i < 4; i += 1) {
    const active = essayDialog.locator('.typing-line-active');
    const sentence = (await active.locator('.typing-prompt').textContent())?.trim() ?? '';
    await active.locator('textarea.typing-underline-input').fill(sentence);
    await expect(essayDialog.locator(`[data-line-index="${i}"][data-line-status="done"]`)).toBeVisible();
  }
  await expect.poll(async () => roll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

test('Chinese IME composition and uncommitted Pinyin do not trigger false errors before Hanzi commit', async ({
  page, request,
}) => {
  const target = await studyTarget(request, 'beginner-english', 'intro', 'greetings-1');
  await page.goto(target.memorizeUrl);
  await page.getByRole('button', { name: '打开打字学习浮窗' }).click();

  const dialog = page.getByRole('dialog', { name: /打字学习/ });
  const active = dialog.locator('.typing-line-active');
  const input = active.locator('textarea.typing-underline-input');
  const expectedStem = (await active.locator('.typing-prompt').textContent())?.trim() ?? '';
  expect(expectedStem).toContain('早晨来到车间工位');

  // Simulate real browser Chinese IME compositionstart -> partial Pinyin input.
  await input.evaluate(el => {
    const ta = el as HTMLTextAreaElement;
    ta.focus();
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(ta, 'zaochen');
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'zaochen' }));
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'zaochen', isComposing: true }));
  });
  await expect(active.locator('.typing-underline-box')).toHaveAttribute('data-ime-state', 'composing');
  await expect(active.locator('[data-char-state="wrong"]')).toHaveCount(0);
  await expect(active.locator('.typing-status-cue')).toContainText('输入法组词中');

  // Commit Hanzi via compositionend: "早晨" matches cleanly with zero errors.
  await input.evaluate(el => {
    const ta = el as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(ta, '早晨');
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, data: '早晨', isComposing: false }));
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '早晨' }));
  });
  await expect(active.locator('[data-char-state="correct"]')).toHaveCount(2);
  await expect(active.locator('[data-char-state="wrong"]')).toHaveCount(0);

  // Typing raw ASCII Pinyin against the next CJK character without composition events stays pending.
  await input.fill('早晨laidao');
  await expect(active.locator('.typing-underline-box')).toHaveAttribute('data-ime-state', 'composing');
  await expect(active.locator('[data-char-state="correct"]')).toHaveCount(2);
  await expect(active.locator('[data-char-state="wrong"]')).toHaveCount(0);

  // Committing a wrong Chinese character flags error immediately.
  await input.fill('早晨去');
  await expect(active.locator('.typing-underline-box')).toHaveAttribute('data-ime-state', 'error');
  await expect(active.locator('[data-char-state="wrong"]').first()).toBeVisible();

  // Committing the full correct Chinese stem advances smoothly to the English answer.
  await input.fill(expectedStem);
  await expect(dialog.locator('.typing-line-active')).toContainText('Good morning.');
  await dialog.locator('.typing-line-active textarea.typing-underline-input').fill('Good morning.');
  await expect(dialog.getByTestId('typing-complete')).toBeVisible();
});

test('practice disables typing study before submit, unlocks after grading, and stays clean on mobile', async ({
  page, request,
}) => {
  const target = await studyTarget(request, 'beginner-english', 'intro', 'greetings-1');
  await page.goto(target.practiceUrl);
  await expect(page.locator('.question-card')).toBeVisible();

  const typingBtn = page.getByRole('button', { name: '打字学习' });
  await expect(typingBtn).toBeDisabled();

  await page.locator('.choice-option').first().click();
  await page.locator('[data-practice-confirm="true"]').click();

  const openTypingBtn = page.getByRole('button', { name: '打开打字学习浮窗' });
  await expect(openTypingBtn).toBeEnabled();
  await openTypingBtn.click();

  const dialog = page.getByRole('dialog', { name: /打字学习/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Good morning.');

  await page.setViewportSize({ width: 375, height: 810 });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  const overflow = await dialog.evaluate(el => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('multi-sentence listening pairs translations in typing study and display_in gates surfaces', async ({
  page, request,
}) => {
  // 1. Multi-sentence listening transcript line pairs sentence 2 with its Chinese translation.
  const listening = await studyTarget(
    request, 'beginner-english', 'intro', 'be-verb-v2-listening-1',
  );
  await page.goto(listening.memorizeUrl);
  await page.getByRole('button', { name: '打开打字学习浮窗' }).click();
  const dialog = page.getByRole('dialog', { name: /打字学习/ });
  await dialog.getByRole('button', { name: '仅英文' }).click();

  const firstLine = dialog.locator('.typing-line-active');
  await expect(firstLine).toContainText('Good morning, David.');
  await expect(firstLine).toContainText('戴维，早上好。');
  await firstLine.locator('textarea.typing-underline-input').fill('Good morning, David.');

  const secondLine = dialog.locator('.typing-line-active');
  await expect(secondLine).toContainText('Are you ready for the line check?');
  await expect(secondLine).toContainText('你准备好检查生产线了吗？');
  await page.keyboard.press('Escape');

  // 2. Full-surface single_choice (numbers-1) renders translations on memorize, post-submit practice, and palace.
  const singleChoice = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'numbers-1',
  );
  await page.goto(singleChoice.memorizeUrl);
  const toggle = page.getByRole('switch', { name: '英中对照' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.question-card')).toContainText('你看到几个盒子？');
  await expect(page.locator('.question-card')).toContainText('我看到 13 个盒子。');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.question-card')).not.toContainText('我看到 13 个盒子。');

  // Practice pre-submit hides translation; post-submit reveals it.
  await page.goto(singleChoice.practiceUrl);
  await expect(page.locator('.question-card')).toBeVisible();
  await expect(page.locator('.question-card')).not.toContainText('你看到几个盒子？');
  await expect(page.locator('.question-card')).not.toContainText('我看到 13 个盒子。');
  await page.locator('.choice-option').first().click();
  await page.locator('[data-practice-confirm="true"]').click();
  await expect(page.locator('.question-card')).toContainText('你看到几个盒子？');
  await expect(page.locator('.question-card')).toContainText('我看到 13 个盒子。');

  // Palace shows translation when included in display_in.
  await page.goto(singleChoice.palaceUrl);
  await expect(page.locator('.palace-source')).toContainText('你看到几个盒子？');
  await expect(page.locator('.palace-source')).toContainText('我看到 13 个盒子。');

  // 3. Selective display_in: ["memorize", "typing"] on numbers-5 shows in memorize & typing, hides in practice & palace.
  const selective = await studyTarget(
    request, 'golden-course-template', 'extended-practice', 'numbers-5',
  );
  await page.goto(selective.memorizeUrl);
  await expect(page.locator('.question-card')).toContainText('工作台上有 8 个红色零件和 7 个蓝色零件。');
  await page.getByRole('button', { name: '打开打字学习浮窗' }).click();
  await expect(page.getByRole('dialog', { name: /打字学习/ })).toContainText(
    '工作台上有 8 个红色零件和 7 个蓝色零件。',
  );
  await page.keyboard.press('Escape');

  await page.goto(selective.practiceUrl);
  await page.locator('.numeric-answer input').fill('15');
  await page.locator('[data-practice-confirm="true"]').click();
  await expect(page.locator('.question-card')).toContainText('正确答案：15');
  await expect(page.locator('.question-card')).not.toContainText('工作台上有 8 个红色零件和 7 个蓝色零件。');

  await page.goto(selective.palaceUrl);
  await expect(page.locator('.palace-source')).toContainText('正确答案：15');
  await expect(page.locator('.palace-source')).not.toContainText('工作台上有 8 个红色零件和 7 个蓝色零件。');
});
