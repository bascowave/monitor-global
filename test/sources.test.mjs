import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  fetchKev, fetchCloudflareOutages, fetchCloudflareAttacks, fetchIodaAlerts,
  fetchOnsInterruptions, fetchOdinOutages, fetchGdeltArticles,
  fetchUsgsEarthquakes, fetchGdacsAlerts, SOURCE_FETCHERS,
} from '../src/sources.mjs';
import { runIngest } from '../src/ingest.mjs';

// Nunca usar o token herdado do ambiente nos testes.
beforeEach(() => { delete process.env.CLOUDFLARE_RADAR_TOKEN; });
const mockJson = (data) => async () => ({ ok: true, json: async () => data });
const mockText = (text) => async () => ({ ok: true, text: async () => text });
const start = '2026-11-05T12:00:00Z';
const kev = { vulnerabilities: [{ cveID: 'CVE-2026-1234', vulnerabilityName: 'Falha explorada', dateAdded: '2026-11-05', vendorProject: 'Vendor', product: 'Product', knownRansomwareCampaignUse: 'Known', dueDate: '2026-11-20' }] };
const radarOutages = { success: true, result: { annotations: [
  { id: 'one', description: 'Falta de energia', startDate: start, outage: { outageCause: 'POWER_OUTAGE' }, locationsDetails: [{ code: 'BR', name: 'Brasil' }] },
  { id: 'two', description: 'Cabo rompido', startDate: start, outage: { outageCause: 'CABLE_CUT' }, scope: 'Portugal' },
  { id: 'three', description: 'Ataque DDoS', startDate: start, outage: { outageCause: 'DDOS_ATTACK' } },
] } };
const attacks = { success: true, result: { summary_0: { GET: '90.25', POST: '9.75' }, meta: { dateRange: [{ startTime: '2026-10-29T12:00:00Z', endTime: start }] } } };
const ioda = { error: null, data: [{ datasource: 'bgp', entity: { type: 'country', code: 'BR', name: 'Brazil' }, time: 1793880000, level: 'critical' }] };
const csvHeader = 'cod_perturbacao;din_interrupcaocarga;id_subsistema;nom_subsistema;id_estado;nom_agente;val_cargainterrompida_mw';
const ons = `\uFEFF${csvHeader}\r\n1/2026;2026-11-04 12:00:00;SE;SUDESTE;SP;Agente A;100.5\r\n1/2026;2026-11-04 12:00:00;SE;SUDESTE;RJ;Agente B;50\r\n2/2026;2026-11-05 13:00:00;NE;NORDESTE;BA;Agente C;25\r\n`;
const odin = { outage: [{ communityDescriptor: '04025', metersAffected: 12, reportedStartTime: start, estimatedRestorationTime: null, names: [{ nameType: 'UtilityName', name: 'Utility' }] }] };
const usgs = { features: [{ id: 'abc', geometry: { type: 'Point', coordinates: [178.4, -18.1, 10] }, properties: { time: Date.parse(start), title: 'M 6.1 — Fiji', place: 'Fiji', url: 'https://earthquake.usgs.gov/example' } }] };
const gdelt = { articles: [{ title: 'Apagão', url: 'https://example.org/noticia?a=1&b=2', seendate: '20261105T120000Z', sourcecountry: 'Brazil' }] };
const gdacsItem = (id = 1, date = 'Thu, 05 Nov 2026 12:00:00 GMT') => `<item><title><![CDATA[Terremoto & alerta]]></title><link>https://www.gdacs.org/report?eventid=${id}&amp;eventtype=EQ</link><pubDate>${date}</pubDate><description>&lt;b&gt;Alerta&lt;/b&gt; &#xE1; &#225;</description><gdacs:country>Fiji</gdacs:country><gdacs:iso3>FJI</gdacs:iso3><geo:lat>-18.1</geo:lat><geo:long>178.4</geo:long><guid>EQ${id}</guid></item>`;
const gdacs = `<rss><channel>${gdacsItem()}</channel></rss>`;

