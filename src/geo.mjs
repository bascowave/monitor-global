import { readFileSync } from 'node:fs';
const read = (name) => JSON.parse(readFileSync(new URL(`../data/geo/${name}.json`, import.meta.url), 'utf8'));
const countries = read('countries');
const ufs = read('br-ufs');
const counties = read('us-counties');
export const normalizeName = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const names = new Map();
for (const [country, c] of Object.entries(countries)) {
  for (const name of [country, c.iso3, ...c.names]) names.set(normalizeName(name), { ...c, country, precisao: 'pais' });
}
for (const [name, code] of Object.entries({ 'EUA': 'US', 'USA': 'US', 'UK': 'GB', 'Russia': 'RU', 'Rússia': 'RU', 'South Korea': 'KR', 'North Korea': 'KP', 'Iran': 'IR', 'Venezuela': 'VE', 'Bolivia': 'BO', 'Vietnam': 'VN', 'Taiwan': 'TW', 'Palestine': 'PS', 'Turkey': 'TR', 'Türkiye': 'TR' })) names.set(normalizeName(name), names.get(normalizeName(code)));
export function resolveCountry(codeOrName) { return names.get(normalizeName(codeOrName)) ?? null; }
export function resolveBrUf(uf) {
  const entry = ufs[String(uf ?? '').trim().toUpperCase()];
  return entry ? { ...entry, country: 'BR', precisao: 'estado' } : null;
}
export function resolveUsCounty(fips) {
  const key = String(fips ?? '').trim();
  if (!/^\d{1,5}$/.test(key)) return null;
  const entry = counties[key.padStart(5, '0')];
  return entry ? { ...entry, country: 'US', precisao: 'condado' } : null;
}
// Não converter null/'' em zero nem inventar coordenadas para entidades desconhecidas.
export function attachGeo(item, geo = {}) {
  if (!geo) return { ...item };
  const country = resolveCountry(geo.country)?.country;
  const result = { ...item, ...(country ? { country } : {}) };
  if (Number.isFinite(geo.lat) && Math.abs(geo.lat) <= 90 && Number.isFinite(geo.lon) && Math.abs(geo.lon) <= 180 && ['pais','estado','condado','exata'].includes(geo.precisao)) {
    Object.assign(result, { lat: geo.lat, lon: geo.lon, precisao: geo.precisao });
  }
  return result;
}
const toponyms = { zhytomyr: 'UA', zhitomir: 'UA', kyiv: 'UA', kiev: 'UA', kharkiv: 'UA', gaza: 'PS', khartoum: 'SD', yangon: 'MM' };
export function countriesInText(text) {
  let haystack = ` ${normalizeName(text)} `;
  const found = new Set();
  // Somente nomes por extenso; siglas curtas (IN, AS, ...) causam falsos positivos no texto.
  // Consumir nomes maiores primeiro evita Sudan dentro de South Sudan, por exemplo.
  for (const [name, entry] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    if (name.length > 3 && haystack.includes(` ${name} `)) {
      found.add(entry.country);
      haystack = haystack.replaceAll(` ${name} `, ' ');
    }
  }
  for (const [name, country] of Object.entries(toponyms)) if (haystack.includes(` ${name} `)) found.add(country);
  return [...found].sort().map(resolveCountry);
}
