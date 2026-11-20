import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type {
  CourseSummary, QuestionSummary, SubjectOverview,
} from '../../web/src/api/generated/types.gen';

async function studyUnit(request: APIRequestContext) {
  const catalog: CourseSummary[] = await (await request.get('/api/courses')).json();
  const subject = catalog.find(course => course.id === 'beginner-english')
    ?.units.find(unit => unit.id === 'tools-equipment')?.subject_id;
  if (!subject) throw new Error('Missing Beginner English tools and equipment unit');
  const path = `/api/questions?subject=${subject}`;
  const rows: QuestionSummary[] = await (await request.get(path)).json();
  const [first, second, third] = rows.filter(row => row.state === 'unlearned');
  if (!first || !second || !third) throw new Error('Need three unlearned questions');
  const overviewPath = `/api/study/overview?subject=${subject}`;
  const overview: SubjectOverview = await (await request.get(overviewPath)).json();
  return { subject, first, second, third, overview, overviewPath, path };
}

function urlFor(subject: number, row: QuestionSummary, filter = 'all') {
  return `/memorize?subject=${subject}&question=${row.question_id}&state=${filter}`;
}

async function holdResponse(page: Page, matches: (url: URL) => boolean) {
  let release!: () => void;
  let markReceived!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { markReceived = resolve; });
  await page.route(matches, async route => {
    const response = await route.fetch();
    markReceived();
    await blocked;
    await route.fulfill({ response });
  }, { times: 1 });
  return { received, release };
}

function navigation(page: Page) {
  const drawer = page.getByRole('dialog', { name: '题目导航', exact: true });
  return {
    open: () => page.getByRole('button', { name: '题目导航', exact: true }).click(),
    close: () => drawer.getByRole('button', { name: '收起题目导航' }).click(),
    current: drawer.locator('.grid-question[aria-current="true"]'),
    tile: (id: number) => drawer.locator(`[data-question-id="${id}"]`),
    mastered: drawer.locator('.grid-question.mastered'),
  };
}

function sourceLine(page: Page) {
  return page.locator('.question-card .source-line');
}

const sourceLabel = (row: QuestionSummary) => `题号 #${row.source_item_id ?? row.question_id}`;

test('memorization keeps the card and navigator aligned while a next question loads', async ({
  page, request,
}) => {
  const { subject, first, second, overview } = await studyUnit(request);
  const navigator = navigation(page);
  const counter = page.getByTestId('mastered-count');
  await page.goto(urlFor(subject, first));
  await expect(sourceLine(page)).toHaveText(sourceLabel(first));
  const delay = await holdResponse(page, url =>
    url.pathname === `/api/questions/${second.question_id}`);

  try {
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await delay.received;
    await navigator.open();
    await expect(sourceLine(page)).toHaveText(sourceLabel(first));
    await expect(navigator.current).toHaveAttribute('data-question-id', String(first.question_id));
    await expect(counter).toHaveText(String(overview.mastered));
  } finally {
    delay.release();
  }

  await expect(sourceLine(page)).toHaveText(sourceLabel(second));
  await expect(navigator.current).toHaveAttribute('data-question-id', String(second.question_id));
  await navigator.close();
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(sourceLine(page)).toHaveText(sourceLabel(first));
  await navigator.open();
  await expect(navigator.current).toHaveAttribute('data-question-id', String(first.question_id));
  await expect(counter).toHaveText(String(overview.mastered));
});

test('remember and advance keeps the count and navigator mark in sync', async ({
  page, request,
}) => {
  const { subject, first, second, overview, overviewPath, path } = await studyUnit(request);
  const navigator = navigation(page);
  const counter = page.getByTestId('mastered-count');
  await page.goto(urlFor(subject, first));
  await expect(sourceLine(page)).toHaveText(sourceLabel(first));
  const delay = await holdResponse(page, url =>
    url.pathname + url.search === overviewPath);
  const refreshedList = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.ok() && url.pathname + url.search === `${path}&state=all`;
  });
  try {
    await page.getByRole('button', { name: '已记住，下一题', exact: true }).click();
    await delay.received;
    await (await refreshedList).finished();
    await navigator.open();
    await expect(counter).toHaveText(String(await navigator.mastered.count()));
  } finally {
    delay.release();
  }

  await expect(counter).toHaveText(String(overview.mastered + 1));
  await expect(navigator.tile(first.question_id)).toHaveAccessibleName(/已记住/);
  await expect(navigator.current).toHaveAttribute('data-question-id', String(second.question_id));
  const markedTile = navigator.tile(first.question_id);
  const background = await markedTile.evaluate(tile => getComputedStyle(tile).backgroundColor);
  await navigator.close();
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(sourceLine(page)).toHaveText(sourceLabel(first));
  await navigator.open();
  await expect(markedTile).toHaveAttribute('aria-current', 'true');
  await expect(markedTile).toHaveCSS('background-color', background);
  await expect(markedTile).toHaveCSS('border-top-width', '2px');
});

test('remembering a filtered question advances without exposing the first result', async ({
  page, request,
}) => {
  const { subject, first, second, third, overview, overviewPath, path } = await studyUnit(request);
  const exposures: number[] = [];
  page.on('request', browserRequest => {
    if (new URL(browserRequest.url()).pathname === '/api/study/exposures') {
      exposures.push(browserRequest.postDataJSON().question_id);
    }
  });
  await page.goto(urlFor(subject, first, 'unlearned'));
  await expect(sourceLine(page)).toHaveText(sourceLabel(first));
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  await expect(sourceLine(page)).toHaveText(sourceLabel(second));
  await expect.poll(() => exposures.at(-1)).toBe(second.question_id);
  const previousExposures = exposures.length;
  const delay = await holdResponse(page, url =>
    url.pathname + url.search === overviewPath);
  const refreshedList = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.ok() && url.pathname + url.search === `${path}&state=unlearned`;
  });
  try {
    await page.getByRole('button', { name: '已记住，下一题', exact: true }).click();
    await delay.received;
    await (await refreshedList).finished();
    await expect(sourceLine(page)).toHaveText(sourceLabel(second));
  } finally {
    delay.release();
  }

  await expect(sourceLine(page)).toHaveText(sourceLabel(third));
  await expect.poll(() => exposures.slice(previousExposures)).toEqual([third.question_id]);
  await expect(page.getByTestId('mastered-count')).toHaveText(String(overview.mastered + 1));
});