function normalized(items, source, kind, status = 'confirmado') {
  assert.ok(items.length > 0);
  for (const item of items) {
    for (const field of ['id', 'title', 'region', 'sourceUrl']) assert.equal(typeof item[field], 'string');
    assert.equal(item.source, source);
    assert.equal(item.kind, kind);
    assert.equal(item.status, status);
    assert.equal(item.publishedAt, new Date(item.publishedAt).toISOString());
  }
}

test('KEV mantém shape e campos existentes', async () => {
  const items = await fetchKev(async (url, options) => {
    assert.match(url, /cisa.gov/);
    assert.equal(options.headers['User-Agent'], 'monitor-global/0.1 (contato do projeto)');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => kev };
  });
  normalized(items, 'CISA KEV', 'cyber');
  assert.equal(items[0].id, 'kev-CVE-2026-1234');
  assert.equal(items[0].ransomware, true);
  assert.equal(items[0].dueAt, '2026-11-20T00:00:00.000Z');
});

test('Radar desligado com env ausente, vazia ou só espaços; sem fetch', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (line) => logs.push(line));
  for (const token of [undefined, '', '   ']) {
    if (token === undefined) delete process.env.CLOUDFLARE_RADAR_TOKEN;
    else process.env.CLOUDFLARE_RADAR_TOKEN = token;
    for (const fetcher of [fetchCloudflareOutages, fetchCloudflareAttacks]) {
      assert.deepEqual(await fetcher(() => assert.fail('Não deve consultar a rede')), []);
    }
  }
  assert.equal(logs.length, 6);
  assert.ok(logs.every((line) => line === 'Cloudflare Radar desligado: CLOUDFLARE_RADAR_TOKEN ausente'));
});

test('Radar outages: autenticação fictícia, energia, rede e ataque', async () => {
  process.env.CLOUDFLARE_RADAR_TOKEN = 'fixture-token';
  const items = await fetchCloudflareOutages(async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=100');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    return { ok: true, json: async () => radarOutages };
  });
  normalized(items.slice(0, 2), 'Cloudflare Radar', 'power');
  assert.equal(items[0].title, 'Falta de energia');
  assert.equal(items[0].region, 'Brasil');
  assert.equal(items[2].kind, 'cyber');
});

test('Radar attacks gera um único resumo agregado com ID estável', async () => {
  process.env.CLOUDFLARE_RADAR_TOKEN = 'fixture-token';
  const items = await fetchCloudflareAttacks(async (url) => {
    assert.match(url, /summary\/http_method\?dateRange=7d$/);
    return { ok: true, json: async () => attacks };
  });
  normalized(items, 'Cloudflare Radar', 'cyber');
  assert.equal(items.length, 1);
  assert.match(items[0].title, /GET 90.25%/);
  assert.equal(items[0].id, (await fetchCloudflareAttacks(mockJson(attacks)))[0].id);
  await assert.rejects(fetchCloudflareAttacks(mockJson({ success: false })), /sem sucesso/);
});

test('IODA usa Unix absoluto nos últimos 7 dias e ID estável', async () => {
  const before = Math.floor(Date.now() / 1000);
  const items = await fetchIodaAlerts(async (url) => {
    const params = new URL(url).searchParams;
    const until = Number(params.get('until'));
    assert.ok(until >= before && until <= Math.floor(Date.now() / 1000));
    assert.equal(until - Number(params.get('from')), 604800);
    assert.equal(params.get('limit'), '100');
    return { ok: true, json: async () => ioda };
  });
  normalized(items, 'IODA', 'power');
  assert.equal(items[0].id, 'ioda-bgp-BR-1793880000');
  await assert.rejects(fetchIodaAlerts(mockJson({ error: 'bad request', data: [] })), /erro retornado/);
});

