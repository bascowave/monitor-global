import { createLocalPanel } from './panel.js';
import { addDefs, drawCountries, drawMarkers, heatColor, drawStates } from './map.js';
import { enablePanZoom, setBaseView, zoomBy, resetView } from './panzoom.js';

const T = {
  pt: { disasters: 'Desastres', brand: 'Monitor global', share: 'Compartilhar', live: 'Ao vivo', title: 'Incidentes no mundo, com fonte e data', eyebrow: 'Atualizado a partir das fontes oficiais', sumTitle: 'Resumo', tabAll: 'Tudo', tabCyber: 'Ciberataques', tabPower: 'Apagões', mapTitle: 'Mapa de apagões', mapHint: 'Pontos agrupados por proximidade. Cor = gravidade; tamanho = MW ou clientes. Pontos menores e suaves = localização aproximada do país. Desastres em roxo são opcionais.', mapEmpty: 'Nenhum apagão localizado nesta coleta. Ative Desastres para ver os eventos naturais disponíveis.', feedTitle: 'Lista de incidentes', srcTitle: 'Fontes', navMap: 'Mapa', navList: 'Lista', navSrc: 'Fontes', footer: 'Cada item mostra a fonte original. Itens "a confirmar" ainda não foram verificados por fonte oficial.', kind: { cyber: 'Ciberataque', power: 'Apagão' }, st: { confirmado: 'confirmado', a_confirmar: 'a confirmar', reportado: 'reportado' }, updated: 'Coletado em', none: 'Nenhum item ainda.', fonte: 'Fonte', ransom: 'ligado a ransomware', due: 'prazo de correção', legAlta: 'Alta gravidade', legMedia: 'Média', legBaixa: 'Baixa', legCount: 'Apagões', srcNote: 'Fontes ativas: CISA KEV, Cloudflare Radar, IODA, ONS, ODIN, GDELT, USGS e GDACS. ENTSO-E ainda pendente.' },
  en: { disasters: 'Disasters', brand: 'Global monitor', share: 'Share', live: 'Live', title: 'Incidents worldwide, with source and date', eyebrow: 'Updated from official sources', sumTitle: 'Summary', tabAll: 'All', tabCyber: 'Cyberattacks', tabPower: 'Blackouts', mapTitle: 'Blackout map', mapHint: 'Nearby points are grouped. Colour = severity; size = MW or customers. Smaller, faded points = approximate country location. Optional disasters are purple.', mapEmpty: 'No located outages in this collection. Enable Disasters to see available natural events.', feedTitle: 'Incident list', srcTitle: 'Sources', navMap: 'Map', navList: 'List', navSrc: 'Sources', footer: 'Each item shows its original source. "To confirm" items are not yet verified by an official source.', kind: { cyber: 'Cyberattack', power: 'Blackout' }, st: { confirmado: 'confirmed', a_confirmar: 'to confirm', reportado: 'reported' }, updated: 'Collected at', none: 'No items yet.', fonte: 'Source', ransom: 'linked to ransomware', due: 'fix due', legAlta: 'High severity', legMedia: 'Medium', legBaixa: 'Low', legCount: 'Blackouts', srcNote: 'Active sources: CISA KEV, Cloudflare Radar, IODA, ONS, ODIN, GDELT, USGS and GDACS. ENTSO-E still pending.' },
  es: { disasters: 'Desastres', brand: 'Monitor global', share: 'Compartir', live: 'En vivo', title: 'Incidentes en el mundo, con fuente y fecha', eyebrow: 'Actualizado desde fuentes oficiales', sumTitle: 'Resumen', tabAll: 'Todo', tabCyber: 'Ciberataques', tabPower: 'Apagones', mapTitle: 'Mapa de apagones', mapHint: 'Puntos agrupados por proximidad. Color = gravedad; tamaño = MW o clientes. Puntos pequeños y suaves = ubicación aproximada del país. Desastres opcionales en morado.', mapEmpty: 'No hay apagones localizados en esta recopilación. Active Desastres para ver los eventos naturales disponibles.', feedTitle: 'Lista de incidentes', srcTitle: 'Fuentes', navMap: 'Mapa', navList: 'Lista', navSrc: 'Fuentes', footer: 'Cada elemento muestra su fuente original. Los elementos "por confirmar" aún no han sido verificados por una fuente oficial.', kind: { cyber: 'Ciberataque', power: 'Apagón' }, st: { confirmado: 'confirmado', a_confirmar: 'por confirmar', reportado: 'reportado' }, updated: 'Recopilado el', none: 'Aún no hay elementos.', fonte: 'Fuente', ransom: 'vinculado a ransomware', due: 'plazo de corrección', legAlta: 'Gravedad alta', legMedia: 'Media', legBaixa: 'Baja', legCount: 'Apagones', srcNote: 'Fuentes activas: CISA KEV, Cloudflare Radar, IODA, ONS, ODIN, GDELT, USGS y GDACS. ENTSO-E aún pendiente.' },
};
let lang = (navigator.language || 'pt').slice(0, 2);
if (!T[lang]) lang = 'pt';
let filter = 'power';
let data = { items: [], errors: [] };
let countries = null;

