import { addDefs, drawCountries, drawMarkers, heatColor } from './map.js';

const T = {
  pt: { brand: 'Monitor global', share: 'Compartilhar', live: 'Ao vivo', title: 'Incidentes no mundo, com fonte e data', eyebrow: 'Atualizado a partir das fontes oficiais', sumTitle: 'Resumo', tabAll: 'Tudo', tabCyber: 'Ciberataques', tabPower: 'Apagões', mapTitle: 'Mapa de apagões', mapHint: 'Pontos = apagões com localização informada pela fonte. Cor = gravidade; tamanho = clientes afetados. Ciberataques não têm local e aparecem só na lista.', mapEmpty: 'Nenhum apagão com localização ainda. Fontes de apagões pendentes.', feedTitle: 'Lista de incidentes', srcTitle: 'Fontes', navMap: 'Mapa', navList: 'Lista', navSrc: 'Fontes', footer: 'Cada item mostra a fonte original. Itens "a confirmar" ainda não foram verificados por fonte oficial.', kind: { cyber: 'Ciberataque', power: 'Apagão' }, st: { confirmado: 'confirmado', a_confirmar: 'a confirmar', reportado: 'reportado' }, updated: 'Coletado em', none: 'Nenhum item ainda.', fonte: 'Fonte', ransom: 'ligado a ransomware', due: 'prazo de correção', legAlta: 'Alta gravidade', legMedia: 'Média', legBaixa: 'Baixa', legCount: 'Apagões', srcNote: 'CISA KEV (ciberataques, domínio público); ENTSO-E, ONS e ODIN (apagões, pendentes).' },
  en: { brand: 'Global monitor', share: 'Share', live: 'Live', title: 'Incidents worldwide, with source and date', eyebrow: 'Updated from official sources', sumTitle: 'Summary', tabAll: 'All', tabCyber: 'Cyberattacks', tabPower: 'Blackouts', mapTitle: 'Blackout map', mapHint: 'Dots = outages with a location given by the source. Colour = severity; size = customers affected. Cyberattacks have no location and appear only in the list.', mapEmpty: 'No located blackouts yet. Blackout sources pending.', feedTitle: 'Incident list', srcTitle: 'Sources', navMap: 'Map', navList: 'List', navSrc: 'Sources', footer: 'Each item shows its original source. "To confirm" items are not yet verified by an official source.', kind: { cyber: 'Cyberattack', power: 'Blackout' }, st: { confirmado: 'confirmed', a_confirmar: 'to confirm', reportado: 'reported' }, updated: 'Collected at', none: 'No items yet.', fonte: 'Source', ransom: 'linked to ransomware', due: 'fix due', legAlta: 'High severity', legMedia: 'Medium', legBaixa: 'Low', legCount: 'Blackouts', srcNote: 'CISA KEV (cyber, public domain); ENTSO-E, ONS and ODIN (blackouts, pending).' },
  es: { brand: 'Monitor global', share: 'Compartir', live: 'En vivo', title: 'Incidentes en el mundo, con fuente y fecha', eyebrow: 'Actualizado desde fuentes oficiales', sumTitle: 'Resumen', tabAll: 'Todo', tabCyber: 'Ciberataques', tabPower: 'Apagones', mapTitle: 'Mapa de apagones', mapHint: 'Puntos = apagones con ubicación informada por la fuente. Color = gravedad; tamaño = clientes afectados. Los ciberataques no tienen ubicación y aparecen solo en la lista.', mapEmpty: 'Aún no hay apagones con ubicación. Fuentes de apagones pendientes.', feedTitle: 'Lista de incidentes', srcTitle: 'Fuentes', navMap: 'Mapa', navList: 'Lista', navSrc: 'Fuentes', footer: 'Cada elemento muestra su fuente original. Los elementos "por confirmar" aún no han sido verificados por una fuente oficial.', kind: { cyber: 'Ciberataque', power: 'Apagón' }, st: { confirmado: 'confirmado', a_confirmar: 'por confirmar', reportado: 'reportado' }, updated: 'Recopilado el', none: 'Aún no hay elementos.', fonte: 'Fuente', ransom: 'vinculado a ransomware', due: 'plazo de corrección', legAlta: 'Gravedad alta', legMedia: 'Media', legBaixa: 'Baja', legCount: 'Apagones', srcNote: 'CISA KEV (ciberataques, dominio público); ENTSO-E, ONS y ODIN (apagones, pendientes).' },
};
let lang = (navigator.language || 'pt').slice(0, 2);
if (!T[lang]) lang = 'pt';
let filter = 'power';
let data = { items: [], errors: [] };
let countries = null;

const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const fmt = (iso) => new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T[lang][el.dataset.i18n] ?? el.textContent; });
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.querySelectorAll('.pills button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
  document.getElementById('srclist').innerHTML = `<li><strong>CISA KEV</strong><br>${esc(T[lang].srcNote)}</li>`;
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
  if (countries) drawCountries(svg, countries, (name) => heatColor(byCountry[name], max));
  const markers = power.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon))
    .map((i) => ({ lat: i.lat, lon: i.lon, label: i.title, severity: i.severity, clientes: i.clientes }));
  if (markers.length) drawMarkers(svg, markers);
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
  document.getElementById('errors').textContent = (data.errors || []).map((e) => `${e.source}: ${e.message}`).join(' · ');
}

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; applyI18n(); renderAll(); }));
document.querySelectorAll('.pills button').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('.pills button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  renderFeed();
}));
document.getElementById('share').addEventListener('click', async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: document.title, url });
    else await navigator.clipboard.writeText(url);
  } catch { /* cancelado pelo usuário */ }
});

applyI18n();
Promise.all([
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson').then((r) => r.json()).catch(() => null),
  fetch('/api/incidents').then((r) => r.json()),
]).then(([geo, d]) => {
  countries = geo;
  data = d;
  renderAll();
}).catch(() => { document.getElementById('errors').textContent = 'erro ao carregar'; });
