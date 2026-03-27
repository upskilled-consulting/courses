/* ============================================================
   UPSKILLED PLATFORM — platform.js
   Routes:
     /                              → catalog
     /prereq/:id                    → prereq overview
     /prereq/:id/reading/:rid       → reading
     /prereq/:id/quiz/:qid          → quiz
     /prereq/:id/lab/:lid           → lab
     /supplement/:id                → supplement overview
     /supplement/:id/reading/:rid   → reading  (etc.)
     /:id                           → multi-module course home
     /:id/:mid                      → module overview
     /:id/:mid/reading/:rid         → reading
     /:id/:mid/quiz/:qid            → quiz
     /:id/:mid/lab/:lid             → lab
     /:id/syllabus                  → syllabus
   ============================================================ */

'use strict';

// ── Base path (GitHub Pages sub-directory support) ───────────
const BASE_PATH = (() => {
  try {
    const url = new URL(document.currentScript.src);
    return url.pathname.replace(/\/assets\/js\/platform\.js$/, '');
  } catch { return ''; }
})();

// ── Storage namespace ───────────────────────────────────────
const NS = 'upskilled:';
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(NS + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch {} },
};

// ── Theme ───────────────────────────────────────────────────
(function initTheme() {
  const saved = store.get('theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  store.set('theme', next);
});

document.getElementById('navBrand')?.addEventListener('click', e => {
  e.preventDefault();
  navigate('/');
});

// ── Marked: emit plain code blocks; hljs runs post-render via highlightCode ──
(function setupCodeRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = function(code, language) {
    const lang = (language || '').split(/\s+/)[0] || 'plaintext';
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<pre><code class="language-' + lang + '">' + esc + '</code></pre>\n';
  };
  // marked v9 disabled headerIds by default — restore them using our slug function.
  // _slugCounts is reset at the start of each renderMarkdown call (see below).
  let _slugCounts = {};
  renderer.heading = function(text, depth, raw) {
    const base = headingSlug(raw);
    const count = _slugCounts[base] = (_slugCounts[base] || 0) + 1;
    const id = count === 1 ? base : base + '-' + (count - 1);
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  marked.use({ renderer });
  // Expose reset so renderMarkdown can clear counts before each parse
  marked._resetSlugs = () => { _slugCounts = {}; };
})();

// ── Markdown / math helpers (mirrors 3dgs-course pattern) ───
function parseContentWithMath(raw) {
  const mathSlots = [];
  let processed = raw;

  // 1. Display math: $$...$$ and \[...\]
  processed = processed.replace(/\$\$([^$]+?)\$\$/gs, (_, tex) => {
    const idx = mathSlots.length;
    mathSlots.push({ type: 'display', tex });
    return `MATHSLOT_DISPLAY_${idx}_`;
  });
  processed = processed.replace(/\\\[(.+?)\\\]/gs, (_, tex) => {
    const idx = mathSlots.length;
    mathSlots.push({ type: 'display', tex });
    return `MATHSLOT_DISPLAY_${idx}_`;
  });
  // 2. Inline math: \(...\) and $...$
  processed = processed.replace(/\\\((.+?)\\\)/gs, (_, tex) => {
    const idx = mathSlots.length;
    mathSlots.push({ type: 'inline', tex });
    return `MATHSLOT_INLINE_${idx}_`;
  });
  processed = processed.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/gs, (_, tex) => {
    const idx = mathSlots.length;
    mathSlots.push({ type: 'inline', tex });
    return `MATHSLOT_INLINE_${idx}_`;
  });
  return { processed, mathSlots };
}

function restoreMath(html, mathSlots) {
  let result = html;
  mathSlots.forEach((slot, idx) => {
    let rendered;
    try {
      rendered = katex.renderToString(slot.tex, {
        displayMode: slot.type === 'display',
        throwOnError: false,
      });
    } catch {
      rendered = `<code>${slot.tex}</code>`;
    }
    const key = slot.type === 'display'
      ? `MATHSLOT_DISPLAY_${idx}_`
      : `MATHSLOT_INLINE_${idx}_`;
    result = result.replace(key, rendered);
  });
  return result;
}

function renderMarkdown(mdText) {
  if (!mdText) return '';
  marked._resetSlugs?.();
  const { processed, mathSlots } = parseContentWithMath(mdText);
  const html = marked.parse(processed, { gfm: true, breaks: false });
  const withMath = restoreMath(html, mathSlots);
  return withMath;
}

function renderInlineMath(text) {
  if (!text) return '';
  const { processed, mathSlots } = parseContentWithMath(text);
  const html = marked.parseInline ? marked.parseInline(processed) : processed
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return restoreMath(html, mathSlots);
}

function highlightCode(container) {
  if (!window.hljs) return;
  container.querySelectorAll('pre code').forEach(block => {
    // Default to Python for blocks with no language tag
    if (![...block.classList].some(c => c.startsWith('language-'))) {
      block.classList.add('language-python');
    }
    window.hljs.highlightElement(block);
  });
}

// ── Pyodide code runner ────────────────────────────────────────
const CodeRunner = (() => {
  let _pyodide = null;
  let _loading = null;

  async function _init() {
    if (_pyodide) return _pyodide;
    if (_loading)  return _loading;
    _loading = (async () => {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      _pyodide = await window.loadPyodide();
      await _pyodide.loadPackage('numpy');
      return _pyodide;
    })();
    return _loading;
  }

  async function run(code) {
    const py = await _init();
    let stdout = '', stderr = '';
    py.setStdout({ batched: line => { stdout += line + '\n'; } });
    py.setStderr({ batched: line => { stderr += line + '\n'; } });
    try {
      await py.runPythonAsync(code);
    } catch (e) {
      stderr += e.message;
    }
    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
  }

  return { run };
})();

function attachCodeRunners(contentEl) {
  contentEl.querySelectorAll('pre code.language-python').forEach(codeEl => {
    const pre = codeEl.parentElement;
    if (pre.dataset.runner) return;
    pre.dataset.runner = '1';

    // Skip blocks that require unavailable packages or runtime objects
    const src = codeEl.textContent;
    const needsExternal = /import\s+(torch|tensorflow|tf|sklearn|scipy|pandas|matplotlib|cv2|PIL|plyfile)/.test(src)
                       || /from\s+(torch|tensorflow|tf|sklearn|scipy|pandas|matplotlib|cv2|PIL|plyfile)/.test(src)
                       || /\b(torch|nn|tf|np|pd|PlyData|optimizer|scheduler|model|dataloader|dataset|db|service|scene_repo|identity_map|mapper)\s*[\.\(]/.test(src)
                       || /\b(optimizer|scheduler|model|dataloader|dataset|plydata|scene_repo|identity_map)\b/.test(src)
                       || /\b\w+(?:Repository|Factory|Strategy|Policy)\b/.test(src)
                       || (/@dataclass/.test(src) && !/from dataclasses/.test(src))
                       || /-> "/.test(src);
    if (needsExternal) return;

    const wrap = document.createElement('div');
    wrap.className = 'code-runner-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'code-run-btn';
    btn.innerHTML = '&#9654; Run';
    wrap.appendChild(btn);

    const out = document.createElement('pre');
    out.className = 'code-output';
    out.hidden = true;
    wrap.appendChild(out);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      out.hidden = false;
      out.className = 'code-output code-output--pending';
      out.textContent = 'Loading Python runtime (first run only)…';
      const { stdout, stderr } = await CodeRunner.run(codeEl.textContent);
      btn.disabled = false;
      btn.innerHTML = '&#9654; Run';
      if (stderr) {
        out.className = 'code-output code-output--err';
        out.textContent = stderr;
      } else {
        out.className = 'code-output code-output--ok';
        out.textContent = stdout || '(no output)';
      }
    });
  });
}

// ── Fetch helpers ────────────────────────────────────────────
async function fetchJSON(path) {
  // Resolve relative paths from the app root, not the current SPA route
  const url = path.startsWith('/') || /^https?:\/\//.test(path)
    ? path
    : BASE_PATH + '/' + path;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

// ── Progress helpers ─────────────────────────────────────────
function markReadingRead(moduleId, readingId) {
  const key = `progress:${moduleId}`;
  const data = store.get(key) || {};
  if (!data[readingId]) {
    data[readingId] = { completedAt: new Date().toISOString() };
    store.set(key, data);
  }
}

function isReadingRead(moduleId, readingId) {
  const data = store.get(`progress:${moduleId}`) || {};
  return !!data[readingId];
}

function saveQuizResult(moduleId, quizId, score, passed) {
  const key = `quiz:${moduleId}`;
  const data = store.get(key) || {};
  const prev = data[quizId] || { attempts: 0, bestScore: 0, passed: false };
  data[quizId] = {
    attempts: prev.attempts + 1,
    bestScore: Math.max(prev.bestScore, score),
    lastScore: score,
    passed: passed || prev.passed,
    lastAttemptAt: new Date().toISOString(),
  };
  store.set(key, data);
}

function isQuizPassed(moduleId, quizId) {
  const data = store.get(`quiz:${moduleId}`) || {};
  return !!(data[quizId]?.passed);
}

// Build a URL for a prevItem/nextItem navigation target
function navItemUrl(courseId, item, seg = 'prereq', moduleId = null) {
  if (seg === 'course' && moduleId) {
    const base = `/${courseId}/${moduleId}`;
    if (!item) return base;
    if (item.type === 'quiz') return `${base}/quiz/${item.id}`;
    if (item.type === 'lab')  return `${base}/lab/${item.id}`;
    return `${base}/reading/${item.id}`;
  }
  if (!item) return `/${seg}/${courseId}`;
  if (item.type === 'quiz') return `/${seg}/${courseId}/quiz/${item.id}`;
  if (item.type === 'lab')  return `/${seg}/${courseId}/lab/${item.id}`;
  return `/${seg}/${courseId}/reading/${item.id}`;
}

// Find a course across all sections — returns the course ref from platform.json
async function findCourse(courseId) {
  const platform = await fetchJSON('data/platform.json');
  for (const section of platform.sections) {
    const course = section.courses.find(c => c.id === courseId);
    if (course) return course;
  }
  throw new Error('Course not found: ' + courseId);
}

function courseSegment(course) {
  if (course.type === 'supplement') return 'supplement';
  if (course.type === 'course') return 'course';
  return 'prereq';
}

// ── Heading helpers for syllabus ─────────────────────────────
function extractMarkdownHeadings(content) {
  if (!content) return [];
  return content.split('\n').map(line => {
    const m2 = line.match(/^## (.+)$/);
    const m3 = line.match(/^### (.+)$/);
    if (m2) return { level: 2, text: m2[1].trim() };
    if (m3) return { level: 3, text: m3[1].trim() };
    return null;
  }).filter(Boolean);
}

function headingSlug(text) {
  // Match marked.js default heading ID generation
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
    .replace(/\s/g, '-');
}

function markLabVisited(moduleId, labId) {
  const key = `lab:${moduleId}`;
  const data = store.get(key) || {};
  if (!data[labId]) {
    data[labId] = { visitedAt: new Date().toISOString() };
    store.set(key, data);
  }
}

function isLabVisited(moduleId, labId) {
  const data = store.get(`lab:${moduleId}`) || {};
  return !!(data[labId]);
}

// ── Drill progress helpers ────────────────────────────────────
// Storage: store.get('drill:moduleId') → { deckId: { cardId: boxNumber (0|1|2) } }
function getDrillProgress(moduleId, deckId) {
  const data = store.get(`drill:${moduleId}`) || {};
  return data[deckId] || {};
}

function saveDrillProgress(moduleId, deckId, cardId, box) {
  const key = `drill:${moduleId}`;
  const data = store.get(key) || {};
  if (!data[deckId]) data[deckId] = {};
  data[deckId][cardId] = box;
  store.set(key, data);
}

function isDrillStarted(moduleId, deckId) {
  const progress = getDrillProgress(moduleId, deckId);
  return Object.keys(progress).length > 0;
}

function drillDeckStats(moduleId, deckId, cards) {
  const progress = getDrillProgress(moduleId, deckId);
  const known = cards.filter(c => (progress[c.id] || 0) === 2).length;
  return { known, total: cards.length };
}

// ── Router ───────────────────────────────────────────────────
const routes = [];

function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

function matchRoute(hash) {
  for (const { pattern, handler } of routes) {
    const keys = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
    const m = hash.match(new RegExp(`^${regexStr}$`));
    if (m) {
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler, params };
    }
  }
  return null;
}

function navigate(path) {
  history.pushState(null, '', BASE_PATH + path);
  handleRoute();
}

function handleRoute() {
  // Migrate legacy hash URLs: /#/course/foo/module/bar → /foo/bar
  if (window.location.hash.startsWith('#/')) {
    const clean = window.location.hash.slice(1)
      .replace(/^\/course\//, '/')
      .replace(/\/module\//, '/');
    history.replaceState(null, '', BASE_PATH + clean);
  }
  // Migrate legacy path URLs: /course/foo/module/bar → /foo/bar
  let path = window.location.pathname.slice(BASE_PATH.length) || '/';
  if (path.startsWith('/course/') || /\/module\//.test(path)) {
    path = path.replace(/^\/course\//, '/').replace(/\/module\//, '/');
    history.replaceState(null, '', BASE_PATH + path);
  }
  const match = matchRoute(path);
  const root = document.getElementById('appRoot');
  if (match) {
    match.handler(match.params, root);
  } else {
    renderCatalog({}, root);
  }
}

window.addEventListener('popstate', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

// ── Breadcrumb ───────────────────────────────────────────────
function setBreadcrumb(parts) {
  const bc = document.getElementById('navBreadcrumb');
  if (!bc) return;
  if (!parts || parts.length === 0) { bc.innerHTML = ''; return; }
  bc.innerHTML = parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    const sep = i > 0 ? '<span class="bc-sep">/</span>' : '';
    if (isLast) return `${sep}<span class="bc-current">${p.label}</span>`;
    return `${sep}<a href="${BASE_PATH + p.href}" data-bc-nav="${p.href}">${p.label}</a>`;
  }).join(' ');
  bc.querySelectorAll('[data-bc-nav]').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.bcNav); })
  );
}

