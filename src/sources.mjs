import { attachGeo, resolveCountry, resolveBrUf, resolveUsCounty, countriesInText } from './geo.mjs';
import { createHash } from 'node:crypto';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';

// Cada adaptador retorna o shape comum, com datas ISO em UTC.
const USER_AGENT = 'monitor-global/0.1 (contato do projeto)';
const DAY = 86400000;
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const iso = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const newest = (a, b) => b.publishedAt.localeCompare(a.publishedAt);

async function request(url, source, fetchFn, { text = false, headers = {} } = {}) {
  let res;
  try {
    res = await fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Não propagar detalhes de requisição que possam conter credenciais.
    throw new Error(`${source}: falha de rede ou tempo limite`);
  }
  if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
  try { return await (text ? res.text() : res.json()); }
  catch { throw new Error(`${source}: resposta inválida`); }
}

/** GET JSON/text via node:https com connectTimeout maior (GDELT costuma passar de 10s). */
function httpsGet(url, { text = false, headers = {}, connectTimeout = 45000, totalTimeout = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(url);
    const req = https.request({
      protocol: u.protocol, hostname: u.hostname, path: `${u.pathname}${u.search}`,
      method: 'GET', headers: { 'User-Agent': USER_AGENT, ...headers },
      timeout: connectTimeout,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({
          ok, status: res.statusCode,
          text: async () => body,
          json: async () => JSON.parse(body),
        });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('connect/timeout')); });
    req.on('error', reject);
    const killer = setTimeout(() => req.destroy(new Error('total timeout')), totalTimeout);
    req.on('close', () => clearTimeout(killer));
    req.end();
  });
}


function array(value, source) {
  if (!Array.isArray(value)) throw new Error(`${source}: formato de resposta inesperado`);
  return value;
}

export const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export async function fetchKev(fetchFn = fetch) {
  const json = await request(KEV_URL, 'CISA KEV', fetchFn);
  return array(json.vulnerabilities, 'CISA KEV').map((v) => ({
    id: `kev-${v.cveID}`,
    kind: 'cyber',
    title: `${v.cveID}: ${v.vulnerabilityName}`,
    region: 'Global',
    vendor: v.vendorProject,
    product: v.product,
    publishedAt: new Date(`${v.dateAdded}T00:00:00Z`).toISOString(),
    dueAt: v.dueDate ? new Date(`${v.dueDate}T00:00:00Z`).toISOString() : null,
    ransomware: v.knownRansomwareCampaignUse === 'Known',
    source: 'CISA KEV',
    sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    status: 'confirmado',
  }));
}

function radarToken() {
  const token = process.env.CLOUDFLARE_RADAR_TOKEN?.trim();
  if (!token) console.error('Cloudflare Radar desligado: CLOUDFLARE_RADAR_TOKEN ausente');
  return token;
}

