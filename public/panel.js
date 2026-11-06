import { filterLocal, localCode, localUrl, parseLocal } from './local.js';
const labels = {
  pt: { place: 'Ocorrências locais', group: 'Pontos agrupados', all: 'Tudo', power: 'Apagões', cyber: 'Ciber', disaster: 'Desastres', news: 'Notícias', incidents: 'Ocorrências', close: 'Fechar painel', visible: 'itens visíveis', empty: 'Nenhum item para este local e filtro nesta coleta.', state: 'Estado / UF', country: 'Ver país inteiro', customers: 'clientes', unknown: 'Gravidade não informada', alta: 'Alta', media: 'Média', baixa: 'Baixa', failed: 'Não foi possível carregar os estados. Tente abrir o país novamente.', sourceCountry: 'GDELT: país da fonte jornalística; pode diferir do local do fato.', world: 'Ver mundo' },
  en: { place: 'Local incidents', group: 'Grouped points', all: 'All', power: 'Blackouts', cyber: 'Cyber', disaster: 'Disasters', news: 'News', incidents: 'Incidents', close: 'Close panel', visible: 'visible items', empty: 'No items for this place and filter in this collection.', state: 'State', country: 'View entire country', customers: 'customers', unknown: 'Severity unavailable', alta: 'High', media: 'Medium', baixa: 'Low', failed: 'Could not load states. Open the country again to retry.', sourceCountry: 'GDELT: country of the news source; may differ from the event location.', world: 'View world' },
  es: { place: 'Incidentes locales', group: 'Puntos agrupados', all: 'Todo', power: 'Apagones', cyber: 'Ciber', disaster: 'Desastres', news: 'Noticias', incidents: 'Incidentes', close: 'Cerrar panel', visible: 'elementos visibles', empty: 'No hay elementos para este lugar y filtro en esta recopilación.', state: 'Estado', country: 'Ver país completo', customers: 'clientes', unknown: 'Gravedad no disponible', alta: 'Alta', media: 'Media', baixa: 'Baja', failed: 'No se pudieron cargar los estados. Abra el país nuevamente.', sourceCountry: 'GDELT: país de la fuente periodística; puede diferir del lugar del hecho.', world: 'Ver mundo' },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (value) => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? esc(u.href) : '#'; } catch { return '#'; } };
