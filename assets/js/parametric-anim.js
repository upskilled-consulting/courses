// Animation for r2: reading the parametric solution from an echelon form matrix.
// Shows pivot/free column identification and assembly of x = p + s·v₁ + t·v₂.
// Matrix: [1 2 0 1|3 ; 0 0 1 -1|2 ; 0 0 0 0|0]

export function initParametricAnimation(container) {
  const W = 540, H = 290;
  const DPR = window.devicePixelRatio || 1;

  const MATRIX      = [[1,2,0,1,3],[0,0,1,-1,2],[0,0,0,0,0]];
  const COL_HEADS   = ['x₁','x₂','x₃','x₄','b'];
  const PIVOT_COLS  = [0, 2];
  const FREE_COLS   = [1, 3];

  // ── Steps ─────────────────────────────────────────────────────
  const STEPS = [
    { pivotCols:[], freeCols:[], hlRow:-1, params:false, vectors:false,
      label:'Echelon form — identify pivot and free variables' },
    { pivotCols:[0,2], freeCols:[], hlRow:-1, params:false, vectors:false,
      label:'Pivot columns (●): x₁ and x₃ are pivot variables' },
    { pivotCols:[0,2], freeCols:[1,3], hlRow:-1, params:false, vectors:false,
      label:'Free columns (○): x₂ and x₄ are free — no pivot constrains them' },
    { pivotCols:[0,2], freeCols:[1,3], hlRow:0, params:false, vectors:false,
      label:'Row 1:  x₁ + 2x₂ + x₄ = 3  →  x₁ = 3 − 2x₂ − x₄' },
    { pivotCols:[0,2], freeCols:[1,3], hlRow:1, params:false, vectors:false,
      label:'Row 2:  x₃ − x₄ = 2  →  x₃ = 2 + x₄' },
    { pivotCols:[0,2], freeCols:[1,3], hlRow:-1, params:true, vectors:false,
      label:'Assign free parameters:  x₂ = s,  x₄ = t  (any real values)' },
    { pivotCols:[], freeCols:[], hlRow:-1, params:false, vectors:true,
      label:'Parametric form:  x = p + s · v₁ + t · v₂' },
  ];

  // ── DOM scaffold ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'gauss-anim-wrap';
  wrap.innerHTML = `
    <canvas class="gauss-canvas"></canvas>
    <div class="gauss-controls">
      <button class="gauss-btn" id="pvPrev" aria-label="Previous">‹</button>
      <span class="gauss-step-counter" id="pvCounter">1 / ${STEPS.length}</span>
      <button class="gauss-btn" id="pvNext" aria-label="Next">›</button>
      <button class="gauss-btn gauss-play-btn" id="pvPlay">▶ Play</button>
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
      text:       light ? '#1a202c' : '#e2e8f0',
      muted:      light ? '#94a3b8' : '#4a5568',
      pivotBg:    light ? 'rgba(23,118,164,0.11)'  : 'rgba(23,118,164,0.16)',
      pivotText:  '#63aac9',
      freeBg:     light ? 'rgba(217,119,6,0.09)'   : 'rgba(251,191,36,0.11)',
      freeText:   light ? '#b45309' : '#fbbf24',
      hlRowBg:    light ? 'rgba(99,170,201,0.14)'  : 'rgba(99,170,201,0.17)',
      sep:        light ? '#cbd5e1' : '#2d3f55',
      dot:        light ? '#d1d5db' : '#263348',
      accentLight:'#63aac9',
      pColor:     '#63aac9',
      v1Color:    light ? '#b45309' : '#fbbf24',
      v2Color:    light ? '#9a3412' : '#fb923c',
    };
  }

  // ── Matrix layout ─────────────────────────────────────────────
  const CELL_W = 48, CELL_H = 50;
  const SEP_GAP = 28, L_PAD = 20;
  const MAT_W = L_PAD + 4 * CELL_W + SEP_GAP + CELL_W + L_PAD; // 308
  const MAT_X = Math.round((W - MAT_W) / 2);
  const MAT_Y = 32;
  const GRID_H = 3 * CELL_H;   // 150
  const SEP_X  = MAT_X + L_PAD + 4 * CELL_W + SEP_GAP / 2;

  function colX(c) {
    return MAT_X + L_PAD + c * CELL_W + (c >= 4 ? SEP_GAP : 0) + CELL_W / 2;
  }
  function rowY(r) { return MAT_Y + r * CELL_H + CELL_H / 2; }

  // ── Draw matrix view ──────────────────────────────────────────
  function drawMatrix(c, step) {
    const cl = colors();
    const { pivotCols, freeCols, hlRow, params } = step;

    // Column backgrounds
    for (let col = 0; col < 4; col++) {
      const bx = colX(col) - CELL_W / 2 + 2;
      if (pivotCols.includes(col)) {
        c.fillStyle = cl.pivotBg;
        c.fillRect(bx, MAT_Y + 2, CELL_W - 4, GRID_H - 4);
      } else if (freeCols.includes(col)) {
        c.fillStyle = cl.freeBg;
        c.fillRect(bx, MAT_Y + 2, CELL_W - 4, GRID_H - 4);
      }
    }

    // Row highlight
    if (hlRow >= 0) {
      c.fillStyle = cl.hlRowBg;
      c.fillRect(MAT_X + L_PAD - 4, MAT_Y + hlRow * CELL_H + 3,
                 4 * CELL_W + SEP_GAP + CELL_W + 8, CELL_H - 6);
    }

    // Brackets
    const arm = 12;
    const bx1 = MAT_X + 5, bx2 = MAT_X + MAT_W - 5;
    const by1 = MAT_Y + 3, by2 = MAT_Y + GRID_H - 3;
    c.strokeStyle = cl.text;
    c.lineWidth   = 2;
    c.lineCap     = 'square';
    c.beginPath();
    c.moveTo(bx1 + arm, by1); c.lineTo(bx1, by1); c.lineTo(bx1, by2); c.lineTo(bx1 + arm, by2);
    c.stroke();
    c.beginPath();
    c.moveTo(bx2 - arm, by1); c.lineTo(bx2, by1); c.lineTo(bx2, by2); c.lineTo(bx2 - arm, by2);
    c.stroke();

    // Separator
    c.strokeStyle = cl.sep;
    c.lineWidth   = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(SEP_X, MAT_Y + 5); c.lineTo(SEP_X, MAT_Y + GRID_H - 5);
    c.stroke();
    c.setLineDash([]);

    // Column headers
    c.font         = '11px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    for (let col = 0; col < 5; col++) {
      c.fillStyle = pivotCols.includes(col) ? cl.pivotText
                  : freeCols.includes(col)  ? cl.freeText
                  : cl.muted;
      c.fillText(COL_HEADS[col], colX(col), MAT_Y - 3);
    }

    // Cell values
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 5; col++) {
        const val = MATRIX[r][col];
        let color;
        if (val === 0) {
          color = cl.muted;
        } else if (col < 4 && pivotCols.includes(col)) {
          color = cl.pivotText;
        } else if (col < 4 && freeCols.includes(col)) {
          color = cl.freeText;
        } else {
          color = cl.text;
        }
        c.fillStyle = color;
        c.font = `${val < 0 || Math.abs(val) >= 10 ? 15 : 17}px 'Courier New', monospace`;
        c.fillText(String(val), colX(col), rowY(r));
      }
    }

    // Parameter labels (step 5: = s and = t below free columns)
    if (params) {
      c.font         = 'italic 13px system-ui, sans-serif';
      c.textAlign    = 'center';
      c.textBaseline = 'top';
      c.fillStyle    = cl.freeText;
      c.fillText('= s', colX(1), MAT_Y + GRID_H + 5);
      c.fillText('= t', colX(3), MAT_Y + GRID_H + 5);
    }
  }

  // ── Vector equation layout ────────────────────────────────────
  const VC_H  = 28;   // cell height in column vector
  const VC_W  = 30;   // cell width (number area)
  const VC_BR = 10;   // bracket arm
  const VEC_W = VC_BR + VC_W + VC_BR;   // 50px per vector
  const VEC_H = 4 * VC_H;               // 112px

  // Horizontal layout: [rowLabel] [x =] [gap] [p] [+ s·] [v₁] [+ t·] [v₂]
  const RL_W  = 26, EQ_W = 32, EQ_G = 6, OP_W = 40;
  const TOT_W = RL_W + EQ_W + EQ_G + VEC_W + OP_W + VEC_W + OP_W + VEC_W;
  // = 26 + 32 + 6 + 50 + 40 + 50 + 40 + 50 = 294
  const EQ_LEFT = Math.round((W - TOT_W) / 2);   // = 123

  const RL_RIGHT  = EQ_LEFT + RL_W;               // right edge for row labels
  const EQ_CX     = EQ_LEFT + RL_W + EQ_W / 2;   // centre of "x ="
  const VP_LEFT   = EQ_LEFT + RL_W + EQ_W + EQ_G;
  const OP1_CX    = VP_LEFT + VEC_W + OP_W / 2;
  const V1_LEFT   = VP_LEFT + VEC_W + OP_W;
  const OP2_CX    = V1_LEFT + VEC_W + OP_W / 2;
  const V2_LEFT   = V1_LEFT + VEC_W + OP_W;

  // Vertical: centre vectors in the drawing area (H - 50px for annotation+dots)
  const VEC_TOP = Math.round((H - 50 - VEC_H) / 2) - 8;

  function drawColumnVec(c, vals, leftX, topY, clr) {
    const cl = colors();
    const bx1 = leftX + 1, bx2 = leftX + VEC_W - 1;
    const ty  = topY + 1,  by  = topY + VEC_H - 1;
    c.strokeStyle = cl.text;
    c.lineWidth   = 1.5;
    c.lineCap     = 'square';
    c.beginPath();
    c.moveTo(bx1 + VC_BR, ty); c.lineTo(bx1, ty); c.lineTo(bx1, by); c.lineTo(bx1 + VC_BR, by);
    c.stroke();
    c.beginPath();
    c.moveTo(bx2 - VC_BR, ty); c.lineTo(bx2, ty); c.lineTo(bx2, by); c.lineTo(bx2 - VC_BR, by);
    c.stroke();
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      c.fillStyle = v === 0 ? colors().muted : clr;
      c.font = `${v < 0 ? 14 : 15}px 'Courier New', monospace`;
      c.fillText(String(v), leftX + VC_BR + VC_W / 2, topY + i * VC_H + VC_H / 2);
    }
  }

  function drawVectorEquation(c) {
    const cl  = colors();
    const mid = VEC_TOP + VEC_H / 2;

    // Row labels
    c.font         = '11px system-ui, sans-serif';
    c.fillStyle    = cl.muted;
    c.textAlign    = 'right';
    c.textBaseline = 'middle';
    const rowNames = ['x₁','x₂','x₃','x₄'];
    for (let i = 0; i < 4; i++) {
      c.fillText(rowNames[i], RL_RIGHT - 3, VEC_TOP + i * VC_H + VC_H / 2);
    }

    // "x ="
    c.font         = '16px system-ui, sans-serif';
    c.fillStyle    = cl.text;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText('x =', EQ_CX, mid);

    // p vector + label
    drawColumnVec(c, [3, 0, 2, 0], VP_LEFT, VEC_TOP, cl.pColor);
    c.fillStyle    = cl.pColor;
    c.font         = '12px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.fillText('p', VP_LEFT + VEC_W / 2, VEC_TOP - 3);

    // "+ s ·"
    c.fillStyle    = cl.v1Color;
    c.font         = '15px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText('+ s ·', OP1_CX, mid);

    // v₁ vector + label
    drawColumnVec(c, [-2, 1, 0, 0], V1_LEFT, VEC_TOP, cl.v1Color);
    c.fillStyle    = cl.v1Color;
    c.font         = '12px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.fillText('v₁', V1_LEFT + VEC_W / 2, VEC_TOP - 3);

    // "+ t ·"
    c.fillStyle    = cl.v2Color;
    c.font         = '15px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText('+ t ·', OP2_CX, mid);

    // v₂ vector + label
    drawColumnVec(c, [-1, 0, 1, 1], V2_LEFT, VEC_TOP, cl.v2Color);
    c.fillStyle    = cl.v2Color;
    c.font         = '12px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'bottom';
    c.fillText('v₂', V2_LEFT + VEC_W / 2, VEC_TOP - 3);

    // "s, t ∈ ℝ" below
    c.fillStyle    = cl.muted;
    c.font         = '11px system-ui, sans-serif';
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    c.fillText('s, t ∈ ℝ', W / 2, VEC_TOP + VEC_H + 7);
  }

  // ── Shared chrome ─────────────────────────────────────────────
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
    const step = STEPS[stepIdx];
    if (step.vectors) {
      drawVectorEquation(ctx);
    } else {
      drawMatrix(ctx, step);
    }
    drawAnnotation(ctx, stepIdx);
    drawProgress(ctx, stepIdx);
    wrap.querySelector('#pvCounter').textContent = `${stepIdx + 1} / ${STEPS.length}`;
    wrap.querySelector('#pvPrev').disabled = stepIdx === 0;
    wrap.querySelector('#pvNext').disabled = stepIdx === STEPS.length - 1;
  }

  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
  }

  function stopPlay() {
    playing = false;
    clearInterval(playTimer);
    wrap.querySelector('#pvPlay').textContent = '▶ Play';
  }

  function startPlay() {
    if (stepIdx >= STEPS.length - 1) goTo(0);
    playing = true;
    wrap.querySelector('#pvPlay').textContent = '⏸ Pause';
    playTimer = setInterval(() => {
      if (stepIdx >= STEPS.length - 1) { stopPlay(); return; }
      goTo(stepIdx + 1);
    }, 1800);
  }

  // ── Controls ──────────────────────────────────────────────────
  wrap.querySelector('#pvPrev').addEventListener('click', () => { stopPlay(); goTo(stepIdx - 1); });
  wrap.querySelector('#pvNext').addEventListener('click', () => { stopPlay(); goTo(stepIdx + 1); });
  wrap.querySelector('#pvPlay').addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  new MutationObserver(render).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }
  );

  render();
}
