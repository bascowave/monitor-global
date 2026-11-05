import { drawCountries, drawMarkers } from './map.js';

const T = {
  pt: { brand: 'Monitor global', eyebrow: 'Atualizado a partir das fontes oficiais', title: 'Incidentes no mundo, com fonte e data', mapTitle: 'Mapa de apagões', mapHint: 'Pontos = apagões com localização informada pela fonte. Cor = gravidade; tamanho = clientes afetados. Ciberataques não têm local e aparecem só na lista.', mapEmpty: 'Nenhum apagão com localização ainda. Fontes de apagões pendentes.', tabAll: 'Tudo', tabCyber: 'Ciberataques', tabPower: 'Apagões', footer: 'Cada item mostra a fonte original. Itens "a confirmar" ainda não foram verificados por fonte oficial.', kind: { cyber: 'Ciberataque', power: 'Apagão' }, st: { confirmado: 'confirmado', a_confirmar: 'a confirmar', reportado: 'reportado' }, updated: 'Coletado em', none: 'Nenhum item ainda.', fonte: 'Fonte', ransom: 'ligado a ransomware', due: 'prazo de correção', clientes: 'clientes afetados' },
  en: { brand: 'Global monitor', eyebrow: 'Updated from official sources', title: 'Incidents worldwide, with source and date', mapTitle: 'Blackout map', mapHint: 'Dots = outages with a location given by the source. Colour = severity; size = customers affected. Cyberattacks have no location and appear only in the list.', mapEmpty: 'No located blackouts yet. Blackout sources pending.', tabAll: 'All', tabCyber: 'Cyberattacks', tabPower: 'Blackouts', footer: 'Each item shows its original source. "To confirm" items are not yet verified by an official source.', kind: { cyber: 'Cyberattack', power: 'Blackout' }, st: { confirmado: 'confirmed', a_confirmar: 'to confirm', reportado: 'reported' }, updated: 'Collected at', none: 'No items yet.', fonte: 'Source', ransom: 'linked to ransomware', due: 'fix due', clientes: 'customers affected' },
  es: { brand: 'Monitor global', eyebrow: 'Actualizado desde fuentes oficiales', title: 'Incidentes en el mundo, con fuente y fecha', mapTitle: 'Mapa de apagones', mapHint: 'Puntos = apagones con ubicación informada por la fuente. Color = gravedad; tamaño = clientes afectados. Los ciberataques no tienen ubicación y aparecen solo en la lista.', mapEmpty: 'Aún no hay apagones con ubicación. Fuentes de apagones pendientes.', tabAll: 'Todo', tabCyber: 'Ciberataques', tabPower: 'Apagones', footer: 'Cada elemento muestra su fuente original. Los elementos "por confirmar" aún no han sido verificados por una fuente oficial.', kind: { cyber: 'Ciberataque', power: 'Apagón' }, st: { confirmado: 'confirmado', a_confirmar: 'por confirmar', reportado: 'reportado' }, updated: 'Recopilado el', none: 'Aún no hay elementos.', fonte: 'Fuente', ransom: 'vinculado a ransomware', due: 'plazo de corrección', clientes: 'clientes afectados' },
};
let lang = (navigator.language || 'pt').slice(0, 2);
if (!T[lang]) lang = 'pt';
let filter = 'all';
let data = { items: [], errors: [] };
let countries = null;

const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const fmt = (iso) => new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T[lang][el.dataset.i18n] ?? el.textContent; });
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

function renderMap() {
  const svg = document.getElementById('map');
  svg.innerHTML = '';
  if (countries) drawCountries(svg, countries);
  const markers = (data.items || []).filter((i) => i.kind === 'power' && Number.isFinite(i.lat) && Number.isFinite(i.lon))
    .map((i) => ({ lat: i.lat, lon: i.lon, label: i.title, severity: i.severity, clientes: i.clientes }));
  if (markers.length) drawMarkers(svg, markers);
  document.getElementById('maphint').textContent = markers.length ? T[lang].mapHint : T[lang].mapEmpty;
}

function render() {
  const items = (data.items || []).filter((i) => filter === 'all' || i.kind === filter);
  document.getElementById('feed').innerHTML = items.length ? items.map((i) => `
    <li class="card">
      <span class="badge ${esc(i.kind)}">${esc(T[lang].kind[i.kind] || i.kind)}</span>
      <span class="badge ${esc(i.status)}">${esc(T[lang].st[i.status] || i.status)}</span>
      <h2>${esc(i.title)}</h2>
      <div class="src">${esc(T[lang].fonte)}: <a href="${esc(i.sourceUrl)}" rel="noopener" target="_blank">${esc(i.source)}</a> · ${esc(fmt(i.publishedAt))} · ${esc(i.region)}${i.ransomware ? ' · ' + esc(T[lang].ransom) : ''}${i.dueAt ? ' · ' + esc(T[lang].due) + ' ' + esc(fmt(i.dueAt)) : ''}</div>
    </li>`).join('') : `<li class="card">${esc(T[lang].none)}</li>`;
  document.getElementById('meta').textContent = data.collectedAt ? `${T[lang].updated} ${fmt(data.collectedAt)}` : '';
  document.getElementById('errors').textContent = (data.errors || []).map((e) => `${e.source}: ${e.message}`).join(' · ');
}

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; applyI18n(); render(); renderMap(); }));
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  render();
}));

applyI18n();
Promise.all([
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson').then((r) => r.json()).catch(() => null),
  fetch('/api/incidents').then((r) => r.json()),
]).then(([geo, d]) => {
  countries = geo;
  data = d;
  render();
  renderMap();
}).catch(() => { document.getElementById('errors').textContent = 'erro ao carregar'; });