test('ONS parseia BOM, CRLF, agrupa perturbações e ordena por data', async () => {
  const items = await fetchOnsInterruptions(mockText(ons));
  normalized(items, 'ONS', 'power');
  assert.equal(items.length, 3);
  assert.match(items[0].id, /^ons-2\/2026-/);
  assert.equal(items[0].publishedAt, '2026-11-05T16:00:00.000Z');
  assert.match(items[1].title, /100.5 MW/);
  assert.match(items[1].region, /Brasil.*SP/);
  assert.match(items[2].region, /Brasil.*RJ/);
  assert.equal(items[1].mw, 100.5);
  assert.equal(items[1].severity, 'alta');
  assert.equal(items[1].precisao, 'estado');
  assert.equal(items[0].sourceUrl, 'https://dados.ons.org.br/dataset/interrupcao_carga');
});

test('ONS limita aos 200 eventos mais recentes', async () => {
  const rows = Array.from({ length: 205 }, (_, i) => `${i};2026-11-05 12:00:00;SE;SUDESTE;SP;Agente;1`);
  assert.equal((await fetchOnsInterruptions(mockText(`${csvHeader}\n${rows.join('\n')}`))).length, 200);
  await assert.rejects(fetchOnsInterruptions(mockText('coluna_incorreta\n1')), /colunas/);
});

test('ODIN filtra ETR stale, aceita objeto ert, ordena medidores e mantém ID', async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 2 * 86400000).toISOString();
  const items = await fetchOdinOutages(mockJson({ outage: [
    ...odin.outage,
    { ...odin.outage[0], communityDescriptor: '00001', metersAffected: 999, estimatedRestorationTime: { ert: past } },
    { ...odin.outage[0], communityDescriptor: '00002', metersAffected: 50, estimatedRestorationTime: { ert: future } },
    { ...odin.outage[0], communityDescriptor: '00003', metersAffected: 0 },
  ] }));
  normalized(items, 'ODIN', 'power');
  assert.equal(items.length, 2);
  assert.equal(items[0].id, `odin-00002-${start}`);
  assert.equal(items[0].region, 'EUA / FIPS 00002');
  const undated = await fetchOdinOutages(mockJson({ outage: [{ ...odin.outage[0], reportedStartTime: null, mrid: 'abc' }] }));
  assert.equal(undated[0].id, 'odin-04025-abc');
  assert.equal(undated[0].timeBasis, 'observed');
});

test('USGS normaliza GeoJSON', async () => {
  const items = await fetchUsgsEarthquakes(mockJson(usgs));
  normalized(items, 'USGS', 'disaster');
  assert.equal(items[0].id, 'usgs-abc');
  assert.equal(items[0].publishedAt, '2026-11-05T12:00:00.000Z');
});

test('GDELT consulta uma vez, normaliza data e deduplica URLs', async () => {
  let calls = 0;
  const items = await fetchGdeltArticles(async (url) => {
    calls++;
    const params = new URL(url).searchParams;
    assert.equal(params.get('mode'), 'ArtList');
    assert.equal(params.get('maxrecords'), '50');
    assert.match(params.get('query'), /apagao.*cyberattack/i);
    return { ok: true, json: async () => ({ articles: [...gdelt.articles, ...gdelt.articles] }) };
  });
  normalized(items, 'GDELT', 'news', 'reportado');
  assert.equal(calls, 1);
  assert.equal(items.length, 1);
  assert.match(items[0].id, /^gdelt-[a-f0-9]+$/);
  assert.equal(items[0].id, (await fetchGdeltArticles(mockJson(gdelt)))[0].id);
});

test('GDACS parseia RSS, CDATA, entidades e limita aos 50 mais recentes', async () => {
  const items = await fetchGdacsAlerts(mockText(gdacs));
  normalized(items, 'GDACS', 'disaster');
  assert.equal(items[0].title, 'Terremoto & alerta');
  assert.match(items[0].sourceUrl, /&eventtype=EQ/);
  assert.equal(items[0].region, 'Fiji');
  assert.match(items[0].description, /á á/);
  const rss = `<rss>${Array.from({ length: 55 }, (_, i) => gdacsItem(i)).join('')}${gdacsItem(99, 'Fri, 06 Nov 2026 12:00:00 GMT')}</rss>`;
  const limited = await fetchGdacsAlerts(mockText(rss));
  assert.equal(limited.length, 50);
  assert.match(limited[0].sourceUrl, /eventid=99&/);
});