// ── Loading / error ──────────────────────────────────────────
function showLoading(root) {
  root.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>`;
}

function showError(root, msg) {
  root.innerHTML = `<div class="error-state"><h2>Something went wrong</h2><p>${msg}</p></div>`;
}

// ── CATALOG VIEW ─────────────────────────────────────────────
async function renderCatalog(params, root) {
  setBreadcrumb([]);
  const _fab = document.getElementById('notationFab');
  if (_fab) _fab.style.display = 'none';
  showLoading(root);

  let platform;
  try {
    platform = await fetchJSON('data/platform.json');
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const sectionsHTML = platform.sections.map(section => {
    const isCompact = section.id === 'prerequisites' || section.id === 'supplements';
    const cardsHTML = section.courses.map(course => buildCourseCard(course)).join('');
    return `
      <div class="catalog-section">
        <div class="section-header">
          <h2>${section.title}</h2>
          <p>${section.description}</p>
        </div>
        <div class="course-grid${isCompact ? '' : ' featured-grid'}">
          ${cardsHTML}
        </div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="catalog-hero">
      <div class="catalog-hero-inner">
        <h1><span class="hero-accent">Upskilled Consulting</span><span class="hero-suffix">&nbsp;&amp;&nbsp;Training</span></h1>
        <p>${platform.tagline}</p>
      </div>
    </div>
    <div class="catalog-body">
      ${sectionsHTML}
    </div>`;

  // Attach card click handlers
  root.querySelectorAll('.course-card[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
  root.querySelectorAll('.course-card[data-external]').forEach(card => {
    card.addEventListener('click', () => { window.location.href = card.dataset.external; });
  });

  setSearchContext('catalog', { platform });
}

function buildCourseCard(course) {
  const isPrereq = course.type === 'prereq';
  const isSupplement = course.type === 'supplement';
  const isCourse = course.type === 'course';
  const typeLabel = isPrereq ? 'Prerequisite' : isSupplement ? 'Supplement' : 'Course';
  const levelClass = 'level-' + (course.level || '').toLowerCase().replace(/\s+/, '-');
  const tagsHTML = (course.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
  const countLabel = isCourse
    ? `${course.moduleCount} modules`
    : `${course.readingCount} readings`;
  const hoursLabel = `${course.estimatedHours}h estimated`;
  const ctaText = isCourse ? 'Explore course' : 'Start reading';
  const seg = isPrereq ? 'prereq' : isSupplement ? 'supplement' : '';
  const nav = isCourse ? `data-nav="/${course.id}"` : seg ? `data-nav="/${seg}/${course.id}"` : '';
  const ext = '';

  return `
    <div class="course-card" ${nav} ${ext} role="button" tabindex="0">
      <div class="course-card-stripe" style="background:${course.color}"></div>
      <div class="course-card-body">
        <div class="course-card-type">${typeLabel}</div>
        <div class="course-card-title">${course.title}</div>
        <div class="course-card-desc">${course.description}</div>
        <div class="course-card-meta">
          <span class="meta-pill ${levelClass}">${course.level}</span>
          <span class="meta-pill">${hoursLabel}</span>
          <span class="meta-pill">${countLabel}</span>
        </div>
        <div class="course-card-tags">${tagsHTML}</div>
      </div>
      <div class="course-card-footer">
        <span class="card-cta">${ctaText} <span class="card-cta-arrow">→</span></span>
      </div>
    </div>`;
}

// ── COURSE OVERVIEW ───────────────────────────────────────────
async function renderCourseOverview(params, root) {
  const { id } = params;
  setBreadcrumb([{ label: 'Catalog', href: '/' }, { label: id }]);
  showLoading(root);

  let module, courseRef;
  try {
    courseRef = await findCourse(id);
    module = await fetchJSON(courseRef.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg = courseSegment(courseRef);
  const kickerLabel = seg === 'supplement' ? 'Supplement' : 'Prerequisite Course';
  const levelClass = 'level-' + (module.level || '').toLowerCase().replace(/\s+/, '-');

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: module.title },
  ]);

  const readingsHTML = module.readings.map((r, i) => {
    const done = isReadingRead(module.id, r.id);
    return `
      <div class="reading-row" data-nav="/${seg}/${id}/reading/${r.id}" role="button" tabindex="0">
        <div class="reading-row-num">${i + 1}</div>
        <div class="reading-row-info">
          <div class="reading-row-title">${r.title}</div>
          <div class="reading-row-desc">${r.description || ''}</div>
        </div>
        <div class="reading-row-time">${r.estimatedMinutes} min</div>
        ${done ? '<div class="reading-row-done">✓</div>' : ''}
      </div>`;
  }).join('');

  const quizzesHTML = (module.quizzes || []).map(q => {
    const passed = isQuizPassed(module.id, q.id);
    return `
      <div class="quiz-row" data-nav="/${seg}/${id}/quiz/${q.id}" role="button" tabindex="0">
        <div class="quiz-row-icon">Q</div>
        <div class="quiz-row-info">
          <div class="quiz-row-title">${q.title}</div>
          <div class="quiz-row-desc">${q.questionCount ? `${q.questionCount} questions · ` : ''}${Math.round((q.passingScore || 0.7) * 100)}% to pass</div>
        </div>
        ${passed ? '<div class="quiz-row-passed">✓</div>' : ''}
      </div>`;
  }).join('');

  const labsHTML = (module.labs || []).map(l => {
    const visited = isLabVisited(module.id, l.id);
    return `
      <div class="lab-row" data-nav="/${seg}/${id}/lab/${l.id}" role="button" tabindex="0">
        <div class="lab-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <div class="lab-row-info">
          <div class="lab-row-title">${l.title}</div>
          <div class="lab-row-desc">${l.description || ''}</div>
        </div>
        <div class="lab-row-time">${l.estimatedMinutes} min</div>
        ${visited ? '<div class="lab-row-visited">✓</div>' : ''}
      </div>`;
  }).join('');

  const quizSection = quizzesHTML ? `
    <div class="reading-list-label">Quizzes</div>
    <div class="reading-list">${quizzesHTML}</div>` : '';

  const labSection = labsHTML ? `
    <div class="reading-list-label">Labs</div>
    <div class="reading-list">${labsHTML}</div>` : '';

  const drillsHTML = (module.drills || []).map(d => {
    const started = isDrillStarted(module.id, d.id);
    const progress = getDrillProgress(module.id, d.id);
    const known = Object.values(progress).filter(b => b === 2).length;
    const total = d.cardCount || 0;
    const pct = total ? Math.round((known / total) * 100) : 0;
    const statusLabel = !started ? `${total} cards` : `${known}/${total} known`;
    return `
      <div class="drill-row" data-nav="/${seg}/${id}/drill/${d.id}" role="button" tabindex="0">
        <div class="drill-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="drill-row-info">
          <div class="drill-row-title">${d.title}</div>
          <div class="drill-row-meta">${statusLabel} · ${d.estimatedMinutes} min</div>
          ${started && total ? `<div class="drill-row-bar"><div class="drill-row-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        ${started && known === total ? '<div class="drill-row-done">✓</div>' : ''}
      </div>`;
  }).join('');

  const drillSection = drillsHTML ? `
    <div class="reading-list-label">Practice</div>
    <div class="reading-list">${drillsHTML}</div>` : '';

  const labCount = (module.labs || []).length;
  const drillCount = (module.drills || []).length;

  root.innerHTML = `
    <div class="course-overview">
      <div class="course-ov-header">
        <button class="course-ov-back" data-nav="/">← Catalog</button>
        <div class="course-ov-kicker">${kickerLabel}</div>
        <h1 class="course-ov-title">${module.title}</h1>
        <p class="course-ov-desc">${module.description}</p>
        <div class="course-ov-meta">
          <span class="meta-pill ${levelClass}">${module.level}</span>
          <span class="meta-pill">${module.estimatedHours}h estimated</span>
          <span class="meta-pill">${module.readings.length} readings</span>
          ${(module.quizzes || []).length ? `<span class="meta-pill">${module.quizzes.length} quiz</span>` : ''}
          ${labCount ? `<span class="meta-pill">${labCount} lab${labCount !== 1 ? 's' : ''}</span>` : ''}
          ${drillCount ? `<span class="meta-pill">${drillCount} drill deck${drillCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="reading-list-label" style="display:flex;align-items:center;justify-content:space-between;">
        Readings
        <button class="btn-outline-ctrl" id="syllabus-btn" title="Hold 2s for admin access">Syllabus</button>
      </div>
      <div class="reading-list">
        ${readingsHTML}
      </div>
      ${quizSection}
      ${labSection}
      ${drillSection}
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // Syllabus button: click = navigate; hold 2s = admin unlock + confetti + navigate
  const syllabusBtn = root.querySelector('#syllabus-btn');
  if (syllabusBtn) {
    let holdTimer = null;
    const syllabusUrl = `/${seg}/${id}/syllabus`;

    function startHold(e) {
      if (e.button !== undefined && e.button !== 0) return;
      syllabusBtn.classList.add('holding');
      holdTimer = setTimeout(() => {
        syllabusBtn.classList.remove('holding');
        holdTimer = null;
        sessionStorage.setItem('upskilled:devUnlock', '1');
        fireConfetti(() => navigate(syllabusUrl));
      }, 2000);
    }

    function cancelHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      syllabusBtn.classList.remove('holding');
    }

    syllabusBtn.addEventListener('mousedown',   startHold);
    syllabusBtn.addEventListener('touchstart',  startHold,  { passive: true });
    syllabusBtn.addEventListener('mouseup',     cancelHold);
    syllabusBtn.addEventListener('mouseleave',  cancelHold);
    syllabusBtn.addEventListener('touchend',    cancelHold);
    syllabusBtn.addEventListener('touchcancel', cancelHold);
    syllabusBtn.addEventListener('click', () => { if (!holdTimer) navigate(syllabusUrl); });
  }

  setSearchContext('course', { module, courseRef, seg });
}

