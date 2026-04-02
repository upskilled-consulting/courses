'use strict';
const { BASE, escHtml, navItemUrl, href, relPrefix, BACK_SVG } = require('./utils');
const { renderMarkdown, renderInlineMath } = require('./render-markdown');

// ── Shell page (wraps every generated HTML file) ───────────────
// bodyContent: pre-rendered HTML for #appRoot, or null for quiz/drill shells
function shellPage({ title, description = '', bodyContent = null, relPath = 'index.html' }) {
  const rootAttrs = bodyContent !== null ? ' data-ssg="1"' : '';
  const p = relPrefix(relPath); // relative path prefix for local assets
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(title)}</title>
  <link rel="icon" href="data:,"/>
  <meta name="description" content="${escHtml(description)}"/>
  <!-- KaTeX -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous"/>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
  <!-- marked.js -->
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
  <!-- highlight.js -->
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <link rel="stylesheet" href="${p}assets/css/platform.css"/>
  <link rel="stylesheet" href="${p}assets/css/consent.css"/>
  <!-- Three.js -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <script type="module">
    import { initDensificationAnimation } from '${p}assets/js/densification-anim.js';
    import { initSHVisualizer }           from '${p}assets/js/sh-visualizer.js';
    import { initGaussElimAnimation }     from '${p}assets/js/gauss-elim-anim.js';
    import { initSolutionSetAnimation }   from '${p}assets/js/solution-set-anim.js';
    import { initParametricAnimation }    from '${p}assets/js/parametric-anim.js';
    import { initSubspaceAnimation }      from '${p}assets/js/subspace-anim.js';
    import { initSpanGaussAnimation }     from '${p}assets/js/span-gauss-anim.js';
    import { initLITestAnimation }        from '${p}assets/js/li-test-anim.js';
    import { initRankNullityAnimation }   from '${p}assets/js/rank-nullity-anim.js';
    window.initDensificationAnimation = initDensificationAnimation;
    window.initSHVisualizer           = initSHVisualizer;
    window.initGaussElimAnimation     = initGaussElimAnimation;
    window.initSolutionSetAnimation   = initSolutionSetAnimation;
    window.initParametricAnimation    = initParametricAnimation;
    window.initSubspaceAnimation      = initSubspaceAnimation;
    window.initSpanGaussAnimation     = initSpanGaussAnimation;
    window.initLITestAnimation        = initLITestAnimation;
    window.initRankNullityAnimation   = initRankNullityAnimation;
  </script>
