// Span membership via Gauss's method + general span = ℝ² conclusion
// Problem: Is v = (5, 4) in span{ u₁=(1,1), u₂=(2,1) }?
// Augmented matrix: a + 2b = 5, a + b = 4

export function initSpanGaussAnimation(container) {
  const W = 540, H = 280;
  const DPR = window.devicePixelRatio || 1;

  // ── Step definitions ──────────────────────────────────────────
  // symbols[] overrides numeric matrix rendering (for the symbolic step)
  const STEPS = [
    {
      matrix:   [[1, 2, 5], [1, 1, 4]],
      pivotRow: -1, changed: [], symbols: null,
      label: 'Set up: find a, b such that  a·u₁ + b·u₂ = v',
      ops: [], solve: null, solution: null,
    },
    {
      matrix:   [[1, 2, 5], [1, 1, 4]],
      pivotRow: 0,  changed: [], symbols: null,
      label: 'Row 1 is the pivot — eliminate below it',
      ops: ['−ρ₁ + ρ₂  →  ρ₂'],
      solve: null, solution: null,
    },
    {
      matrix:   [[1, 2, 5], [0, -1, -1]],
      pivotRow: -1,
      changed: [[1, 0], [1, 1], [1, 2]], symbols: null,
      label: 'Column 1 cleared — upper-triangular form',
      ops: [], solve: null, solution: null,
    },
    {
      matrix:   [[1, 2, 5], [0, -1, -1]],
      pivotRow: 1,  changed: [], symbols: null,
      label: 'Row 2:  −b = −1',
      ops: [], solve: 'b = 1', solution: null,
    },
    {
      matrix:   [[1, 2, 5], [0, -1, -1]],
      pivotRow: 0,  changed: [], symbols: null,
      label: 'Row 1:  a + 2(1) = 5',
      ops: [], solve: 'a = 3', solution: null,
    },
    {
      matrix:   [[1, 2, 5], [0, -1, -1]],
      pivotRow: -1, changed: [], symbols: null,
      label: 'v = (5, 4)  is in the span',
      ops: [], solve: null, solution: '3·u₁ + 1·u₂ = (5, 4)  ✓',
    },
    {
      matrix:   [[1, 2, 0], [0, -1, 0]],
      pivotRow: -1, changed: [], symbols: [['1', '2', 'x'], ['0', '−1', 'y−x']],
      label: 'Replace (5, 4) with any (x, y) — a solution always exists',
      ops: [], solve: null, solution: 'span{u₁, u₂} = ℝ²',
    },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="sgPrev" aria-label="Previous step">‹</button>
      <span class="gauss-step-counter" id="sgCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="sgNext" aria-label="Next step">›</button>
      <button class="gauss-btn gauss-play-btn" id="sgPlay">▶ Play</button>
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

  // ── Layout constants ──────────────────────────────────────────
  const CELL_W = 68, CELL_H = 54;
  const ROWS = 2, COEF_COLS = 2;
  const SEP_GAP = 28;
  const GRID_W  = COEF_COLS * CELL_W + SEP_GAP + CELL_W;  // 68+68+28+68=232
  const GRID_H  = ROWS * CELL_H;                           // 108
  const BRACK   = 16;
  const LEFT_PAD = 20;
  const MAT_W   = LEFT_PAD + GRID_W + LEFT_PAD;
  const MAT_X   = (W - MAT_W) / 2;
  const MAT_Y   = 38;

  function colX(c) {
    const extra = c >= COEF_COLS ? SEP_GAP : 0;
    return MAT_X + LEFT_PAD + c * CELL_W + extra + CELL_W / 2;
  }
  function rowY(r) { return MAT_Y + r * CELL_H + CELL_H / 2; }

  // ── Theme colours ─────────────────────────────────────────────
  function colors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text:        light ? '#1a202c'               : '#e2e8f0',
      muted:       light ? '#94a3b8'               : '#4a5568',
      accent:      '#1776a4',
      accentLight: '#63aac9',
      pivotBg:     light ? 'rgba(23,118,164,0.10)' : 'rgba(23,118,164,0.18)',
      changedText: light ? '#0d7490'               : '#52ab97',
      changedBg:   light ? 'rgba(13,116,144,0.10)' : 'rgba(82,171,151,0.12)',
      sep:         light ? '#cbd5e1'               : '#2d3f55',
      dot:         light ? '#d1d5db'               : '#263348',
      solution:    '#52ab97',
      symbolic:    light ? '#7c3aed'               : '#a78bfa',
    };
  }

  // ── Drawing helpers ───────────────────────────────────────────
  function drawBrackets(c) {
    const cl = colors();
    const x1 = MAT_X + 6, x2 = MAT_X + MAT_W - 6;
    const y0 = MAT_Y + 4, y1 = MAT_Y + GRID_H - 4;
    c.strokeStyle = cl.text;
    c.lineWidth = 2;
    c.lineCap = 'square';
    c.beginPath();
    c.moveTo(x1 + BRACK, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x1 + BRACK, y1);
    c.stroke();
    c.beginPath();
    c.moveTo(x2 - BRACK, y0); c.lineTo(x2, y0); c.lineTo(x2, y1); c.lineTo(x2 - BRACK, y1);
    c.stroke();
  }

  function drawSeparator(c) {
    const cl = colors();
    const sepX = MAT_X + LEFT_PAD + COEF_COLS * CELL_W + SEP_GAP / 2;
    c.strokeStyle = cl.sep;
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(sepX, MAT_Y + 6); c.lineTo(sepX, MAT_Y + GRID_H - 6);
    c.stroke();
    c.setLineDash([]);
  }

  function drawHeaders(c) {
    const cl = colors();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = cl.muted;
    c.font = '12px system-ui, sans-serif';
    ['a', 'b', 'v'].forEach((h, col) => {
      c.fillText(h, colX(col), MAT_Y - 16);
    });
  }

  function isChanged(r, col, changed) {
    return changed.some(([cr, cc]) => cr === r && cc === col);
  }

  function drawMatrix(c, step) {
    const cl = colors();
    const { matrix, pivotRow, changed, symbols } = step;
    const TOTAL_COLS = COEF_COLS + 1;

    // pivot row background
    if (pivotRow >= 0) {
      c.fillStyle = cl.pivotBg;
      const rx = MAT_X + LEFT_PAD - 4;
      const ry = MAT_Y + pivotRow * CELL_H + 4;
      const rw = GRID_W + 8;
      const rh = CELL_H - 8;
      c.beginPath();
      if (c.roundRect) c.roundRect(rx, ry, rw, rh, 6);
      else c.rect(rx, ry, rw, rh);
      c.fill();
    }

    drawBrackets(c);
    drawSeparator(c);
    drawHeaders(c);

    c.textAlign = 'center'; c.textBaseline = 'middle';

    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < TOTAL_COLS; col++) {
        const cx  = colX(col);
        const cy  = rowY(r);
        const chg = isChanged(r, col, changed);

        if (chg) {
          c.fillStyle = cl.changedBg;
          c.beginPath();
          if (c.roundRect) c.roundRect(cx - CELL_W / 2 + 4, cy - CELL_H / 2 + 6, CELL_W - 8, CELL_H - 12, 4);
          else c.rect(cx - CELL_W / 2 + 4, cy - CELL_H / 2 + 6, CELL_W - 8, CELL_H - 12);
          c.fill();
        }

        // text to render
        let txt, color;
        if (symbols) {
          txt = symbols[r][col];
          color = cl.symbolic;
        } else {
          const val = matrix[r][col];
          txt   = String(val);
          if (chg) {
            color = cl.changedText;
          } else if (r === pivotRow) {
            color = cl.accentLight;
          } else if (val === 0 && col < COEF_COLS) {
            color = cl.muted;
          } else {
            color = cl.text;
          }
        }

        const isLong = txt.length >= 3;
        c.fillStyle = color;
        c.font = `${isLong ? 14 : 18}px 'Courier New', monospace`;
        c.fillText(txt, cx, cy);
      }
    }
  }

  function drawAnnotation(c, step) {
    const cl = colors();
    const { label, ops, solve, solution } = step;
    const y0 = MAT_Y + GRID_H + 18;

    c.textAlign = 'center'; c.textBaseline = 'top';

    c.font = '13px system-ui, sans-serif';
    c.fillStyle = cl.text;
    c.fillText(label, W / 2, y0);

    ops.forEach((op, i) => {
      c.font = '13px "Courier New", monospace';
      c.fillStyle = cl.accentLight;
      c.fillText(op, W / 2, y0 + 22 + i * 20);
    });

    if (solve) {
      c.font = 'bold 22px system-ui, sans-serif';
      c.fillStyle = cl.solution;
      c.fillText(solve, W / 2, y0 + 22);
    }

    if (solution) {
      c.font = 'bold 18px system-ui, sans-serif';
      c.fillStyle = cl.solution;
      c.fillText(solution, W / 2, y0 + 22);
    }
  }

  function drawProgress(c) {
    const cl = colors();
    const r = 4, gap = 10;
    const totalW = STEPS.length * (r * 2 + gap) - gap;
    const x0 = (W - totalW) / 2;
    const y  = H - 11;
    for (let i = 0; i < STEPS.length; i++) {
      c.beginPath();
      c.arc(x0 + i * (r * 2 + gap) + r, y, r, 0, Math.PI * 2);
      c.fillStyle = i === stepIdx ? cl.accentLight : cl.dot;
      c.fill();
    }
  }

  // ── State & render ────────────────────────────────────────────
  let stepIdx = 0;
  let playing = false;
  let timer   = null;

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawMatrix(ctx, STEPS[stepIdx]);
    drawAnnotation(ctx, STEPS[stepIdx]);
    drawProgress(ctx);
    wrap.querySelector('#sgCounter').textContent = `${stepIdx + 1} / ${STEPS.length}`;
    wrap.querySelector('#sgPrev').disabled = stepIdx === 0;
    wrap.querySelector('#sgNext').disabled = stepIdx === STEPS.length - 1;
  }

  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }

  function stopPlay() {
    playing = false;
    clearInterval(timer);
    wrap.querySelector('#sgPlay').textContent = '▶ Play';
  }

  function startPlay() {
    if (stepIdx >= STEPS.length - 1) goTo(0);
    playing = true;
    wrap.querySelector('#sgPlay').textContent = '⏸ Pause';
    timer = setInterval(() => {
      if (stepIdx >= STEPS.length - 1) { stopPlay(); return; }
      goTo(stepIdx + 1);
    }, 1800);
  }

  // ── Controls ──────────────────────────────────────────────────
  wrap.querySelector('#sgPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx - 1); });
  wrap.querySelector('#sgNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx + 1); });
  wrap.querySelector('#sgPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  new MutationObserver(render).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
  );

  render();
}