// ── MULTI-MODULE COURSE HOME ───────────────────────────────────
async function renderCourseHome(params, root) {
  const { id } = params;
  showLoading(root);

  let courseRef, courseManifest, moduleDataMap;
  try {
    courseRef = await findCourse(id);
    courseManifest = await fetchJSON(courseRef.dataPath);
    // Load all module.jsons in parallel for progress + unlock computation
    const loaded = await Promise.all(courseManifest.modules.map(m => fetchJSON(m.dataPath)));
    moduleDataMap = {};
    courseManifest.modules.forEach((m, i) => { moduleDataMap[m.id] = loaded[i]; });
  } catch (e) {
    showError(root, e.message);
    return;
  }

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: courseManifest.title },
  ]);

  const threshold = courseManifest.unlockThreshold || 0.6;

  function isModuleUnlocked(modEntry) {
    if (!modEntry.prereq) return true;
    const prereqMod = moduleDataMap[modEntry.prereq];
    if (!prereqMod) return false;
    const prereqKey = `${id}_${modEntry.prereq}`;
    return (prereqMod.quizzes || []).every(q => {
      const result = store.get(`quiz:${prereqKey}`)?.[q.id];
      return result && result.bestScore >= threshold;
    });
  }

  const modulesHTML = courseManifest.modules.map((modEntry, i) => {
    const mod = moduleDataMap[modEntry.id];
    const storageKey = `${id}_${modEntry.id}`;
    const unlocked = isModuleUnlocked(modEntry);

    const readingsTotal = (mod.readings || []).length;
    const readingsDone = (mod.readings || []).filter(r => isReadingRead(storageKey, r.id)).length;
    const quizzesTotal = (mod.quizzes || []).length;
    const quizzesPassed = (mod.quizzes || []).filter(q => isQuizPassed(storageKey, q.id)).length;
    const labs = mod.labs || (mod.lab ? [mod.lab] : []);

    const metaParts = [`${readingsTotal} readings`];
    if (quizzesTotal) metaParts.push(`${quizzesTotal} quiz${quizzesTotal !== 1 ? 'zes' : ''}`);
    if (labs.length)  metaParts.push(`${labs.length} lab${labs.length !== 1 ? 's' : ''}`);

    const progressPct = readingsTotal ? Math.round((readingsDone / readingsTotal) * 100) : 0;
    const progressLabel = readingsDone > 0
      ? `${readingsDone}/${readingsTotal} read${quizzesPassed ? ` · ${quizzesPassed}/${quizzesTotal} passed` : ''}`
      : '';

    const lockIcon = `<svg class="module-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const checkIcon = readingsDone === readingsTotal && readingsTotal > 0 && quizzesPassed === quizzesTotal
      ? '<span class="module-row-done">✓</span>' : '';

    const lockedClass = unlocked ? '' : ' module-row--locked';
    const navAttr = unlocked ? `data-nav="/${id}/${modEntry.id}"` : '';

    return `
      <div class="reading-row module-row${lockedClass}" ${navAttr} role="${unlocked ? 'button' : 'listitem'}" ${unlocked ? 'tabindex="0"' : ''}>
        <div class="module-row-stripe" style="background:${modEntry.color}"></div>
        <div class="reading-row-num">${i + 1}</div>
        <div class="reading-row-info">
          <div class="reading-row-title">${modEntry.title}</div>
          <div class="reading-row-desc">${modEntry.description || ''}</div>
          <div class="module-row-meta">${metaParts.join(' · ')}</div>
        </div>
        <div class="module-row-right">
          ${progressLabel ? `<div class="module-row-progress">${progressLabel}</div>` : ''}
          ${unlocked ? checkIcon : lockIcon}
        </div>
      </div>`;
  }).join('');

  const levelClass = 'level-' + (courseRef.level || '').toLowerCase().replace(/\s+/, '-');
  const tagsHTML = (courseRef.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');

  root.innerHTML = `
    <div class="course-overview">
      <div class="course-ov-header">
        <button class="course-ov-back" data-nav="/">← Catalog</button>
        <div class="course-ov-kicker">Course</div>
        <h1 class="course-ov-title">${courseManifest.title}</h1>
        <p class="course-ov-desc">${courseManifest.subtitle || ''}</p>
        <div class="course-ov-meta">
          <span class="meta-pill ${levelClass}">${courseRef.level || 'Advanced'}</span>
          <span class="meta-pill">${courseRef.estimatedHours}h estimated</span>
          <span class="meta-pill">${courseManifest.modules.length} modules</span>
        </div>
        ${tagsHTML ? `<div class="course-card-tags" style="margin-top:12px">${tagsHTML}</div>` : ''}
      </div>
      <div class="reading-list-label" style="display:flex;align-items:center;justify-content:space-between;">
        Modules
        <button class="btn-outline-ctrl" id="syllabus-btn" data-nav="/${id}/syllabus" title="Hold 2s for admin access">Syllabus</button>
      </div>
      <div class="reading-list">${modulesHTML}</div>
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el => {
    if (el.id === 'syllabus-btn') return; // wired separately
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // Syllabus button: click = navigate; hold 2s = admin unlock + confetti + navigate
  const syllabusBtn = root.querySelector('#syllabus-btn');
  if (syllabusBtn) {
    let holdTimer = null;

    function startHold(e) {
      if (e.button !== undefined && e.button !== 0) return;
      syllabusBtn.classList.add('holding');
      holdTimer = setTimeout(() => {
        syllabusBtn.classList.remove('holding');
        holdTimer = null;
        sessionStorage.setItem('upskilled:devUnlock', '1');
        fireConfetti(() => navigate(`/${id}/syllabus`));
      }, 2000);
    }

    function cancelHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      syllabusBtn.classList.remove('holding');
    }

    syllabusBtn.addEventListener('mousedown',   startHold);
    syllabusBtn.addEventListener('touchstart',  startHold,  { passive: true });
    syllabusBtn.addEventListener('mouseup',     cancelHold);
    syllabusBtn.addEventListener('mouseleave',  cancelHold);
    syllabusBtn.addEventListener('touchend',    cancelHold);
    syllabusBtn.addEventListener('touchcancel', cancelHold);
    syllabusBtn.addEventListener('click', () => { if (!holdTimer) navigate(`/${id}/syllabus`); });
  }

  setSearchContext('catalog', { platform: await fetchJSON('data/platform.json') });
}

// ── PER-MODULE OVERVIEW ─────────────────────────────────────────
async function renderModuleOverview(params, root) {
  const { id, mid } = params;
  showLoading(root);

  let courseRef, courseManifest, modEntry, module;
  try {
    courseRef = await findCourse(id);
    courseManifest = await fetchJSON(courseRef.dataPath);
    modEntry = courseManifest.modules.find(m => m.id === mid);
    if (!modEntry) throw new Error('Module not found: ' + mid);
    module = await fetchJSON(modEntry.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: courseManifest.title, href: `/${id}` },
    { label: modEntry.title },
  ]);

  const storageKey = `${id}_${mid}`;
  const base = `/${id}/${mid}`;

  const readingsHTML = (module.readings || []).map((r, i) => {
    const done = isReadingRead(storageKey, r.id);
    return `
      <div class="reading-row" data-nav="${base}/reading/${r.id}" role="button" tabindex="0">
        <div class="reading-row-num">${i + 1}</div>
        <div class="reading-row-info">
          <div class="reading-row-title">${r.title}</div>
          <div class="reading-row-desc">${r.description || ''}</div>
        </div>
        <div class="reading-row-time">${r.estimatedMinutes} min</div>
        ${done ? '<div class="reading-row-done">✓</div>' : ''}
      </div>`;
  }).join('');

  const quizzesHTML = (module.quizzes || []).map(q => {
    const passed = isQuizPassed(storageKey, q.id);
    return `
      <div class="quiz-row" data-nav="${base}/quiz/${q.id}" role="button" tabindex="0">
        <div class="quiz-row-icon">Q</div>
        <div class="quiz-row-info">
          <div class="quiz-row-title">${q.title}</div>
          <div class="quiz-row-desc">${q.questionCount ? `${q.questionCount} questions · ` : ''}${Math.round((q.passingScore || 0.7) * 100)}% to pass</div>
        </div>
        ${passed ? '<div class="quiz-row-passed">✓</div>' : ''}
      </div>`;
  }).join('');

  const labs = module.labs || (module.lab ? [module.lab] : []);
  const labsHTML = labs.map(l => {
    const visited = isLabVisited(storageKey, l.id);
    return `
      <div class="lab-row" data-nav="${base}/lab/${l.id}" role="button" tabindex="0">
        <div class="lab-row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <div class="lab-row-info">
          <div class="lab-row-title">${l.title}</div>
          <div class="lab-row-desc">${l.description || ''}</div>
        </div>
        <div class="lab-row-time">${l.estimatedMinutes} min</div>
        ${visited ? '<div class="lab-row-visited">✓</div>' : ''}
      </div>`;
  }).join('');

  const quizSection = quizzesHTML ? `
    <div class="reading-list-label">Quizzes</div>
    <div class="reading-list">${quizzesHTML}</div>` : '';
  const labSection = labsHTML ? `
    <div class="reading-list-label">Labs</div>
    <div class="reading-list">${labsHTML}</div>` : '';

  root.innerHTML = `
    <div class="course-overview">
      <div class="course-ov-header">
        <button class="course-ov-back" data-nav="/${id}">← ${courseManifest.title}</button>
        <div class="course-ov-kicker">Module ${modEntry.order}</div>
        <h1 class="course-ov-title">${modEntry.title}</h1>
        <p class="course-ov-desc">${modEntry.description || ''}</p>
        <div class="course-ov-meta">
          <span class="meta-pill">${(module.readings || []).length} readings</span>
          ${(module.quizzes || []).length ? `<span class="meta-pill">${module.quizzes.length} quiz${module.quizzes.length !== 1 ? 'zes' : ''}</span>` : ''}
          ${labs.length ? `<span class="meta-pill">${labs.length} lab${labs.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="reading-list-label">Readings</div>
      <div class="reading-list">${readingsHTML}</div>
      ${quizSection}
      ${labSection}
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  setSearchContext('course', { module, courseRef, seg: 'course' });
}

// ── READING VIEW ──────────────────────────────────────────────
// Inject equation breakdown cards inline, each after its matching section.
// Runs after root.innerHTML is set so .katex-display elements are present.
function injectBreakdownsIntoContent(contentEl, breakdowns) {
  if (!contentEl || !breakdowns || !breakdowns.length) return;
  const filtered = breakdowns.filter(bd => bd && bd.terms && bd.terms.length);
  if (!filtered.length) return;

  function normText(s) {
    return s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const stop = new Set(['the','a','an','and','or','of','in','for','is','are','to','its','that','with']);

  function matchScore(headingText, query) {
    const hn = normText(headingText);
    const ln = normText(query);
    if (hn === ln) return 1;
    // whole-word substring: avoid "adam" matching "adamax" etc.
    const wholeWord = (hay, needle) => hay === needle
      || hay.startsWith(needle + ' ') || hay.endsWith(' ' + needle)
      || hay.includes(' ' + needle + ' ');
    // Only score 1 when the heading *contains* the query as a whole word.
    // The reverse (query contains heading as prefix) falls through to word-overlap,
    // so that "The Chain Rule" heading doesn't steal "The Chain Rule and Backpropagation" query.
    if (wholeWord(hn, ln)) return 1;
    const hw = new Set(hn.split(' ').filter(w => w.length > 2 && !stop.has(w)));
    const lw = ln.split(' ').filter(w => w.length > 2 && !stop.has(w));
    if (!lw.length) return 0;
    return lw.filter(w => hw.has(w)).length / lw.length;
  }

  function getSectionEquations(heading) {
    const eqs = [];
    let el = heading.nextElementSibling;
    while (el && !['H1','H2','H3'].includes(el.tagName)) {
      if (el.querySelector('.katex-display')) eqs.push(el);
      el = el.nextElementSibling;
    }
    return eqs;
  }

  function buildCard(bd) {
    const termsHTML = bd.terms.map(t => `
      <div class="eq-term">
        <div class="eq-symbol">${renderKaTeX(t.symbol)}</div>
        <div>
          <div class="eq-name">${renderInlineMath(t.name)}</div>
          <div class="eq-desc">${renderInlineMath(t.desc)}</div>
        </div>
      </div>`).join('');
    const card = document.createElement('div');
    card.className = 'eq-breakdown';
    const displayLabel = bd.label.includes(' — ') ? bd.label.split(' — ').pop() : bd.label;
    card.innerHTML = `<div class="eq-breakdown-label">${_escHtml(displayLabel)}</div>${termsHTML}`;
    return card;
  }

  const headings = Array.from(contentEl.querySelectorAll('h2, h3'));

  // Assign each breakdown to a heading.
  // bd.heading (explicit anchor substring) takes priority over fuzzy label matching.
  const assignments = new Map(); // heading el → [bd, ...]
  const orphans = [];

  filtered.forEach(bd => {
    let bestH = null, bestScore = 0;
    const query = bd.heading || bd.label;
    for (const h of headings) {
      const s = matchScore(h.textContent, query);
      if (s > bestScore) { bestScore = s; bestH = h; }
    }
    if (bestH && bestScore >= (bd.heading ? 0.1 : 0.3)) {
      if (!assignments.has(bestH)) assignments.set(bestH, []);
      assignments.get(bestH).push(bd);
    } else {
      orphans.push(bd);
    }
  });

  // For each heading, distribute its breakdowns across the section's display equations in order.
  for (const [heading, bds] of assignments) {
    const eqs = getSectionEquations(heading);
    bds.forEach((bd, i) => {
      const anchor = eqs.length > 0 ? eqs[Math.min(i, eqs.length - 1)] : heading;
      // If a previous card was already inserted after this anchor, stack after it.
      let target = anchor;
      while (target.nextElementSibling?.classList?.contains('eq-breakdown')) {
        target = target.nextElementSibling;
      }
      target.after(buildCard(bd));
    });
  }

  orphans.forEach(bd => contentEl.appendChild(buildCard(bd)));
}

async function renderReading(params, root) {
  const { id, rid } = params;
  const mid = params.mid || null;
  showLoading(root);

  let courseRef, module, reading, courseManifest, modEntry;
  try {
    courseRef = await findCourse(id);
    if (courseRef.type === 'course') {
      courseManifest = await fetchJSON(courseRef.dataPath);
      modEntry = courseManifest.modules.find(m => m.id === mid);
      if (!modEntry) throw new Error('Module not found: ' + mid);
      module = await fetchJSON(modEntry.dataPath);
    } else {
      module = await fetchJSON(courseRef.dataPath);
    }
    const readingRef = module.readings.find(r => r.id === rid);
    if (!readingRef) throw new Error('Reading not found: ' + rid);
    reading = await fetchJSON(readingRef.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg = courseSegment(courseRef);
  const isCourse = seg === 'course';
  const kickerLabel = isCourse ? courseManifest.title : seg === 'supplement' ? 'Supplement' : 'Prerequisite';
  const storageKey = isCourse ? `${id}_${mid}` : id;
  const overviewUrl = isCourse ? `/${id}/${mid}` : `/${seg}/${id}`;

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    ...(isCourse ? [{ label: courseManifest.title, href: `/${id}` }, { label: modEntry.title, href: overviewUrl }] : [{ label: module.title, href: overviewUrl }]),
    { label: reading.title },
  ]);

  // Mark as read
  markReadingRead(storageKey, rid);

  // Equation breakdowns
  const breakdownsHTML = (reading.equationBreakdowns || []).filter(bd => bd && bd.terms).map(bd => {
    const termsHTML = bd.terms.map(t => `
      <div class="eq-term">
        <div class="eq-symbol">${renderKaTeX(t.symbol)}</div>
        <div>
          <div class="eq-name">${renderInlineMath(t.name)}</div>
          <div class="eq-desc">${renderInlineMath(t.desc)}</div>
        </div>
      </div>`).join('');
    return `
      <div class="eq-breakdown">
        <div class="eq-breakdown-label">${bd.label.includes(' — ') ? bd.label.split(' — ').pop() : bd.label}</div>
        ${termsHTML}
      </div>`;
  }).join('');

  // Nav buttons
  const prevItem = reading.prevItem;
  const nextItem = reading.nextItem;
  const prevLabel = prevItem ? '← Previous' : '← Overview';
  const nextLabel = nextItem
    ? (nextItem.type === 'quiz' ? 'Take Quiz →' : nextItem.type === 'lab' ? 'Start Lab →' : 'Next →')
    : '← Overview';
  const prevBtn = `<button class="reading-nav-btn prev" data-nav="${navItemUrl(id, prevItem, seg, mid)}">${prevLabel}</button>`;
  const nextBtn = `<button class="reading-nav-btn next" data-nav="${navItemUrl(id, nextItem, seg, mid)}">${nextLabel}</button>`;

  // References
  const refsHTML = (reading.references || []).length > 0 ? `
    <div class="references-section">
      <div class="references-label">References</div>
      ${reading.references.map(r => `
        <div class="reference-item">
          ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${r.label} — ${r.title}</a>` : `${r.label} — ${r.title}`}
        </div>`).join('')}
    </div>` : '';

  // Sidebar items
  const sidebarReadingUrl = r => isCourse ? `/${id}/${mid}/reading/${r.id}` : `/${seg}/${id}/reading/${r.id}`;
  const sidebarItems = module.readings.map((r, i) => {
    const active = r.id === rid ? ' active' : '';
    return `<button class="sidebar-reading-item${active}" data-nav="${sidebarReadingUrl(r)}">
      <span class="sidebar-item-num">${i + 1}</span>
      <span>${r.title}</span>
    </button>`;
  }).join('');

  const contentHTML = renderMarkdown(reading.content);

  const losHTML = (reading.learningObjectives || []).length ? `
    <div class="reading-los">
      <div class="reading-los-label">By the end of this reading you will be able to:</div>
      <ul class="reading-los-list">
        ${reading.learningObjectives.map(lo => {
          const rest = lo.description.startsWith(lo.verb + ' ')
            ? lo.description.slice(lo.verb.length + 1)
            : lo.description;
          return `<li><strong>${_escHtml(lo.verb)}</strong> ${_escHtml(rest)}</li>`;
        }).join('')}
      </ul>
    </div>` : '';

  root.innerHTML = `
    <div class="reading-layout">
      <aside class="reading-sidebar">
        <button class="sidebar-course-link" data-nav="${overviewUrl}">← ${isCourse ? modEntry.title : module.title}</button>
        <div class="sidebar-nav-label">Readings</div>
        ${sidebarItems}
      </aside>
      <div class="reading-main">
        <div class="reading-kicker">${kickerLabel} · ${isCourse ? modEntry.title : module.title}</div>
        <h1 class="reading-title">${reading.title}</h1>
        <div class="reading-meta-row">
          <span>${reading.estimatedMinutes} min read</span>
        </div>
        ${losHTML}
        <div class="reading-content" id="readingContent">
          ${contentHTML}
        </div>
        ${refsHTML}
        <div class="reading-nav-row">
          ${prevBtn}
          ${nextBtn}
        </div>
      </div>
    </div>`;

  // Wire nav
  root.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // Inject equation breakdown cards inline with their sections
  injectBreakdownsIntoContent(
    root.querySelector('#readingContent'),
    reading.equationBreakdowns || []
  );

  // Highlight code and attach run buttons
  highlightCode(root);
  attachCodeRunners(root);

  // Boot canvas animations (densification, SH visualizer)
  const contentEl = root.querySelector('#readingContent');
  if (contentEl) {
    contentEl.querySelectorAll('canvas[data-densification]').forEach(canvas => {
      window.initDensificationAnimation?.(canvas, canvas.dataset.densification);
    });
    contentEl.querySelectorAll('.sh-viz-embed').forEach(el => {
      window.initSHVisualizer?.(el);
    });
    contentEl.querySelectorAll('.gauss-elim-embed').forEach(el => {
      window.initGaussElimAnimation?.(el);
    });
    contentEl.querySelectorAll('.solution-set-embed').forEach(el => {
      window.initSolutionSetAnimation?.(el);
    });
    contentEl.querySelectorAll('.parametric-embed').forEach(el => {
      window.initParametricAnimation?.(el);
    });
    contentEl.querySelectorAll('.subspace-embed').forEach(el => {
      window.initSubspaceAnimation?.(el);
    });
    contentEl.querySelectorAll('.span-gauss-embed').forEach(el => {
      window.initSpanGaussAnimation?.(el);
    });
    contentEl.querySelectorAll('.li-test-embed').forEach(el => {
      window.initLITestAnimation?.(el);
    });
    contentEl.querySelectorAll('.rank-nullity-embed').forEach(el => {
      window.initRankNullityAnimation?.(el);
    });
  }

  setSearchContext('reading', { reading, module, seg, courseRef });

  // Scroll to section if arriving from syllabus topic click
  const scrollTarget = sessionStorage.getItem('upskilled:scrollTo');
  if (scrollTarget) {
    sessionStorage.removeItem('upskilled:scrollTo');
    setTimeout(() => {
      const el = document.getElementById(scrollTarget);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
}

function renderKaTeX(tex) {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: false });
  } catch {
    return `<code>${tex}</code>`;
  }
}

// ── QUIZ HELPERS ──────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuizData(quiz) {
  return {
    ...quiz,
    questions: shuffleArray(quiz.questions).map(q =>
      q.type === 'multiple-choice' ? { ...q, options: shuffleArray(q.options) } : q
    ),
  };
}

const HINT_ICONS = `
  <svg class="icon-bulb" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
    <path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.46-.302l-.761-1.77a2 2 0 0 0-.453-.618A5.98 5.98 0 0 1 2 6m6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1"/>
  </svg>
  <svg class="icon-close" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
  <span class="hint-label">Show hint</span>`;

function buildMCQuestion(q, idx) {
  const optionsHTML = q.options.map(opt => `
    <label class="option-label" data-qid="${q.id}" data-oid="${opt.id}">
      <input type="radio" name="q_${q.id}" value="${opt.id}" />
      <span>${renderInlineMath(opt.text)}</span>
    </label>`).join('');

  return `
    <div class="question-card" id="qcard_${q.id}" data-type="multiple-choice" data-qid="${q.id}">
      <div class="question-num">Question ${idx + 1}</div>
      <div class="question-prompt">${renderInlineMath(q.prompt)}</div>
      <div class="options-list">${optionsHTML}</div>
      <button type="button" class="hint-toggle" data-qid="${q.id}" aria-expanded="false">${HINT_ICONS}</button>
      <div class="question-hint" id="hint_${q.id}">${renderInlineMath(q.hint || '')}</div>
      <div class="question-explanation" id="exp_${q.id}">
        <strong>Explanation:</strong> ${renderInlineMath(q.explanation || '')}
      </div>
    </div>`;
}

function buildCodeQuestion(q, idx) {
  const tpl = escapeHtml(q.codeTemplate).replace(
    escapeHtml(q.blankKey),
    `<input class="code-blank-input" id="blank_${q.id}" autocomplete="off" spellcheck="false" size="22" />`
  );

  return `
    <div class="question-card" id="qcard_${q.id}" data-type="code-completion" data-qid="${q.id}">
      <div class="question-num">Question ${idx + 1}</div>
      <div class="question-prompt">${renderInlineMath(q.prompt)}</div>
      <div class="code-template-wrap">
        <pre class="code-template"><code>${tpl}</code></pre>
      </div>
      <button type="button" class="hint-toggle" data-qid="${q.id}" aria-expanded="false">${HINT_ICONS}</button>
      <div class="question-hint" id="hint_${q.id}">${renderInlineMath(q.hint || '')}</div>
      <div class="question-explanation" id="exp_${q.id}">
        <strong>Explanation:</strong> ${renderInlineMath(q.explanation || '')}
      </div>
    </div>`;
}

function gradeQuiz(quiz, root) {
  let correct = 0;
  for (const q of quiz.questions) {
    const card = root.querySelector(`#qcard_${q.id}`);
    if (!card) continue;

    let isCorrect = false;

    if (q.type === 'multiple-choice') {
      const checked = card.querySelector('input[type="radio"]:checked');
      const selectedId = checked?.value;
      const correctOpt = q.options.find(o => o.correct);
      isCorrect = selectedId === correctOpt?.id;
      card.querySelectorAll('.option-label').forEach(label => {
        label.classList.add('disabled');
        const oid = label.dataset.oid;
        const opt = q.options.find(o => o.id === oid);
        if (opt?.correct) label.classList.add('correct');
        else if (oid === selectedId) label.classList.add('wrong');
      });
    } else if (q.type === 'code-completion') {
      const input = root.querySelector(`#blank_${q.id}`);
      const val = (input?.value || '').trim();
      isCorrect = (q.acceptedAnswers || []).some(a => a.trim() === val);
      if (input) { input.disabled = true; input.classList.add(isCorrect ? 'correct' : 'wrong'); }
    }

    if (isCorrect) correct++;
    card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    if (quiz.showAnswersAfterSubmit) {
      root.querySelector(`#exp_${q.id}`)?.classList.add('visible');
    }
    card.querySelector('.hint-toggle')?.setAttribute('disabled', '');
  }

  return { correct, total: quiz.questions.length, score: quiz.questions.length > 0 ? correct / quiz.questions.length : 0 };
}