</head>
<body data-theme="dark">

  <nav class="platform-nav" id="platformNav">
    <div class="nav-inner">
      <a href="${BASE}/" class="nav-brand" id="navBrand">
        <img src="${p}assets/images/logo.png" alt="Upskilled" class="brand-logo"/>
      </a>
      <div class="nav-breadcrumb" id="navBreadcrumb"></div>
      <div class="nav-search" id="navSearch">
        <button class="search-pill" id="searchPill" aria-label="Search (Ctrl+K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="search-pill-hint">Search\u2026</span>
          <span class="search-pill-kbd">\u2318K</span>
        </button>
      </div>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" title="Toggle light/dark theme">
          <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <main id="appRoot"${rootAttrs}>${bodyContent !== null ? bodyContent : ''}</main>

  <footer class="platform-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="https://upskilled.consulting" class="footer-logo-link" target="_blank" rel="noopener" aria-label="Upskilled Consulting">
          UPSKILLED CONSULTING
        </a>
        <p class="footer-tagline">Free ML &amp; AI courses for practitioners.</p>
        <nav class="footer-nav" aria-label="Course navigation">
          <a href="${BASE}/prereq/linear-algebra/" class="footer-nav-link" data-path="/prereq/linear-algebra">Linear Algebra</a>
          <a href="${BASE}/prereq/matrix-algebra/" class="footer-nav-link" data-path="/prereq/matrix-algebra">Matrix Algebra</a>
          <a href="${BASE}/prereq/calculus-foundations/" class="footer-nav-link" data-path="/prereq/calculus-foundations">Calculus</a>
          <a href="${BASE}/prereq/probability-foundations/" class="footer-nav-link" data-path="/prereq/probability-foundations">Probability</a>
          <a href="${BASE}/supplement/architectures/" class="footer-nav-link" data-path="/supplement/architectures">Neural Network Architectures</a>
          <a href="${BASE}/supplement/activation-functions/" class="footer-nav-link" data-path="/supplement/activation-functions">Activation Functions</a>
          <a href="${BASE}/supplement/loss-functions/" class="footer-nav-link" data-path="/supplement/loss-functions">Loss Functions</a>
          <a href="${BASE}/supplement/optimizers/" class="footer-nav-link" data-path="/supplement/optimizers">Optimizers</a>
          <a href="${BASE}/supplement/regularization/" class="footer-nav-link" data-path="/supplement/regularization">Regularization</a>
          <a href="${BASE}/supplement/normalization/" class="footer-nav-link" data-path="/supplement/normalization">Normalization</a>
          <a href="${BASE}/3dgs-compression/" class="footer-nav-link" data-path="/3dgs-compression">3D Gaussian Splatting</a>
          <a href="${BASE}/deep-rl/" class="footer-nav-link footer-nav-course" data-path="/deep-rl">Deep Reinforcement Learning</a>
        </nav>
      </div>
      <div class="footer-contact">
        <p class="footer-contact-heading">Stay in Touch</p>
        <p class="footer-contact-sub">New courses, research updates, and case studies \u2014 straight to your inbox.</p>
        <div id="footer-form-message"></div>
        <form id="footer-contact-form" class="footer-form" novalidate>
          <div class="footer-form-row">
            <input type="text"  id="footer-name"  name="name"  placeholder="Name"  autocomplete="name"/>
            <input type="email" id="footer-email" name="email" placeholder="Email" autocomplete="email" required/>
            <button type="submit" id="footer-submit-btn" class="footer-submit-btn">Send</button>
          </div>
          <textarea id="footer-feedback" name="feedback" class="footer-feedback" placeholder="Feedback (optional)" rows="3"></textarea>
        </form>
      </div>
    </div>
  </footer>

  <script src="${p}assets/js/platform.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js"></script>
  <script src="${p}assets/js/footer.js"></script>

  <div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Search">
    <div class="search-modal" id="searchModal">
      <div class="search-modal-head">
        <div class="search-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="searchField" class="search-field" placeholder="Search\u2026" autocomplete="off" spellcheck="false" aria-label="Search"/>
          <button class="search-esc-btn" id="searchEscBtn" aria-label="Close search">ESC</button>
        </div>
        <div class="search-scope-bar">
          <span class="search-scope-label" id="searchScopeLabel">All content</span>
        </div>
      </div>
      <div class="search-results-list" id="searchResultsList">
        <div class="search-hint-state">Type to search\u2026</div>
      </div>
    </div>
  </div>

  <button class="notation-fab" id="notationFab" aria-label="Notation reference" title="Notation reference" style="display:none">
    <span aria-hidden="true">?</span>
  </button>

  <div class="notation-overlay" id="notationOverlay" role="dialog" aria-modal="true" aria-label="Notation Reference">
    <div class="notation-modal">
      <div class="notation-modal-head">
        <span class="notation-modal-title">Notation Reference</span>
        <input type="text" id="notationSearchField" class="notation-search" placeholder="Filter symbols\u2026" autocomplete="off" spellcheck="false"/>
        <button class="notation-close-btn" id="notationCloseBtn" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="notation-list" id="notationList"></div>
    </div>
  </div>

  <div class="para-overlay" id="paraOverlay">
    <div class="para-popup" id="paraPopup" role="dialog" aria-modal="true">
      <div class="para-popup-header">
        <span class="para-popup-src" id="paraPopupSrc"></span>
        <button class="para-popup-close" id="paraPopupClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="para-popup-text" id="paraPopupText"></div>
    </div>
  </div>

  <div id="consent-banner" hidden>
    <p class="consent-text">
      We use Google Analytics to understand how people use this site, and browser storage to save course progress. No accounts, no ads, no other data collection. Please see our <button class="consent-privacy-btn">Privacy Policy</button> for additional information.
    </p>
    <div class="consent-actions">
      <button id="consent-accept" class="consent-btn">Accept</button>
      <button id="consent-decline" class="consent-btn">Decline</button>
    </div>
  </div>

  <div id="privacy-modal" hidden>
    <div id="privacy-modal-overlay">
      <div class="privacy-modal-box">
        <button class="privacy-modal-close" id="privacy-modal-close" aria-label="Close">&times;</button>
        <h2>Privacy Policy</h2>
        <p class="privacy-updated">Last updated: March 2026</p>
        <h3>What we collect</h3>
        <ul>
          <li><strong>Analytics</strong> \u2014 if you consent, we use Google Analytics (GA4) to collect anonymized data about page views, session duration, and general geographic region. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a> for details.</li>
          <li><strong>Progress data</strong> \u2014 quiz and lab progress is stored locally in your browser via localStorage. This data never leaves your device and is never transmitted to any server.</li>
        </ul>
        <h3>What we don't collect</h3>
        <ul>
          <li>No names, emails, or account information from course visitors.</li>
          <li>No advertising or sale of data to third parties.</li>
          <li>No tracking beyond Google Analytics.</li>
        </ul>
        <h3>Your choices</h3>
        <p>You can decline or withdraw analytics consent at any time by clicking Decline in the banner. You can clear your progress data by clearing localStorage for this site in your browser settings.</p>
        <h3>Contact</h3>
        <p><a href="mailto:get@upskilled.consulting">get@upskilled.consulting</a></p>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
  <script src="${p}assets/js/consent.js"></script>
