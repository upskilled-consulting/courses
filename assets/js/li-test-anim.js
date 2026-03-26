// Independence test animation for r4
// Example: are v1=(1,2,0)', v2=(0,1,1)', v3=(1,4,2)' linearly independent?
// Solve [A|0]: columns of A are v1,v2,v3; find all c with c1v1+c2v2+c3v3=0

export function initLITestAnimation(container) {
  const W = 540, H = 290;
  const DPR = window.devicePixelRatio || 1;

  const STEPS = [
    {
      matrix: [[1,0,1,0],[2,1,4,0],[0,1,2,0]],
      pivotRow: -1, changed: [],
      label: 'Set up [A | 0] — find all c₁,c₂,c₃ with c₁v₁ + c₂v₂ + c₃v₃ = 0',
      ops: [], solve: null, solution: null,
    },
    {
      matrix: [[1,0,1,0],[2,1,4,0],[0,1,2,0]],
      pivotRow: 0, changed: [],
      label: 'Row 1 is the pivot — eliminate below it',
      ops: ['−2ρ₁ + ρ₂  →  ρ₂'],
      solve: null, solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,1,2,0]],
      pivotRow: -1,
      changed: [[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
      label: 'Rows 2 and 3 are identical — one must become zero',
      ops: [], solve: null, solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,1,2,0]],
      pivotRow: 1, changed: [],
      label: 'Row 2 is the pivot — eliminate below it',
      ops: ['−ρ₂ + ρ₃  →  ρ₃'],
      solve: null, solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,0,0,0]],
      pivotRow: -1,
      changed: [[2,0],[2,1],[2,2],[2,3]],
      label: 'Row 3 vanishes → c₃ is a free variable → nontrivial solutions exist',
      ops: [], solve: null, solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,0,0,0]],
      pivotRow: 1, changed: [],
      label: 'Row 2:  c₂ + 2c₃ = 0',
      ops: [], solve: 'c₂ = −2c₃', solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,0,0,0]],
      pivotRow: 0, changed: [],
      label: 'Row 1:  c₁ + c₃ = 0',
      ops: [], solve: 'c₁ = −c₃', solution: null,
    },
    {
      matrix: [[1,0,1,0],[0,1,2,0],[0,0,0,0]],
      pivotRow: -1, changed: [],
      label: 'Set c₃ = 1 — nontrivial solution found',
      ops: [], solve: null, solution: 'v₃ = v₁ + 2v₂  — set is dependent',
    },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="liPrev" aria-label="Previous step">‹</button>
      <span class="gauss-step-counter" id="liCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="liNext" aria-label="Next step">›</button>
      <button class="gauss-btn gauss-play-btn" id="liPlay">▶ Play</button>
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

  // ── Layout (identical to gauss-elim-anim) ─────────────────────
  const CELL_W = 58, CELL_H = 52;
  const ROWS = 3, COLS = 4;
  const SEP_GAP = 28;
  const GRID_W  = 3 * CELL_W + SEP_GAP + CELL_W;
  const GRID_H  = ROWS * CELL_H;
  const BRACK   = 18;
  const LEFT_PAD = 22;
  const MAT_W = LEFT_PAD + GRID_W + LEFT_PAD;
  const MAT_X = (W - MAT_W) / 2;
  const MAT_Y = 34;

  function colX(c) {
    const extra = c >= 3 ? SEP_GAP : 0;
    return MAT_X + LEFT_PAD + c * CELL_W + extra + CELL_W / 2;
  }
  function rowY(r) { return MAT_Y + r * CELL_H + CELL_H / 2; }

  function colors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text:        light ? '#1a202c'               : '#e2e8f0',
      muted:       light ? '#94a3b8'               : '#4a5568',
      accentLight: '#63aac9',
      pivotBg:     light ? 'rgba(23,118,164,0.10)' : 'rgba(23,118,164,0.18)',
      changedText: light ? '#0d7490'               : '#52ab97',
      changedBg:   light ? 'rgba(13,116,144,0.10)' : 'rgba(82,171,151,0.12)',
      sep:         light ? '#cbd5e1'               : '#2d3f55',
      dot:         light ? '#d1d5db'               : '#263348',
      solution:    '#52ab97',
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

  function drawSeparator(c) {
    const cl = colors();
    const sepX = MAT_X + LEFT_PAD + 3*CELL_W + SEP_GAP/2;
    c.strokeStyle = cl.sep; c.lineWidth = 1.5;
    c.setLineDash([4,4]);
    c.beginPath(); c.moveTo(sepX, MAT_Y+6); c.lineTo(sepX, MAT_Y+GRID_H-6); c.stroke();
    c.setLineDash([]);
  }

  function drawHeaders(c) {
    const cl = colors();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = cl.muted; c.font = '12px system-ui, sans-serif';
    ['c₁','c₂','c₃','0'].forEach((h, col) => c.fillText(h, colX(col), MAT_Y - 14));
  }

  function isChanged(r, col, changed) { return changed.some(([cr,cc]) => cr===r && cc===col); }

  function drawMatrix(c, step) {
    const cl = colors();
    const { matrix, pivotRow, changed } = step;
    if (pivotRow >= 0) {
      c.fillStyle = cl.pivotBg;
      const rx = MAT_X+LEFT_PAD-4, ry = MAT_Y+pivotRow*CELL_H+4;
      c.beginPath();
      if (c.roundRect) c.roundRect(rx, ry, GRID_W+8, CELL_H-8, 6); else c.rect(rx, ry, GRID_W+8, CELL_H-8);
      c.fill();
    }
    drawBrackets(c); drawSeparator(c); drawHeaders(c);
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
        const color = chg ? cl.changedText : r===pivotRow ? cl.accentLight : (val===0 && col<3) ? cl.muted : cl.text;
        c.fillStyle = color;
        c.font = `${Math.abs(val)>=10||val<0?15:18}px 'Courier New', monospace`;
        c.fillText(String(val), cx, cy);
      }
    }
  }

  function drawAnnotation(c, step) {
    const cl = colors();
    const { label, ops, solve, solution } = step;
    const y0 = MAT_Y + GRID_H + 20;
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.font = '13px system-ui, sans-serif'; c.fillStyle = cl.text;
    c.fillText(label, W/2, y0);
    ops.forEach((op, i) => {
      c.font = '13px "Courier New", monospace'; c.fillStyle = cl.accentLight;
      c.fillText(op, W/2, y0+22+i*20);
    });
    if (solve) { c.font='bold 20px system-ui,sans-serif'; c.fillStyle=cl.solution; c.fillText(solve, W/2, y0+22); }
    if (solution) { c.font='bold 18px system-ui,sans-serif'; c.fillStyle=cl.solution; c.fillText(solution, W/2, y0+22); }
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
    drawAnnotation(ctx, STEPS[stepIdx]);
    drawProgress(ctx);
    wrap.querySelector('#liCounter').textContent = `${stepIdx+1} / ${STEPS.length}`;
    wrap.querySelector('#liPrev').disabled = stepIdx===0;
    wrap.querySelector('#liNext').disabled = stepIdx===STEPS.length-1;
  }
  function goTo(i) { stepIdx=Math.max(0,Math.min(STEPS.length-1,i)); render(); }
  function stopPlay() { playing=false; clearInterval(timer); wrap.querySelector('#liPlay').textContent='▶ Play'; }
  function startPlay() {
    if (stepIdx>=STEPS.length-1) goTo(0);
    playing=true; wrap.querySelector('#liPlay').textContent='⏸ Pause';
    timer=setInterval(() => { if (stepIdx>=STEPS.length-1){stopPlay();return;} goTo(stepIdx+1); }, 1800);
  }

  wrap.querySelector('#liPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx-1); });
  wrap.querySelector('#liNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx+1); });
  wrap.querySelector('#liPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });
  new MutationObserver(render).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  render();
}