// ── QUIZ VIEW ─────────────────────────────────────────────────

async function renderQuiz(params, root) {
  const { id, qid } = params;
  const mid = params.mid || null;
  setSearchContext('none');
  showLoading(root);

  let courseRef, module, quiz, courseManifest, modEntry;
  try {
    courseRef = await findCourse(id);
    if (courseRef.type === 'course') {
      courseManifest = await fetchJSON(courseRef.dataPath);
      modEntry = courseManifest.modules.find(m => m.id === mid);
      if (!modEntry) throw new Error('Module not found: ' + mid);
      module = await fetchJSON(modEntry.dataPath);
    } else {
      module = await fetchJSON(courseRef.dataPath);
    }
    const quizRef = module.quizzes?.find(q => q.id === qid);
    if (!quizRef) throw new Error('Quiz not found: ' + qid);
    quiz = await fetchJSON(quizRef.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg = courseSegment(courseRef);
  const isCourse = seg === 'course';
  const overviewUrl = isCourse ? `/${id}/${mid}` : `/${seg}/${id}`;
  params._seg = seg;
  params._mid = mid;
  params._overviewUrl = overviewUrl;
  params._modTitle = isCourse ? modEntry.title : module.title;
  params._storageKey = isCourse ? `${id}_${mid}` : id;
  params._courseTitle = isCourse ? courseManifest.title : null;

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    ...(isCourse ? [{ label: courseManifest.title, href: `/${id}` }, { label: modEntry.title, href: overviewUrl }] : [{ label: module.title, href: overviewUrl }]),
    { label: quiz.title },
  ]);

  renderQuizBody(params, root, module, quiz);
}

function renderQuizBody(params, root, module, quiz) {
  const { id, qid } = params;
  const seg = params._seg || 'prereq';
  const mid = params._mid || null;
  const isCourse = seg === 'course';
  const storageKey = params._storageKey || id;
  const overviewUrl = params._overviewUrl || `/${seg}/${id}`;
  const modTitle = params._modTitle || module.title;
  const kickerLabel = isCourse ? (params._courseTitle || modTitle) : seg === 'supplement' ? 'Supplement' : 'Prerequisite';
  const prevRecord = store.get(`quiz:${storageKey}`)?.[qid];

  const prevScoreNote = prevRecord
    ? `<span class="reading-meta-sep">·</span><span>Best: ${Math.round(prevRecord.bestScore * 100)}% · ${prevRecord.attempts} attempt${prevRecord.attempts !== 1 ? 's' : ''}</span>`
    : '';

  const readingUrl = r => isCourse ? `/${id}/${mid}/reading/${r.id}` : `/${seg}/${id}/reading/${r.id}`;
  const quizUrl   = q => isCourse ? `/${id}/${mid}/quiz/${q.id}`    : `/${seg}/${id}/quiz/${q.id}`;

  const sidebarHTML = (() => {
    const readingItems = module.readings.map((r, i) =>
      `<button class="sidebar-reading-item" data-nav="${readingUrl(r)}">
        <span class="sidebar-item-num">${i + 1}</span>
        <span>${r.title}</span>
      </button>`
    ).join('');
    const quizItems = (module.quizzes || []).map(q => {
      const active = q.id === qid ? ' active' : '';
      return `<button class="sidebar-quiz-item${active}" data-nav="${quizUrl(q)}">
        <span class="sidebar-quiz-icon">Q</span>
        <span>${q.title}</span>
      </button>`;
    }).join('');
    return `
      <aside class="reading-sidebar">
        <button class="sidebar-course-link" data-nav="${overviewUrl}">← ${modTitle}</button>
        <div class="sidebar-nav-label">Readings</div>
        ${readingItems}
        <div class="sidebar-nav-label" style="margin-top:12px">Quizzes</div>
        ${quizItems}
      </aside>`;
  })();

  const questionsHTML = quiz.questions.map((q, i) => {
    if (q.type === 'multiple-choice') return buildMCQuestion(q, i);
    if (q.type === 'code-completion') return buildCodeQuestion(q, i);
    return '';
  }).join('');

  root.innerHTML = `
    <div class="reading-layout">
      ${sidebarHTML}
      <div class="reading-main">
        <div class="reading-kicker">${kickerLabel} · ${modTitle}</div>
        <h1 class="reading-title">${quiz.title}</h1>
        <div class="reading-meta-row">
          <span>${quiz.questions.length} questions</span>
          <span class="reading-meta-sep">·</span>
          <span>Pass at ${Math.round(quiz.passingScore * 100)}%</span>
          ${quiz.allowRetry ? `<span class="reading-meta-sep">·</span><span>Retries allowed</span>` : ''}
          ${prevScoreNote}
        </div>
        <form id="quiz-form" class="quiz-question-list">
          ${questionsHTML}
        </form>
        <div class="quiz-actions" id="quizActions">
          <button class="quiz-submit-btn" id="quizSubmit" type="button">Submit Quiz</button>
        </div>
        <div id="quizResult"></div>
        <div class="reading-nav-row" style="margin-top:40px">
          <button class="reading-nav-btn prev" data-nav="${navItemUrl(id, quiz.prevItem, seg, mid)}">← Previous</button>
          ${quiz.nextItem ? `<button class="reading-nav-btn next" data-nav="${navItemUrl(id, quiz.nextItem, seg, mid)}">Next →</button>` : ''}
        </div>
      </div>
    </div>`;

  // Wire [data-nav] clicks
  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );

  // Hint toggles
  root.querySelectorAll('.hint-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const hintEl = root.querySelector(`#hint_${btn.dataset.qid}`);
      if (!hintEl) return;
      const open = hintEl.classList.toggle('visible');
      btn.classList.toggle('hint-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('.hint-label').textContent = open ? 'Hide hint' : 'Show hint';
    });
  });

  // Option selection
  root.querySelectorAll('.options-list').forEach(list => {
    list.querySelectorAll('.option-label').forEach(label => {
      label.querySelector('input')?.addEventListener('change', () => {
        list.querySelectorAll('.option-label').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
      });
    });
  });

  // Submit
  root.querySelector('#quizSubmit').addEventListener('click', () => {
    root.querySelector('#quiz-form')?.classList.add('quiz-submitted');

    const { correct, total, score } = gradeQuiz(quiz, root);
    const passed = score >= quiz.passingScore;

    saveQuizResult(storageKey, qid, score, passed);
    const updatedRecord = store.get(`quiz:${storageKey}`)?.[qid];

    root.querySelector('#quizActions').innerHTML = '';

    const retryBtn = quiz.allowRetry
      ? `<button class="quiz-retry-btn" id="quizRetry">Try Again</button>`
      : '';
    const nextNav = quiz.nextItem
      ? `<button class="reading-nav-btn next" data-nav="${navItemUrl(id, quiz.nextItem, seg)}">Continue →</button>`
      : '';
    const overviewBtn = `<button class="reading-nav-btn prev" data-nav="${overviewUrl}">← Overview</button>`;

    root.querySelector('#quizResult').innerHTML = `
      <div class="quiz-score-card ${passed ? 'passed' : 'failed'}">
        <div class="quiz-score-pct">${correct}/${total}</div>
        <div class="quiz-score-label">
          ${Math.round(score * 100)}% &nbsp;·&nbsp; ${passed ? 'Passed' : 'Did not pass'}
          ${updatedRecord?.attempts > 1 ? ` &nbsp;·&nbsp; Best: ${Math.round(updatedRecord.bestScore * 100)}% · ${updatedRecord.attempts} attempts` : ''}
        </div>
        <div class="quiz-result-actions">
          ${retryBtn}${nextNav}${overviewBtn}
        </div>
      </div>`;

    root.querySelectorAll('#quizResult [data-nav]').forEach(el =>
      el.addEventListener('click', () => navigate(el.dataset.nav))
    );

    root.querySelector('#quizRetry')?.addEventListener('click', () => {
      renderQuizBody(params, root, module, shuffleQuizData(quiz));
    });
  });
}