async function radar(path, token, fetchFn) {
  const json = await request(`https://api.cloudflare.com/client/v4/radar/${path}`, 'Cloudflare Radar', fetchFn, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (json.success === false || !json.result) throw new Error('Cloudflare Radar: resposta sem sucesso');
  return json.result;
}

export async function fetchCloudflareOutages(fetchFn = fetch) {
  const token = radarToken();
  if (!token) return [];
  const result = await radar('annotations/outages?limit=100', token, fetchFn);
  return array(result.annotations, 'Cloudflare Radar').slice(0, 100).flatMap((o) => {
    const publishedAt = iso(o.startDate);
    if (!publishedAt) return [];
    const cause = o.outage?.outageCause ?? '';
    const details = o.locationsDetails ?? [];
    const explicit = [...details.map((l) => resolveCountry(l.code) || resolveCountry(l.name)), ...(o.locations ?? []).map((l) => resolveCountry(typeof l === 'string' ? l : l.code))].filter(Boolean);
    const geos = [...new Map((explicit.length ? explicit : countriesInText(`${o.description || ''} ${o.scope || ''}`)).map((g) => [g.country, g])).values()];
    const item = {
      id: `cloudflare-outage-${o.id ?? hash(`${o.description}-${publishedAt}`)}`,
      kind: /attack|ddos/i.test(cause) ? 'cyber' : 'power',
      title: o.description || `Interrupção de conectividade: ${cause || 'causa não informada'}`,
      region: details.map((l) => l.name || l.code).join(', ') || o.locations?.join(', ') || o.scope || 'Global',
      publishedAt, source: 'Cloudflare Radar',
      sourceUrl: o.linkedUrl || 'https://radar.cloudflare.com/outage-center', status: 'confirmado',
    };
    return geos.length ? geos.map((geo) => attachGeo({ ...item, id: `${item.id}-${geo.country}` }, geo)) : [item];
  });
}

export async function fetchCloudflareAttacks(fetchFn = fetch) {
  const token = radarToken();
  if (!token) return [];
  const result = await radar('attacks/layer7/summary/http_method?dateRange=7d', token, fetchFn);
  if (!result.summary_0 || typeof result.summary_0 !== 'object') throw new Error('Cloudflare Radar: resumo ausente');
  const methods = Object.entries(result.summary_0)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!methods.length) return [];
  const publishedAt = iso(result.meta?.dateRange?.[0]?.endTime) || iso(result.meta?.lastUpdated);
  if (!publishedAt) throw new Error('Cloudflare Radar: data do resumo ausente');
  return [{
    id: `cloudflare-attacks-${hash(publishedAt)}`, kind: 'cyber',
    title: `Ataques HTTP — resumo global dos últimos 7 dias: ${methods.slice(0, 5).map(([method, value]) => `${method} ${Number(value).toFixed(2)}%`).join(', ')}`,
    region: 'Global', publishedAt, source: 'Cloudflare Radar',
    sourceUrl: 'https://radar.cloudflare.com/security-and-attacks', status: 'confirmado',
  }];
}

export async function fetchIodaAlerts(fetchFn = fetch) {
  const until = Math.floor(Date.now() / 1000);
  const url = `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${until - 7 * 86400}&until=${until}&limit=100`;
  const json = await request(url, 'IODA', fetchFn);
  if (json.error) throw new Error('IODA: erro retornado pela API');
  let alerts = array(json.data, 'IODA');
  if (alerts.length > 100) alerts = alerts.filter((a) => /^(critical|warning)$/i.test(a.level));
  return alerts.slice(0, 100).flatMap((a) => {
    const publishedAt = iso(a.time == null ? null : Number(a.time) * 1000);
    if (!publishedAt || !a.entity?.code || !a.datasource) return [];
    const geo = resolveCountry(a.entity.type === 'country' ? a.entity.code : a.entity.attrs?.country_code);
    return [attachGeo({
      id: `ioda-${a.datasource}-${a.entity.code}-${a.time}`, kind: 'power',
      title: `Queda de conectividade: ${a.entity.name || a.entity.code} (${a.level || 'alerta'}, ${a.datasource})`,
      severity: a.level === 'critical' ? 'alta' : a.level === 'warning' ? 'media' : 'baixa',
      region: a.entity.name || a.entity.code, publishedAt, source: 'IODA',
      sourceUrl: 'https://ioda.inetintel.cc.gatech.edu', status: 'confirmado',
    }, geo)];
  });
}

