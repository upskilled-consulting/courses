'use strict';
const path = require('path');
const fs   = require('fs-extra');

const { DIST, writeFile } = require('./utils');
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
  writePage('index.html', {
    title:       'Upskilled — Technical ML & Computer Vision Courses',
    description: 'Free deep-technical courses in machine learning and computer vision for practitioners.',
    bodyContent: catalogBody(platform),
  });
}

function genPrereqOrSupplement(courseRef) {
  const seg    = courseRef.type === 'supplement' ? 'supplement' : 'prereq';
  const module = loadJSON(courseRef.dataPath);
  const base   = `${seg}/${courseRef.id}`;

  console.log(`\n${seg}/${courseRef.id}`);

  writePage(`${base}/index.html`, {
    title:       `${module.title} — Upskilled`,
    description: module.description,
    bodyContent: prereqOverviewBody(module, courseRef),
  });

  for (const rRef of module.readings || []) {
    const rel = `${base}/reading/${rRef.id}/index.html`;
    try {
      const reading  = loadJSON(rRef.dataPath);
      const descText = (reading.learningObjectives || []).map(lo => lo.description).join(' ');
      writePage(rel, {
        title:       `${reading.title} · ${module.title} — Upskilled`,
        description: descText.slice(0, 160),
        bodyContent: readingBody(reading, module, courseRef, null),
      });
    } catch (e) { console.warn(`  ⚠ Skipping reading ${rRef.id}: ${e.message}`); }
  }

  for (const q of module.quizzes || []) {
    writePage(`${base}/quiz/${q.id}/index.html`, {
      title:       `${q.title} · ${module.title} — Upskilled`,
      description: `${q.questionCount || ''} question quiz on ${module.title}.`,
      bodyContent: null,
    });
  }

  for (const lRef of module.labs || []) {
    const rel = `${base}/lab/${lRef.id}/index.html`;
    try {
      const lab = loadJSON(lRef.dataPath);
      writePage(rel, {
        title:       `${lab.title} · ${module.title} — Upskilled`,
        description: `Hands-on lab: ${lab.title}. ~${lab.estimatedMinutes} min.`,
        bodyContent: labBody(lab, module, courseRef, null),
      });
    } catch (e) { console.warn(`  ⚠ Skipping lab ${lRef.id}: ${e.message}`); }
  }

  for (const d of module.drills || []) {
    writePage(`${base}/drill/${d.id}/index.html`, {
      title:       `${d.title} · ${module.title} — Upskilled`,
      description: `Practice drill: ${d.title}. ${d.cardCount} cards.`,
      bodyContent: null,
    });
  }
}

function genCourse(courseRef) {
  const courseManifest = loadJSON(courseRef.dataPath);
  courseRef._title     = courseManifest.title;
  const courseId       = courseRef.id;

  console.log(`\ncourse/${courseId}`);

  writePage(`${courseId}/index.html`, {
    title:       `${courseManifest.title} — Upskilled`,
    description: courseManifest.subtitle || courseRef.description || '',
    bodyContent: courseHomeBody(courseManifest, courseRef),
  });

  writePage(`${courseId}/syllabus/index.html`, {
    title:       `Syllabus · ${courseManifest.title} — Upskilled`,
    description: `Full syllabus for ${courseManifest.title}.`,
    bodyContent: null,
  });

  for (const modEntry of courseManifest.modules || []) {
    let module;
    try { module = loadJSON(modEntry.dataPath); }
    catch (e) { console.warn(`  ⚠ Skipping module ${modEntry.id}: ${e.message}`); continue; }

    const modBase = `${courseId}/${modEntry.id}`;

    writePage(`${modBase}/index.html`, {
      title:       `${modEntry.title} · ${courseManifest.title} — Upskilled`,
      description: modEntry.description || '',
      bodyContent: moduleOverviewBody(courseManifest, courseRef, modEntry, module),
    });

    for (const rRef of module.readings || []) {
      const rel = `${modBase}/reading/${rRef.id}/index.html`;
      try {
        const reading  = loadJSON(rRef.dataPath);
        const descText = (reading.learningObjectives || []).map(lo => lo.description).join(' ');
        writePage(rel, {
          title:       `${reading.title} · ${modEntry.title} — Upskilled`,
          description: descText.slice(0, 160),
          bodyContent: readingBody(reading, module, courseRef, modEntry),
        });
      } catch (e) { console.warn(`  ⚠ Skipping reading ${rRef.id}: ${e.message}`); }
    }

    for (const q of module.quizzes || []) {
      writePage(`${modBase}/quiz/${q.id}/index.html`, {
        title:       `${q.title} · ${modEntry.title} — Upskilled`,
        description: `${q.questionCount || ''} question quiz on ${modEntry.title}.`,
        bodyContent: null,
      });
    }

    const labs = module.labs || (module.lab ? [module.lab] : []);
    for (const lRef of labs) {
      const rel = `${modBase}/lab/${lRef.id}/index.html`;
      try {
        const lab = loadJSON(lRef.dataPath);
        writePage(rel, {
          title:       `${lab.title} · ${modEntry.title} — Upskilled`,
          description: `Hands-on lab: ${lab.title}. ~${lab.estimatedMinutes} min.`,
          bodyContent: labBody(lab, module, courseRef, modEntry),
        });
      } catch (e) { console.warn(`  ⚠ Skipping lab ${lRef.id}: ${e.message}`); }
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

  console.log('\nBuild complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
