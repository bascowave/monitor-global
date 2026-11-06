// Zoom com roda do mouse e arrastar para mover, no SVG do mapa. Sem dependências.
const FULL = [0, 0, 1000, 500];
const MIN_W = 60;

function state(svg) {
  return svg.__pz || (svg.__pz = { base: FULL.slice(), cur: FULL.slice(), drag: null, moved: false });
}

function apply(svg, st) {
  svg.setAttribute('viewBox', st.cur.map((v) => v.toFixed(2)).join(' '));
}

// Mantém a largura entre MIN_W e a largura total, e a área dentro do mapa (com folga).
function clamp(st) {
  let [x, y, w] = st.cur;
  w = Math.max(MIN_W, Math.min(FULL[2], w));
  const h = w * FULL[3] / FULL[2];
  x = Math.max(FULL[0] - w * 0.1, Math.min(FULL[0] + FULL[2] - w * 0.9, x));
  y = Math.max(FULL[1] - h * 0.1, Math.min(FULL[1] + FULL[3] - h * 0.9, y));
  st.cur = [x, y, w, h];
}

// Define a vista base (mundo ou país/estado). Mantém a vista atual se a base não mudou.
export function setBaseView(svg, base) {
  const st = state(svg);
  const same = st.base.join() === base.join();
  st.base = base.slice();
  if (!same) st.cur = base.slice();
  apply(svg, st);
}

function zoomAt(svg, factor, cx, cy) {
  const st = state(svg);
  const [x, y, w, h] = st.cur;
  const nw = w * factor, nh = h * factor;
  const fx = (cx - x) / w, fy = (cy - y) / h;
  st.cur = [cx - fx * nw, cy - fy * nh, nw, nh];
  clamp(st);
  apply(svg, st);
}

export function zoomBy(svg, factor) {
  const [x, y, w, h] = state(svg).cur;
  zoomAt(svg, factor, x + w / 2, y + h / 2);
}

export function resetView(svg) {
  const st = state(svg);
  st.cur = st.base.slice();
  apply(svg, st);
}

export function enablePanZoom(svg) {
  if (svg.__pzInit) return;
  svg.__pzInit = true;
  const st = state(svg);
  const toSvg = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toSvg(e);
    zoomAt(svg, e.deltaY < 0 ? 0.85 : 1 / 0.85, p.x, p.y);
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    st.drag = { x: e.clientX, y: e.clientY, cur: st.cur.slice() };
    st.moved = false;
  });

  svg.addEventListener('pointermove', (e) => {
    if (!st.drag) return;
    const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
    if (!st.moved && Math.hypot(dx, dy) < 5) return;
    if (!st.moved) svg.setPointerCapture?.(e.pointerId);
    st.moved = true;
    const rect = svg.getBoundingClientRect();
    const s = st.drag.cur[2] / rect.width;
    st.cur = [st.drag.cur[0] - dx * s, st.drag.cur[1] - dy * s, st.drag.cur[2], st.drag.cur[3]];
    clamp(st);
    apply(svg, st);
  });

  const end = () => { st.drag = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  // Depois de arrastar, o clique que o navegador dispara não deve selecionar nada.
  svg.addEventListener('click', (e) => {
    if (st.moved) { e.stopPropagation(); e.preventDefault(); st.moved = false; }
  }, true);
}