const localPanel = createLocalPanel({ getData: () => data, getLang: () => lang, onMapChange: renderMap });

const SOURCE_LINKS = [['CISA KEV', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'], ['Cloudflare Radar', 'https://radar.cloudflare.com/outage-center'], ['IODA', 'https://ioda.inetintel.cc.gatech.edu'], ['ONS', 'https://dados.ons.org.br/dataset/interrupcao_carga'], ['ODIN', 'https://odin.ornl.gov'], ['GDELT', 'https://www.gdeltproject.org'], ['USGS', 'https://earthquake.usgs.gov'], ['GDACS', 'https://www.gdacs.org']];

const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const fmt = (iso) => new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T[lang][el.dataset.i18n] ?? el.textContent; });
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.querySelectorAll('.pills button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
  document.getElementById('srclist').innerHTML = SOURCE_LINKS.map(([name, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${esc(name)}</a></li>`).join('') + `<li>${esc(T[lang].srcNote)}</li>`;
}

function counts() {
  const power = (data.items || []).filter((i) => i.kind === 'power');
  const cyber = (data.items || []).filter((i) => i.kind === 'cyber');
  return { power, cyber };
}

function renderSummary() {
  const { power, cyber } = counts();
  document.getElementById('cPower').textContent = power.length;
  document.getElementById('cCyber').textContent = cyber.length;
  const total = power.length + cyber.length;
  const p = total ? (power.length / total) * 100 : 50;
  document.getElementById('barPower').style.width = p + '%';
  document.getElementById('barCyber').style.width = (100 - p) + '%';
}

function renderMap() {
  const svg = document.getElementById('map');
  svg.innerHTML = '';
  addDefs(svg);
  const { power } = counts();
  const byCountry = {};
  for (const i of power) if (i.country) byCountry[i.country] = (byCountry[i.country] || 0) + 1;
  const max = Math.max(0, ...Object.values(byCountry));
  if (countries) drawCountries(svg, countries, (iso) => heatColor(byCountry[iso], max), (s) => localPanel.open(s));
  const selected = localPanel.selection;
  const drilldown = localPanel.geo;
  const zoom = drilldown && !selected?.items;
  svg.classList.toggle('zoomed', zoom);
  setBaseView(svg, zoom ? (selected.country === 'BR' ? [280, 225, 145, 120] : [110, 45, 220, 145]) : [0, 0, 1000, 500]);
  document.getElementById('map-reset').hidden = !zoom;
  if (zoom) drawStates(svg, drilldown, (s) => localPanel.open(s), selected.state);
  const visible = document.getElementById('disasters').checked ? [...power, ...data.items.filter((i) => i.kind === 'disaster')] : power;
  // Com zoom no país/estado, só mostra pontos desse país com localização precisa (estado/condado/exata).
  // Pontos de país ficam na lista e nos chips, para não aparecerem sobre estados sem dados.
  const inView = (i) => !zoom || (i.country === selected.country && i.precisao !== "pais" && i.state && (!selected.state || i.state === selected.state));
  const markers = visible.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon) && inView(i))
    .map((i) => ({ ...i, label: `${i.title} · ${i.region} · ${i.source} · ${i.precisao}` }));
  if (markers.length) drawMarkers(svg, markers, (s) => localPanel.open(s), zoom ? 0.35 : 1);
  document.getElementById('maphint').textContent = markers.length ? T[lang].mapHint : T[lang].mapEmpty;

  const chips = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('chips').innerHTML = chips.map(([c, n]) => `<span>${esc(c)} ${n}</span>`).join('');

  document.getElementById('legend').innerHTML = `<span class="sw alta"></span>${T[lang].legAlta} <span class="sw media"></span>${T[lang].legMedia} <span class="sw baixa"></span>${T[lang].legBaixa}`
    + ` <span class="sep"></span>${T[lang].legCount}: ${power.length}`;
  document.getElementById('tlNow').textContent = data.collectedAt ? fmt(data.collectedAt) : '';
}

function renderFeed() {
  const { power, cyber } = counts();
  const items = filter === 'all' ? [...power, ...cyber] : filter === 'power' ? power : cyber;
  document.getElementById('feed').innerHTML = items.length ? items.map((i) => `
    <li class="card">
      <span class="badge ${esc(i.kind)}">${esc(T[lang].kind[i.kind] || i.kind)}</span>
      <span class="badge ${esc(i.status)}">${esc(T[lang].st[i.status] || i.status)}</span>
      <h3>${esc(i.title)}</h3>
      <div class="src">${esc(T[lang].fonte)}: <a href="${esc(i.sourceUrl)}" rel="noopener" target="_blank">${esc(i.source)}</a> · ${esc(fmt(i.publishedAt))} · ${esc(i.region)}${i.ransomware ? ' · ' + esc(T[lang].ransom) : ''}${i.dueAt ? ' · ' + esc(T[lang].due) + ' ' + esc(fmt(i.dueAt)) : ''}</div>
    </li>`).join('') : `<li class="card">${esc(T[lang].none)}</li>`;
}

function renderAll() {
  document.getElementById('updated').textContent = data.collectedAt ? `${T[lang].updated} ${fmt(data.collectedAt)}` : '';
  renderSummary();
  renderMap();
  renderFeed();
  localPanel.render();
  document.getElementById('errors').textContent = (data.errors || []).map((e) => `${e.source}: ${e.message}`).join(' · ');
}

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; applyI18n(); renderAll(); }));
document.querySelectorAll('.pills button').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('.pills button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  renderFeed();
}));
document.getElementById('map-reset').addEventListener('click', () => localPanel.close());
enablePanZoom(document.getElementById('map'));
document.getElementById('zoom-in').addEventListener('click', () => zoomBy(document.getElementById('map'), 0.8));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(document.getElementById('map'), 1 / 0.8));
document.getElementById('zoom-reset').addEventListener('click', () => resetView(document.getElementById('map')));
document.getElementById('disasters').addEventListener('change', renderMap);
document.getElementById('share').addEventListener('click', async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: document.title, url });
    else await navigator.clipboard.writeText(url);
  } catch { /* cancelado pelo usuário */ }
});

applyI18n();
Promise.all([
  fetch('/geo/countries.geojson').then((r) => r.json()).catch(() => null),
  fetch('/api/incidents').then((r) => r.json()),
]).then(([geo, d]) => {
  countries = geo;
  data = d;
  renderAll();
  localPanel.fromUrl();
}).catch(() => { document.getElementById('errors').textContent = 'erro ao carregar'; });
