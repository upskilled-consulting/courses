/**
 * densification-anim.js
 *
 * Animated Canvas 2D illustrations for Gaussian cloning and splitting.
 * Each canvas draws Gaussian blobs as radial-gradient "splats" and
 * animates the densification operation on loop.
 */

const CYCLE = 6000; // ms per full loop

// ── Easing ──────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function invlerp(a, b, v) { return clamp((v - a) / (b - a), 0, 1); }
function phase(t, start, end) { return easeInOut(invlerp(start, end, t)); }

// ── Drawing helpers ─────────────────────────────────────────────

function drawGaussian(ctx, x, y, rx, ry, alpha, r, g, b) {
  if (alpha <= 0.01 || rx < 0.5 || ry < 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.8);
  grd.addColorStop(0,    `rgba(${r},${g},${b},${alpha})`);
  grd.addColorStop(0.45, `rgba(${r},${g},${b},${alpha * 0.45})`);
  grd.addColorStop(0.75, `rgba(${r},${g},${b},${alpha * 0.12})`);
  grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
  ctx.beginPath();
  ctx.arc(0, 0, rx * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.restore();
}

function drawGradientArrow(ctx, x, y, pulseFactor, r, g, b) {
  const len   = 18 + pulseFactor * 6;
  const alpha = 0.45 + pulseFactor * 0.55;
  const tip   = y - 8 - len;
  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillStyle   = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, tip + 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 5, tip + 8);
  ctx.lineTo(x,     tip);
  ctx.lineTo(x + 5, tip + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx, text, x, y, r, g, b, alpha = 0.55) {
  ctx.save();
  ctx.font         = `500 10px Inter, system-ui, sans-serif`;
  ctx.fillStyle    = `rgba(${r},${g},${b},${alpha})`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Draw two lines of label text, bottom-anchored (yBottom = top of lower line)
function drawLabel2(ctx, line1, line2, x, yBottom, r, g, b, alpha = 0.55) {
  const lineH = 13;
  drawLabel(ctx, line1, x, yBottom - lineH, r, g, b, alpha);
  drawLabel(ctx, line2, x, yBottom,         r, g, b, alpha);
}

// Arrow from (x1,y1) to (x2,y2), clearing Gaussian edge and target ring
function drawArrowBetween(ctx, x1, y1, x2, y2, startOffset, endOffset, alpha, r, g, b) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;
  const ux = dx / dist, uy = dy / dist;
  const perpX = -uy, perpY = ux;
  const sx = x1 + ux * startOffset, sy = y1 + uy * startOffset;
  const ex = x2 - ux * endOffset,   ey = y2 - uy * endOffset;
  const hs = 7; // head size
  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillStyle   = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex - ux * hs, ey - uy * hs);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex + ux * hs * 0.4, ey + uy * hs * 0.4);
  ctx.lineTo(ex - ux * hs + perpX * hs * 0.7, ey - uy * hs + perpY * hs * 0.7);
  ctx.lineTo(ex - ux * hs - perpX * hs * 0.7, ey - uy * hs - perpY * hs * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTarget(ctx, x, y, radius, alpha, tr, tg, tb) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${tr},${tg},${tb},${0.22 * alpha})`;
  ctx.fill();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = `rgba(${tr},${tg},${tb},${0.85 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Gradient concept animation ───────────────────────────────────
//  t 0.00–0.22  Gaussian + target fade in, labels appear
//  t 0.22–0.55  residual halo blooms, arrow fades in
//  t 0.55–0.80  arrow pulses, "high ∂L/∂μ" label
//  t 0.80–1.00  hold

function drawGradientConcept(ctx, W, H, t, r, g, b) {
  ctx.clearRect(0, 0, W, H);
  const gx = W * 0.30, gy = H * 0.52; // Gaussian position
  const tx = W * 0.78, ty = H * 0.47; // target position
  const R  = 19;
  const [tr, tg, tb] = [255, 165, 55]; // amber for target / residual

  // Shared: residual halo + gaussian + target + arrow + labels at different alphas
  function draw(haloA, blobA, arrowA, topLabelA, botLabelA) {
    // Residual halo around target
    if (haloA > 0.01) {
      const grd = ctx.createRadialGradient(tx, ty, 0, tx, ty, 30);
      grd.addColorStop(0,   `rgba(${tr},${tg},${tb},${0.38 * haloA})`);
      grd.addColorStop(0.5, `rgba(${tr},${tg},${tb},${0.16 * haloA})`);
      grd.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(tx, ty, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    drawGaussian(ctx, gx, gy, R, R * 0.82, 0.60 * blobA, r, g, b);
    drawTarget(ctx, tx, ty, 11, blobA, tr, tg, tb);
    if (arrowA > 0.01) {
      drawArrowBetween(ctx, gx, gy, tx, ty, 36, 15, arrowA, r, g, b);
    }
    if (topLabelA > 0.01) {
      drawLabel(ctx, 'photometric residual', W / 2, 4, tr, tg, tb, topLabelA * 0.60);
    }
    if (botLabelA > 0.01) {
      drawLabel2(ctx, 'high \u2202L/\u2202\u03bc', 'signals under-coverage', W / 2, H - 18, r, g, b, botLabelA * 0.60);
    }
  }

  if (t < 0.22) {
    const fade = phase(t, 0, 0.18);
    draw(0, fade, 0, 0, 0);
    drawLabel(ctx, 'Gaussian \u03bc', gx, gy + R * 0.82 + 5, r, g, b, fade * 0.45);
    drawLabel(ctx, 'target region', tx, ty + 15, tr, tg, tb, fade * 0.45);
  } else if (t < 0.55) {
    const p = phase(t, 0.22, 0.50);
    draw(p, 1, p, p, 0);
  } else if (t < 0.80) {
    const pulse = 0.72 + Math.sin(t * Math.PI * 5) * 0.28;
    draw(pulse, 1, pulse, 1, phase(t, 0.55, 0.72));
  } else {
    draw(0.85, 1, 0.88, 1, 1);
  }
}

// ── Clone animation ─────────────────────────────────────────────
//  t 0.00–0.25  single Gaussian, pulsing ∇ arrow
//  t 0.25–0.45  brighten/pulse (about to clone)
//  t 0.45–0.70  two copies drift apart from origin
//  t 0.70–1.00  hold settled state

function drawClone(ctx, W, H, t, r, g, b) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 8;
  const R  = 24;

  if (t < 0.25) {
    const pulse = Math.sin(t * Math.PI / 0.25) * 0.5 + 0.5;
    drawGaussian(ctx, cx, cy, R, R, 0.68, r, g, b);
    drawGradientArrow(ctx, cx, cy - R, pulse, r, g, b);
    drawLabel(ctx, 'high positional gradient', cx, 4, r, g, b, 0.45 + pulse * 0.25);
  } else if (t < 0.45) {
    const p    = phase(t, 0.25, 0.45);
    const glow = lerp(0.68, 1.0, p);
    drawGaussian(ctx, cx, cy, R, R, glow, r, g, b);
    drawGradientArrow(ctx, cx, cy - R, 1, r, g, b);
    drawLabel(ctx, 'high positional gradient', cx, 4, r, g, b, 0.7);
  } else if (t < 0.70) {
    const p   = phase(t, 0.45, 0.70);
    const off = lerp(0, 32, p);
    const op  = lerp(1.0, 0.66, p);
    drawGaussian(ctx, cx - off, cy - off * 0.35, R * 0.88, R * 0.88, op, r, g, b);
    drawGaussian(ctx, cx + off, cy + off * 0.35, R * 0.88, R * 0.88, op, r, g, b);
  } else {
    drawGaussian(ctx, cx - 32, cy - 11, R * 0.88, R * 0.88, 0.66, r, g, b);
    drawGaussian(ctx, cx + 32, cy + 11, R * 0.88, R * 0.88, 0.66, r, g, b);
    const fade = phase(t, 0.72, 0.90);
    drawLabel2(ctx, 'two copies —', 'converge to different positions', cx, H - 18, r, g, b, fade * 0.55);
  }
}

// ── Split animation ─────────────────────────────────────────────
//  t 0.00–0.25  large Gaussian, pulsing ∇ arrow
//  t 0.25–0.45  Gaussian stretches horizontally (elongates)
//  t 0.45–0.70  elongated blob splits into two smaller ones
//  t 0.70–1.00  hold settled

function drawSplit(ctx, W, H, t, r, g, b) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 8;
  const R  = 34, Rsmall = 21;

  if (t < 0.25) {
    const pulse = Math.sin(t * Math.PI / 0.25) * 0.5 + 0.5;
    drawGaussian(ctx, cx, cy, R, R * 0.72, 0.50, r, g, b);
    drawGradientArrow(ctx, cx, cy - R * 0.72, pulse, r, g, b);
    drawLabel(ctx, 'high positional gradient', cx, 4, r, g, b, 0.45 + pulse * 0.25);
  } else if (t < 0.45) {
    const p  = phase(t, 0.25, 0.45);
    const rx = lerp(R,        R * 1.7,   p);
    const ry = lerp(R * 0.72, R * 0.28,  p);
    drawGaussian(ctx, cx, cy, rx, ry, lerp(0.50, 0.42, p), r, g, b);
    drawGradientArrow(ctx, cx, cy - ry, 1, r, g, b);
    drawLabel(ctx, 'high positional gradient', cx, 4, r, g, b, 0.7);
  } else if (t < 0.70) {
    const p   = phase(t, 0.45, 0.70);
    const off = lerp(0, 40, p);
    const rx  = lerp(R * 1.7 * 0.7, Rsmall, p);
    const ry  = lerp(R * 0.28 + off * 0.22, Rsmall, p);
    const op  = lerp(0.42, 0.66, p);
    drawGaussian(ctx, cx - off, cy, rx, ry, op, r, g, b);
    drawGaussian(ctx, cx + off, cy, rx, ry, op, r, g, b);
  } else {
    drawGaussian(ctx, cx - 40, cy, Rsmall, Rsmall, 0.66, r, g, b);
    drawGaussian(ctx, cx + 40, cy, Rsmall, Rsmall, 0.66, r, g, b);
    const fade = phase(t, 0.72, 0.90);
    drawLabel(ctx, 'two smaller Gaussians — finer coverage', cx, H - 16, r, g, b, fade * 0.55);
  }
}

// ── Public init ─────────────────────────────────────────────────

export function initDensificationAnimation(canvas, type) {
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.clientWidth  || 260;
  const displayH = canvas.clientHeight || 120;
  canvas.width  = displayW * dpr;
  canvas.height = displayH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = displayW, H = displayH;

  // Read accent / success / warning colour from CSS variables
  function parseColor(hex) {
    const h = hex.replace(/[^0-9a-f]/gi, '');
    if (h.length < 6) return [100, 130, 250];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  const style = getComputedStyle(document.documentElement);
  const colorVar = type === 'clone'    ? '--success'
                 : type === 'gradient' ? '--accent'
                 :                       '--accent';
  const [r, g, b] = parseColor(style.getPropertyValue(colorVar).trim());

  let animId = null, t0 = null;

  function frame(ts) {
    if (!t0) t0 = ts;
    const t = ((ts - t0) % CYCLE) / CYCLE;
    if      (type === 'clone')    drawClone(ctx, W, H, t, r, g, b);
    else if (type === 'gradient') drawGradientConcept(ctx, W, H, t, r, g, b);
    else                          drawSplit(ctx, W, H, t, r, g, b);
    animId = requestAnimationFrame(frame);
  }

  // Only animate while visible — pause otherwise
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        if (!animId) { t0 = null; animId = requestAnimationFrame(frame); }
      } else {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
      }
    });
  }, { threshold: 0.1 });

  observer.observe(canvas);
}