// ── LAB VIEW ──────────────────────────────────────────────────
async function renderLab(params, root) {
  const { id, lid } = params;
  const mid = params.mid || null;
  showLoading(root);

  let courseRef, module, lab, courseManifest, modEntry;
  try {
    courseRef = await findCourse(id);
    if (courseRef.type === 'course') {
      courseManifest = await fetchJSON(courseRef.dataPath);
      modEntry = courseManifest.modules.find(m => m.id === mid);
      if (!modEntry) throw new Error('Module not found: ' + mid);
      module = await fetchJSON(modEntry.dataPath);
    } else {
      module = await fetchJSON(courseRef.dataPath);
    }
    // Support both module.labs[] (array) and module.lab (singular, 3DGS style)
    const labsArr = module.labs || (module.lab ? [module.lab] : []);
    const labRef = labsArr.find(l => l.id === lid);
    if (!labRef) throw new Error('Lab not found: ' + lid);
    lab = await fetchJSON(labRef.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg = courseSegment(courseRef);
  const isCourse = seg === 'course';
  const storageKey = isCourse ? `${id}_${mid}` : id;
  const overviewUrl = isCourse ? `/${id}/${mid}` : `/${seg}/${id}`;
  const modTitle = isCourse ? modEntry.title : module.title;
  const kickerLabel = isCourse ? courseManifest.title : seg === 'supplement' ? 'Supplement' : 'Prerequisite';

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    ...(isCourse ? [{ label: courseManifest.title, href: `/${id}` }, { label: modEntry.title, href: overviewUrl }] : [{ label: module.title, href: overviewUrl }]),
    { label: lab.title },
  ]);

  markLabVisited(storageKey, lid);

  const readingUrl = r => isCourse ? `/${id}/${mid}/reading/${r.id}` : `/${seg}/${id}/reading/${r.id}`;
  const quizUrl   = q => isCourse ? `/${id}/${mid}/quiz/${q.id}`    : `/${seg}/${id}/quiz/${q.id}`;
  const labUrl    = l => isCourse ? `/${id}/${mid}/lab/${l.id}`     : `/${seg}/${id}/lab/${l.id}`;

  const labsArr = module.labs || (module.lab ? [module.lab] : []);

  const sidebarHTML = (() => {
    const readingItems = module.readings.map((r, i) =>
      `<button class="sidebar-reading-item" data-nav="${readingUrl(r)}">
        <span class="sidebar-item-num">${i + 1}</span>
        <span>${r.title}</span>
      </button>`
    ).join('');
    const quizItems = (module.quizzes || []).map(q =>
      `<button class="sidebar-quiz-item" data-nav="${quizUrl(q)}">
        <span class="sidebar-quiz-icon">Q</span>
        <span>${q.title}</span>
      </button>`
    ).join('');
    const labItems = labsArr.map(l => {
      const active = l.id === lid ? ' active' : '';
      return `<button class="sidebar-lab-item${active}" data-nav="${labUrl(l)}">
        <span class="sidebar-lab-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </span>
        <span>${l.title}</span>
      </button>`;
    }).join('');

    const quizSection = quizItems
      ? `<div class="sidebar-nav-label" style="margin-top:12px">Quizzes</div>${quizItems}` : '';
    const labSection = labItems
      ? `<div class="sidebar-nav-label" style="margin-top:12px">Labs</div>${labItems}` : '';

    return `
      <aside class="reading-sidebar">
        <button class="sidebar-course-link" data-nav="${overviewUrl}">← ${modTitle}</button>
        <div class="sidebar-nav-label">Readings</div>
        ${readingItems}
        ${quizSection}
        ${labSection}
      </aside>`;
  })();

  const objectivesHTML = (lab.objectives || []).map((o, i) => `
    <div class="lab-objective-item">
      <div class="lab-objective-num">${i + 1}</div>
      <span>${renderInlineMath(o)}</span>
    </div>`).join('');

  const descHTML = renderMarkdown(lab.description || '');

  root.innerHTML = `
    <div class="reading-layout">
      ${sidebarHTML}
      <div class="reading-main">
        <div class="reading-kicker">${kickerLabel} · ${modTitle}</div>
        <h1 class="reading-title">${lab.title}</h1>
        <div class="reading-meta-row">
          <span>Colab Notebook</span>
          <span class="reading-meta-sep">·</span>
          <span>~${lab.estimatedMinutes} min</span>
        </div>

        <div class="lab-colab-card">
          <div class="lab-colab-info">
            <div class="lab-colab-kicker">Google Colab Notebook</div>
            <div class="lab-colab-title">${lab.title}</div>
            <div class="lab-colab-meta">Python · ~${lab.estimatedMinutes} min</div>
          </div>
          <a class="lab-colab-btn" href="${lab.colabUrl}" target="_blank" rel="noopener" id="colabBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in Colab
          </a>
        </div>

        ${objectivesHTML ? `
        <div class="lab-objectives">
          <div class="lab-objectives-label">Lab Objectives</div>
          ${objectivesHTML}
        </div>` : ''}

        <div class="reading-content" id="labDescription">
          ${descHTML}
        </div>

        <div class="reading-nav-row">
          <button class="reading-nav-btn prev" data-nav="${navItemUrl(id, lab.prevItem, seg, mid)}">← Previous</button>
          ${lab.nextItem ? `<button class="reading-nav-btn next" data-nav="${navItemUrl(id, lab.nextItem, seg, mid)}">Next →</button>` : ''}
        </div>
      </div>
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );

  highlightCode(root);

  setSearchContext('lab', { lab, module, seg, courseRef });
}

// ══════════════════════════════════════════════════════════════
// SEARCH SYSTEM
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// NOTATION REFERENCE
// ══════════════════════════════════════════════════════════════
const Notation = {
  // [ { symbol, name, desc, sources: [{title, url}] } ]  — deduped by symbol
  index: [],
};

function addNotationTerms(terms, sourceTitle, sourceUrl) {
  for (const term of terms) {
    if (!term || !term.symbol) continue;
    const existing = Notation.index.find(e => e.symbol === term.symbol && e.name === term.name);
    if (existing) {
      if (!existing.sources.some(s => s.url === sourceUrl))
        existing.sources.push({ title: sourceTitle, url: sourceUrl });
    } else {
      Notation.index.push({
        symbol: term.symbol,
        name:   term.name,
        desc:   term.desc || '',
        sources: sourceUrl ? [{ title: sourceTitle, url: sourceUrl }] : [],
      });
    }
  }
  renderNotationFab();
}

function renderNotationFab() {
  const fab = document.getElementById('notationFab');
  if (!fab) return;
  const currentPath = window.location.pathname.slice(BASE_PATH.length) || '/';
  const onHome = currentPath === '/' || currentPath === '';
  fab.style.display = (!onHome && Notation.index.length) ? 'flex' : 'none';
}

function openNotationModal() {
  const modal = document.getElementById('notationOverlay');
  if (!modal) return;
  modal.classList.add('is-open');
  const field = document.getElementById('notationSearchField');
  if (field) {
    field.value = '';
    // Skip auto-focus on touch — keyboard would immediately compress the sheet
    if (window.matchMedia('(pointer: fine)').matches) field.focus();
  }
  renderNotationList('');
}

function closeNotationModal() {
  document.getElementById('notationOverlay')?.classList.remove('is-open');
}

function renderNotationList(query) {
  const list = document.getElementById('notationList');
  if (!list) return;
  const q = query.toLowerCase().trim();
  const entries = q
    ? Notation.index.filter(e =>
        e.symbol.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.desc.toLowerCase().includes(q)
      )
    : Notation.index;

  if (!entries.length) {
    list.innerHTML = `<div class="notation-empty">No symbols match "${_escHtml(query)}"</div>`;
    return;
  }

  list.innerHTML = entries.map(e => {
    let sym = e.symbol;
    try { sym = katex.renderToString(e.symbol, { throwOnError: false, displayMode: false }); } catch { sym = _escHtml(e.symbol); }
    const srcs = e.sources.map(s =>
      `<a class="notation-source-link" href="${_escHtml(s.url)}" data-nav="${_escHtml(s.url)}">${_escHtml(s.title)}</a>`
    ).join(', ');
    return `<div class="notation-entry">
      <div class="notation-sym">${sym}</div>
      <div class="notation-body">
        <div class="notation-name">${renderInlineMath(e.name)}</div>
        <div class="notation-desc">${renderInlineMath(e.desc)}</div>
        ${srcs ? `<div class="notation-sources">from: ${srcs}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-nav]').forEach(a =>
    a.addEventListener('click', e => {
      e.preventDefault();
      closeNotationModal();
      navigate(a.dataset.nav);
    })
  );
}

function initNotation() {
  document.getElementById('notationFab')?.addEventListener('click', openNotationModal);
  document.getElementById('notationCloseBtn')?.addEventListener('click', closeNotationModal);
  document.getElementById('notationOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNotationModal();
  });
  document.getElementById('notationSearchField')?.addEventListener('input', e => {
    renderNotationList(e.target.value);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('notationOverlay')?.classList.contains('is-open')) {
      closeNotationModal();
    }
  });
  renderNotationFab();
}

document.addEventListener('DOMContentLoaded', initNotation);

// ── State ────────────────────────────────────────────────────
const Search = {
  index: [],           // [{title, subtitle, url, paragraphs: string[], type}]
  context: 'catalog',  // 'catalog' | 'course' | 'reading' | 'lab' | 'none'
  contextLabel: 'All content',
  contextColor: null,
  moduleCache: {},     // dataPath → module JSON (for catalog enrichment)
  debounceTimer: null,
  activeIdx: -1,       // keyboard-selected result index
};

// ── Text utilities ───────────────────────────────────────────
function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function stripMd(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')    // fenced code
    .replace(/`[^`]+`/g, '')           // inline code
    .replace(/#{1,6}\s+/g, '')         // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')    // images
    .replace(/^\s*[-*+]\s+/gm, '')     // bullets
    .replace(/^\s*\d+\.\s+/gm, '')     // ordered list
    .replace(/^\s*>\s+/gm, '')         // blockquote
    .replace(/\|[^\n]+\|\n/g, '')      // table rows
    .replace(/\$\$[\s\S]*?\$\$/g, '') // display math
    .replace(/\$[^$\n]+\$/g, '')      // inline math
    .replace(/\\\([\s\S]*?\\\)/g, '') // \(...\) math
    .replace(/\\\[[\s\S]*?\\\]/g, '') // \[...\] math
    .trim();
}

function getParagraphs(mdText) {
  if (!mdText) return [];
  return mdText
    .split(/\n\n+/)
    .map(p => stripMd(p).trim())
    .filter(p => p.length > 30);
}

// Extract the sentence containing `query` from `para`.
// Returns HTML-escaped snippet with query term wrapped in <mark>.
function extractSnippet(para, query) {
  const lower = para.toLowerCase();
  const qLow  = query.toLowerCase();
  const pos   = lower.indexOf(qLow);
  if (pos === -1) return null;

  // Find surrounding sentence boundaries (period or start/end of para)
  let start = pos;
  while (start > 0 && para[start - 1] !== '.' && para[start - 1] !== '\n') start--;
  let end = pos + query.length;
  while (end < para.length && para[end] !== '.' && para[end] !== '\n') end++;
  if (end < para.length && para[end] === '.') end++; // include the period

  let sentence = para.slice(start, end).trim();

  // Hard-truncate if still very long, keeping the match visible
  const MAX = 220;
  if (sentence.length > MAX) {
    const relPos = pos - start;
    const from = Math.max(0, relPos - 80);
    const to   = Math.min(sentence.length, relPos + MAX - 80);
    sentence = (from > 0 ? '…' : '') + sentence.slice(from, to) + (to < sentence.length ? '…' : '');
  }

  return _escHtml(sentence).replace(
    new RegExp(_escRegex(_escHtml(query)), 'gi'),
    '<mark>$&</mark>'
  );
}

function highlightInPara(para, query) {
  return _escHtml(para).replace(
    new RegExp(_escRegex(_escHtml(query)), 'gi'),
    '<mark>$&</mark>'
  );
}

// ── Index builders ───────────────────────────────────────────
// Async-enrich a reading index entry with the full content paragraphs.
// The item is already in Search.index; we update it in-place so any
// in-flight search query picks up the richer data on the next keystroke.
async function enrichReadingContent(item, dataPath) {
  if (!dataPath) return;
  try {
    const reading = Search.moduleCache[dataPath] ||
                    (Search.moduleCache[dataPath] = await fetchJSON(dataPath));
    const paras = getParagraphs(reading.content || '');
    for (const bd of (reading.equationBreakdowns || [])) {
      if (!bd) continue;
      for (const term of (bd.terms || [])) paras.push(`${term.name}: ${term.desc}`);
      addNotationTerms(bd.terms || [], item.title, item.url);
    }
    if (paras.length) item.paragraphs = paras;
  } catch { /* ignore */ }
}

async function buildCatalogIndex(platform) {
  Search.index = [];
  for (const section of platform.sections) {
    for (const course of section.courses) {
      if (course.type === 'external') continue; // no longer used
      if (course.type === 'course') {
        Search.index.push({
          title: course.title,
          subtitle: section.title,
          url: `/${course.id}`,
          type: 'course',
          paragraphs: [course.description || course.title],
        });
        if (course.dataPath) {
          (async () => {
            try {
              const manifest = Search.moduleCache[course.dataPath] ||
                               (Search.moduleCache[course.dataPath] = await fetchJSON(course.dataPath));
              for (const modEntry of manifest.modules || []) {
                Search.index.push({
                  title: modEntry.title,
                  subtitle: course.title,
                  url: `/${course.id}/${modEntry.id}`,
                  type: 'course',
                  paragraphs: [modEntry.description || modEntry.title],
                });
                if (!modEntry.dataPath) continue;
                const modData = Search.moduleCache[modEntry.dataPath] ||
                                (Search.moduleCache[modEntry.dataPath] = await fetchJSON(modEntry.dataPath));
                for (const r of modData.readings || []) {
                  const item = {
                    title: r.title,
                    subtitle: modEntry.title,
                    url: `/${course.id}/${modEntry.id}/reading/${r.id}`,
                    type: 'reading',
                    paragraphs: [r.description || r.title],
                  };
                  Search.index.push(item);
                  enrichReadingContent(item, r.dataPath);
                }
                for (const q of modData.quizzes || []) {
                  Search.index.push({
                    title: q.title,
                    subtitle: modEntry.title,
                    url: `/${course.id}/${modEntry.id}/quiz/${q.id}`,
                    type: 'quiz',
                    paragraphs: [q.title],
                  });
                }
                const labs = modData.labs || (modData.lab ? [modData.lab] : []);
                for (const l of labs) {
                  Search.index.push({
                    title: l.title,
                    subtitle: modEntry.title,
                    url: `/${course.id}/${modEntry.id}/lab/${l.id}`,
                    type: 'lab',
                    paragraphs: [l.description || l.title],
                  });
                }
              }
            } catch { /* ignore */ }
          })();
        }
        continue;
      }
      const seg = course.type === 'supplement' ? 'supplement' : 'prereq';
      Search.index.push({
        title: course.title,
        subtitle: section.title,
        url: `/${seg}/${course.id}`,
        type: 'course',
        paragraphs: [course.description || course.title],
      });
      // Async-enrich: fetch module.json for each course to get reading titles
      const dp = course.dataPath;
      if (!dp) continue;
      (async () => {
        try {
          const mod = Search.moduleCache[dp] || (Search.moduleCache[dp] = await fetchJSON(dp));
          for (const r of mod.readings || []) {
            const item = {
              title: r.title,
              subtitle: course.title,
              url: `/${seg}/${course.id}/reading/${r.id}`,
              type: 'reading',
              paragraphs: [r.description || r.title],
            };
            Search.index.push(item);
            enrichReadingContent(item, r.dataPath);
          }
          for (const q of mod.quizzes || []) {
            Search.index.push({
              title: q.title,
              subtitle: course.title,
              url: `/${seg}/${course.id}/quiz/${q.id}`,
              type: 'quiz',
              paragraphs: [q.title],
            });
          }
          for (const l of mod.labs || []) {
            Search.index.push({
              title: l.title,
              subtitle: course.title,
              url: `/${seg}/${course.id}/lab/${l.id}`,
              type: 'lab',
              paragraphs: [l.description || l.title],
            });
          }
        } catch { /* ignore fetch errors silently */ }
      })();
    }
  }
}

function courseBase(seg, courseRef, module) {
  return seg === 'course'
    ? `/${courseRef.id}/${module.id}`
    : `/${seg}/${module.id}`;
}

function buildCourseIndex(module, courseRef, seg) {
  const base = courseBase(seg, courseRef, module);
  Search.index = [];
  for (const r of module.readings || []) {
    const item = {
      title: r.title,
      subtitle: 'Reading',
      url: `${base}/reading/${r.id}`,
      type: 'reading',
      paragraphs: [r.description || r.title],
    };
    Search.index.push(item);
    enrichReadingContent(item, r.dataPath);
  }
  for (const q of module.quizzes || []) {
    Search.index.push({
      title: q.title,
      subtitle: 'Quiz',
      url: `${base}/quiz/${q.id}`,
      type: 'quiz',
      paragraphs: [q.title],
    });
  }
  for (const l of module.labs || (module.lab ? [module.lab] : [])) {
    Search.index.push({
      title: l.title,
      subtitle: 'Lab',
      url: `${base}/lab/${l.id}`,
      type: 'lab',
      paragraphs: [l.description || l.title],
    });
  }
}

function buildReadingIndex(reading, module, seg, courseRef) {
  const base = courseBase(seg, courseRef || { id: module.id }, module);
  const paragraphs = getParagraphs(reading.content || '');
  for (const bd of reading.equationBreakdowns || []) {
    for (const term of (bd && bd.terms) || []) {
      paragraphs.push(`${term.name}: ${term.desc}`);
    }
  }
  Search.index = [{
    title: reading.title,
    subtitle: module.title,
    url: `${base}/reading/${reading.id}`,
    type: 'reading',
    paragraphs,
  }];
}

function buildLabIndex(lab, module, seg, courseRef) {
  const base = courseBase(seg, courseRef || { id: module.id }, module);
  const paragraphs = getParagraphs(lab.description || '');
  for (const obj of lab.objectives || []) paragraphs.push(obj);
  Search.index = [{
    title: lab.title,
    subtitle: module.title,
    url: `${base}/lab/${lab.id}`,
    type: 'lab',
    paragraphs,
  }];
}

// ── Context setter ────────────────────────────────────────────
async function setSearchContext(type, data) {
  Search.context = type;
  Search.activeIdx = -1;

  const navSearch  = document.getElementById('navSearch');
  const scopeLabel = document.getElementById('searchScopeLabel');
  const scopeDot   = document.getElementById('searchScopeDot');

  if (type === 'none') {
    if (navSearch) navSearch.style.display = 'none';
    return;
  }
  if (navSearch) navSearch.style.display = '';

  let label = 'All content';
  let color  = null;

  if (type === 'catalog') {
    label = 'All content';
    color = null;
    await buildCatalogIndex(data.platform);
  } else if (type === 'course') {
    label = data.module.title;
    buildCourseIndex(data.module, data.courseRef, data.seg);
  } else if (type === 'reading') {
    label = data.reading.title;
    buildReadingIndex(data.reading, data.module, data.seg, data.courseRef);
  } else if (type === 'lab') {
    label = data.lab.title;
    buildLabIndex(data.lab, data.module, data.seg, data.courseRef);
  }

  Search.contextLabel = label;
  if (scopeLabel) scopeLabel.textContent = label;
  if (scopeDot) {
    if (type !== 'catalog') {
      scopeDot.classList.add('visible');
    } else {
      scopeDot.classList.remove('visible');
    }
  }

  // Sync search field placeholder
  const field = document.getElementById('searchField');
  if (field) {
    const hint = type === 'catalog'   ? 'Search all courses and readings…'
               : type === 'course'    ? `Search in ${label}…`
               : type === 'reading'   ? `Search in this reading…`
               : type === 'lab'       ? `Search in this lab…`
               : 'Search…';
    field.placeholder = hint;
  }
}

// ── Search execution ─────────────────────────────────────────
function runSearch(query) {
  query = (query || '').trim();
  const list = document.getElementById('searchResultsList');
  if (!list) return;

  if (query.length < 2) {
    Search.activeIdx = -1;
    list.innerHTML = query.length === 0
      ? '<div class="search-hint-state">Type to search…</div>'
      : '<div class="search-hint-state">Keep typing…</div>';
    return;
  }

  const results = [];
  for (const item of Search.index) {
    for (const para of item.paragraphs) {
      if (para.toLowerCase().includes(query.toLowerCase())) {
        const snippet = extractSnippet(para, query);
        if (snippet) {
          results.push({ ...item, snippet, rawPara: para });
          break; // one result per index item
        }
      }
    }
  }

  renderSearchResults(results.slice(0, 30), query, list);
}

function renderSearchResults(results, query, list) {
  Search.activeIdx = -1;
  if (results.length === 0) {
    list.innerHTML = `<div class="search-empty-state">No results for "<strong>${_escHtml(query)}</strong>"</div>`;
    return;
  }

  const typeIcon = { reading: '📖', quiz: '🎯', lab: '🧪', course: '📚' };

  list.innerHTML =
    `<div class="search-results-header">${results.length} result${results.length !== 1 ? 's' : ''}</div>` +
    results.map((r, i) => `
      <div class="search-result-item" data-idx="${i}" data-url="${_escHtml(r.url)}"
           data-para="${encodeURIComponent(r.rawPara)}"
           data-title="${_escHtml(r.title)}" data-sub="${_escHtml(r.subtitle || '')}"
           data-external="${r.isExternal ? '1' : ''}">
        <div class="search-result-meta">
          <span class="search-result-title">${_escHtml(r.title)}</span>
          <span class="search-result-sub">${_escHtml(r.subtitle || '')}</span>
        </div>
        <div class="search-result-snippet" title="Click to view full paragraph">${r.snippet}</div>
        <div class="search-result-snippet-hint">Click snippet to expand paragraph</div>
      </div>`
    ).join('');

  list.querySelectorAll('.search-result-item').forEach(row => {
    // Click snippet → paragraph popup
    row.querySelector('.search-result-snippet').addEventListener('click', e => {
      e.stopPropagation();
      const para  = decodeURIComponent(row.dataset.para);
      const title = row.dataset.title;
      const sub   = row.dataset.sub;
      const url   = row.dataset.url;
      showParagraphPopup(para, title, sub, query, url);
    });
    // Click row (not snippet) → navigate
    row.addEventListener('click', e => {
      if (e.target.closest('.search-result-snippet')) return;
      closeSearch();
      if (row.dataset.external === '1') {
        window.location.href = row.dataset.url;
      } else {
        navigate(row.dataset.url);
      }
    });
  });
}

// ── Keyboard navigation in results ───────────────────────────
function moveSearchSelection(delta) {
  const items = document.querySelectorAll('.search-result-item');
  if (!items.length) return;
  items[Search.activeIdx]?.classList.remove('is-active');
  Search.activeIdx = Math.max(0, Math.min(items.length - 1, Search.activeIdx + delta));
  const next = items[Search.activeIdx];
  next.classList.add('is-active');
  next.scrollIntoView({ block: 'nearest' });
}

function activateSelectedResult() {
  const items = document.querySelectorAll('.search-result-item');
  const item  = items[Search.activeIdx];
  if (!item) return;
  closeSearch();
  if (item.dataset.external === '1') {
    window.location.href = item.dataset.url;
  } else {
    navigate(item.dataset.url);
  }
}

// ── Paragraph popup ──────────────────────────────────────────
function showParagraphPopup(para, title, subtitle, query, url) {
  const overlay = document.getElementById('paraOverlay');
  const src     = document.getElementById('paraPopupSrc');
  const text    = document.getElementById('paraPopupText');
  if (!overlay || !src || !text) return;

  const label = subtitle ? `${title}  ·  ${subtitle}` : title;
  if (url) {
    src.innerHTML = `<a class="para-popup-src-link" href="${url}" title="Go to page">${_escHtml(label)}</a>`;
    src.querySelector('a').addEventListener('click', e => {
      e.preventDefault();
      closeParagraphPopup();
      closeSearch();
      navigate(url);
    });
  } else {
    src.textContent = label;
  }
  text.innerHTML  = highlightInPara(para, query);
  overlay.classList.add('is-open');
  document.getElementById('paraPopupClose')?.focus();
}

function closeParagraphPopup() {
  document.getElementById('paraOverlay')?.classList.remove('is-open');
}

// ── Open / close search ──────────────────────────────────────
function openSearch() {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  Search.activeIdx = -1;
  const field = document.getElementById('searchField');
  if (field) {
    field.value = '';
    setTimeout(() => field.focus(), 50);
  }
  const list = document.getElementById('searchResultsList');
  if (list) list.innerHTML = '<div class="search-hint-state">Type to search…</div>';
  document.body.style.overflow = 'hidden';
}

function closeSearch() {
  document.getElementById('searchOverlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ── Init search (called once after DOM ready) ─────────────────
function initSearch() {
  // Fix kbd hint: Ctrl+K on Windows/Linux
  const isMac = navigator.platform?.toUpperCase().includes('MAC') ||
                navigator.userAgent?.includes('Mac');
  const kbd = document.querySelector('.search-pill-kbd');
  if (kbd && !isMac) kbd.textContent = 'Ctrl+K';

  // Open on pill click
  document.getElementById('searchPill')?.addEventListener('click', openSearch);

  // Close on ESC button or overlay backdrop click
  document.getElementById('searchEscBtn')?.addEventListener('click', closeSearch);
  document.getElementById('searchOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSearch();
  });

  // Keyboard: ⌘K / Ctrl+K to open, Escape to close
  document.addEventListener('keydown', e => {
    const paraOpen = document.getElementById('paraOverlay')?.classList.contains('is-open');
    if (e.key === 'Escape') {
      if (paraOpen) { closeParagraphPopup(); return; }
      closeSearch(); return;
    }
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const isOpen = document.getElementById('searchOverlay')?.classList.contains('is-open');
      if (isOpen) closeSearch(); else openSearch();
      return;
    }
    const searchOpen = document.getElementById('searchOverlay')?.classList.contains('is-open');
    if (!searchOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchSelection(1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveSearchSelection(-1); }
    if (e.key === 'Enter')     { e.preventDefault(); activateSelectedResult(); }
  });

  // Paragraph popup close
  document.getElementById('paraPopupClose')?.addEventListener('click', closeParagraphPopup);
  document.getElementById('paraOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeParagraphPopup();
  });

  // Debounced search on input
  document.getElementById('searchField')?.addEventListener('input', e => {
    clearTimeout(Search.debounceTimer);
    Search.debounceTimer = setTimeout(() => runSearch(e.target.value), 150);
  });
}

// Start search system once DOM is ready
document.addEventListener('DOMContentLoaded', initSearch);

// ══════════════════════════════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════════════════════════════

function fireConfetti(onDone) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const COLORS = ['#f59e0b','#10b981','#6366f1','#ef4444','#3b82f6','#ec4899','#63aac9','#f97316'];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height * 0.6,
    w: 7  + Math.random() * 9,
    h: 3  + Math.random() * 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2  + Math.random() * 5,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.18,
  }));

  const start = performance.now();
  const DURATION = 1800;
  let raf;

  function draw(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = Math.max(0, 1 - (elapsed - DURATION * 0.55) / (DURATION * 0.45));
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.angle += p.spin;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < DURATION) {
      raf = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
      onDone?.();
    }
  }
  raf = requestAnimationFrame(draw);
}

