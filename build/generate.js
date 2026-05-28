'use strict';
const path = require('path');
const fs   = require('fs-extra');

const { DIST, SITE_URL, writeFile } = require('./utils');
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const {
  shellPage,
  catalogBody,
  prereqOverviewBody,
  courseHomeBody,
  moduleOverviewBody,
  readingBody,
  labBody,
} = require('./templates');

const ROOT = path.resolve(__dirname, '..');

function loadJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf-8'));
}

// Convenience: threads relPath into shellPage so asset paths are relative-correct
function writePage(relPath, opts) {
  writeFile(relPath, shellPage({ ...opts, relPath }));
}

// ── Sitemap accumulator ──────────────────────────────────────────
const sitemapUrls = [];

function trackUrl(relPath, priority = 0.8) {
  const p = relPath === 'index.html' ? '/' : '/' + relPath.replace(/index\.html$/, '');
  sitemapUrls.push({ url: `${SITE_URL}${BASE}${p}`, priority });
}

// ── JSON-LD schema builders ───────────────────────────────────────
const ORG = {
  '@type': 'Organization',
  name:    'Upskilled Consulting',
  url:     'https://upskilled.consulting',
  logo:    'https://upskilled.consulting/assets/images/logo.png',
};

function courseSchema({ name, description, url, level }) {
  return {
    '@context': 'https://schema.org',
    '@type':    'Course',
    name, description, url,
    provider:            ORG,
    isAccessibleForFree: true,
    inLanguage:          'en',
    ...(level ? { educationalLevel: level } : {}),
  };
}

function articleSchema({ name, description, url, courseTitle, courseUrl }) {
  return {
    '@context': 'https://schema.org',
    '@type':    'Article',
    name, description, url,
    isAccessibleForFree: true,
    inLanguage:          'en',
    publisher:           ORG,
    isPartOf: {
      '@type': 'Course',
      name:    courseTitle,
      url:     courseUrl,
      provider: ORG,
    },
  };
}

// ── SSG guard patch for platform.js ─────────────────────────────
function patchPlatformJs() {
  const src = path.join(DIST, 'assets', 'js', 'platform.js');
  let code  = fs.readFileSync(src, 'utf-8');

  const GUARD = `function handleRoute() {
  // SSG: if page was pre-rendered by the static generator, wire interactivity
  // and return — avoids a flash of loading state on initial page load.
  const _ssgRoot = document.getElementById('appRoot');
  if (_ssgRoot && _ssgRoot.getAttribute('data-ssg') === '1') {
    _ssgRoot.removeAttribute('data-ssg');
    _ssgRoot.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.nav); })
    );
    const _aw = _ssgRoot.querySelector('[data-audio-src]');
    if (_aw && typeof initAudioWidget === 'function') initAudioWidget(_ssgRoot, _aw.dataset.audioSrc);
    if (typeof highlightCode === 'function')    highlightCode(_ssgRoot);
    if (typeof attachCodeRunners === 'function') attachCodeRunners(_ssgRoot);
    return;
  }`;

  const TARGET = 'function handleRoute() {';
  if (!code.includes(TARGET)) {
    console.warn('  ⚠ Could not find handleRoute() in platform.js — skipping SSG patch');
    return;
  }
  code = code.replace(TARGET, GUARD);
  fs.writeFileSync(src, code, 'utf-8');
  console.log('  → patched assets/js/platform.js with SSG guard');
}

// ── Page generators ──────────────────────────────────────────────

function genCatalog(platform) {
  console.log('\nCatalog');
  const relPath = 'index.html';
  const url     = `${SITE_URL}${BASE}/`;
  writePage(relPath, {
    title:       'Upskilled — Technical ML & Computer Vision Courses',
    description: 'Free deep-technical courses in machine learning and computer vision for practitioners.',
    bodyContent: catalogBody(platform),
    schema: [
      {
        '@context': 'https://schema.org',
        '@type':    'WebSite',
        name:        'Upskilled Consulting — Free ML & AI Courses',
        url,
        description: 'Free deep-technical courses in machine learning and computer vision for practitioners.',
        publisher:   ORG,
      },
      { '@context': 'https://schema.org', ...ORG },
    ],
  });
  trackUrl(relPath, 1.0);
}

