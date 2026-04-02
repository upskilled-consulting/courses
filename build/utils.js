'use strict';
const path = require('path');
const fs   = require('fs-extra');

// Set via env at build time: BASE_PATH=/courses npm run build
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

const DIST = path.resolve(__dirname, '..', 'dist');

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Must match platform.js headingSlug exactly so anchor links are consistent
function headingSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
    .replace(/\s/g, '-');
}

// Must match platform.js navItemUrl exactly
function navItemUrl(courseId, item, seg = 'prereq', moduleId = null) {
  if (seg === 'course' && moduleId) {
    const base = `/${courseId}/${moduleId}`;
    if (!item) return base;
    if (item.type === 'quiz')  return `${base}/quiz/${item.id}`;
    if (item.type === 'lab')   return `${base}/lab/${item.id}`;
    if (item.type === 'drill') return `${base}/drill/${item.id}`;
    return `${base}/reading/${item.id}`;
  }
  if (!item) return `/${seg}/${courseId}`;
  if (item.type === 'quiz')  return `/${seg}/${courseId}/quiz/${item.id}`;
  if (item.type === 'lab')   return `/${seg}/${courseId}/lab/${item.id}`;
  if (item.type === 'drill') return `/${seg}/${courseId}/drill/${item.id}`;
  return `/${seg}/${courseId}/reading/${item.id}`;
}

// href = SPA path (e.g. /prereq/matrix-algebra/reading/r1)
// Returns full URL with BASE prefix for use in href attributes
function href(spaPath) {
  return BASE + spaPath;
}

// Compute relative path prefix from a dist-relative file path.
// e.g. 'index.html' → './'
//      'prereq/matrix-algebra/index.html' → '../../'
//      'prereq/matrix-algebra/reading/r1/index.html' → '../../../../'
function relPrefix(fileRelPath) {
  const depth = fileRelPath.split('/').length - 1; // number of directory segments
  return depth === 0 ? './' : '../'.repeat(depth);
}

function writeFile(relPath, content) {
  const abs = path.join(DIST, relPath);
  fs.ensureDirSync(path.dirname(abs));
  fs.writeFileSync(abs, content, 'utf-8');
  console.log('  →', relPath);
}

// Back arrow SVG (shared)
const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="vertical-align:-0.1em;margin-right:1px"><path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5"/></svg>`;

module.exports = { BASE, DIST, escHtml, headingSlug, navItemUrl, href, relPrefix, writeFile, BACK_SVG };