</body>
</html>`;
}

// ── Catalog ─────────────────────────────────────────────────────
function catalogBody(platform) {
  const sectionsHTML = platform.sections.map(section => {
    const isCompact = section.id === 'prerequisites' || section.id === 'supplements';
    const cardsHTML = section.courses.map(course => courseCard(course)).join('');
    return `
      <div class="catalog-section">
        <div class="section-header">
          <h2>${escHtml(section.title)}</h2>
          <p>${escHtml(section.description)}</p>
        </div>
        <div class="course-grid${isCompact ? '' : ' featured-grid'}">
          ${cardsHTML}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="catalog-hero">
      <div class="catalog-hero-inner">
        <h1><span class="hero-accent">Upskilled Consulting</span><span class="hero-suffix">&nbsp;&amp;&nbsp;Training</span></h1>
        <p>${escHtml(platform.tagline)}</p>
      </div>
    </div>
    <div class="catalog-body">${sectionsHTML}</div>`;
}

function courseCard(course) {
  const isPrereq     = course.type === 'prereq';
  const isSupplement = course.type === 'supplement';
  const isCourse     = course.type === 'course';
  const typeLabel    = isPrereq ? 'Prerequisite' : isSupplement ? 'Supplement' : 'Course';
  const tagsHTML     = (course.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');
  const seg          = isPrereq ? 'prereq' : isSupplement ? 'supplement' : '';
  const spaPath      = isCourse ? `/${course.id}` : `/${seg}/${course.id}`;
  return `
    <a class="course-card" href="${href(spaPath)}/" data-nav="${spaPath}" role="button" tabindex="0">
      <div class="course-card-stripe" style="background:${escHtml(course.color)}"></div>
      <div class="course-card-body">
        <div class="course-card-type">${escHtml(typeLabel)}</div>
        <div class="course-card-title">${escHtml(course.title)}</div>
        <div class="course-card-desc">${escHtml(course.description)}</div>
        <div class="course-card-tags">${tagsHTML}</div>
      </div>
    </a>`;
}

// ── Prereq / Supplement overview ────────────────────────────────
function prereqOverviewBody(module, courseRef) {
  const seg         = courseRef.type === 'supplement' ? 'supplement' : 'prereq';
  const kickerLabel = seg === 'supplement' ? 'Supplement' : 'Prerequisite Course';
  const levelClass  = 'level-' + (module.level || '').toLowerCase().replace(/\s+/g, '-');
  const base        = `/${seg}/${courseRef.id}`;

  const labCount   = (module.labs   || []).length;
  const drillCount = (module.drills || []).length;

  const readingsHTML = (module.readings || []).map((r, i) => `
    <a class="reading-row" href="${href(base)}/reading/${r.id}/" data-nav="${base}/reading/${r.id}" role="button" tabindex="0">
      <div class="reading-row-num">${i + 1}</div>
      <div class="reading-row-info">
        <div class="reading-row-title">${escHtml(r.title)}</div>
        <div class="reading-row-desc">${escHtml(r.description || '')}</div>
      </div>
      <div class="reading-row-time">${r.estimatedMinutes} min</div>
    </a>`).join('');

  const quizzesHTML = (module.quizzes || []).map(q => `
    <a class="quiz-row" href="${href(base)}/quiz/${q.id}/" data-nav="${base}/quiz/${q.id}" role="button" tabindex="0">
      <div class="quiz-row-icon">Q</div>
      <div class="quiz-row-info">
        <div class="quiz-row-title">${escHtml(q.title)}</div>
        <div class="quiz-row-desc">${q.questionCount ? `${q.questionCount} questions · ` : ''}${Math.round((q.passingScore || 0.7) * 100)}% to pass</div>
      </div>
    </a>`).join('');

  const labsHTML = (module.labs || []).map(l => `
    <a class="lab-row" href="${href(base)}/lab/${l.id}/" data-nav="${base}/lab/${l.id}" role="button" tabindex="0">
      <div class="lab-row-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </div>
      <div class="lab-row-info">
        <div class="lab-row-title">${escHtml(l.title)}</div>
        <div class="lab-row-desc">${escHtml(l.description || '')}</div>
      </div>
      <div class="lab-row-time">${l.estimatedMinutes} min</div>
    </a>`).join('');

  const drillsHTML = (module.drills || []).map(d => `
    <a class="drill-row" href="${href(base)}/drill/${d.id}/" data-nav="${base}/drill/${d.id}" role="button" tabindex="0">
      <div class="drill-row-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div class="drill-row-info">
        <div class="drill-row-title">${escHtml(d.title)}</div>
        <div class="drill-row-meta">${d.cardCount} cards · ${d.estimatedMinutes} min</div>
      </div>
    </a>`).join('');

  const quizSection  = quizzesHTML ? `<div class="reading-list-label">Quizzes</div><div class="reading-list">${quizzesHTML}</div>` : '';
  const labSection   = labsHTML    ? `<div class="reading-list-label">Labs</div><div class="reading-list">${labsHTML}</div>`       : '';
  const drillSection = drillsHTML  ? `<div class="reading-list-label">Practice</div><div class="reading-list">${drillsHTML}</div>` : '';

  return `
    <div class="course-overview">
      <div class="course-ov-header">
        <a class="course-ov-back" href="${href('/')}/" data-nav="/">${BACK_SVG}Catalog</a>
        <div class="course-ov-kicker">${escHtml(kickerLabel)}</div>
        <h1 class="course-ov-title">${escHtml(module.title)}</h1>
        <p class="course-ov-desc">${escHtml(module.description)}</p>
        <div class="course-ov-meta">
          <span class="meta-pill ${levelClass}">${escHtml(module.level)}</span>
          <span class="meta-pill">${module.estimatedHours}h estimated</span>
          <span class="meta-pill">${(module.readings || []).length} readings</span>
          ${(module.quizzes || []).length ? `<span class="meta-pill">${module.quizzes.length} quiz${module.quizzes.length !== 1 ? 'zes' : ''}</span>` : ''}
          ${labCount   ? `<span class="meta-pill">${labCount} lab${labCount !== 1 ? 's' : ''}</span>`             : ''}
          ${drillCount ? `<span class="meta-pill">${drillCount} drill deck${drillCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="reading-list-label" style="display:flex;align-items:center;justify-content:space-between;">
        Readings
        <button class="btn-outline-ctrl" id="syllabus-btn">Syllabus</button>
      </div>
      <div class="reading-list">${readingsHTML}</div>
      ${quizSection}${labSection}${drillSection}
    </div>`;
}

