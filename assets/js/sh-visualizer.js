/**
 * sh-visualizer.js — Interactive 3D Spherical Harmonic basis function viewer.
 *
 * Renders all 16 real SH basis functions used in 3DGS (l=0..3) as 3D polar
 * plots using a single Three.js renderer with multiple scissored viewports.
 * Click any function to select it — the bottom panel shows it larger with
 * auto-orbit and a description linking back to the 3DGS use case.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── SH evaluation (3DGS Cartesian convention) ────────────────────────────────
// Unit vector (x,y,z): x=sinθcosφ, y=sinθsinφ, z=cosθ

function evalSH(l, m, x, y, z) {
  if (l === 0) return 0.28209479177387814;
  if (l === 1) {
    if (m === -1) return -0.4886025119029199 * y;
    if (m ===  0) return  0.4886025119029199 * z;
    if (m ===  1) return -0.4886025119029199 * x;
  }
  if (l === 2) {
    if (m === -2) return  1.0925484305920792 * x * y;
    if (m === -1) return -1.0925484305920792 * y * z;
    if (m ===  0) return  0.31539156525252005 * (2*z*z - x*x - y*y);
    if (m ===  1) return -1.0925484305920792 * x * z;
    if (m ===  2) return  0.5462742152960396 * (x*x - y*y);
  }
  if (l === 3) {
    if (m === -3) return -0.5900435899266435 * y * (3*x*x - y*y);
    if (m === -2) return  2.890611442640554  * x * y * z;
    if (m === -1) return -0.4570457994644658 * y * (4*z*z - x*x - y*y);
    if (m ===  0) return  0.3731763325901154 * z * (2*z*z - 3*x*x - 3*y*y);
    if (m ===  1) return -0.4570457994644658 * x * (4*z*z - x*x - y*y);
    if (m ===  2) return  1.4453057213903607 * z * (x*x - y*y);
    if (m ===  3) return -0.5900435899266435 * x * (x*x - 3*y*y);
  }
  return 0;
}

// ── Descriptions ─────────────────────────────────────────────────────────────

const SH_INFO = {
  '0,0':  { name: 'Y₀⁰ — DC term',           desc: 'Constant on the entire sphere — the view-independent base color. In 3DGS, the three f_dc coefficients (one per RGB channel) scale this function. SH_C0 ≈ 0.2821 is its normalization constant. This is the only term used in the .splat binary format.' },
  '1,-1': { name: 'Y₁⁻¹ — y-dipole',         desc: 'Linear brightness gradient along Y. Positive in the +Y hemisphere, negative in −Y. Enables a Gaussian to appear brighter from one side — modeling diffuse illumination from a roughly horizontal light source.' },
  '1,0':  { name: 'Y₁⁰ — z-dipole',          desc: 'Linear gradient along Z (up/down). Positive at the north pole, negative at the south. Captures sky-vs-ground lighting — essential for outdoor scenes where ambient sky and ground bounce have different colors.' },
  '1,1':  { name: 'Y₁¹ — x-dipole',          desc: 'Linear gradient along X (left/right). Together with Y₁⁻¹ and Y₁⁰, the three l=1 functions span all first-order view-dependent color effects — equivalent to a Lambertian BRDF in SH form.' },
  '2,-2': { name: 'Y₂⁻² — xy quadrupole',    desc: 'Four lobes at 45° in the equatorial XY plane. Captures lighting from diagonal horizontal directions, e.g. a window at the corner of a room illuminating a wall at an angle.' },
  '2,-1': { name: 'Y₂⁻¹ — yz quadrupole',    desc: 'Four lobes in the YZ plane. Enables the Gaussian\'s color to depend on the up-back vs down-forward viewing angle — modeling glossy reflections with a vertical tilt component.' },
  '2,0':  { name: 'Y₂⁰ — axial quadrupole',  desc: 'Rotationally symmetric: positive at both poles, negative in the equatorial belt. Models surfaces that appear bright from above/below but dark from the side — characteristic of metallic or convex objects.' },
  '2,1':  { name: 'Y₂¹ — xz quadrupole',     desc: 'Four lobes in the XZ plane. Together the five l=2 functions can represent simple specular highlights with an arbitrary orientation and moderate angular sharpness.' },
  '2,2':  { name: 'Y₂² — equatorial quadrupole', desc: 'Four lobes aligned with the X and Y axes in the equatorial plane. Captures the difference in reflectance along two perpendicular horizontal directions — e.g., different specular responses for X vs Y.' },
  '3,-3': { name: 'Y₃⁻³ — y-hexapole',       desc: 'Six alternating lobes in the equatorial plane (oriented toward ±Y diagonals). The l=3 functions enable sharp specular highlights. SOGS int8 quantization of these fine-detail terms introduces ≤ 1/128 error per coefficient — perceptually negligible.' },
  '3,-2': { name: 'Y₃⁻² — xyz term',         desc: 'Lobes along triaxial diagonal directions. Captures complex three-way lighting interactions. One of 7 l=3 basis functions that together occupy 21 of the 45 AC SH coefficients per Gaussian.' },
  '3,-1': { name: 'Y₃⁻¹',                    desc: 'High-frequency variation emphasizing one hemisphere. Enables realistic near-field illumination effects and subtle color variations that depend on the precise viewing elevation.' },
  '3,0':  { name: 'Y₃⁰ — axial octupole',    desc: 'Rotationally symmetric with alternating bands along Z: positive axis, negative ring, positive ring, negative poles. Models bright polar highlights with concentric dark rings — common in specular and metallic materials.' },
  '3,1':  { name: 'Y₃¹',                     desc: 'Symmetric to Y₃⁻¹ rotated about Z. Together with neighboring l=3 terms, enables arbitrary third-order view-dependent color — sufficient to represent most real-world non-Lambertian surfaces at typical 3DGS reconstruction distances.' },
  '3,2':  { name: 'Y₃² — elevated quadrupole', desc: 'Four-fold equatorial variation modulated by height. Captures specular highlights that shift position with viewing elevation — important for surfaces with anisotropic reflectance.' },
  '3,3':  { name: 'Y₃³ — x-hexapole',        desc: 'Six alternating lobes oriented toward ±X. The highest-frequency SH function in standard 3DGS (l=3 max). Fine-detail view-dependent color — the last to become perceptible as SH degree increases.' },
};

// ── Geometry builder ─────────────────────────────────────────────────────────

function buildSHMesh(l, m, N = 52) {
  const positions = [];
  const colors    = [];
  const indices   = [];

  // Find max |value| for normalisation
  let maxAbs = 0;
  for (let ti = 0; ti <= N; ti++) {
    const theta = (ti / N) * Math.PI;
    for (let pi = 0; pi <= N; pi++) {
      const phi = (pi / N) * 2 * Math.PI;
      const sx = Math.sin(theta) * Math.cos(phi);
      const sy = Math.sin(theta) * Math.sin(phi);
      const sz = Math.cos(theta);
      const v = Math.abs(evalSH(l, m, sx, sy, sz));
      if (v > maxAbs) maxAbs = v;
    }
  }
  if (maxAbs < 1e-10) maxAbs = 1;

  for (let ti = 0; ti <= N; ti++) {
    const theta = (ti / N) * Math.PI;
    for (let pi = 0; pi <= N; pi++) {
      const phi = (pi / N) * 2 * Math.PI;
      const sx = Math.sin(theta) * Math.cos(phi);
      const sy = Math.sin(theta) * Math.sin(phi);
      const sz = Math.cos(theta);
      const v  = evalSH(l, m, sx, sy, sz);
      const r  = Math.abs(v) / maxAbs;
      // Map math (x,y,z) → Three.js (x,z,−y) so SH north pole (z=1) points up
      positions.push(r * sx, r * sz, -r * sy);
      const pos = v >= 0;
      colors.push(pos ? 0.15 : 0.82, pos ? 0.76 : 0.13, pos ? 0.15 : 0.13);
    }
  }

  for (let ti = 0; ti < N; ti++) {
    for (let pi = 0; pi < N; pi++) {
      const a = ti * (N + 1) + pi;
      const b = a + (N + 1);
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    shininess: 35,
  });
  return new THREE.Mesh(geo, mat);
}

function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.85);
  d1.position.set(2, 3, 2);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.25);
  d2.position.set(-2, -1, -2);
  scene.add(d2);
}

// ── Exported initialiser ─────────────────────────────────────────────────────

export function initSHVisualizer(container) {
  // Build DOM
  container.innerHTML = `
    <div class="sh-viz-wrap">
      <div class="sh-viz-header">
        <span class="sh-viz-title">Real Spherical Harmonic Basis Functions</span>
        <span class="sh-viz-subtitle">3DGS uses <em>l</em> = 0 … 3 &nbsp;·&nbsp; 16 functions &nbsp;·&nbsp; 3 RGB channels = 48 SH coefficients per Gaussian &nbsp;·&nbsp; Click any function to explore</span>
      </div>
      <div class="sh-viz-body">
        <div class="sh-viz-m-labels" id="sh-m-labels"></div>
        <div class="sh-viz-grid-wrap" id="sh-grid-wrap">
          <div class="sh-viz-row-labels" id="sh-row-labels"></div>
          <canvas class="sh-viz-canvas" id="sh-canvas"></canvas>
        </div>
        <div class="sh-viz-detail" id="sh-detail">
          <div class="sh-detail-lm"    id="sh-d-lm">l = 0, m = 0</div>
          <div class="sh-detail-name"  id="sh-d-name">Y₀⁰ — DC term</div>
          <div class="sh-detail-desc"  id="sh-d-desc">Click any basis function above to see its description and 3DGS interpretation.</div>
        </div>
      </div>
    </div>`;

  const canvas       = container.querySelector('#sh-canvas');
  const rowLabelsEl  = container.querySelector('#sh-row-labels');
  const detailLm     = container.querySelector('#sh-d-lm');
  const detailName   = container.querySelector('#sh-d-name');
  const detailDesc   = container.querySelector('#sh-d-desc');

  // ── Renderer ────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false;

  // ── Build 16 grid views ─────────────────────────────────────────
  const ALL_LM = [];
  for (let l = 0; l <= 3; l++)
    for (let m = -l; m <= l; m++)
      ALL_LM.push({ l, m });

  const gridViews = ALL_LM.map(({ l, m }) => {
    const scene  = new THREE.Scene();
    addLights(scene);
    const mesh   = buildSHMesh(l, m);
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(1.3, 1.0, 2.4);
    camera.lookAt(0, 0, 0);
    return { l, m, scene, camera, mesh };
  });

  // ── Selected view (larger, orbit-controlled) ────────────────────
  const selScene  = new THREE.Scene();
  addLights(selScene);
  const selCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  selCamera.position.set(1.5, 1.2, 2.8);
  selCamera.lookAt(0, 0, 0);
  let selMesh = null;

  const selOrbit = new OrbitControls(selCamera, canvas);
  selOrbit.enablePan  = false;
  selOrbit.enableZoom = false;
  selOrbit.autoRotate = true;
  selOrbit.autoRotateSpeed = 1.2;

  // ── Layout ──────────────────────────────────────────────────────
  const GAP     = 7;
  const LABEL_W = 34;
  const SEL_H   = 210;

  let canvasW = 0, canvasH = 0, cellSize = 0;
  let viewRects = [];
  let selRect   = { left: 0, top: 0, w: SEL_H, h: SEL_H };

  function reflow() {
    canvasW  = canvas.parentElement.clientWidth - LABEL_W;
    cellSize = Math.max(56, Math.min(84, Math.floor((canvasW - 6 * GAP) / 7)));

    // Grid row positions (y from top of canvas)
    const rowY = [0, 1, 2, 3].map(l => GAP + l * (cellSize + GAP));
    const gridH = GAP + 4 * (cellSize + GAP);

    viewRects = [];
    for (let l = 0; l <= 3; l++) {
      const count = 2 * l + 1;
      const rowW  = count * cellSize + (count - 1) * GAP;
      const startX = (canvasW - rowW) / 2;
      for (let m = -l; m <= l; m++) {
        const col = m + l;
        viewRects.push({
          left: startX + col * (cellSize + GAP),
          top:  rowY[l],
          w: cellSize, h: cellSize,
        });
      }
    }

    // Selected view centered below grid
    const selW = Math.min(SEL_H, canvasW * 0.5);
    selRect = {
      left: (canvasW - selW) / 2,
      top:  gridH + GAP * 2,
      w: selW, h: selW,
    };

    canvasH = selRect.top + selRect.h + GAP * 2;

    renderer.setSize(canvasW, canvasH);
    canvas.style.width  = canvasW + 'px';
    canvas.style.height = canvasH + 'px';

    // Row labels (HTML, left of canvas)
    rowLabelsEl.style.width  = LABEL_W + 'px';
    rowLabelsEl.style.height = canvasH + 'px';
    rowLabelsEl.innerHTML = '';
    for (let l = 0; l <= 3; l++) {
      const div = document.createElement('div');
      div.className   = 'sh-row-label';
      div.textContent = `l=${l}`;
      div.style.top   = (rowY[l] + cellSize / 2 - 8) + 'px';
      rowLabelsEl.appendChild(div);
    }

    // Update camera aspect for selected view
    selCamera.aspect = selRect.w / selRect.h;
    selCamera.updateProjectionMatrix();
  }

  // ── Selection state ─────────────────────────────────────────────
  let selectedIdx = 0;

  function selectView(idx) {
    selectedIdx = idx;
    const { l, m } = ALL_LM[idx];
    const key  = `${l},${m}`;
    const info = SH_INFO[key] ?? {};
    const mStr = m > 0 ? `+${m}` : String(m);

    detailLm.textContent   = `l = ${l},  m = ${mStr}`;
    detailName.textContent = info.name ?? `Y${l}^${m}`;
    detailDesc.textContent = info.desc ?? '';

    if (selMesh) selScene.remove(selMesh);
    selMesh = buildSHMesh(l, m);
    selScene.add(selMesh);
  }

  // ── Mouse interaction ────────────────────────────────────────────
  function canvasCoords(e) {
    const r  = canvas.getBoundingClientRect();
    const sx = canvasW  / r.width;
    const sy = canvasH / r.height;
    return { mx: (e.clientX - r.left) * sx, my: (e.clientY - r.top) * sy };
  }

  function hitTest(mx, my) {
    for (let i = 0; i < viewRects.length; i++) {
      const r = viewRects[i];
      if (mx >= r.left && mx <= r.left + r.w && my >= r.top && my <= r.top + r.h)
        return i;
    }
    return -1;
  }

  // Restrict OrbitControls to selRect area
  let orbitPointerDown = false;
  canvas.addEventListener('pointerdown', (e) => {
    const { mx, my } = canvasCoords(e);
    const inSel = mx >= selRect.left && mx <= selRect.left + selRect.w &&
                  my >= selRect.top  && my <= selRect.top  + selRect.h;
    orbitPointerDown = inSel;
    selOrbit.enabled = inSel;
  });
  canvas.addEventListener('pointerup',    () => { orbitPointerDown = false; selOrbit.enabled = true; });
  canvas.addEventListener('pointerleave', () => { orbitPointerDown = false; selOrbit.enabled = true; });

  canvas.addEventListener('click', (e) => {
    const { mx, my } = canvasCoords(e);
    const idx = hitTest(mx, my);
    if (idx >= 0) selectView(idx);
  });

  canvas.addEventListener('mousemove', (e) => {
    const { mx, my } = canvasCoords(e);
    canvas.style.cursor = hitTest(mx, my) >= 0 ? 'pointer' : 'default';
  });

  // ── Render loop ──────────────────────────────────────────────────
  let rotAngle = 0;
  let rafId    = null;

  const BG_DARK = new THREE.Color(0x111418);
  const BG_SEL  = new THREE.Color(0x0d1a10);
  const BG_HI   = new THREE.Color(0x141f14);

  function animate() {
    if (!canvas.isConnected) return;   // auto-stop when page navigates away
    rafId = requestAnimationFrame(animate);
    rotAngle += 0.006;

    renderer.setScissorTest(false);
    renderer.setClearColor(BG_DARK, 1);
    renderer.setViewport(0, 0, canvasW, canvasH);
    renderer.clear(true, true, false);

    renderer.setScissorTest(true);

    // Grid viewports
    for (let i = 0; i < gridViews.length; i++) {
      const v  = gridViews[i];
      const r  = viewRects[i];
      if (!r) continue;

      const vpY = canvasH - r.top - r.h;
      renderer.setViewport(r.left, vpY, r.w, r.h);
      renderer.setScissor( r.left, vpY, r.w, r.h);

      v.camera.aspect = r.w / r.h;
      v.camera.updateProjectionMatrix();
      v.mesh.rotation.y = rotAngle;

      if (i === selectedIdx) {
        renderer.setClearColor(BG_HI, 1);
        renderer.clear(true, true, false);
      }

      renderer.render(v.scene, v.camera);
    }

    // Selected view
    {
      const r   = selRect;
      const vpY = canvasH - r.top - r.h;
      renderer.setViewport(r.left, vpY, r.w, r.h);
      renderer.setScissor( r.left, vpY, r.w, r.h);
      renderer.setClearColor(BG_SEL, 1);
      renderer.clear(true, true, false);

      selOrbit.update();
      renderer.render(selScene, selCamera);
    }
  }

  // ── Start ────────────────────────────────────────────────────────
  reflow();
  selectView(0);
  animate();

  const ro = new ResizeObserver(() => reflow());
  ro.observe(container);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    ro.disconnect();
    selOrbit.dispose();
    renderer.dispose();
  };
}
