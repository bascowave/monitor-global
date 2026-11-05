// Mapa-múndi em SVG (projeção equiretangular). Sem dependências.
const W = 1000;
const H = 500;

const project = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

function ringToPath(ring) {
  return ring.map((pt, i) => {
    const [x, y] = project(pt);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join('') + 'Z';
}

function geometryToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.map((poly) => poly.map(ringToPath).join('')).join('');
}

const SVGNS = 'http://www.w3.org/2000/svg';

export function drawCountries(svg, geojson) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'countries');
  for (const f of geojson.features) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', geometryToPath(f.geometry));
    p.setAttribute('data-name', f.properties?.NAME || '');
    g.appendChild(p);
  }
  svg.appendChild(g);
}

// markers: [{ lat, lon, label, severity: 'alta'|'media'|'baixa', clientes? }]
export function drawMarkers(svg, markers) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'markers');
  for (const m of markers) {
    const [x, y] = project([m.lon, m.lat]);
    const c = document.createElementNS(SVGNS, 'circle');
    const r = m.clientes ? Math.min(14, 4 + Math.log10(m.clientes + 1) * 2) : 5;
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', r.toFixed(1));
    c.setAttribute('class', 'marker ' + (m.severity || 'media'));
    const t = document.createElementNS(SVGNS, 'title');
    t.textContent = m.label || '';
    c.appendChild(t);
    g.appendChild(c);
  }
  svg.appendChild(g);
}

export { W, H, project };