// ── Course home (multi-module) ───────────────────────────────────
function courseHomeBody(courseManifest, courseRef) {
  const levelClass = 'level-' + (courseRef.level || '').toLowerCase().replace(/\s+/g, '-');
  const tagsHTML   = (courseRef.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('');

  const modulesHTML = courseManifest.modules.map((modEntry, i) => `
    <a class="reading-row module-row" href="${href('/' + courseRef.id + '/' + modEntry.id)}/" data-nav="/${courseRef.id}/${modEntry.id}" role="button" tabindex="0">
      <div class="module-row-stripe" style="background:${escHtml(modEntry.color || '#888')}"></div>
      <div class="reading-row-num">${i + 1}</div>
      <div class="reading-row-info">
        <div class="reading-row-title">${escHtml(modEntry.title)}</div>
        <div class="reading-row-desc">${escHtml(modEntry.description || '')}</div>
      </div>
      <div class="module-row-right"></div>
    </a>`).join('');

  return `
    <div class="course-overview">
      <div class="course-ov-header">
        <a class="course-ov-back" href="${href('/')}/" data-nav="/">${BACK_SVG}Catalog</a>
        <div class="course-ov-kicker">Course</div>
        <h1 class="course-ov-title">${escHtml(courseManifest.title)}</h1>
        <p class="course-ov-desc">${escHtml(courseManifest.subtitle || '')}</p>
        <div class="course-ov-meta">
          <span class="meta-pill ${levelClass}">${escHtml(courseRef.level || 'Advanced')}</span>
          <span class="meta-pill">${courseRef.estimatedHours}h estimated</span>
          <span class="meta-pill">${courseManifest.modules.length} modules</span>
        </div>
        ${tagsHTML ? `<div class="course-card-tags" style="margin-top:12px">${tagsHTML}</div>` : ''}
      </div>
      <div class="reading-list-label" style="display:flex;align-items:center;justify-content:space-between;">
        Modules
        <a class="btn-outline-ctrl" href="${href('/' + courseRef.id + '/syllabus')}/" data-nav="/${courseRef.id}/syllabus">Syllabus</a>
      </div>
      <div class="reading-list">${modulesHTML}</div>
    </div>`;
}

// ── Module overview ──────────────────────────────────────────────
function moduleOverviewBody(courseManifest, courseRef, modEntry, module) {
  const base = `/${courseRef.id}/${modEntry.id}`;
  const labs = module.labs || (module.lab ? [module.lab] : []);

  const readingsHTML = (module.readings || []).map((r, i) => `
    <a class="reading-row" href="${href(base)}/reading/${r.id}/" data-nav="${base}/reading/${r.id}" role="button" tabindex="0">
      <div class="reading-row-num">${i + 1}</div>
      <div class="reading-row-info">
        <div class="reading-row-title">${escHtml(r.title)}</div>
        <div class="reading-row-desc">${escHtml(r.description || '')}</div>
      </div>
      <div class="reading-row-time">${r.estimatedMinutes} min</div>
    </a>`).join('');

  const quizzesHTML = (module.quizzes || []).map(q => `
    <a class="quiz-row" href="${href(base)}/quiz/${q.id}/" data-nav="${base}/quiz/${q.id}" role="button" tabindex="0">
      <div class="quiz-row-icon">Q</div>
      <div class="quiz-row-info">
        <div class="quiz-row-title">${escHtml(q.title)}</div>
        <div class="quiz-row-desc">${q.questionCount ? `${q.questionCount} questions · ` : ''}${Math.round((q.passingScore || 0.7) * 100)}% to pass</div>
      </div>
    </a>`).join('');

  const labsHTML = labs.map(l => `
    <a class="lab-row" href="${href(base)}/lab/${l.id}/" data-nav="${base}/lab/${l.id}" role="button" tabindex="0">
      <div class="lab-row-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </div>
      <div class="lab-row-info">
        <div class="lab-row-title">${escHtml(l.title)}</div>
        <div class="lab-row-desc">${escHtml(l.description || '')}</div>
      </div>
      <div class="lab-row-time">${l.estimatedMinutes} min</div>
    </a>`).join('');

  const quizSection = quizzesHTML ? `<div class="reading-list-label">Quizzes</div><div class="reading-list">${quizzesHTML}</div>` : '';
  const labSection  = labsHTML    ? `<div class="reading-list-label">Labs</div><div class="reading-list">${labsHTML}</div>`       : '';

  return `
    <div class="course-overview">
      <div class="course-ov-header">
        <a class="course-ov-back" href="${href('/' + courseRef.id)}/" data-nav="/${courseRef.id}">${BACK_SVG}${escHtml(courseManifest.title)}</a>
        <div class="course-ov-kicker">Module ${modEntry.order}</div>
        <h1 class="course-ov-title">${escHtml(modEntry.title)}</h1>
        <p class="course-ov-desc">${escHtml(modEntry.description || '')}</p>
        <div class="course-ov-meta">
          <span class="meta-pill">${(module.readings || []).length} readings</span>
          ${(module.quizzes || []).length ? `<span class="meta-pill">${module.quizzes.length} quiz${module.quizzes.length !== 1 ? 'zes' : ''}</span>` : ''}
          ${labs.length ? `<span class="meta-pill">${labs.length} lab${labs.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="reading-list-label">Readings</div>
      <div class="reading-list">${readingsHTML}</div>
      ${quizSection}${labSection}
    </div>`;
}

// ── Reading page ─────────────────────────────────────────────────
function readingBody(reading, module, courseRef, modEntry) {
  const seg      = courseRef.type === 'supplement' ? 'supplement' : courseRef.type === 'course' ? 'course' : 'prereq';
  const isCourse = seg === 'course';
  const overviewUrl = isCourse ? `/${courseRef.id}/${modEntry.id}` : `/${seg}/${courseRef.id}`;
  const modTitle    = isCourse ? modEntry.title : module.title;
  const kickerLabel = isCourse ? courseManifest_title(courseRef) : seg === 'supplement' ? 'Supplement' : 'Prerequisite';

  function readingUrl(r) {
    return isCourse
      ? `/${courseRef.id}/${modEntry.id}/reading/${r.id}`
      : `/${seg}/${courseRef.id}/reading/${r.id}`;
  }

  const sidebarItems = (module.readings || []).map((r, i) => {
    const active = r.id === reading.id ? ' active' : '';
    return `<a class="sidebar-reading-item${active}" href="${href(readingUrl(r))}/" data-nav="${readingUrl(r)}">
      <span class="sidebar-item-num">${i + 1}</span>
      <span>${escHtml(r.title)}</span>
    </a>`;
  }).join('');

  const losHTML = (reading.learningObjectives || []).length ? `
    <div class="reading-los">
      <div class="reading-los-label">By the end of this reading you will be able to:</div>
      <ul class="reading-los-list">
        ${reading.learningObjectives.map(lo => {
          const rest = lo.description.startsWith(lo.verb + ' ')
            ? lo.description.slice(lo.verb.length + 1)
            : lo.description;
          return `<li><strong>${escHtml(lo.verb)}</strong> ${escHtml(rest)}</li>`;
        }).join('')}
      </ul>
    </div>` : '';

  const refsHTML = (reading.references || []).length ? `
    <div class="references-section">
      <div class="references-label">References</div>
      ${reading.references.map(r => `
        <div class="reference-item">
          ${r.url ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener">${escHtml(r.label)} \u2014 ${escHtml(r.title)}</a>` : `${escHtml(r.label)} \u2014 ${escHtml(r.title)}`}
        </div>`).join('')}
    </div>` : '';

  const prevUrl  = navItemUrl(courseRef.id, reading.prevItem, seg, modEntry?.id);
  const nextUrl  = navItemUrl(courseRef.id, reading.nextItem, seg, modEntry?.id);
  const nextItem = reading.nextItem;
  const nextLabel = nextItem
    ? (nextItem.type === 'quiz' ? 'Take Quiz \u2192' : nextItem.type === 'lab' ? 'Start Lab \u2192' : 'Next \u2192')
    : `${BACK_SVG}Overview`;

  const audioHTML = reading.audio ? `
    <div class="audio-widget" id="audioWidget" data-audio-src="${BASE}/${reading.audio}">
      <button class="audio-play-btn" aria-label="Play">
        <svg class="audio-icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>
        <svg class="audio-icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      </button>
      <div class="audio-mid">
        <div class="audio-progress-track" role="slider" aria-label="Seek" tabindex="0">
          <div class="audio-progress-fill"></div>
          <div class="audio-progress-thumb"></div>
        </div>
        <div class="audio-time-row">
          <span class="audio-current">0:00</span>
          <span class="audio-duration">\u2014</span>
        </div>
      </div>
      <button class="audio-speed-btn" aria-label="Playback speed">1\u00d7</button>
      <a class="audio-download-btn" href="${BASE}/${reading.audio}" download aria-label="Download audio">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
        </svg>
      </a>
    </div>
    <div class="audio-attribution">
      <span>Audio overview generated with</span>
      <img src="${BASE}/assets/images/NotebookLM-logo.png" alt="NotebookLM" class="audio-attribution-logo">
    </div>` : '';

  return `
    <div class="reading-layout">
      <aside class="reading-sidebar">
        <a class="sidebar-course-link" href="${href(overviewUrl)}/" data-nav="${overviewUrl}">${BACK_SVG}${escHtml(modTitle)}</a>
        <div class="sidebar-nav-label">Readings</div>
        ${sidebarItems}
      </aside>
      <div class="reading-main">
        <div class="reading-kicker">${escHtml(kickerLabel)} \u00b7 ${escHtml(modTitle)}</div>
        <div class="reading-title-row">
          <h1 class="reading-title">${escHtml(reading.title)}</h1>
          <button class="reading-copy-btn" id="readingCopyBtn" title="Copy as Markdown" aria-label="Copy page as Markdown">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span class="reading-copy-label">Copy MD</span>
          </button>
        </div>
        <div class="reading-meta-row">
          <span>${reading.estimatedMinutes} min read</span>
        </div>
        ${audioHTML}
        ${losHTML}
        <div class="reading-content" id="readingContent">
          ${renderMarkdown(reading.content)}
        </div>
        ${refsHTML}
        <div class="reading-nav-row">
          <a class="reading-nav-btn prev" href="${href(prevUrl)}/" data-nav="${prevUrl}">${BACK_SVG}${reading.prevItem ? 'Previous' : 'Overview'}</a>
          <a class="reading-nav-btn next" href="${href(nextUrl)}/" data-nav="${nextUrl}">${nextLabel}</a>
        </div>
      </div>
    </div>`;
}

// Placeholder needed by readingBody for isCourse kicker — filled by caller
function courseManifest_title(courseRef) {
  // Caller stores title in courseRef._title during generation
  return courseRef._title || courseRef.title || courseRef.id;
}

// ── Lab page ─────────────────────────────────────────────────────
function labBody(lab, module, courseRef, modEntry) {
  const seg      = courseRef.type === 'supplement' ? 'supplement' : courseRef.type === 'course' ? 'course' : 'prereq';
  const isCourse = seg === 'course';
  const overviewUrl = isCourse ? `/${courseRef.id}/${modEntry.id}` : `/${seg}/${courseRef.id}`;
  const modTitle    = isCourse ? modEntry.title : module.title;
  const kickerLabel = isCourse ? courseManifest_title(courseRef) : seg === 'supplement' ? 'Supplement' : 'Prerequisite';

  function readingUrl(r) { return isCourse ? `/${courseRef.id}/${modEntry.id}/reading/${r.id}` : `/${seg}/${courseRef.id}/reading/${r.id}`; }
  function quizUrl(q)    { return isCourse ? `/${courseRef.id}/${modEntry.id}/quiz/${q.id}`    : `/${seg}/${courseRef.id}/quiz/${q.id}`; }
  function labUrlFn(l)   { return isCourse ? `/${courseRef.id}/${modEntry.id}/lab/${l.id}`     : `/${seg}/${courseRef.id}/lab/${l.id}`; }

  const labsArr = module.labs || (module.lab ? [module.lab] : []);

  const sidebarReadings = (module.readings || []).map((r, i) => `
    <a class="sidebar-reading-item" href="${href(readingUrl(r))}/" data-nav="${readingUrl(r)}">
      <span class="sidebar-item-num">${i + 1}</span>
      <span>${escHtml(r.title)}</span>
    </a>`).join('');

  const sidebarQuizzes = (module.quizzes || []).map(q => `
    <a class="sidebar-quiz-item" href="${href(quizUrl(q))}/" data-nav="${quizUrl(q)}">
      <span class="sidebar-quiz-icon">Q</span>
      <span>${escHtml(q.title)}</span>
    </a>`).join('');

  const sidebarLabs = labsArr.map(l => {
    const active = l.id === lab.id ? ' active' : '';
    return `<a class="sidebar-lab-item${active}" href="${href(labUrlFn(l))}/" data-nav="${labUrlFn(l)}">
      <span class="sidebar-lab-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </span>
      <span>${escHtml(l.title)}</span>
    </a>`;
  }).join('');

  const quizSection = sidebarQuizzes ? `<div class="sidebar-nav-label" style="margin-top:12px">Quizzes</div>${sidebarQuizzes}` : '';
  const labSection  = sidebarLabs    ? `<div class="sidebar-nav-label" style="margin-top:12px">Labs</div>${sidebarLabs}`       : '';

  const objectivesHTML = (lab.objectives || []).map((o, i) => `
    <div class="lab-objective-item">
      <div class="lab-objective-num">${i + 1}</div>
      <span>${renderInlineMath(o)}</span>
    </div>`).join('');

  const prevUrl = navItemUrl(courseRef.id, lab.prevItem, seg, modEntry?.id);
  const nextUrl = lab.nextItem ? navItemUrl(courseRef.id, lab.nextItem, seg, modEntry?.id) : null;

  return `
    <div class="reading-layout">
      <aside class="reading-sidebar">
        <a class="sidebar-course-link" href="${href(overviewUrl)}/" data-nav="${overviewUrl}">${BACK_SVG}${escHtml(modTitle)}</a>
        <div class="sidebar-nav-label">Readings</div>
        ${sidebarReadings}
        ${quizSection}
        ${labSection}
      </aside>
      <div class="reading-main">
        <div class="reading-kicker">${escHtml(kickerLabel)} \u00b7 ${escHtml(modTitle)}</div>
        <h1 class="reading-title">${escHtml(lab.title)}</h1>
        <div class="reading-meta-row">
          <span>${lab.colabUrl ? 'Colab Notebook' : 'Lab Exercises'}</span>
          <span class="reading-meta-sep">\u00b7</span>
          <span>~${lab.estimatedMinutes} min</span>
        </div>
        ${lab.colabUrl ? `
        <div class="lab-colab-card">
          <div class="lab-colab-info">
            <div class="lab-colab-kicker">Google Colab Notebook</div>
            <div class="lab-colab-title">${escHtml(lab.title)}</div>
            <div class="lab-colab-meta">Python \u00b7 ~${lab.estimatedMinutes} min</div>
          </div>
          <a class="lab-colab-btn" href="${escHtml(lab.colabUrl)}" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in Colab
          </a>
        </div>` : ''}
        ${objectivesHTML ? `
        <div class="lab-objectives">
          <div class="lab-objectives-label">Lab Objectives</div>
          ${objectivesHTML}
        </div>` : ''}
        <div class="reading-content" id="labDescription">
          ${renderMarkdown(lab.description || '')}
        </div>
        <div class="reading-nav-row">
          <a class="reading-nav-btn prev" href="${href(prevUrl)}/" data-nav="${prevUrl}">${BACK_SVG}Previous</a>
          ${nextUrl ? `<a class="reading-nav-btn next" href="${href(nextUrl)}/" data-nav="${nextUrl}">Next \u2192</a>` : ''}
        </div>
      </div>
    </div>`;
}

module.exports = { shellPage, catalogBody, prereqOverviewBody, courseHomeBody, moduleOverviewBody, readingBody, labBody };