// ══════════════════════════════════════════════════════════════
// SYLLABUS
// ══════════════════════════════════════════════════════════════

const SYLLABUS_ICONS = {
  reading: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM5 4.5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1zm-.5 2.5A.5.5 0 0 1 5 6.5h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zM5 9a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z"/></svg>`,
  quiz:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.54.146A.5.5 0 0 1 4.893 0h6.214a.5.5 0 0 1 .353.146l4.394 4.394a.5.5 0 0 1 .146.353v6.214a.5.5 0 0 1-.146.353l-4.394 4.394a.5.5 0 0 1-.353.146H4.893a.5.5 0 0 1-.353-.146L.146 11.46A.5.5 0 0 1 0 11.107V4.893a.5.5 0 0 1 .146-.353zM5.1 1 1 5.1v5.8L5.1 15h5.8l4.1-4.1V5.1L10.9 1z"/><path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94"/></svg>`,
  lab:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M14.5 3a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1 0-1h13a.5.5 0 0 1 .5.5M11 7.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 .5.5m-2 3a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5"/><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/></svg>`,
  lock:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  drill:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
};

function _syllabusItemRow(iconKey, label, href, meta) {
  const content = href
    ? `<a class="outline-item-link" href="${href}">${_escHtml(label)}</a>`
    : `<span class="outline-item-link outline-item-disabled">${_escHtml(label)}</span>`;
  return `
    <li class="outline-item${href ? '' : ' outline-item-locked'}">
      <span class="outline-item-icon outline-icon-${iconKey}">${SYLLABUS_ICONS[iconKey]}</span>
      ${content}
      ${meta ? `<span class="outline-item-meta">${meta}</span>` : ''}
    </li>`;
}

