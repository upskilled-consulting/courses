// Animation for r2: Solution Sets and the Homogeneous Structure
// Illustrates the General = Particular + Homogeneous decomposition
// using the 2D system  x₁ + 2x₂ = 3  (one free variable → line solution set)

export function initSolutionSetAnimation(container) {
  const W = 520, H = 300;
  const DPR = window.devicePixelRatio || 1;

  // ── Coordinate system ─────────────────────────────────────────
  // Origin at canvas (OX, OY); scale SC pixels per unit
  const OX = 158, OY = 155, SC = 44;
  function cx(x) { return OX + x * SC; }
  function cy(y) { return OY - y * SC; }

  // Null-space direction: (2, −1)  [satisfies x₁ + 2x₂ = 0]
  // Particular solution: p = (3, 0)
  // Example solution:    x = (1, 1)  →  h = x − p = (−2, 1)

  // ── Steps ─────────────────────────────────────────────────────
  const STEPS = [
    { label: '2D example:  x₁ + 2x₂ = 3  (one equation, two unknowns → one free variable)' },
    { label: 'Homogeneous system  x₁ + 2x₂ = 0  →  N(A): a line through the origin' },
    { label: 'Particular solution  p = (3, 0)  satisfies  1·3 + 2·0 = 3  ✓' },
    { label: 'Translating N(A) by p  …', animated: true },
    { label: 'Solution set of  x₁ + 2x₂ = 3  =  p + N(A)  — a line parallel to N(A)' },
    { label: 'Any solution  x = p + h  where  h ∈ N(A).  Here  x = (1,1) = (3,0) + (−2,1)' },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="ssPrev" aria-label="Previous step">‹</button>
      <span class="gauss-step-counter" id="ssCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="ssNext" aria-label="Next step">›</button>
      <button class="gauss-btn gauss-play-btn" id="ssPlay">▶ Play</button>
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

  // ── Theme colours ─────────────────────────────────────────────
  function colors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text:      light ? '#1a202c'  : '#e2e8f0',
      muted:     light ? '#94a3b8'  : '#4a5568',
      grid:      light ? '#e8edf3'  : '#1a2535',
      axis:      light ? '#b0b8c4'  : '#2d3f55',
      nullLine:  light ? '#1776a4'  : '#63aac9',
      solLine:   light ? '#0d7490'  : '#52ab97',
      point:     light ? '#dc2626'  : '#f87171',
      vector:    light ? '#d97706'  : '#fbbf24',
      dot:       light ? '#d1d5db'  : '#263348',
      accentLight: '#63aac9',
    };
  }

  // ── Drawing utilities ─────────────────────────────────────────
  // Clip-aware infinite line through (px,py) with direction (dx,dy)
  function drawLine(c, px, py, dx, dy, color, width = 2, dashed = false) {
    c.save();
    c.beginPath();
    c.rect(2, 2, W - 4, H - 44);
    c.clip();
    c.strokeStyle = color;
    c.lineWidth   = width;
    if (dashed) c.setLineDash([7, 5]);
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
    c.beginPath();
    c.moveTo(cx(x1), cy(y1));
    c.lineTo(cx(x2), cy(y2));
    c.stroke();
    const angle = Math.atan2(cy(y2) - cy(y1), cx(x2) - cx(x1));
    const L = 9;
    c.beginPath();
    c.moveTo(cx(x2), cy(y2));
    c.lineTo(cx(x2) - L * Math.cos(angle - 0.38), cy(y2) - L * Math.sin(angle - 0.38));
    c.lineTo(cx(x2) - L * Math.cos(angle + 0.38), cy(y2) - L * Math.sin(angle + 0.38));
    c.closePath();
    c.fill();
  }

  function drawDot(c, x, y, color, r = 5) {
    c.fillStyle   = color;
    c.strokeStyle = '#ffffff66';
    c.lineWidth   = 1.5;
    c.beginPath();
    c.arc(cx(x), cy(y), r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  function label(c, text, x, y, color, align = 'left', baseline = 'middle', size = 11.5) {
    c.fillStyle    = color;
    c.font         = `${size}px system-ui, sans-serif`;
    c.textAlign    = align;
    c.textBaseline = baseline;
    c.fillText(text, cx(x), cy(y));
  }

  function drawAxes(c) {
    const cl = colors();
    // Grid
    c.strokeStyle = cl.grid;
    c.lineWidth   = 1;
    for (let x = -2; x <= 6; x++) {
      c.beginPath(); c.moveTo(cx(x), 2); c.lineTo(cx(x), H - 44); c.stroke();
    }
    for (let y = -2; y <= 3; y++) {
      c.beginPath(); c.moveTo(cx(-2.5), cy(y)); c.lineTo(cx(6.5), cy(y)); c.stroke();
    }
    // Axes
    c.strokeStyle = cl.axis;
    c.lineWidth   = 1.5;
    c.beginPath(); c.moveTo(cx(-2.5), cy(0)); c.lineTo(cx(6.5), cy(0)); c.stroke();
    c.beginPath(); c.moveTo(cx(0), 2);         c.lineTo(cx(0), H - 44); c.stroke();
    // Tick labels
    c.fillStyle    = cl.muted;
    c.font         = '10.5px system-ui, sans-serif';
    c.textBaseline = 'top';
    c.textAlign    = 'center';
    for (let x = -2; x <= 6; x++) {
      if (x === 0) continue;
      c.fillText(x, cx(x), cy(0) + 4);
    }
    c.textAlign    = 'right';
    c.textBaseline = 'middle';
    for (let y = -2; y <= 2; y++) {
      if (y === 0) continue;
      c.fillText(y, cx(0) - 4, cy(y));
    }
    // Axis name labels
    c.font = '12px system-ui, sans-serif';
    c.fillStyle    = cl.muted;
    c.textAlign    = 'left';  c.textBaseline = 'middle';
    c.fillText('x₁', cx(6.3), cy(0));
    c.textAlign    = 'center'; c.textBaseline = 'bottom';
    c.fillText('x₂', cx(0),   cy(3) + 4);
  }

  function drawAnnotation(c, si) {
    const cl = colors();
    const step = STEPS[si];
    c.fillStyle    = cl.text;
    c.font         = '12px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    c.fillText(step.label, W / 2, H - 38);
  }

  function drawProgress(c, si) {
    const cl = colors();
    const r = 4, gap = 10;
    const totalW = STEPS.length * (r * 2 + gap) - gap;
    const x0 = (W - totalW) / 2;
    for (let i = 0; i < STEPS.length; i++) {
      c.beginPath();
      c.arc(x0 + i * (r * 2 + gap) + r, H - 10, r, 0, Math.PI * 2);
      c.fillStyle = i === si ? cl.accentLight : cl.dot;
      c.fill();
    }
  }

  // ── Main render ───────────────────────────────────────────────
  // slideT ∈ [0,1]: how far the null-space line has slid toward p
  function render(si, slideT) {
    const cl = colors();
    ctx.clearRect(0, 0, W, H);
    drawAxes(ctx);

    if (si >= 1) {
      // Null-space line: at slideT it passes through (3*slideT, 0)
      const t = si === 3 ? slideT : si >= 4 ? 1 : 0;
      const lx = 3 * t, ly = 0;

      if (si <= 3) {
        // Show sliding line (or still null-space line if t=0)
        drawLine(ctx, lx, ly, 2, -1, cl.nullLine, 2);
        if (t < 0.85) {
          label(ctx, 'N(A): x₁ + 2x₂ = 0', -1.8, -1.2, cl.nullLine);
        }
        // Translation arrow during slide
        if (si === 3 && t > 0.05) {
          drawArrow(ctx, 0, 0, lx, ly, cl.vector, 2);
          if (t > 0.5) {
            ctx.fillStyle = cl.vector;
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('p', cx(lx / 2), cy(0) - 6);
          }
        }
      } else {
        // Steps 4+: show both lines
        drawLine(ctx, 0, 0, 2, -1, cl.nullLine, 1.5, true);    // N(A) dashed
        drawLine(ctx, 3, 0, 2, -1, cl.solLine,  2.5, false);   // solution set solid
        label(ctx, 'N(A)', -1.8, -1.2, cl.nullLine);
        label(ctx, 'p + N(A): x₁ + 2x₂ = 3', 1.0, 2.2, cl.solLine);
      }
    }

    if (si >= 2) {
      drawDot(ctx, 3, 0, cl.point);
      label(ctx, 'p = (3, 0)', 3.15, 0.28, cl.point);
    }

    if (si >= 5) {
      // Decomposition: x = (1,1), h = (−2,1)
      drawDot(ctx, 1, 1, cl.solLine, 5);
      label(ctx, 'x = (1, 1)', 1.12, 1.28, cl.solLine);
      drawArrow(ctx, 0, 0, 3, 0, cl.vector, 2);      // origin → p
      drawArrow(ctx, 3, 0, 1, 1, cl.vector, 2);      // p → x (= h direction)
      ctx.fillStyle    = cl.vector;
      ctx.font         = '11px system-ui, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('p', cx(1.5), cy(0) - 6);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('h = (−2, 1)', cx(2.2), cy(0.5));
    }

    drawAnnotation(ctx, si);
    drawProgress(ctx, si);
    wrap.querySelector('#ssCounter').textContent = `${si + 1} / ${STEPS.length}`;
    wrap.querySelector('#ssPrev').disabled = si === 0;
    wrap.querySelector('#ssNext').disabled = si === STEPS.length - 1;
  }

  // ── State & animation ─────────────────────────────────────────
  let stepIdx  = 0;
  let slideT   = 0;
  let slideRaf = null;
  let playing  = false;
  let playTimer = null;

  function cancelSlide() {
    if (slideRaf) { cancelAnimationFrame(slideRaf); slideRaf = null; }
  }

  function startSlide(onDone) {
    cancelSlide();
    slideT = 0;
    const start    = performance.now();
    const duration = 1000;
    function frame(now) {
      slideT = Math.min((now - start) / duration, 1);
      render(stepIdx, slideT);
      if (slideT < 1) {
        slideRaf = requestAnimationFrame(frame);
      } else {
        slideRaf = null;
        onDone?.();
      }
    }
    slideRaf = requestAnimationFrame(frame);
  }

  function goTo(i) {
    cancelSlide();
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    slideT  = (stepIdx > 3) ? 1 : (stepIdx === 3 ? 0 : 0);
    if (stepIdx === 3) {
      startSlide();
    } else {
      render(stepIdx, slideT);
    }
  }

  function stopPlay() {
    playing = false;
    clearInterval(playTimer);
    wrap.querySelector('#ssPlay').textContent = '▶ Play';
  }

  function startPlay() {
    if (stepIdx >= STEPS.length - 1) goTo(0);
    playing = true;
    wrap.querySelector('#ssPlay').textContent = '⏸ Pause';
    playTimer = setInterval(() => {
      if (stepIdx >= STEPS.length - 1) { stopPlay(); return; }
      goTo(stepIdx + 1);
    }, 2200);
  }

  // ── Controls ──────────────────────────────────────────────────
  wrap.querySelector('#ssPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx - 1); });
  wrap.querySelector('#ssNext').addEventListener('click', () => {
    stopPlay();
    // If slide is in progress, skip to end first, then advance on next click
    if (slideRaf) { cancelSlide(); slideT = 1; render(stepIdx, slideT); return; }
    goTo(stepIdx + 1);
  });
  wrap.querySelector('#ssPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  new MutationObserver(() => render(stepIdx, slideT)).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
  );

  render(stepIdx, slideT);
}