export async function fetchOnsInterruptions(fetchFn = fetch) {
  const csv = await request('https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/interrupcao_carga/INTERRUPCAO_CARGA.csv', 'ONS', fetchFn, { text: true });
  const [header, ...lines] = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const columns = header.split(';').map((s) => s.trim());
  if (!['cod_perturbacao', 'din_interrupcaocarga'].every((key) => columns.includes(key))) throw new Error('ONS: colunas obrigatórias ausentes');
  const events = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split(';');
    const row = Object.fromEntries(columns.map((key, i) => [key, fields[i]?.trim() ?? '']));
    // O CSV não traz fuso; usamos explicitamente o horário de Brasília (UTC-3).
    const publishedAt = iso(`${row.din_interrupcaocarga.replace(' ', 'T')}-03:00`);
    if (!row.cod_perturbacao || !publishedAt) continue;
    const uf = (row.id_estado || '').toUpperCase();
    const id = `ons-${row.cod_perturbacao}-${publishedAt}-${uf || 'BR'}`;
    const event = events.get(id) ?? { id, publishedAt, uf, regions: new Set(), agents: new Set(), mw: 0 };
    event.regions.add([row.nom_subsistema || row.id_subsistema, row.id_estado].filter(Boolean).join(' / '));
    if (row.nom_agente) event.agents.add(row.nom_agente);
    event.mw += Number(row.val_cargainterrompida_mw.replace(',', '.')) || 0;
    events.set(id, event);
  }
  return [...events.values()].sort(newest).slice(0, 200).map((e) => attachGeo({
    id: e.id, kind: 'power', mw: Number(e.mw.toFixed(2)), severity: e.mw >= 100 ? 'alta' : e.mw >= 20 ? 'media' : 'baixa',
    title: `Interrupção de carga: ${Number(e.mw.toFixed(2))} MW${e.agents.size ? ` — ${[...e.agents].join(', ')}` : ''}`,
    region: `Brasil / ${[...e.regions].filter(Boolean).join(', ')}`, publishedAt: e.publishedAt,
    source: 'ONS', sourceUrl: 'https://dados.ons.org.br/dataset/interrupcao_carga', status: 'confirmado',
  }, resolveBrUf(e.uf) || resolveCountry('BR')));
}

export async function fetchOdinOutages(fetchFn = fetch) {
  const json = await request('https://odin.ornl.gov/odi?format=JSON', 'ODIN', fetchFn);
  const now = Date.now();
  return array(json.outage, 'ODIN').filter((o) => {
    const etr = iso(o.estimatedRestorationTime?.ert ?? o.estimatedRestorationTime);
    return Number(o.metersAffected) > 0 && (!etr || Date.parse(etr) >= now - DAY);
  }).sort((a, b) => Number(b.metersAffected) - Number(a.metersAffected)).slice(0, 100).map((o) => {
    const utility = o.names?.find((n) => n.nameType === 'UtilityName')?.name || 'Concessionária não informada';
    const start = iso(o.reportedStartTime) || iso(o.outageArea?.earliestReportedTime);
    const geo = resolveUsCounty(o.communityDescriptor);
    const clientes = Number(o.metersAffected);
    return attachGeo({
      id: `odin-${o.communityDescriptor}-${o.reportedStartTime || o.mrid || o.MRID || hash(utility)}`,
      kind: 'power', title: `Apagão: ${o.metersAffected} medidores afetados — ${utility}`,
      clientes, severity: clientes >= 10000 ? 'alta' : clientes >= 1000 ? 'media' : 'baixa',
      region: geo ? `${geo.name} / ${geo.state}` : `EUA / FIPS ${o.communityDescriptor}`, publishedAt: start || new Date(now).toISOString(),
      // Sem início informado, publishedAt representa o momento da observação.
      ...(start ? {} : { timeBasis: 'observed' }),
      source: 'ODIN', sourceUrl: 'https://odin.ornl.gov', status: 'confirmado',
    }, { ...geo, country: 'US' });
  });
}