function genPrereqOrSupplement(courseRef) {
  const seg       = courseRef.type === 'supplement' ? 'supplement' : 'prereq';
  const module    = loadJSON(courseRef.dataPath);
  const base      = `${seg}/${courseRef.id}`;
  const courseUrl = `${SITE_URL}${BASE}/${base}/`;

  console.log(`\n${seg}/${courseRef.id}`);

  writePage(`${base}/index.html`, {
    title:       `${module.title} — Upskilled`,
    description: module.description,
    bodyContent: prereqOverviewBody(module, courseRef),
    schema:      courseSchema({ name: module.title, description: module.description, url: courseUrl, level: module.level }),
  });
  trackUrl(`${base}/index.html`, 0.9);

  for (const rRef of module.readings || []) {
    const rel = `${base}/reading/${rRef.id}/index.html`;
    try {
      const reading  = loadJSON(rRef.dataPath);
      const descText = (reading.learningObjectives || []).map(lo => lo.description).join(' ');
      const desc     = descText.slice(0, 160);
      writePage(rel, {
        title:       `${reading.title} · ${module.title} — Upskilled`,
        description: desc,
        bodyContent: readingBody(reading, module, courseRef, null),
        schema:      articleSchema({ name: reading.title, description: desc, url: `${SITE_URL}${BASE}/${rel.replace('index.html', '')}`, courseTitle: module.title, courseUrl }),
      });
      trackUrl(rel, 0.7);
    } catch (e) { console.warn(`  ⚠ Skipping reading ${rRef.id}: ${e.message}`); }
  }

  for (const q of module.quizzes || []) {
    writePage(`${base}/quiz/${q.id}/index.html`, {
      title:       `${q.title} · ${module.title} — Upskilled`,
      description: `${q.questionCount || ''} question quiz on ${module.title}.`,
      bodyContent: null, // noindex applied automatically
    });
  }

  for (const lRef of module.labs || []) {
    const rel = `${base}/lab/${lRef.id}/index.html`;
    try {
      const lab  = loadJSON(lRef.dataPath);
      const desc = `Hands-on lab: ${lab.title}. ~${lab.estimatedMinutes} min.`;
      writePage(rel, {
        title:       `${lab.title} · ${module.title} — Upskilled`,
        description: desc,
        bodyContent: labBody(lab, module, courseRef, null),
        schema: {
          '@context': 'https://schema.org',
          '@type':    'LearningResource',
          name:       lab.title,
          description: desc,
          url:         `${SITE_URL}${BASE}/${rel.replace('index.html', '')}`,
          provider:    ORG,
          isAccessibleForFree: true,
          inLanguage:  'en',
        },
      });
      trackUrl(rel, 0.6);
    } catch (e) { console.warn(`  ⚠ Skipping lab ${lRef.id}: ${e.message}`); }
  }

  for (const d of module.drills || []) {
    writePage(`${base}/drill/${d.id}/index.html`, {
      title:       `${d.title} · ${module.title} — Upskilled`,
      description: `Practice drill: ${d.title}. ${d.cardCount} cards.`,
      bodyContent: null, // noindex applied automatically
    });
  }
}

