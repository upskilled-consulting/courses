/**
 * Data integrity tests — pure Node.js, no browser.
 * Validates that every dataPath reference in every JSON file resolves
 * to an actual file, and that required fields are present.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const COLAB_PREFIX = 'https://colab.research.google.com/github/';

function readJSON(relPath: string): unknown {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${relPath}`);
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ── Collect all JSON data paths we need to validate ──────────────────────

test.describe('platform.json', () => {
  test('file exists and has required top-level fields', () => {
    const p = readJSON('data/platform.json') as any;
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('sections');
    expect(Array.isArray(p.sections)).toBe(true);
  });

  test('every course dataPath resolves', () => {
    const p = readJSON('data/platform.json') as any;
    const missing: string[] = [];
    for (const section of p.sections) {
      for (const course of section.courses) {
        if (!fileExists(course.dataPath)) missing.push(course.dataPath);
      }
    }
    expect(missing, `Missing course dataPath files:\n${missing.join('\n')}`).toHaveLength(0);
  });
});

// ── Prereqs & Supplements (module.json structure) ─────────────────────────

test.describe('prereqs & supplements', () => {
  let catalog: any;

  test.beforeAll(() => {
    catalog = readJSON('data/platform.json') as any;
  });

  test('every reading dataPath resolves', () => {
    const missing: string[] = [];
    for (const section of catalog.sections) {
      if (!['prerequisites', 'supplements'].includes(section.id)) continue;
      for (const course of section.courses) {
        const mod = readJSON(course.dataPath) as any;
        for (const r of mod.readings ?? []) {
          if (!fileExists(r.dataPath)) missing.push(r.dataPath);
        }
      }
    }
    expect(missing, `Missing reading files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every quiz dataPath resolves', () => {
    const missing: string[] = [];
    for (const section of catalog.sections) {
      if (!['prerequisites', 'supplements'].includes(section.id)) continue;
      for (const course of section.courses) {
        const mod = readJSON(course.dataPath) as any;
        for (const q of mod.quizzes ?? []) {
          if (!fileExists(q.dataPath)) missing.push(q.dataPath);
        }
      }
    }
    expect(missing, `Missing quiz files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every lab dataPath resolves', () => {
    const missing: string[] = [];
    for (const section of catalog.sections) {
      if (!['prerequisites', 'supplements'].includes(section.id)) continue;
      for (const course of section.courses) {
        const mod = readJSON(course.dataPath) as any;
        for (const l of mod.labs ?? []) {
          if (!fileExists(l.dataPath)) missing.push(l.dataPath);
        }
      }
    }
    expect(missing, `Missing lab files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every reading JSON has required fields', () => {
    const errors: string[] = [];
    for (const section of catalog.sections) {
      if (!['prerequisites', 'supplements'].includes(section.id)) continue;
      for (const course of section.courses) {
        const mod = readJSON(course.dataPath) as any;
        for (const r of mod.readings ?? []) {
          if (!fileExists(r.dataPath)) continue;
          const reading = readJSON(r.dataPath) as any;
          if (!reading.content) errors.push(`${r.dataPath}: missing "content"`);
          if (!reading.title) errors.push(`${r.dataPath}: missing "title"`);
          if (!reading.id) errors.push(`${r.dataPath}: missing "id"`);
        }
      }
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});

// ── Courses (course.json + module.json structure) ─────────────────────────

test.describe('courses', () => {
  let catalog: any;

  test.beforeAll(() => {
    catalog = readJSON('data/platform.json') as any;
  });

  function getCourses() {
    return catalog.sections
      .filter((s: any) => s.id === 'courses')
      .flatMap((s: any) => s.courses);
  }

  test('course.json has required fields', () => {
    const errors: string[] = [];
    for (const course of getCourses()) {
      const c = readJSON(course.dataPath) as any;
      if (!c.id) errors.push(`${course.dataPath}: missing "id"`);
      if (!Array.isArray(c.modules)) errors.push(`${course.dataPath}: missing "modules" array`);
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('every module dataPath in course.json resolves', () => {
    const missing: string[] = [];
    for (const course of getCourses()) {
      const c = readJSON(course.dataPath) as any;
      for (const m of c.modules ?? []) {
        if (!fileExists(m.dataPath)) missing.push(m.dataPath);
      }
    }
    expect(missing, `Missing module files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every reading dataPath in course modules resolves', () => {
    const missing: string[] = [];
    for (const course of getCourses()) {
      const c = readJSON(course.dataPath) as any;
      for (const m of c.modules ?? []) {
        if (!fileExists(m.dataPath)) continue;
        const mod = readJSON(m.dataPath) as any;
        for (const r of mod.readings ?? []) {
          if (!fileExists(r.dataPath)) missing.push(r.dataPath);
        }
      }
    }
    expect(missing, `Missing reading files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every lab dataPath in course modules resolves', () => {
    const missing: string[] = [];
    for (const course of getCourses()) {
      const c = readJSON(course.dataPath) as any;
      for (const m of c.modules ?? []) {
        if (!fileExists(m.dataPath)) continue;
        const mod = readJSON(m.dataPath) as any;
        for (const l of mod.labs ?? []) {
          if (!fileExists(l.dataPath)) missing.push(l.dataPath);
        }
      }
    }
    expect(missing, `Missing lab files:\n${missing.join('\n')}`).toHaveLength(0);
  });

  test('every quiz dataPath in course modules resolves', () => {
    const missing: string[] = [];
    for (const course of getCourses()) {
      const c = readJSON(course.dataPath) as any;
      for (const m of c.modules ?? []) {
        if (!fileExists(m.dataPath)) continue;
        const mod = readJSON(m.dataPath) as any;
        for (const q of mod.quizzes ?? []) {
          if (!fileExists(q.dataPath)) missing.push(q.dataPath);
        }
      }
    }
    expect(missing, `Missing quiz files:\n${missing.join('\n')}`).toHaveLength(0);
  });
});

// ── Lab Colab URLs ─────────────────────────────────────────────────────────

test.describe('lab colabUrls', () => {
  function* allLabPaths(catalog: any): Generator<string> {
    for (const section of catalog.sections) {
      for (const course of section.courses) {
        try {
          const data = readJSON(course.dataPath) as any;
          // prereq/supplement: module.json has labs[]
          for (const l of data.labs ?? []) yield l.dataPath;
          // course: course.json has modules[] → module.json → labs[]
          for (const m of data.modules ?? []) {
            if (!fileExists(m.dataPath)) continue;
            const mod = readJSON(m.dataPath) as any;
            for (const l of mod.labs ?? []) yield l.dataPath;
          }
        } catch { /* file missing; caught elsewhere */ }
      }
    }
  }

  test('all labs have a colabUrl with correct prefix', () => {
    // colabUrl: null  → notebook planned but not yet linked (skip — tracked separately)
    // colabUrl absent → field missing entirely (bug)
    // colabUrl set    → must start with COLAB_PREFIX
    const catalog = readJSON('data/platform.json') as any;
    const errors: string[] = [];
    for (const labPath of allLabPaths(catalog)) {
      if (!fileExists(labPath)) continue;
      const lab = readJSON(labPath) as any;
      if (!('colabUrl' in lab)) {
        errors.push(`${labPath}: colabUrl field missing entirely`);
      } else if (lab.colabUrl !== null && !lab.colabUrl.startsWith(COLAB_PREFIX)) {
        errors.push(`${labPath}: colabUrl does not start with ${COLAB_PREFIX}\n  got: ${lab.colabUrl}`);
      }
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});

// ── prevItem / nextItem chain consistency ─────────────────────────────────

test.describe('prevItem/nextItem chains', () => {
  test('no broken prev/next references within a module', () => {
    // Collect all reading/lab/quiz IDs per module and check prev/next ids
    // exist in the same module's item list.
    const catalog = readJSON('data/platform.json') as any;
    const errors: string[] = [];

    function checkChain(items: any[], modulePath: string) {
      const ids = new Set(items.map((x: any) => x.id));
      for (const item of items) {
        if (!fileExists(item.dataPath)) continue;
        const data = readJSON(item.dataPath) as any;
        if (data.prevItem && !ids.has(data.prevItem.id)) {
          errors.push(`${item.dataPath}: prevItem id "${data.prevItem.id}" not found in module ${modulePath}`);
        }
        if (data.nextItem && !ids.has(data.nextItem.id)) {
          errors.push(`${item.dataPath}: nextItem id "${data.nextItem.id}" not found in module ${modulePath}`);
        }
      }
    }

    for (const section of catalog.sections) {
      for (const course of section.courses) {
        try {
          const data = readJSON(course.dataPath) as any;
          // prereq/supplement modules
          const allItems = [
            ...(data.readings ?? []),
            ...(data.quizzes ?? []),
            ...(data.labs ?? []),
          ];
          if (allItems.length) checkChain(allItems, course.dataPath);

          // full courses: per-module
          for (const m of data.modules ?? []) {
            if (!fileExists(m.dataPath)) continue;
            const mod = readJSON(m.dataPath) as any;
            const modItems = [
              ...(mod.readings ?? []),
              ...(mod.quizzes ?? []),
              ...(mod.labs ?? []),
            ];
            if (modItems.length) checkChain(modItems, m.dataPath);
          }
        } catch { /* missing files handled elsewhere */ }
      }
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
