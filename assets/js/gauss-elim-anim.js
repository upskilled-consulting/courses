export function initGaussElimAnimation(container) {
  const W = 540, H = 290;
  const DPR = window.devicePixelRatio || 1;

  // ── Step definitions ──────────────────────────────────────────
  const STEPS = [
    {
      matrix: [[1,1,1,6],[2,1,-1,1],[1,-1,2,5]],
      pivotRow: -1, changed: [],
      label: 'Augmented matrix  [A | b]',
      ops: [],
    },
    {
      matrix: [[1,1,1,6],[2,1,-1,1],[1,-1,2,5]],
      pivotRow: 0, changed: [],
      label: 'Row 1 is the pivot — eliminate entries below it',
      ops: ['−2ρ₁ + ρ₂  →  ρ₂', '−ρ₁ + ρ₃  →  ρ₃'],
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,-2,1,-1]],
      pivotRow: -1,
      changed: [[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3]],
      label: 'Column 1 cleared below the pivot',
      ops: [],
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,-2,1,-1]],
      pivotRow: 1, changed: [],
      label: 'Row 2 is the new pivot — eliminate entry below it',
      ops: ['−2ρ₂ + ρ₃  →  ρ₃'],
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,0,7,21]],
      pivotRow: -1,
      changed: [[2,1],[2,2],[2,3]],
      label: 'Echelon form — ready for back-substitution',
      ops: [],
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,0,7,21]],
      pivotRow: 2, changed: [],
      label: 'Row 3 :  7z = 21',
      ops: [], solve: 'z = 3',
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,0,7,21]],
      pivotRow: 1, changed: [],
      label: 'Row 2 :  −y − 3(3) = −11',
      ops: [], solve: 'y = 2',
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,0,7,21]],
      pivotRow: 0, changed: [],
      label: 'Row 1 :  x + 2 + 3 = 6',
      ops: [], solve: 'x = 1',
    },
    {
      matrix: [[1,1,1,6],[0,-1,-3,-11],[0,0,7,21]],
      pivotRow: -1, changed: [],
      label: 'Solution',
      ops: [], solution: '(x, y, z) = (1, 2, 3)',
    },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="gPrev" aria-label="Previous step">‹</button>
      <span class="gauss-step-counter" id="gCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="gNext" aria-label="Next step">›</button>
      <button class="gauss-btn gauss-play-btn" id="gPlay">▶ Play</button>
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
  const CELL_W = 58, CELL_H = 52;
  const ROWS = 3, COLS = 4;
  const SEP_GAP = 28;               // extra gap before RHS column
  const GRID_W  = 3 * CELL_W + SEP_GAP + CELL_W;  // 174 + 28 + 58 = 260
  const GRID_H  = ROWS * CELL_H;   // 156
  const BRACK   = 18;               // bracket arm width
  const LEFT_PAD = 22;              // space left of cell 0
  const MAT_W = LEFT_PAD + GRID_W + LEFT_PAD;
  const MAT_X = (W - MAT_W) / 2;
  const MAT_Y = 34;                 // leave room for column headers

  function colX(c) {
    // centre of column c
    const extra = c >= 3 ? SEP_GAP : 0;
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
    // [
    c.beginPath();
    c.moveTo(x1 + BRACK, y0); c.lineTo(x1, y0);
    c.lineTo(x1, y1);
    c.lineTo(x1 + BRACK, y1);
    c.stroke();
    // ]
    c.beginPath();
    c.moveTo(x2 - BRACK, y0); c.lineTo(x2, y0);
    c.lineTo(x2, y1);
    c.lineTo(x2 - BRACK, y1);
    c.stroke();
  }

  function drawSeparator(c) {
    const cl = colors();
    const sepX = MAT_X + LEFT_PAD + 3 * CELL_W + SEP_GAP / 2;
    c.strokeStyle = cl.sep;
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(sepX, MAT_Y + 6);
    c.lineTo(sepX, MAT_Y + GRID_H - 6);
    c.stroke();
    c.setLineDash([]);
  }

  function drawHeaders(c) {
    const cl = colors();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = cl.muted;
    c.font = '12px system-ui, sans-serif';
    const headers = ['x', 'y', 'z', 'b'];
    for (let col = 0; col < 4; col++) {
      c.fillText(headers[col], colX(col), MAT_Y - 14);
    }
  }

  function isChanged(r, col, changed) {
    return changed.some(([cr, cc]) => cr === r && cc === col);
  }

  function drawMatrix(c, step) {
    const cl = colors();
    const { matrix, pivotRow, changed } = step;

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

    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const val = matrix[r][col];
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

        let color;
        if (chg) {
          color = cl.changedText;
        } else if (r === pivotRow) {
          color = cl.accentLight;
        } else if (val === 0 && col < 3) {
          color = cl.muted;
        } else {
          color = cl.text;
        }

        const txt = String(val);
        c.fillStyle = color;
        c.font = `${Math.abs(val) >= 10 || val < 0 ? 15 : 18}px 'Courier New', monospace`;
        c.fillText(txt, cx, cy);
      }
    }
  }

  function drawAnnotation(c, step) {
    const cl = colors();
    const { label, ops, solve, solution } = step;
    const y0 = MAT_Y + GRID_H + 20;

    c.textAlign = 'center';
    c.textBaseline = 'top';

    // Label
    c.font = '13px system-ui, sans-serif';
    c.fillStyle = cl.text;
    c.fillText(label, W / 2, y0);

    // Operations
    ops.forEach((op, i) => {
      c.font = '13px "Courier New", monospace';
      c.fillStyle = cl.accentLight;
      c.fillText(op, W / 2, y0 + 22 + i * 20);
    });

    // Back-sub result
    if (solve) {
      c.font = 'bold 22px system-ui, sans-serif';
      c.fillStyle = cl.solution;
      c.fillText(solve, W / 2, y0 + 22);
    }

    // Final solution
    if (solution) {
      c.font = 'bold 20px system-ui, sans-serif';
      c.fillStyle = cl.solution;
      c.fillText(solution, W / 2, y0 + 22);
    }
  }

  function drawProgress(c) {
    const cl = colors();
    const r = 4, gap = 10;
    const totalW = STEPS.length * (r * 2 + gap) - gap;
    const x0 = (W - totalW) / 2;
    const y  = H - 12;
    for (let i = 0; i < STEPS.length; i++) {
      c.beginPath();
      c.arc(x0 + i * (r * 2 + gap) + r, y, r, 0, Math.PI * 2);
      c.fillStyle = i === stepIdx ? cl.accentLight : cl.dot;
      c.fill();
    }
  }

  // ── State & render ────────────────────────────────────────────
  let stepIdx  = 0;
  let playing  = false;
  let timer    = null;

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawMatrix(ctx, STEPS[stepIdx]);
    drawAnnotation(ctx, STEPS[stepIdx]);
    drawProgress(ctx);
    wrap.querySelector('#gCounter').textContent = `${stepIdx + 1} / ${STEPS.length}`;
    wrap.querySelector('#gPrev').disabled = stepIdx === 0;
    wrap.querySelector('#gNext').disabled = stepIdx === STEPS.length - 1;
  }

  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }

  function stopPlay() {
    playing = false;
    clearInterval(timer);
    wrap.querySelector('#gPlay').textContent = '▶ Play';
  }

  function startPlay() {
    if (stepIdx >= STEPS.length - 1) goTo(0);
    playing = true;
    wrap.querySelector('#gPlay').textContent = '⏸ Pause';
    timer = setInterval(() => {
      if (stepIdx >= STEPS.length - 1) { stopPlay(); return; }
      goTo(stepIdx + 1);
    }, 1800);
  }

  // ── Controls ──────────────────────────────────────────────────
  wrap.querySelector('#gPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx - 1); });
  wrap.querySelector('#gNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx + 1); });
  wrap.querySelector('#gPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  // Re-render on theme change
  new MutationObserver(render).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
  );

  render();
}
