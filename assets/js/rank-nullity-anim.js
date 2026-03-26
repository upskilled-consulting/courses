// Rank-Nullity animation for r5
// Example: A = [[1,2,0,1],[2,4,1,1]] → row reduce → highlight pivot/free columns

export function initRankNullityAnimation(container) {
  const W = 540, H = 280;
  const DPR = window.devicePixelRatio || 1;

  const STEPS = [
    {
      matrix: [[1,2,0,1],[2,4,1,1]],
      pivotRow: -1, changed: [], pivotCols: [], freeCols: [],
      label: 'Set up A — find which columns become pivot columns',
      ops: [], badge: null,
    },
    {
      matrix: [[1,2,0,1],[2,4,1,1]],
      pivotRow: 0, changed: [], pivotCols: [], freeCols: [],
      label: 'Row 1 is the pivot — eliminate below it',
      ops: ['−2ρ₁ + ρ₂  →  ρ₂'], badge: null,
    },
    {
      matrix: [[1,2,0,1],[0,0,1,-1]],
      pivotRow: -1,
      changed: [[1,0],[1,1],[1,2],[1,3]],
      pivotCols: [], freeCols: [],
      label: 'Echelon form — two pivots, two free variables',
      ops: [], badge: null,
    },
    {
      matrix: [[1,2,0,1],[0,0,1,-1]],
      pivotRow: -1, changed: [], pivotCols: [0,2], freeCols: [],
      label: 'Pivot columns: x₁ and x₃  —  rank(A) = 2',
      ops: [], badge: null,
    },
    {
      matrix: [[1,2,0,1],[0,0,1,-1]],
      pivotRow: -1, changed: [], pivotCols: [], freeCols: [1,3],
      label: 'Free columns: x₂ and x₄  —  nullity(A) = 2',
      ops: [], badge: null,
    },
    {
      matrix: [[1,2,0,1],[0,0,1,-1]],
      pivotRow: -1, changed: [], pivotCols: [0,2], freeCols: [1,3],
      label: 'Every column is pivot or free — none left over',
      ops: [], badge: 'rank + nullity = 2 + 2 = 4 = n  ✓',
    },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="rnPrev" aria-label="Previous step">‹</button>
      <span class="gauss-step-counter" id="rnCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="rnNext" aria-label="Next step">›</button>
      <button class="gauss-btn gauss-play-btn" id="rnPlay">▶ Play</button>
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

  // ── Layout ─────────────────────────────────────────────────────
  const CELL_W = 68, CELL_H = 52;
  const ROWS = 2, COLS = 4;
  const GRID_W = COLS * CELL_W;
  const GRID_H = ROWS * CELL_H;
  const BRACK  = 18;
  const LEFT_PAD = 22;
  const MAT_W = LEFT_PAD + GRID_W + LEFT_PAD;
  const MAT_X = (W - MAT_W) / 2;
  const MAT_Y = 52;

  function colX(c) { return MAT_X + LEFT_PAD + c * CELL_W + CELL_W / 2; }
  function rowY(r) { return MAT_Y + r * CELL_H + CELL_H / 2; }

  function colors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text:         light ? '#1a202c'               : '#e2e8f0',
      muted:        light ? '#94a3b8'               : '#4a5568',
      accentLight:  '#63aac9',
      pivotBg:      light ? 'rgba(23,118,164,0.10)' : 'rgba(23,118,164,0.18)',
      changedText:  light ? '#0d7490'               : '#52ab97',
      changedBg:    light ? 'rgba(13,116,144,0.10)' : 'rgba(82,171,151,0.12)',
      pivotColBg:   light ? 'rgba(23,118,164,0.13)' : 'rgba(99,170,201,0.18)',
      pivotColText: light ? '#17579e'               : '#63aac9',
      freeColBg:    light ? 'rgba(217,119,6,0.11)'  : 'rgba(251,191,36,0.14)',
      freeColText:  light ? '#b45309'               : '#fbbf24',
      dot:          light ? '#d1d5db'               : '#263348',
      badge:        '#52ab97',
    };
  }

  function drawBrackets(c) {
    const cl = colors();
    const x1 = MAT_X + 6, x2 = MAT_X + MAT_W - 6;
    const y0 = MAT_Y + 4, y1 = MAT_Y + GRID_H - 4;
    c.strokeStyle = cl.text; c.lineWidth = 2; c.lineCap = 'square';
    c.beginPath(); c.moveTo(x1+BRACK,y0); c.lineTo(x1,y0); c.lineTo(x1,y1); c.lineTo(x1+BRACK,y1); c.stroke();
    c.beginPath(); c.moveTo(x2-BRACK,y0); c.lineTo(x2,y0); c.lineTo(x2,y1); c.lineTo(x2-BRACK,y1); c.stroke();
  }

  function drawHeaders(c) {
    const cl = colors();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    ['x₁','x₂','x₃','x₄'].forEach((h, col) => {
      const isPivot = STEPS[stepIdx].pivotCols.includes(col);
      const isFree  = STEPS[stepIdx].freeCols.includes(col);
      c.fillStyle = isPivot ? cl.pivotColText : isFree ? cl.freeColText : cl.muted;
      c.font = (isPivot||isFree) ? 'bold 12px system-ui, sans-serif' : '12px system-ui, sans-serif';
      c.fillText(h, colX(col), MAT_Y - 16);
    });
  }

  function isChanged(r, col, changed) { return changed.some(([cr,cc]) => cr===r && cc===col); }

  function drawMatrix(c, step) {
    const cl = colors();
    const { matrix, pivotRow, changed, pivotCols, freeCols } = step;

    // Column backgrounds
    pivotCols.forEach(col => {
      const cx = MAT_X + LEFT_PAD + col * CELL_W;
      c.fillStyle = cl.pivotColBg;
      c.beginPath();
      if (c.roundRect) c.roundRect(cx+3, MAT_Y+3, CELL_W-6, GRID_H-6, 4);
      else c.rect(cx+3, MAT_Y+3, CELL_W-6, GRID_H-6);
      c.fill();
    });
    freeCols.forEach(col => {
      const cx = MAT_X + LEFT_PAD + col * CELL_W;
      c.fillStyle = cl.freeColBg;
      c.beginPath();
      if (c.roundRect) c.roundRect(cx+3, MAT_Y+3, CELL_W-6, GRID_H-6, 4);
      else c.rect(cx+3, MAT_Y+3, CELL_W-6, GRID_H-6);
      c.fill();
    });

    // Row pivot highlight
    if (pivotRow >= 0) {
      c.fillStyle = cl.pivotBg;
      const rx = MAT_X+LEFT_PAD-4, ry = MAT_Y+pivotRow*CELL_H+4;
      c.beginPath();
      if (c.roundRect) c.roundRect(rx, ry, GRID_W+8, CELL_H-8, 6);
      else c.rect(rx, ry, GRID_W+8, CELL_H-8);
      c.fill();
    }

    drawBrackets(c); drawHeaders(c);
    c.textAlign = 'center'; c.textBaseline = 'middle';

    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const val = matrix[r][col];
        const cx  = colX(col), cy = rowY(r);
        const chg = isChanged(r, col, changed);
        if (chg) {
          c.fillStyle = cl.changedBg;
          c.beginPath();
          if (c.roundRect) c.roundRect(cx-CELL_W/2+4, cy-CELL_H/2+6, CELL_W-8, CELL_H-12, 4);
          else c.rect(cx-CELL_W/2+4, cy-CELL_H/2+6, CELL_W-8, CELL_H-12);
          c.fill();
        }
        let color;
        if      (chg)                    color = cl.changedText;
        else if (pivotCols.includes(col)) color = cl.pivotColText;
        else if (freeCols.includes(col))  color = cl.freeColText;
        else if (r === pivotRow)          color = cl.accentLight;
        else if (val === 0)               color = cl.muted;
        else                              color = cl.text;
        c.fillStyle = color;
        c.font = `${Math.abs(val)>=10||val<0?15:18}px 'Courier New', monospace`;
        c.fillText(String(val), cx, cy);
      }
    }
  }

  function drawLegend(c, step) {
    if (!step.pivotCols.length && !step.freeCols.length) return;
    const cl = colors();
    const y = MAT_Y - 30;
    let x = W/2 - 90;
    if (step.pivotCols.length) {
      c.fillStyle = cl.pivotColBg; c.fillRect(x, y, 14, 13);
      c.strokeStyle = cl.pivotColText; c.lineWidth = 1; c.strokeRect(x, y, 14, 13);
      c.font = '11px system-ui, sans-serif'; c.fillStyle = cl.pivotColText;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('pivot column', x+18, y+6.5);
      x += 110;
    }
    if (step.freeCols.length) {
      c.fillStyle = cl.freeColBg; c.fillRect(x, y, 14, 13);
      c.strokeStyle = cl.freeColText; c.lineWidth = 1; c.strokeRect(x, y, 14, 13);
      c.font = '11px system-ui, sans-serif'; c.fillStyle = cl.freeColText;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('free column', x+18, y+6.5);
    }
  }

  function drawAnnotation(c, step) {
    const cl = colors();
    const { label, ops, badge } = step;
    const y0 = MAT_Y + GRID_H + 22;
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.font = '13px system-ui, sans-serif'; c.fillStyle = cl.text;
    c.fillText(label, W/2, y0);
    ops.forEach((op, i) => {
      c.font = '13px "Courier New", monospace'; c.fillStyle = cl.accentLight;
      c.fillText(op, W/2, y0+22+i*20);
    });
    if (badge) {
      c.font = 'bold 20px system-ui, sans-serif';
      c.fillStyle = cl.badge;
      c.fillText(badge, W/2, y0+22);
    }
  }

  function drawProgress(c) {
    const cl = colors();
    const r=4, gap=10, totalW=STEPS.length*(r*2+gap)-gap;
    const x0=(W-totalW)/2, y=H-12;
    for (let i=0; i<STEPS.length; i++) {
      c.beginPath(); c.arc(x0+i*(r*2+gap)+r, y, r, 0, Math.PI*2);
      c.fillStyle = i===stepIdx ? cl.accentLight : cl.dot; c.fill();
    }
  }

  let stepIdx=0, playing=false, timer=null;

  function render() {
    ctx.clearRect(0,0,W,H);
    drawMatrix(ctx, STEPS[stepIdx]);
    drawLegend(ctx, STEPS[stepIdx]);
    drawAnnotation(ctx, STEPS[stepIdx]);
    drawProgress(ctx);
    wrap.querySelector('#rnCounter').textContent = `${stepIdx+1} / ${STEPS.length}`;
    wrap.querySelector('#rnPrev').disabled = stepIdx===0;
    wrap.querySelector('#rnNext').disabled = stepIdx===STEPS.length-1;
  }
  function goTo(i) { stepIdx=Math.max(0,Math.min(STEPS.length-1,i)); render(); }
  function stopPlay() { playing=false; clearInterval(timer); wrap.querySelector('#rnPlay').textContent='▶ Play'; }
  function startPlay() {
    if (stepIdx>=STEPS.length-1) goTo(0);
    playing=true; wrap.querySelector('#rnPlay').textContent='⏸ Pause';
    timer=setInterval(() => { if (stepIdx>=STEPS.length-1){stopPlay();return;} goTo(stepIdx+1); }, 1800);
  }

  wrap.querySelector('#rnPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx-1); });
  wrap.querySelector('#rnNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx+1); });
  wrap.querySelector('#rnPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });
  new MutationObserver(render).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  render();
}