test('todos os adaptadores propagam HTTP e formatos inválidos com contexto', async () => {
  process.env.CLOUDFLARE_RADAR_TOKEN = 'fixture-token';
  for (const [, fetcher] of SOURCE_FETCHERS) {
    await assert.rejects(fetcher(async () => ({ ok: false, status: 503 })), /HTTP 503/);
    await assert.rejects(fetcher(mockJson({})), /resposta inválida|formato|colunas|sucesso|RSS/);
    await assert.rejects(fetcher(async () => { throw new Error('detalhe confidencial'); }), (error) => {
      assert.doesNotMatch(error.message, /confidencial/);
      return /falha de rede/.test(error.message);
    });
  }
});

test('ingest mantém sucesso parcial, ordenação e Radar sem token fora dos erros', async (t) => {
  t.mock.method(console, 'error', () => {});
  const dir = await mkdtemp(path.join(process.cwd(), '.test-ingest-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outFile = path.join(dir, 'incidents.json');
  const visited = [];
  const doc = await runIngest({ outFile, fetchFn: async (url) => {
    visited.push(url);
    if (url.includes('cisa.gov')) return { ok: true, json: async () => kev };
    if (url.includes('ioda.')) return { ok: false, status: 503 };
    if (url.includes('ons-aws')) return { ok: true, text: async () => ons };
    if (url.includes('odin.')) return { ok: true, json: async () => odin };
    if (url.includes('gdeltproject')) return { ok: true, json: async () => gdelt };
    if (url.includes('usgs.gov')) return { ok: true, json: async () => usgs };
    if (url.includes('gdacs.org')) return { ok: true, text: async () => gdacs };
    assert.fail(`URL inesperada: ${url}`);
  } });
  assert.equal(visited.length, 7);
  assert.deepEqual(doc.errors, [{ source: 'IODA', message: 'IODA HTTP 503' }]);
  const power = doc.items.filter((i) => i.kind === 'power');
  assert.ok(power.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon)).length / power.length >= 0.8);
  assert.equal(doc.count, doc.items.length);
  assert.equal(new Set(doc.items.map((i) => i.source)).size, 6);
  assert.deepEqual(doc.items.map((i) => i.publishedAt), doc.items.map((i) => i.publishedAt).sort().reverse());
  assert.deepEqual(JSON.parse(await readFile(outFile, 'utf8')), doc);
});

test('smoke: ingest de todas as fontes com mocks geolocaliza ao menos 80% dos apagões', async (t) => {
  process.env.CLOUDFLARE_RADAR_TOKEN = 'fixture-token';
  const dir = await mkdtemp(path.join(process.cwd(), '.test-ingest-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const doc = await runIngest({ outFile: path.join(dir, 'incidents.json'), fetchFn: async (url) => {
    if (url.includes('cisa.gov')) return { ok: true, json: async () => kev };
    if (url.includes('annotations/outages')) return { ok: true, json: async () => radarOutages };
    if (url.includes('attacks/layer7')) return { ok: true, json: async () => attacks };
    if (url.includes('ioda.')) return { ok: true, json: async () => ioda };
    if (url.includes('ons-aws')) return { ok: true, text: async () => ons };
    if (url.includes('odin.')) return { ok: true, json: async () => odin };
    if (url.includes('gdeltproject')) return { ok: true, json: async () => gdelt };
    if (url.includes('usgs.gov')) return { ok: true, json: async () => usgs };
    if (url.includes('gdacs.org')) return { ok: true, text: async () => gdacs };
    assert.fail(`URL inesperada: ${url}`);
  } });
  assert.deepEqual(doc.errors, []);
  const power = doc.items.filter((i) => i.kind === 'power');
  assert.ok(power.length >= 7);
  assert.ok(power.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon)).length / power.length >= 0.8);
});