export async function fetchGdeltArticles(fetchFn = fetch) {
  // Uma única query por ingest; respeitar ~1 req/5s (retry em 429).
  // GDELT costuma demorar >10s no handshake; https nativo evita o connectTimeout do undici.
  const client = fetchFn === fetch ? httpsGet : fetchFn;
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.search = new URLSearchParams({
    query: '(blackout OR apagao OR "power outage" OR cyberattack OR ransomware OR "ataque cibernetico")',
    mode: 'ArtList', format: 'json', maxrecords: '50', sort: 'DateDesc',
  });
  let json;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      json = await request(url.toString(), 'GDELT', client);
      break;
    } catch (e) {
      if (!/HTTP 429/i.test(e.message)) throw e;
      if (attempt === 2) {
        console.error('GDELT rate-limited (429): pulando este ciclo');
        return [];
      }
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
  if (!json) return [];
  const seen = new Set();
  return array(json.articles, 'GDELT').slice(0, 50).flatMap((a) => {
    const date = a.seendate?.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
    const publishedAt = iso(date);
    if (!a.url || !publishedAt || seen.has(a.url)) return [];
    seen.add(a.url);
    return [{
      id: `gdelt-${hash(a.url)}`, kind: 'news', title: a.title || a.url,
      region: a.sourcecountry || 'Global', publishedAt, source: 'GDELT', sourceUrl: a.url, status: 'reportado',
    }];
  });
}

export async function fetchUsgsEarthquakes(fetchFn = fetch) {
  const json = await request('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', 'USGS', fetchFn);
  return array(json.features, 'USGS').flatMap((f) => {
    const publishedAt = iso(f.properties?.time);
    if (!f.id || !publishedAt) return [];
    const [lon, lat] = f.geometry?.coordinates ?? [];
    return [attachGeo({
      id: `usgs-${f.id}`, kind: 'disaster',
      title: f.properties.title || `Terremoto M ${f.properties.mag} — ${f.properties.place}`,
      region: f.properties.place || 'Global', publishedAt, source: 'USGS',
      sourceUrl: f.properties.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`, status: 'confirmado',
    }, { lon, lat, precisao: 'exata', country: countriesInText(f.properties.place)[0]?.country })];
  });
}

function xmlText(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  }).trim();
}

export async function fetchGdacsAlerts(fetchFn = fetch) {
  const xml = await request('https://www.gdacs.org/xml/rss.xml', 'GDACS', fetchFn, { text: true });
  if (!/<rss\b/i.test(xml)) throw new Error('GDACS: RSS inválido');
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.flatMap(([, item]) => {
    const tag = (name) => xmlText(item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');
    const title = tag('title');
    const sourceUrl = tag('link');
    const publishedAt = iso(tag('pubDate'));
    if (!title || !sourceUrl || !publishedAt) return [];
    const country = resolveCountry(tag('gdacs:iso3')) || resolveCountry(tag('gdacs:country'));
    const numberTag = (name) => tag(name) === '' ? NaN : Number(tag(name));
    let lat = numberTag('geo:lat'), lon = numberTag('geo:long');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const bbox = tag('gdacs:bbox').split(/[ ,;]+/).map(Number);
      if (bbox.length === 4 && bbox.every(Number.isFinite)) {
        // GDACS: minLon maxLon minLat maxLat (ordem do RSS).
        lon = (((bbox[0] + bbox[1]) / 2 + 180) % 360 + 360) % 360 - 180;
        lat = (bbox[2] + bbox[3]) / 2;
      }
    }
    const geo = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180 ? { country: country?.country, lat, lon, precisao: 'exata' } : country;
    return [attachGeo({
      id: `gdacs-${hash(tag('guid') || sourceUrl)}`, kind: 'disaster', title,
      region: tag('gdacs:country') || 'Global', publishedAt, description: tag('description'),
      source: 'GDACS', sourceUrl, status: 'confirmado',
    }, geo)];
  }).sort(newest).slice(0, 50);
}

export const SOURCE_FETCHERS = [
  ['CISA KEV', fetchKev],
  ['Cloudflare Radar (outages)', fetchCloudflareOutages],
  ['Cloudflare Radar (attacks)', fetchCloudflareAttacks],
  ['IODA', fetchIodaAlerts],
  ['ONS', fetchOnsInterruptions],
  ['ODIN', fetchOdinOutages],
  ['GDELT', fetchGdeltArticles],
  ['USGS', fetchUsgsEarthquakes],
  ['GDACS', fetchGdacsAlerts],
];

export const POWER_ADAPTERS_PENDING = ['ENTSO-E (token pendente)'];
