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
  return entry ? { ...entry, country: 'BR', state: String(uf).trim().toUpperCase(), precisao: 'estado' } : null;
}
export const US_STATE_FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR"};
export function resolveUsState(fips) {
  const value = String(fips ?? '').trim();
  return /^\d{1,5}$/.test(value) ? US_STATE_FIPS[value.padStart(5, '0').slice(0, 2)] : undefined;
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
  const result = { ...item, ...(country ? { country } : {}), ...(geo.state ? { state: geo.state } : {}) };
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
