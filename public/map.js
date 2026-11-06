// Mapa-múndi em SVG (projeção equiretangular). Sem dependências.
const W = 1000;
const H = 500;
const SVGNS = 'http://www.w3.org/2000/svg';

const project = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

function ringToPath(ring) {
  return ring.map((pt, i) => {
    const [x, y] = project(pt);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join('') + 'Z';
}

export function geometryToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.map((poly) => poly.map(ringToPath).join('')).join('');
}

// Brilho para os pontos (estilo do exemplo).
export function addDefs(svg) {
  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML = `
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);
}

// fillFor(ISO-2) -> cor CSS. Padrão: fundo neutro.
export function drawCountries(svg, geojson, fillFor = () => null, onSelect = null) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'countries');
  for (const f of geojson.features) {
    const name = f.properties?.NAME || '';
    const iso = f.properties?.ISO_A2 === '-99' ? f.properties?.ISO_A2_EH : f.properties?.ISO_A2;
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', geometryToPath(f.geometry));
    p.setAttribute('data-name', name);
    p.setAttribute('data-country', iso || '');
    const fill = fillFor(iso);
    if (fill) p.setAttribute('style', `fill:${fill}`);
    if (onSelect && iso && iso !== '-99') interactive(p, name || iso, () => onSelect({ country: iso }));
    g.appendChild(p);
  }
  svg.appendChild(g);
}

// Agrupa por célula de ~2°, mantendo camadas e precisões separadas.
// Clientes e MW permanecem métricas distintas; não somamos unidades diferentes.
export function clusterMarkers(markers) {
  const groups = new Map();
  const rank = { baixa: 0, media: 1, alta: 2 };
  for (const m of markers) {
    const key = `${m.kind}:${m.precisao === 'pais' ? m.country : ''}:${m.precisao === 'pais'}:${Math.floor((m.lon + 180) / 2)}:${Math.floor((m.lat + 90) / 2)}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...m, lat: 0, lon: 0, clientes: 0, mw: 0, severity: 'baixa', count: 0, labels: [], items: [] };
      groups.set(key, group);
    }
    group.lat += m.lat; group.lon += m.lon; group.count++;
    group.clientes += Math.max(0, Number(m.clientes) || 0);
    group.mw += Math.max(0, Number(m.mw) || 0);
    group.items.push(m);
    group.labels.push(m.label || '');
    if ((rank[m.severity] ?? 0) > rank[group.severity]) group.severity = m.severity;
  }
  return [...groups.values()].map((g) => ({ ...g, lat: g.lat / g.count, lon: g.lon / g.count,
    label: `${g.count > 1 ? `${g.count} ×\n` : ''}${g.labels.join('\n')}` }));
}

export function drawMarkers(svg, markers, onSelect = null, scale = 1) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'markers');
  g.setAttribute('filter', 'url(#glow)');
  for (const m of clusterMarkers(markers)) {
    const [x, y] = project([m.lon, m.lat]);
    const c = document.createElementNS(SVGNS, 'circle');
    const metric = m.mw || m.clientes;
    const r = (metric ? Math.min(14, 4 + Math.log10(metric + 1) * 2) : 5) * (m.precisao === 'pais' ? 0.65 : 1);
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', (r * scale).toFixed(1));
    c.setAttribute('data-count', m.count);
    c.setAttribute('class', `marker ${m.severity || 'baixa'}${m.precisao === 'pais' ? ' marker-pais' : ''}${m.kind === 'disaster' ? ' marker-disaster' : ''}`);
    const t = document.createElementNS(SVGNS, 'title');
    t.textContent = m.label;
    c.appendChild(t);
    if (onSelect) interactive(c, m.label, () => onSelect({ items: m.items }));
    g.appendChild(c);
  }
  svg.appendChild(g);
}

// Escala de cor pelo número de apagões por país (0 = fundo neutro).
export function heatColor(count, max) {
  if (!count || !max) return null;
  const t = Math.min(1, count / max);
  const a = 0.25 + 0.6 * t;
  return `rgba(241, 66, 66, ${a.toFixed(2)})`;
}

export { W, H, project };

function interactive(element, label, activate) {
  element.setAttribute('tabindex', '0');
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', activate);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
  });
}
export function drawStates(svg, geojson, onSelect, selected) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'states');
  for (const f of geojson.features) {
    const p = document.createElementNS(SVGNS, 'path');
    const { country, state, name } = f.properties;
    p.setAttribute('d', geometryToPath(f.geometry));
    p.setAttribute('data-state', state);
    p.setAttribute('class', selected === state ? 'selected' : '');
    interactive(p, `${name} (${state})`, () => onSelect({ country, state }));
    g.appendChild(p);
  }
  svg.appendChild(g);
}