export function createLocalPanel({ getData, getLang, onMapChange }) {
  let selection = null, kind = 'all', returnFocus = null, returnSelector = null, error = false;
  const geos = new Map();
  const pending = new Map();
  const panel = document.getElementById('local-panel');
  const t = () => labels[getLang()];
  const replaceUrl = () => history.replaceState(null, '', localUrl(location.href, selection));
  async function loadStates(country) {
    if (!['BR', 'US'].includes(country) || geos.has(country)) return;
    if (!pending.has(country)) pending.set(country, fetch(`/geo/${country === 'BR' ? 'br-ufs' : 'us-states'}.geojson`).then((r) => {
      if (!r.ok) throw new Error('geo');
      return r.json();
    }).then((geo) => geos.set(country, geo)).finally(() => pending.delete(country)));
    try { await pending.get(country); } catch { if (selection?.country === country) error = true; }
    if (selection?.country === country) { render(); onMapChange(); }
  }
  function open(next, updateUrl = true) {
    if (panel.hidden) {
      returnFocus = document.activeElement;
      const country = returnFocus?.getAttribute('data-country');
      returnSelector = country ? `#map [data-country="${country}"]` : null;
    }
    selection = next; kind = 'all'; error = false;
    panel.hidden = false;
    document.body.classList.add('local-open');
    if (updateUrl) replaceUrl();
    render(); onMapChange();
    document.getElementById('local-title').focus({ preventScroll: true });
    void loadStates(next.country);
  }
  function close(updateUrl = true) {
    selection = null;
    panel.hidden = true;
    document.body.classList.remove('local-open');
    if (updateUrl) replaceUrl();
    onMapChange();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else document.querySelector(returnSelector || '#map [role="button"]')?.focus({ preventScroll: true });
  }
  function render() {
    document.getElementById('map-reset').textContent = t().world;
    if (!selection) return;
    const text = t();
    const name = selection.country ? new Intl.DisplayNames([getLang()], { type: 'region' }).of(selection.country) : text.group;
    const geo = geos.get(selection.country);
    const stateName = geo?.features.find((f) => f.properties.state === selection.state)?.properties.name;
    document.getElementById('local-eyebrow').textContent = text.place;
    document.getElementById('local-title').textContent = selection.state ? `${stateName || selection.state} · ${localCode(selection)}` : name;
    document.getElementById('local-close').setAttribute('aria-label', text.close);
    const items = filterLocal(getData().items || [], selection, kind);
    document.getElementById('local-count').textContent = `${items.length} ${text.visible}`;
    document.getElementById('local-context').textContent = error ? text.failed : items.some((i) => i.source === 'GDELT') ? text.sourceCountry : '';
    const parent = document.getElementById('local-parent');
    parent.hidden = !selection.state; parent.textContent = text.country;
    const stateLabel = document.getElementById('state-label');
    stateLabel.hidden = !geo || !!selection.items;
    document.getElementById('state-label-text').textContent = text.state;
    document.getElementById('state-select').innerHTML = `<option value="">${esc(text.country)}</option>` + (geo?.features || []).map((f) => `<option value="${esc(f.properties.state)}" ${f.properties.state === selection.state ? 'selected' : ''}>${esc(f.properties.name)} (${esc(f.properties.state)})</option>`).join('');
    document.getElementById('local-filters').innerHTML = ['all', 'power', 'cyber', 'disaster'].map((k) => `<button data-kind="${k}" aria-pressed="${k === kind}">${esc(text[k])}</button>`).join('');
    const card = (i) => `<li class="card"><span class="badge ${esc(i.kind)}">${esc(text[i.kind] || i.kind)}</span><span class="badge">${esc(text[i.severity] || text.unknown)}</span><h3>${esc(i.title)}</h3><div class="src"><a href="${safeUrl(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(i.source)}</a> · <time datetime="${esc(i.publishedAt)}">${esc(new Date(i.publishedAt).toLocaleString(getLang(), { timeZone: 'UTC' }))} UTC</time><br>${esc(i.region)}${Number.isFinite(i.mw) ? ` · ${i.mw} MW` : ''}${Number.isFinite(i.clientes) ? ` · ${i.clientes.toLocaleString(getLang())} ${text.customers}` : ''}</div></li>`;
    document.getElementById('local-items').innerHTML = items.length ? [false, true].map((news) => {
      const section = items.filter((i) => (i.kind === 'news') === news);
      return section.length ? `<h3 class="section-label">${esc(news ? text.news : text.incidents)}</h3><ul class="feed">${section.map(card).join('')}</ul>` : '';
    }).join('') : `<p>${esc(text.empty)}</p>`;
  }
  document.getElementById('local-close').addEventListener('click', () => close());
  document.getElementById('local-parent').addEventListener('click', () => open({ country: selection.country }));
  document.getElementById('state-select').addEventListener('change', (e) => open({ country: selection.country, ...(e.target.value ? { state: e.target.value } : {}) }));
  document.getElementById('local-filters').addEventListener('click', (e) => {
    if (!e.target.dataset.kind) return;
    kind = e.target.dataset.kind; render();
    document.querySelector(`#local-filters [data-kind="${kind}"]`).focus();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selection) { e.preventDefault(); close(); } });
  function fromUrl() {
    const url = new URL(location.href);
    const local = parseLocal(url.searchParams.get('local') || url.hash.slice(1));
    if (local) {
      open(local);
      document.getElementById('mapa').scrollIntoView({ block: 'start', behavior: 'instant' });
    } else if (selection) close(false);
  }
  window.addEventListener('popstate', fromUrl);
  window.addEventListener('hashchange', fromUrl);
  return { open, close, render, fromUrl, get selection() { return selection; }, get geo() { return geos.get(selection?.country); } };
}