function genCourse(courseRef) {
  const courseManifest = loadJSON(courseRef.dataPath);
  courseRef._title     = courseManifest.title;
  const courseId       = courseRef.id;
  const courseUrl      = `${SITE_URL}${BASE}/${courseId}/`;
  const courseDesc     = courseManifest.subtitle || courseRef.description || '';

  console.log(`\ncourse/${courseId}`);

  writePage(`${courseId}/index.html`, {
    title:       `${courseManifest.title} — Upskilled`,
    description: courseDesc,
    bodyContent: courseHomeBody(courseManifest, courseRef),
    schema:      courseSchema({ name: courseManifest.title, description: courseDesc, url: courseUrl, level: courseRef.level }),
  });
  trackUrl(`${courseId}/index.html`, 0.9);

  writePage(`${courseId}/syllabus/index.html`, {
    title:       `Syllabus · ${courseManifest.title} — Upskilled`,
    description: `Full syllabus for ${courseManifest.title}.`,
    bodyContent: null, // noindex applied automatically
  });

  for (const modEntry of courseManifest.modules || []) {
    let module;
    try { module = loadJSON(modEntry.dataPath); }
    catch (e) { console.warn(`  ⚠ Skipping module ${modEntry.id}: ${e.message}`); continue; }

    const modBase = `${courseId}/${modEntry.id}`;
    const modUrl  = `${SITE_URL}${BASE}/${modBase}/`;
    const modDesc = modEntry.description || '';

    writePage(`${modBase}/index.html`, {
      title:       `${modEntry.title} · ${courseManifest.title} — Upskilled`,
      description: modDesc,
      bodyContent: moduleOverviewBody(courseManifest, courseRef, modEntry, module),
      schema:      courseSchema({ name: modEntry.title, description: modDesc, url: modUrl, level: courseRef.level }),
    });
    trackUrl(`${modBase}/index.html`, 0.8);

    for (const rRef of module.readings || []) {
      const rel = `${modBase}/reading/${rRef.id}/index.html`;
      try {
        const reading  = loadJSON(rRef.dataPath);
        const descText = (reading.learningObjectives || []).map(lo => lo.description).join(' ');
        const desc     = descText.slice(0, 160);
        writePage(rel, {
          title:       `${reading.title} · ${modEntry.title} — Upskilled`,
          description: desc,
          bodyContent: readingBody(reading, module, courseRef, modEntry),
          schema:      articleSchema({ name: reading.title, description: desc, url: `${SITE_URL}${BASE}/${rel.replace('index.html', '')}`, courseTitle: courseManifest.title, courseUrl }),
        });
        trackUrl(rel, 0.7);
      } catch (e) { console.warn(`  ⚠ Skipping reading ${rRef.id}: ${e.message}`); }
    }

    for (const q of module.quizzes || []) {
      writePage(`${modBase}/quiz/${q.id}/index.html`, {
        title:       `${q.title} · ${modEntry.title} — Upskilled`,
        description: `${q.questionCount || ''} question quiz on ${modEntry.title}.`,
        bodyContent: null, // noindex applied automatically
      });
    }

    const labs = module.labs || (module.lab ? [module.lab] : []);
    for (const lRef of labs) {
      const rel = `${modBase}/lab/${lRef.id}/index.html`;
      try {
        const lab  = loadJSON(lRef.dataPath);
        const desc = `Hands-on lab: ${lab.title}. ~${lab.estimatedMinutes} min.`;
        writePage(rel, {
          title:       `${lab.title} · ${modEntry.title} — Upskilled`,
          description: desc,
          bodyContent: labBody(lab, module, courseRef, modEntry),
          schema: {
            '@context': 'https://schema.org',
            '@type':    'LearningResource',
            name:       lab.title,
            description: desc,
            url:         `${SITE_URL}${BASE}/${rel.replace('index.html', '')}`,
            provider:    ORG,
            isAccessibleForFree: true,
            inLanguage:  'en',
          },
        });
        trackUrl(rel, 0.6);
      } catch (e) { console.warn(`  ⚠ Skipping lab ${lRef.id}: ${e.message}`); }
    }

    for (const d of module.drills || []) {
      writePage(`${modBase}/drill/${d.id}/index.html`, {
        title:       `${d.title} · ${modEntry.title} — Upskilled`,
        description: `Practice drill: ${d.title}. ${d.cardCount} cards.`,
        bodyContent: null, // noindex applied automatically
      });
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const BASE = process.env.BASE_PATH || '';
  console.log(`Building static site → dist/  (BASE="${BASE}")\n`);

  fs.emptyDirSync(DIST);

  console.log('Copying assets…');
  fs.copySync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  fs.copySync(path.join(ROOT, 'data'),   path.join(DIST, 'data'));
  fs.copySync(path.join(ROOT, '404.html'), path.join(DIST, '404.html'));

  patchPlatformJs();

  const platform = loadJSON('data/platform.json');

  genCatalog(platform);

  for (const section of platform.sections) {
    for (const courseRef of section.courses) {
      if (courseRef.type === 'prereq' || courseRef.type === 'supplement') {
        genPrereqOrSupplement(courseRef);
      } else if (courseRef.type === 'course') {
        genCourse(courseRef);
      }
    }
  }

  // ── robots.txt ───────────────────────────────────────────────────
  const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}${BASE}/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt, 'utf-8');
  console.log('  → robots.txt');

  // ── sitemap.xml ──────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const urlNodes = sitemapUrls.map(({ url, priority }) =>
    `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`
  ).join('\n');
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log(`  → sitemap.xml (${sitemapUrls.length} URLs)`);

  console.log('\nBuild complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
