/**
 * E2E smoke tests — exercises every route type with a real browser.
 * Picks one representative item per route pattern rather than crawling everything.
 */
import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readJSON(relPath: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf-8'));
}

// ── Console error collector ───────────────────────────────────────────────

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err: Error) => errors.push(err.message));
  return errors;
}

// ── Catalog ───────────────────────────────────────────────────────────────

test.describe('catalog page', () => {
  test('loads all sections and course cards', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const platform = readJSON('data/platform.json');
    for (const section of platform.sections) {
      // Use getByRole to scope to the heading only — section titles also
      // appear in course card descriptions, which causes strict mode violations
      // with getByText.
      await expect(page.getByRole('heading', { name: section.title })).toBeVisible();
      // At least one course card per section
      for (const course of section.courses) {
        await expect(page.getByText(course.title, { exact: false }).first()).toBeVisible();
      }
    }
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── Prereqs ───────────────────────────────────────────────────────────────

test.describe('prereq routes', () => {
  const PREREQ = 'matrix-algebra';

  test('overview page renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/prereq/${PREREQ}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('first reading renders content', async ({ page }) => {
    const errors = collectErrors(page);
    const mod = readJSON('data/prereqs/matrix-algebra/module.json');
    const first = mod.readings[0];
    await page.goto(`/prereq/${PREREQ}/reading/${first.id}`);
    await page.waitForLoadState('networkidle');
    // Reading title should appear
    await expect(page.getByText(first.title, { exact: false })).toBeVisible();
    // Content area should have text (not be empty)
    const content = page.locator('.reading-content, .content, article, main').first();
    await expect(content).not.toBeEmpty();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('first quiz renders questions', async ({ page }) => {
    const mod = readJSON('data/prereqs/matrix-algebra/module.json');
    if (!mod.quizzes?.length) test.skip();
    const first = mod.quizzes[0];
    const errors = collectErrors(page);
    await page.goto(`/prereq/${PREREQ}/quiz/${first.id}`);
    await page.waitForLoadState('networkidle');
    // At least one question element should be visible
    await expect(page.locator('.quiz-question, [class*="question"]').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── Supplements ───────────────────────────────────────────────────────────

test.describe('supplement routes', () => {
  const SUPP = 'architectures';

  test('overview page renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/supplement/${SUPP}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('first reading renders content', async ({ page }) => {
    const errors = collectErrors(page);
    const mod = readJSON('data/supplements/architectures/module.json');
    const first = mod.readings[0];
    await page.goto(`/supplement/${SUPP}/reading/${first.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(first.title, { exact: false })).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── Full Courses ──────────────────────────────────────────────────────────

test.describe('deep-rl course routes', () => {
  const COURSE = 'deep-rl';

  test('course home renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/${COURSE}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('syllabus renders with module list', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/${COURSE}/syllabus`);
    await page.waitForLoadState('networkidle');
    const course = readJSON('data/courses/deep-rl/course.json');
    // At least the first module title should appear
    const firstMod = course.modules[0];
    await expect(page.getByText(firstMod.title, { exact: false })).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('module overview renders', async ({ page }) => {
    const errors = collectErrors(page);
    const course = readJSON('data/courses/deep-rl/course.json');
    const firstMod = course.modules[0];
    await page.goto(`/${COURSE}/${firstMod.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('reading page renders content', async ({ page }) => {
    const errors = collectErrors(page);
    const course = readJSON('data/courses/deep-rl/course.json');
    const firstMod = course.modules[0];
    const mod = readJSON(firstMod.dataPath);
    const firstReading = mod.readings[0];
    await page.goto(`/${COURSE}/${firstMod.id}/reading/${firstReading.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(firstReading.title, { exact: false })).toBeVisible();
    const content = page.locator('.reading-content, .content, article, main').first();
    await expect(content).not.toBeEmpty();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('lab page renders with Colab button', async ({ page }) => {
    const errors = collectErrors(page);
    // Find first module with a lab
    const course = readJSON('data/courses/deep-rl/course.json');
    let labModId: string | null = null;
    let labId: string | null = null;
    for (const m of course.modules) {
      const mod = readJSON(m.dataPath);
      if (mod.labs?.length) {
        labModId = m.id;
        labId = mod.labs[0].id;
        break;
      }
    }
    if (!labModId || !labId) test.skip();
    await page.goto(`/${COURSE}/${labModId}/lab/${labId}`);
    await page.waitForLoadState('networkidle');
    // Colab button/link should be present
    const colabLink = page.locator('a[href*="colab.research.google.com"]');
    await expect(colabLink.first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('quiz page renders questions', async ({ page }) => {
    const errors = collectErrors(page);
    const course = readJSON('data/courses/deep-rl/course.json');
    let quizModId: string | null = null;
    let quizId: string | null = null;
    for (const m of course.modules) {
      const mod = readJSON(m.dataPath);
      if (mod.quizzes?.length) {
        quizModId = m.id;
        quizId = mod.quizzes[0].id;
        break;
      }
    }
    if (!quizModId || !quizId) test.skip();
    await page.goto(`/${COURSE}/${quizModId}/quiz/${quizId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.quiz-question, [class*="question"]').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── 3DGS course ───────────────────────────────────────────────────────────

test.describe('3dgs-compression course routes', () => {
  const COURSE = '3dgs-compression';

  test('course home renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/${COURSE}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('first module reading renders', async ({ page }) => {
    const errors = collectErrors(page);
    const course = readJSON('data/courses/3dgs-compression/course.json');
    const firstMod = course.modules[0];
    const mod = readJSON(firstMod.dataPath);
    const firstReading = mod.readings[0];
    await page.goto(`/${COURSE}/${firstMod.id}/reading/${firstReading.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(firstReading.title, { exact: false })).toBeVisible();
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── Navigation: prev/next links work ─────────────────────────────────────

test.describe('prev/next navigation', () => {
  test('next link advances to the following item', async ({ page }) => {
    // Start on the first reading of matrix-algebra and click Next
    const mod = readJSON('data/prereqs/matrix-algebra/module.json');
    const first = mod.readings[0];
    if (!first) test.skip();
    const errors = collectErrors(page);
    await page.goto(`/prereq/matrix-algebra/reading/${first.id}`);
    await page.waitForLoadState('networkidle');

    const nextBtn = page.locator('[data-nav], a[href*="/reading/"], a[href*="/quiz/"]')
      .filter({ hasText: /next/i }).first();
    if (!(await nextBtn.isVisible())) test.skip();
    await nextBtn.click();
    await page.waitForLoadState('networkidle');
    // URL should have changed
    expect(page.url()).not.toContain(first.id);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

// ── 404 / unknown routes ──────────────────────────────────────────────────

test.describe('unknown routes', () => {
  test('unknown route does not crash the app', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/this-route-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');
    // App should still render something (not a blank white page)
    const body = await page.locator('body').textContent();
    expect(body?.trim().length).toBeGreaterThan(0);
    // No uncaught JS errors
    expect(errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('not found')
    )).toHaveLength(0);
  });
});
