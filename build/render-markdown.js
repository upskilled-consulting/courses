'use strict';
// Mirrors parseContentWithMath / restoreMath / renderMarkdown from platform.js
// so Node-side output is identical to browser-side output.
const { marked }     = require('marked');
const katex          = require('katex');
const { headingSlug } = require('./utils');

// ── Custom renderer (same as platform.js setupCodeRenderer) ────
const renderer = new marked.Renderer();

renderer.code = function (code, language) {
  const lang = (language || '').split(/\s+/)[0] || 'plaintext';
  const esc  = code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre><code class="language-${lang}">${esc}</code></pre>\n`;
};

let _slugCounts = {};
renderer.heading = function (text, depth, raw) {
  const base  = headingSlug(raw);
  const count = _slugCounts[base] = (_slugCounts[base] || 0) + 1;
  const id    = count === 1 ? base : `${base}-${count - 1}`;
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};

marked.use({ renderer });

// ── Math slot helpers ───────────────────────────────────────────
function parseContentWithMath(raw) {
  const mathSlots = [];
  let processed = raw;

  // Display math: $$...$$ and \[...\]
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
  // Inline math: \(...\) and $...$
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
    // Use split/join to avoid regex issues with special chars in KaTeX output
    result = result.split(key).join(rendered);
  });
  return result;
}

function renderMarkdown(mdText) {
  if (!mdText) return '';
  _slugCounts = {};
  const { processed, mathSlots } = parseContentWithMath(mdText);
  const html = marked.parse(processed, { gfm: true, breaks: false });
  return restoreMath(html, mathSlots);
}

function renderInlineMath(text) {
  if (!text) return '';
  const { processed, mathSlots } = parseContentWithMath(text);
  const html = marked.parseInline ? marked.parseInline(processed) : processed;
  return restoreMath(html, mathSlots);
}

module.exports = { renderMarkdown, renderInlineMath };