function _syllabusModuleSection(courseId, modEntry, modData, allModuleData, threshold, devUnlock) {
  const { id: mid, color, order, prereq } = modEntry;
  const readings = modData.readings || [];
  const quizzes  = modData.quizzes  || [];
  const labs     = modData.labs || (modData.lab ? [modData.lab] : []);

  // Unlock check
  let locked = false;
  if (!devUnlock && prereq) {
    const prereqData = allModuleData[prereq];
    const prereqKey  = `${courseId}_${prereq}`;
    locked = !(prereqData?.quizzes || []).every(q => {
      const rec = store.get(`quiz:${prereqKey}`)?.[q.id];
      return rec && rec.bestScore >= threshold;
    });
  }

  const base = `/${courseId}/${mid}`;
  const readingRows = readings.map(r => _syllabusItemRow(
    'reading', r.title,
    locked ? null : `${base}/reading/${r.id}`,
    r.estimatedMinutes ? `${r.estimatedMinutes} min` : ''
  )).join('');
  const quizRows = quizzes.map(q => _syllabusItemRow(
    'quiz', q.title,
    locked ? null : `${base}/quiz/${q.id}`,
    q.questionCount ? `${q.questionCount} questions` : ''
  )).join('');
  const labRows = labs.map(l => _syllabusItemRow(
    'lab', l.title,
    locked ? null : `${base}/lab/${l.id}`,
    l.estimatedMinutes ? `${l.estimatedMinutes} min` : ''
  )).join('');

  const totalItems   = readings.length + quizzes.length + labs.length;
  const totalMinutes = readings.reduce((s, r) => s + (r.estimatedMinutes || 0), 0)
                     + labs.reduce((s, l) => s + (l.estimatedMinutes || 0), 0);

  const prereqEntry = prereq ? Object.values(allModuleData).find
    ? null : null : null; // resolved below via courseManifest
  const lockBadge  = locked
    ? `<span class="outline-lock-badge">${SYLLABUS_ICONS.lock} Locked</span>` : '';

  return `
    <details class="outline-module${locked ? ' outline-module-locked' : ''}" open>
      <summary class="outline-summary">
        <span class="outline-accent-dot" style="background:${color};${locked ? 'opacity:0.35' : ''}"></span>
        <span class="outline-module-num">M${order}</span>
        <span class="outline-summary-title">${_escHtml(modEntry.title)}</span>
        ${lockBadge}
        <span class="outline-summary-meta">${totalItems} items · ${totalMinutes} min</span>
        <span class="outline-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </summary>
      <div class="outline-body">
        ${locked ? `<p class="outline-locked-note">Pass the quizzes in the previous module (≥${Math.round(threshold * 100)}%) to unlock this module.</p>` : ''}
        ${readings.length ? `<div class="outline-group"><span class="outline-group-label">Readings</span><ul class="outline-items">${readingRows}</ul></div>` : ''}
        ${quizzes.length  ? `<div class="outline-group"><span class="outline-group-label">Quizzes</span><ul class="outline-items">${quizRows}</ul></div>`   : ''}
        ${labs.length     ? `<div class="outline-group"><span class="outline-group-label">${labs.length > 1 ? 'Labs' : 'Lab'}</span><ul class="outline-items">${labRows}</ul></div>` : ''}
      </div>
    </details>`;
}

async function renderSyllabus(params, root) {
  const { id } = params;
  showLoading(root);

  const devUnlock = sessionStorage.getItem('upskilled:devUnlock') === '1';

  let courseRef, courseManifest, moduleDataMap;
  try {
    courseRef     = await findCourse(id);
    courseManifest = await fetchJSON(courseRef.dataPath);
    const loaded  = await Promise.all(courseManifest.modules.map(m => fetchJSON(m.dataPath)));
    moduleDataMap = {};
    courseManifest.modules.forEach((m, i) => { moduleDataMap[m.id] = loaded[i]; });
  } catch (e) {
    showError(root, e.message);
    return;
  }

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: courseManifest.title, href: `/${id}` },
    { label: 'Syllabus' },
  ]);

  const threshold = courseManifest.unlockThreshold || 0.6;

  const sectionsHTML = courseManifest.modules.map(modEntry =>
    _syllabusModuleSection(id, modEntry, moduleDataMap[modEntry.id], moduleDataMap, threshold, devUnlock)
  ).join('');

  root.innerHTML = `
    <div class="outline-page" id="outline-page">
      <div class="outline-header">
        <button class="course-ov-back" data-nav="/${id}">← ${_escHtml(courseManifest.title)}</button>
        <div class="outline-header-title">
          <h1 class="course-ov-title" style="margin:12px 0 4px">Syllabus</h1>
          ${devUnlock ? '<span class="admin-badge">ADMIN</span>' : ''}
        </div>
        <p class="outline-header-sub">${devUnlock
          ? 'Admin mode — progress gating disabled. All content is directly accessible.'
          : 'Complete each module\'s quizzes to unlock the next. Click any available item to open it.'
        }</p>
        <div class="outline-controls">
          <button class="btn-outline-ctrl" id="outline-expand-all">Expand all</button>
          <button class="btn-outline-ctrl" id="outline-collapse-all">Collapse all</button>
        </div>
      </div>
      <div class="outline-modules">${sectionsHTML}</div>
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );
  root.querySelector('#outline-expand-all')?.addEventListener('click', () => {
    root.querySelectorAll('.outline-module').forEach(el => el.open = true);
  });
  root.querySelector('#outline-collapse-all')?.addEventListener('click', () => {
    root.querySelectorAll('.outline-module').forEach(el => el.open = false);
  });

  setSearchContext('none');
}

// ── DRILL VIEW ────────────────────────────────────────────────
async function renderDrill(params, root) {
  const { id, did } = params;
  showLoading(root);

  let courseRef, module, deck;
  try {
    courseRef = await findCourse(id);
    module    = await fetchJSON(courseRef.dataPath);
    const deckMeta = (module.drills || []).find(d => d.id === did);
    if (!deckMeta) throw new Error('Drill deck not found: ' + did);
    deck = await fetchJSON(deckMeta.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg = courseSegment(courseRef);
  const backUrl = `/${seg}/${id}`;

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: module.title, href: backUrl },
    { label: deck.title },
  ]);

  const cards = deck.cards || [];
  const progress = getDrillProgress(module.id, did);

  // Select session cards: all box-0 first, then box-1; cap at 20 per session
  const box0 = cards.filter(c => (progress[c.id] || 0) === 0);
  const box1 = cards.filter(c => (progress[c.id] || 0) === 1);
  const sessionCards = [...box0, ...box1].slice(0, 20);

  if (sessionCards.length === 0) {
    // All cards known — show completion screen
    const known = Object.values(progress).filter(b => b === 2).length;
    root.innerHTML = `
      <div class="drill-page">
        <button class="course-ov-back" data-nav="${backUrl}">← ${_escHtml(module.title)}</button>
        <div class="drill-complete">
          <div class="drill-complete-icon">🎉</div>
          <h2>All ${cards.length} cards known!</h2>
          <p>You've mastered every card in <strong>${_escHtml(deck.title)}</strong>.</p>
          <div class="drill-complete-actions">
            <button class="btn-drill-primary" id="drill-reset-btn">Reset deck</button>
            <button class="btn-drill-secondary" data-nav="${backUrl}">Back to course</button>
          </div>
        </div>
      </div>`;
    root.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', () => navigate(el.dataset.nav))
    );
    root.querySelector('#drill-reset-btn')?.addEventListener('click', () => {
      const key = `drill:${module.id}`;
      const data = store.get(key) || {};
      data[did] = {};
      store.set(key, data);
      renderDrill(params, root);
    });
    return;
  }

  // Session state
  let idx = 0;
  let flipped = false;
  const sessionProgress = { correct: 0, again: 0 };

  function currentCard() { return sessionCards[idx]; }

  function renderCard() {
    const card = currentCard();
    const box  = progress[card.id] || 0;
    const pct  = Math.round((idx / sessionCards.length) * 100);

    root.querySelector('.drill-progress-fill').style.width = pct + '%';
    root.querySelector('.drill-progress-label').textContent = `${idx + 1} / ${sessionCards.length}`;

    const frontEl = root.querySelector('.drill-card-front');
    const backEl  = root.querySelector('.drill-card-back');
    frontEl.innerHTML = renderMarkdown(card.front);
    backEl.innerHTML  = renderMarkdown(card.back);

    // Re-render math in card faces
    [frontEl, backEl].forEach(el => {
      el.querySelectorAll('.katex-display, .katex').forEach(() => {}); // already rendered by renderMarkdown
    });

    const cardEl = root.querySelector('.drill-card');
    cardEl.classList.remove('is-flipped');
    flipped = false;

    root.querySelector('.drill-btn-reveal').style.display = '';
    root.querySelector('.drill-rating').style.display = 'none';
    root.querySelector('.drill-box-label').textContent = ['New', 'Learning', 'Known'][box];
  }

  function flipCard() {
    if (flipped) return;
    flipped = true;
    root.querySelector('.drill-card').classList.add('is-flipped');
    root.querySelector('.drill-btn-reveal').style.display = 'none';
    root.querySelector('.drill-rating').style.display = '';
  }

  function rateCard(got) {
    const card = currentCard();
    const cur  = progress[card.id] || 0;
    const next = got ? Math.min(cur + 1, 2) : Math.max(cur - 1, 0);
    progress[card.id] = next;
    saveDrillProgress(module.id, did, card.id, next);
    if (got) sessionProgress.correct++; else sessionProgress.again++;

    idx++;
    if (idx >= sessionCards.length) {
      showSummary();
    } else {
      renderCard();
    }
  }

  function showSummary() {
    const knownNow = Object.values(progress).filter(b => b === 2).length;
    root.querySelector('.drill-session').innerHTML = `
      <div class="drill-summary">
        <h2>Session complete</h2>
        <div class="drill-summary-stats">
          <div class="drill-stat"><span class="drill-stat-num">${sessionProgress.correct}</span><span class="drill-stat-label">Got it</span></div>
          <div class="drill-stat"><span class="drill-stat-num">${sessionProgress.again}</span><span class="drill-stat-label">Again</span></div>
          <div class="drill-stat"><span class="drill-stat-num">${knownNow}/${cards.length}</span><span class="drill-stat-label">Known</span></div>
        </div>
        <div class="drill-summary-actions">
          <button class="btn-drill-primary" id="drill-again-btn">Study again</button>
          <button class="btn-drill-secondary" data-nav="${backUrl}">Back to course</button>
        </div>
      </div>`;
    root.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', () => navigate(el.dataset.nav))
    );
    root.querySelector('#drill-again-btn')?.addEventListener('click', () => renderDrill(params, root));
  }

  root.innerHTML = `
    <div class="drill-page">
      <div class="drill-header">
        <button class="course-ov-back" data-nav="${backUrl}">← ${_escHtml(module.title)}</button>
        <h1 class="drill-title">${_escHtml(deck.title)}</h1>
        <p class="drill-subtitle">${_escHtml(deck.description || '')}</p>
      </div>
      <div class="drill-session">
        <div class="drill-progress-bar">
          <div class="drill-progress-fill" style="width:0%"></div>
        </div>
        <div class="drill-progress-label">1 / ${sessionCards.length}</div>
        <div class="drill-box-label">New</div>

        <div class="drill-card-scene">
          <div class="drill-card">
            <div class="drill-card-front"></div>
            <div class="drill-card-back"></div>
          </div>
        </div>

        <div class="drill-controls">
          <button class="btn-drill-primary drill-btn-reveal">Reveal answer</button>
          <div class="drill-rating" style="display:none">
            <button class="btn-drill-again" id="drill-again">Again</button>
            <button class="btn-drill-got" id="drill-got">Got it</button>
          </div>
        </div>
        <p class="drill-hint drill-hint-kb">Space to flip · 1 = Again · 2 = Got it</p>
        <p class="drill-hint drill-hint-touch">Tap card to flip</p>
      </div>
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );

  root.querySelector('.drill-btn-reveal')?.addEventListener('click', flipCard);
  root.querySelector('.drill-card')?.addEventListener('click', flipCard);
  root.querySelector('#drill-again')?.addEventListener('click', () => rateCard(false));
  root.querySelector('#drill-got')?.addEventListener('click', () => rateCard(true));

  // Keyboard shortcuts
  const keyHandler = (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); flipCard(); }
    if (e.key === '1' && flipped) rateCard(false);
    if (e.key === '2' && flipped) rateCard(true);
  };
  document.addEventListener('keydown', keyHandler);

  // Clean up listener when navigating away
  const origPopState = window._drillKeyCleanup;
  if (origPopState) window.removeEventListener('popstate', origPopState);
  window._drillKeyCleanup = () => document.removeEventListener('keydown', keyHandler);
  window.addEventListener('popstate', window._drillKeyCleanup, { once: true });

  renderCard();
  setSearchContext('none');
}

