// Animation for r3: Subspace Test
// Demonstrates the three-condition test on concrete subsets of ℝ²:
//   S₁ = line y=x (subspace ✓), S₂ = line y=x+1 (fails cond.1), S₃ = upper half-plane (fails cond.3)

export function initSubspaceAnimation(container) {
  const W = 520, H = 290;
  const DPR = window.devicePixelRatio || 1;

  // Coordinate system: origin at (OX, OY), SC pixels per unit
  const OX = 195, OY = 152, SC = 40;
  function cx(x) { return OX + x * SC; }
  function cy(y) { return OY - y * SC; }

  // ── Steps ─────────────────────────────────────────────────────
  const STEPS = [
    { scene:'s1',     phase:'ask',   label:'S₁ = {t(1,1) : t ∈ ℝ}  (line y = x) — condition 1: is  (0,0) ∈ S₁?' },
    { scene:'s1',     phase:'cond1', label:'(0,0) lies on y = x  ✓  — condition 1 satisfied' },
    { scene:'s1',     phase:'cond2', label:'u = (1,1),  v = (2,2) ∈ S₁  →  u+v = (3,3) ∈ S₁  ✓  — condition 2' },
    { scene:'s1',     phase:'cond3', label:'−1·(2,2) = (−2,−2) ∈ S₁  ✓  — all three conditions pass: S₁ is a subspace' },
    { scene:'s2',     phase:'fail',  label:'S₂: line y = x+1  — (0,0) ∉ S₂  ✗  — fails condition 1: NOT a subspace' },
    { scene:'s3',     phase:'fail',  label:'S₃ = {(x,y): y ≥ 0}  — (1,1) ∈ S₃  but  −(1,1) = (−1,−1) ∉ S₃  ✗  — NOT a subspace' },
  ];

  // ── DOM ───────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="sbPrev" aria-label="Previous">‹</button>
      <span class="gauss-step-counter" id="sbCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="sbNext" aria-label="Next">›</button>
      <button class="gauss-btn gauss-play-btn" id="sbPlay">▶ Play</button>
    </div>
  `;
  container.replaceChildren(wrap);

  const canvas = wrap.querySelector('.gauss-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(DPR, DPR);

  // ── Theme ─────────────────────────────────────────────────────
  function colors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text:       light ? '#1a202c'  : '#e2e8f0',
      muted:      light ? '#94a3b8'  : '#4a5568',
      grid:       light ? '#edf2f7'  : '#1a2535',
      axis:       light ? '#b0b8c4'  : '#2d3f55',
      s1:         light ? '#1776a4'  : '#63aac9',
      s2:         light ? '#c2410c'  : '#fb923c',
      s3fill:     light ? 'rgba(23,118,164,0.08)' : 'rgba(99,170,201,0.09)',
      uColor:     light ? '#d97706'  : '#fbbf24',
      vColor:     light ? '#7c3aed'  : '#a78bfa',
      uvColor:    light ? '#059669'  : '#34d399',
      pass:       light ? '#15803d'  : '#4ade80',
      fail:       light ? '#dc2626'  : '#f87171',
      passBg:     light ? 'rgba(21,128,61,0.10)'  : 'rgba(74,222,128,0.10)',
      failBg:     light ? 'rgba(220,38,38,0.10)'  : 'rgba(248,113,113,0.10)',
      dot:        light ? '#d1d5db'  : '#263348',
      accentLight:'#63aac9',
    };
  }

  // ── Drawing helpers ───────────────────────────────────────────
  function drawAxes(c) {
    const cl = colors();
    // Grid
    c.strokeStyle = cl.grid;
    c.lineWidth   = 1;
    for (let x = -4; x <= 5; x++) {
      c.beginPath(); c.moveTo(cx(x), 2); c.lineTo(cx(x), H - 44); c.stroke();
    }
    for (let y = -2; y <= 3; y++) {
      c.beginPath(); c.moveTo(cx(-4), cy(y)); c.lineTo(cx(5), cy(y)); c.stroke();
    }
    // Axes
    c.strokeStyle = cl.axis;
    c.lineWidth   = 1.5;
    c.beginPath(); c.moveTo(cx(-4), cy(0)); c.lineTo(cx(5),    cy(0)); c.stroke();
    c.beginPath(); c.moveTo(cx(0),  cy(-2.2)); c.lineTo(cx(0), cy(3.2)); c.stroke();
    // Tick labels
    c.font = '10px system-ui, sans-serif';
    for (let x = -3; x <= 4; x++) {
      if (x === 0) continue;
      c.textAlign = 'center'; c.textBaseline = 'top';
      fillTextBg(c, String(x), cx(x), cy(0) + 3, cl.muted, 'center', 'top');
    }
    for (let y = -2; y <= 2; y++) {
      if (y === 0) continue;
      c.textAlign = 'right'; c.textBaseline = 'middle';
      fillTextBg(c, String(y), cx(0) - 3, cy(y), cl.muted, 'right', 'middle');
    }
    // Axis name labels
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'left';  c.textBaseline = 'middle';
    fillTextBg(c, 'x', cx(4.8), cy(0), cl.muted, 'left', 'middle');
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    fillTextBg(c, 'y', cx(0), cy(3.1), cl.muted, 'center', 'bottom');
  }

  // Clip-aware infinite line through (px,py) with direction (dx,dy)
  function drawInfLine(c, px, py, dx, dy, color, width = 2, dashed = false) {
    c.save();
    c.beginPath(); c.rect(2, 2, W - 4, H - 44); c.clip();
    c.strokeStyle = color;
    c.lineWidth   = width;
    if (dashed) c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(cx(px - 20 * dx), cy(py - 20 * dy));
    c.lineTo(cx(px + 20 * dx), cy(py + 20 * dy));
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  function drawArrow(c, x1, y1, x2, y2, color, width = 2) {
    c.strokeStyle = color;
    c.fillStyle   = color;
    c.lineWidth   = width;
    c.beginPath(); c.moveTo(cx(x1), cy(y1)); c.lineTo(cx(x2), cy(y2)); c.stroke();
    const angle = Math.atan2(cy(y2) - cy(y1), cx(x2) - cx(x1));
    const L = 9;
    c.beginPath();
    c.moveTo(cx(x2), cy(y2));
    c.lineTo(cx(x2) - L * Math.cos(angle - 0.38), cy(y2) - L * Math.sin(angle - 0.38));
    c.lineTo(cx(x2) - L * Math.cos(angle + 0.38), cy(y2) - L * Math.sin(angle + 0.38));
    c.closePath(); c.fill();
  }

  function drawDot(c, x, y, color, r = 5) {
    c.fillStyle   = color;
    c.strokeStyle = '#ffffff55';
    c.lineWidth   = 1.5;
    c.beginPath(); c.arc(cx(x), cy(y), r, 0, Math.PI * 2);
    c.fill(); c.stroke();
  }

  function ptLabel(c, text, x, y, color, dx = 10, dy = -10, align = 'left') {
    c.font = '11px system-ui, sans-serif';
    c.textAlign = align; c.textBaseline = 'middle';
    fillTextBg(c, text, cx(x) + dx, cy(y) + dy, color, align, 'middle');
  }

  // ✓ / ✗ marker near a canvas point; mx/my control offset
  function drawMark(c, x, y, pass, mx = 16, my = -16) {
    const cl = colors();
    c.fillStyle    = pass ? cl.pass : cl.fail;
    c.font         = 'bold 15px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText(pass ? '✓' : '✗', cx(x) + mx, cy(y) + my);
  }

  // Draw text with a semi-transparent background rect for legibility over drawn content
  function fillTextBg(c, text, x, y, color, align = 'center', baseline = 'middle', pad = 2) {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const bg    = light ? 'rgba(255,255,255,0.82)' : 'rgba(13,18,28,0.80)';
    const tw    = c.measureText(text).width;
    const fh    = 11; // approximate cap-height for current font
    let rx = x - pad;
    if (align === 'center') rx = x - tw / 2 - pad;
    if (align === 'right')  rx = x - tw - pad;
    let ry = y - fh / 2 - pad;
    if (baseline === 'top')    ry = y - pad;
    if (baseline === 'bottom') ry = y - fh - pad;
    c.fillStyle = bg;
    c.fillRect(rx, ry, tw + pad * 2, fh + pad * 2);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  // Floating badge in upper-right area
  function drawBadge(c, text, pass) {
    const cl     = colors();
    const color  = pass ? cl.pass : cl.fail;
    const bgcol  = pass ? cl.passBg : cl.failBg;
    c.font       = '12px system-ui, sans-serif';
    const tw     = c.measureText(text).width;
    const pad    = 9;
    const bw     = tw + pad * 2, bh = 22;
    const bx     = W - bw - 14, by = 14;
    c.fillStyle  = bgcol;
    c.strokeStyle = color;
    c.lineWidth  = 1.5;
    c.beginPath();
    if (c.roundRect) c.roundRect(bx, by, bw, bh, 5);
    else c.rect(bx, by, bw, bh);
    c.fill(); c.stroke();
    c.fillStyle    = color;
    c.textAlign    = 'left';
    c.textBaseline = 'middle';
    c.fillText(text, bx + pad, by + bh / 2);
  }

  // ── Scene renderers ───────────────────────────────────────────
  function sceneS1(c, phase) {
    const cl = colors();
    drawInfLine(c, 0, 0, 1, 1, cl.s1, 2);
    c.font = '11px system-ui, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    fillTextBg(c, 'S₁: y = x', cx(2.1), cy(2.3), cl.s1, 'left', 'middle');

    if (phase === 'ask') {
      c.fillStyle    = cl.muted;
      c.font         = 'bold 18px system-ui, sans-serif';
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', cx(0) + 20, cy(0) - 18);
    }

    if (phase === 'cond1') {
      // Only show: does (0,0) lie on S₁?
      drawDot(c, 0, 0, cl.pass);
      drawMark(c, 0, 0, true);
    }

    if (phase === 'cond2') {
      // Only show: is S₁ closed under addition?
      drawArrow(c, 0, 0, 1, 1, cl.uColor);
      drawArrow(c, 0, 0, 2, 2, cl.vColor);
      drawArrow(c, 0, 0, 3, 3, cl.uvColor);
      drawDot(c, 1, 1, cl.uColor, 4);
      drawDot(c, 2, 2, cl.vColor, 4);
      drawDot(c, 3, 3, cl.uvColor, 4);
      ptLabel(c, 'u',   1, 1, cl.uColor,   10,  12);
      ptLabel(c, 'v',   2, 2, cl.vColor,  -10, -12, 'right');
      ptLabel(c, 'u+v', 3, 3, cl.uvColor,  10,  16);
      drawMark(c, 3, 3, true, 0, 28);
    }

    if (phase === 'cond3') {
      // Only show: is S₁ closed under scalar mult?
      drawArrow(c, 0, 0,  2,  2, cl.uColor);
      drawArrow(c, 0, 0, -2, -2, cl.uvColor);
      drawDot(c,  2,  2, cl.uColor, 4);
      drawDot(c, -2, -2, cl.uvColor, 4);
      ptLabel(c, 'u = (2,2)',     2,  2, cl.uColor,    10, -12);
      ptLabel(c, '−u = (−2,−2)', -2, -2, cl.uvColor,  -8, -14, 'right');
      drawMark(c, -2, -2, true);
      drawBadge(c, '✓  S₁ is a subspace', true);
    }
  }

  function sceneS2(c) {
    const cl = colors();
    // S₂: y = x+1, passes through (0,1), direction (1,1)
    drawInfLine(c, 0, 1, 1, 1, cl.s2, 2);
    c.font = '11px system-ui, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    fillTextBg(c, 'S₂: y = x + 1', cx(1.4), cy(2.6), cl.s2, 'left', 'middle');

    // Origin marked as NOT on S₂
    // Dashed line from origin to closest point on S₂ = (−0.5, 0.5)
    c.strokeStyle = cl.fail;
    c.lineWidth   = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(cx(0), cy(0)); c.lineTo(cx(-0.5), cy(0.5));
    c.stroke();
    c.setLineDash([]);

    drawDot(c, 0, 0, cl.fail);
    drawMark(c, 0, 0, false);
    ptLabel(c, '(0,0) ∉ S₂', 0, 0, cl.fail, 14, 18); // below ✗ mark
    drawBadge(c, '✗  NOT a subspace', false);
  }

  function sceneS3(c) {
    const cl = colors();
    // Shade upper half-plane (y ≥ 0 = canvas top to OY)
    c.fillStyle = cl.s3fill;
    c.fillRect(2, 2, W - 4, cy(0) - 2);
    // x-axis boundary
    c.strokeStyle = cl.s1 + '88';
    c.lineWidth   = 1.5;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(cx(-4), cy(0)); c.lineTo(cx(5), cy(0));
    c.stroke();
    c.setLineDash([]);

    // Label
    c.font = '11px system-ui, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    fillTextBg(c, 'S₃: y ≥ 0', cx(2.2), cy(1.5), cl.s1, 'left', 'middle');

    // v = (1,1) inside S₃
    drawArrow(c, 0, 0, 1, 1, cl.pass);
    drawDot(c, 1, 1, cl.pass, 5);
    ptLabel(c, 'v = (1,1)  ✓', 1, 1, cl.pass, 10, -14);

    // −v = (−1,−1) outside S₃ (y = −1 < 0)
    drawArrow(c, 0, 0, -1, -1, cl.fail);
    drawDot(c, -1, -1, cl.fail, 5);
    ptLabel(c, '−v = (−1,−1)  ✗', -1, -1, cl.fail, -10, 0, 'right'); // left of point
    drawBadge(c, '✗  NOT a subspace', false);
  }

  // ── Chrome ────────────────────────────────────────────────────
  function drawAnnotation(c, si) {
    const cl = colors();
    c.fillStyle    = cl.text;
    c.font         = '12px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    c.fillText(STEPS[si].label, W / 2, H - 38);
  }

  function drawProgress(c, si) {
    const cl = colors();
    const r = 4, gap = 10;
    const tw = STEPS.length * (r * 2 + gap) - gap;
    const x0 = (W - tw) / 2;
    for (let i = 0; i < STEPS.length; i++) {
      c.beginPath();
      c.arc(x0 + i * (r * 2 + gap) + r, H - 11, r, 0, Math.PI * 2);
      c.fillStyle = i === si ? cl.accentLight : cl.dot;
      c.fill();
    }
  }

  // ── State & render ────────────────────────────────────────────
  let stepIdx = 0;
  let playing = false;
  let playTimer = null;

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawAxes(ctx);
    const { scene, phase } = STEPS[stepIdx];
    if (scene === 's1') sceneS1(ctx, phase);
    if (scene === 's2') sceneS2(ctx);
    if (scene === 's3') sceneS3(ctx);
    drawAnnotation(ctx, stepIdx);
    drawProgress(ctx, stepIdx);
    wrap.querySelector('#sbCounter').textContent = `${stepIdx + 1} / ${STEPS.length}`;
    wrap.querySelector('#sbPrev').disabled = stepIdx === 0;
    wrap.querySelector('#sbNext').disabled = stepIdx === STEPS.length - 1;
  }

  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }

  function stopPlay() {
    playing = false;
    clearInterval(playTimer);
    wrap.querySelector('#sbPlay').textContent = '▶ Play';
  }

  function startPlay() {
    if (stepIdx >= STEPS.length - 1) goTo(0);
    playing = true;
    wrap.querySelector('#sbPlay').textContent = '⏸ Pause';
    playTimer = setInterval(() => {
      if (stepIdx >= STEPS.length - 1) { stopPlay(); return; }
      goTo(stepIdx + 1);
    }, 1900);
  }

  // ── Controls ──────────────────────────────────────────────────
  wrap.querySelector('#sbPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx - 1); });
  wrap.querySelector('#sbNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx + 1); });
  wrap.querySelector('#sbPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  new MutationObserver(render).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
  );

  render();
}
