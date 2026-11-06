// Funções puras compartilhadas pelo painel e pelos testes.
export function parseLocal(value) {
  const match = /^([A-Z]{2})(?:-([A-Z]{2}))?$/.exec(String(value || '').toUpperCase());
  return match ? { country: match[1], ...(match[2] ? { state: match[2] } : {}) } : null;
}
export function filterLocal(items, selection, kind = 'all') {
  const ids = selection?.items ? new Set(selection.items.map((i) => i.id)) : null;
  return items.filter((i) => selection && (ids ? ids.has(i.id) :
    i.country === selection.country && (!selection.state || i.state === selection.state)) &&
    (kind === 'all' || i.kind === kind))
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}
export function localCode(selection) {
  return selection?.country && !selection.items ? selection.country + (selection.state ? `-${selection.state}` : '') : '';
}
export function localUrl(href, selection) {
  const url = new URL(href);
  url.searchParams.delete('local');
  if (parseLocal(url.hash.slice(1))) url.hash = '';
  const code = localCode(selection);
  if (code) url.searchParams.set('local', code);
  return url.pathname + url.search + url.hash;
}