// ── PREREQ / SUPPLEMENT SYLLABUS ──────────────────────────────
async function renderPrereqSyllabus(params, root) {
  const { id } = params;
  showLoading(root);

  const devUnlock = sessionStorage.getItem('upskilled:devUnlock') === '1';

  let courseRef, module;
  try {
    courseRef = await findCourse(id);
    module    = await fetchJSON(courseRef.dataPath);
  } catch (e) {
    showError(root, e.message);
    return;
  }

  const seg        = courseSegment(courseRef);
  const allReadings = module.readings || [];
  const allQuizzes  = module.quizzes  || [];
  const allLabs     = module.labs     || [];

  // Fetch all item JSONs in parallel (need nextItem chain + headings)
  const [readingDatas, quizDatas, labDatas] = await Promise.all([
    Promise.all(allReadings.map(r => fetchJSON(r.dataPath).catch(() => null))),
    Promise.all(allQuizzes.map(q => fetchJSON(q.dataPath).catch(() => null))),
    Promise.all(allLabs.map(l    => fetchJSON(l.dataPath).catch(() => null))),
  ]);

  const readingMap = {};
  allReadings.forEach((r, i) => { readingMap[r.id] = { meta: r, data: readingDatas[i] }; });
  const quizMap = {};
  allQuizzes.forEach((q, i)  => { quizMap[q.id]   = { meta: q, data: quizDatas[i] }; });
  const labMap = {};
  allLabs.forEach((l, i)     => { labMap[l.id]    = { meta: l, data: labDatas[i] }; });

  // Walk nextItem chain from first reading to build ordered sequence
  const sequence = [];
  const seen = new Set();
  let cur = allReadings[0] ? { type: 'reading', id: allReadings[0].id } : null;

  while (cur) {
    const key = `${cur.type}:${cur.id}`;
    if (seen.has(key)) break;
    seen.add(key);

    let entry;
    if      (cur.type === 'reading' && readingMap[cur.id]) entry = { type: 'reading', ...readingMap[cur.id] };
    else if (cur.type === 'quiz'    && quizMap[cur.id])    entry = { type: 'quiz',    ...quizMap[cur.id] };
    else if (cur.type === 'lab'     && labMap[cur.id])     entry = { type: 'lab',     ...labMap[cur.id] };
    else break;

    sequence.push(entry);
    cur = entry.data?.nextItem || null;
  }

  // Sequential gating: accessible until the first incomplete item, then locked
  const storageKey = id;
  let canAccess = true;
  const accessibility = sequence.map(item => {
    const accessible = devUnlock || canAccess;
    if (!devUnlock && canAccess) {
      const done = item.type === 'reading' ? isReadingRead(storageKey, item.meta.id)
                 : item.type === 'quiz'    ? isQuizPassed(storageKey, item.meta.id)
                 :                          isLabVisited(storageKey, item.meta.id);
      if (!done) canAccess = false;
    }
    return accessible;
  });

  setBreadcrumb([
    { label: 'Catalog', href: '/' },
    { label: module.title, href: `/${seg}/${id}` },
    { label: 'Syllabus' },
  ]);

  const accent = module.color || '#2a5757';
  const base   = `/${seg}/${id}`;

  const sectionsHTML = sequence.map((item, idx) => {
    const accessible = accessibility[idx];

    if (item.type === 'reading') {
      const headings  = extractMarkdownHeadings(item.data?.content || '');
      const done      = isReadingRead(storageKey, item.meta.id);
      const doneCheck = done ? '<span class="outline-done-check">✓</span>' : '';
      const lockBadge = accessible ? '' : `<span class="outline-lock-badge">${SYLLABUS_ICONS.lock} Locked</span>`;

      const headingRows = headings.map(h => {
        const slug    = headingSlug(h.text);
        const indent  = h.level === 3 ? ' outline-topic-h3' : '';
        const label   = renderInlineMath(h.text);
        if (!accessible) {
          return `<li class="outline-item outline-item-locked${indent}">
            <span class="outline-item-icon outline-icon-reading">${SYLLABUS_ICONS.reading}</span>
            <span class="outline-item-link outline-item-disabled">${label}</span>
          </li>`;
        }
        return `<li class="outline-item${indent}" data-reading="${_escHtml(item.meta.id)}" data-slug="${_escHtml(slug)}">
          <span class="outline-item-icon outline-icon-reading">${SYLLABUS_ICONS.reading}</span>
          <a class="outline-item-link" href="${base}/reading/${item.meta.id}">${label}</a>
        </li>`;
      }).join('');

      return `
        <details class="outline-module${accessible ? '' : ' outline-module-locked'}" open>
          <summary class="outline-summary">
            <span class="outline-accent-dot" style="background:${accent}${accessible ? '' : ';opacity:0.35'}"></span>
            <span class="outline-summary-title">${_escHtml(item.meta.title)}</span>
            ${lockBadge}${doneCheck}
            <span class="outline-summary-meta">${item.meta.estimatedMinutes ? item.meta.estimatedMinutes + ' min' : ''}</span>
            <span class="outline-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </summary>
          <div class="outline-body">
            ${!accessible ? '<p class="outline-locked-note">Complete the previous items to unlock this section.</p>' : ''}
            ${headingRows ? `<ul class="outline-items">${headingRows}</ul>` : ''}
          </div>
        </details>`;
    }

    if (item.type === 'quiz') {
      const passed     = isQuizPassed(storageKey, item.meta.id);
      const doneCheck  = passed ? '<span class="outline-done-check">✓</span>' : '';
      const lockBadge  = accessible ? '' : `<span class="outline-lock-badge">${SYLLABUS_ICONS.lock} Locked</span>`;
      const titleEl    = accessible
        ? `<a class="outline-item-link" href="${base}/quiz/${item.meta.id}">${_escHtml(item.meta.title)}</a>`
        : `<span class="outline-item-link outline-item-disabled">${_escHtml(item.meta.title)}</span>`;
      return `
        <div class="outline-item outline-item-flat${accessible ? '' : ' outline-item-locked'}">
          <span class="outline-item-icon outline-icon-quiz">${SYLLABUS_ICONS.quiz}</span>
          ${titleEl}${doneCheck}${lockBadge}
          <span class="outline-item-meta">${item.meta.questionCount ? `${item.meta.questionCount} questions` : ''}</span>
        </div>`;
    }

    if (item.type === 'lab') {
      const visited    = isLabVisited(storageKey, item.meta.id);
      const doneCheck  = visited ? '<span class="outline-done-check">✓</span>' : '';
      const lockBadge  = accessible ? '' : `<span class="outline-lock-badge">${SYLLABUS_ICONS.lock} Locked</span>`;
      const objRows    = (item.data?.objectives || []).map(obj => `
        <li class="outline-item outline-topic-h3">
          <span class="outline-item-icon outline-icon-lab">${SYLLABUS_ICONS.lab}</span>
          <span class="outline-item-link outline-item-obj">${renderInlineMath(obj)}</span>
        </li>`).join('');
      const colabBtn   = accessible && item.data?.colabUrl
        ? `<div class="outline-lab-open"><a class="btn-outline-ctrl" href="${item.data.colabUrl}" target="_blank" rel="noopener">Open in Colab ↗</a></div>`
        : '';
      return `
        <details class="outline-module${accessible ? '' : ' outline-module-locked'}">
          <summary class="outline-summary">
            <span class="outline-accent-dot" style="background:${accent}${accessible ? '' : ';opacity:0.35'}"></span>
            <span class="outline-summary-title">${_escHtml(item.meta.title)}</span>
            ${lockBadge}${doneCheck}
            <span class="outline-summary-meta">${item.meta.estimatedMinutes ? item.meta.estimatedMinutes + ' min' : ''} · Lab</span>
            <span class="outline-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </summary>
          <div class="outline-body">
            ${!accessible ? '<p class="outline-locked-note">Complete the previous items to unlock this lab.</p>' : ''}
            ${colabBtn}
            ${objRows ? `<ul class="outline-items">${objRows}</ul>` : ''}
          </div>
        </details>`;
    }

    return '';
  }).join('');

  // Drill decks section for syllabus
  const allDrills = module.drills || [];
  const drillsOutlineHTML = allDrills.length ? `
    <div class="outline-practice-section">
      <div class="outline-practice-label">Practice Decks</div>
      ${allDrills.map(d => {
        const progress  = getDrillProgress(id, d.id);
        const known     = Object.values(progress).filter(b => b === 2).length;
        const total     = d.cardCount || 0;
        const started   = Object.keys(progress).length > 0;
        const pct       = total ? Math.round((known / total) * 100) : 0;
        const statusTxt = !started ? `${total} cards` : `${known}/${total} known`;
        return `
          <div class="outline-drill-row" data-nav="${base}/drill/${d.id}" role="button" tabindex="0">
            <span class="outline-item-icon outline-icon-drill">${SYLLABUS_ICONS.drill}</span>
            <span class="outline-drill-title">${_escHtml(d.title)}</span>
            <span class="outline-drill-meta">${statusTxt} · ${d.estimatedMinutes} min</span>
            ${started ? `<div class="outline-drill-bar"><div class="outline-drill-fill" style="width:${pct}%"></div></div>` : ''}
            ${started && known === total ? '<span class="outline-done-check">✓</span>' : ''}
          </div>`;
      }).join('')}
    </div>` : '';

  root.innerHTML = `
    <div class="outline-page">
      <div class="outline-header">
        <button class="course-ov-back" data-nav="${base}">← ${_escHtml(module.title)}</button>
        <div class="outline-header-title">
          <h1 class="course-ov-title" style="margin:12px 0 4px">Syllabus</h1>
          ${devUnlock ? '<span class="admin-badge">ADMIN</span>' : ''}
        </div>
        <p class="outline-header-sub">${devUnlock
          ? 'Admin mode — progress gating disabled. All content is directly accessible.'
          : 'Click any topic to jump directly to that section. Topics in locked readings become available as you progress.'
        }</p>
        <div class="outline-controls">
          <button class="btn-outline-ctrl" id="outline-expand-all">Expand all</button>
          <button class="btn-outline-ctrl" id="outline-collapse-all">Collapse all</button>
        </div>
      </div>
      <div class="outline-modules">${sectionsHTML}</div>
      ${drillsOutlineHTML}
    </div>`;

  root.querySelectorAll('[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );

  // Topic click: store scroll target then navigate to the reading
  root.querySelectorAll('.outline-item[data-reading]').forEach(li => {
    li.querySelector('a.outline-item-link')?.addEventListener('click', e => {
      e.preventDefault();
      const slug = li.dataset.slug;
      if (slug) sessionStorage.setItem('upskilled:scrollTo', slug);
      navigate(`${base}/reading/${li.dataset.reading}`);
    });
  });

  root.querySelector('#outline-expand-all')?.addEventListener('click', () => {
    root.querySelectorAll('.outline-module').forEach(el => el.open = true);
  });
  root.querySelector('#outline-collapse-all')?.addEventListener('click', () => {
    root.querySelectorAll('.outline-module').forEach(el => el.open = false);
  });

  setSearchContext('none');
}

// ── Register routes ──────────────────────────────────────────
addRoute('/', renderCatalog);
addRoute('/prereq/:id', renderCourseOverview);
addRoute('/prereq/:id/syllabus', renderPrereqSyllabus);
addRoute('/prereq/:id/reading/:rid', renderReading);
addRoute('/prereq/:id/quiz/:qid', renderQuiz);
addRoute('/prereq/:id/lab/:lid', renderLab);
addRoute('/prereq/:id/drill/:did', renderDrill);
addRoute('/supplement/:id', renderCourseOverview);
addRoute('/supplement/:id/syllabus', renderPrereqSyllabus);
addRoute('/supplement/:id/reading/:rid', renderReading);
addRoute('/supplement/:id/quiz/:qid', renderQuiz);
addRoute('/supplement/:id/lab/:lid', renderLab);
addRoute('/supplement/:id/drill/:did', renderDrill);
addRoute('/:id', renderCourseHome);
addRoute('/:id/syllabus', renderSyllabus);
addRoute('/:id/:mid', renderModuleOverview);
addRoute('/:id/:mid/reading/:rid', renderReading);
addRoute('/:id/:mid/quiz/:qid', renderQuiz);
addRoute('/:id/:mid/lab/:lid', renderLab);
