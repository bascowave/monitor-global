const T = {
  pt: { brand: 'Monitor global', eyebrow: 'Atualizado a partir das fontes oficiais', title: 'Incidentes no mundo, com fonte e data', tabAll: 'Tudo', tabCyber: 'Ciberataques', tabPower: 'Apagões', footer: 'Cada item mostra a fonte original. Itens "a confirmar" ainda não foram verificados por fonte oficial.', kind: { cyber: 'Ciberataque', power: 'Apagão' }, st: { confirmado: 'confirmado', a_confirmar: 'a confirmar', reportado: 'reportado' }, updated: 'Coletado em', none: 'Nenhum item ainda.', fonte: 'Fonte', ransom: 'ligado a ransomware', due: 'prazo de correção' },
  en: { brand: 'Global monitor', eyebrow: 'Updated from official sources', title: 'Incidents worldwide, with source and date', tabAll: 'All', tabCyber: 'Cyberattacks', tabPower: 'Blackouts', footer: 'Each item shows its original source. "To confirm" items are not yet verified by an official source.', kind: { cyber: 'Cyberattack', power: 'Blackout' }, st: { confirmado: 'confirmed', a_confirmar: 'to confirm', reportado: 'reported' }, updated: 'Collected at', none: 'No items yet.', fonte: 'Source', ransom: 'linked to ransomware', due: 'fix due' },
  es: { brand: 'Monitor global', eyebrow: 'Actualizado desde fuentes oficiales', title: 'Incidentes en el mundo, con fuente y fecha', tabAll: 'Todo', tabCyber: 'Ciberataques', tabPower: 'Apagones', footer: 'Cada elemento muestra su fuente original. Los elementos "por confirmar" aún no han sido verificados por una fuente oficial.', kind: { cyber: 'Ciberataque', power: 'Apagón' }, st: { confirmado: 'confirmado', a_confirmar: 'por confirmar', reportado: 'reportado' }, updated: 'Recopilado el', none: 'Aún no hay elementos.', fonte: 'Fuente', ransom: 'vinculado a ransomware', due: 'plazo de corrección' },
};
let lang = (navigator.language || 'pt').slice(0, 2);
if (!T[lang]) lang = 'pt';
let filter = 'all';
let data = { items: [], errors: [] };

const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const fmt = (iso) => new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T[lang][el.dataset.i18n] ?? el.textContent; });
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
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

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; applyI18n(); render(); }));
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  render();
}));

applyI18n();
fetch('/api/incidents').then((r) => r.json()).then((d) => { data = d; render(); }).catch(() => { document.getElementById('errors').textContent = 'erro ao carregar'; });
