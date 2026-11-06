import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveCountry, resolveBrUf, resolveUsCounty, attachGeo, countriesInText } from '../src/geo.mjs';
import { fetchCloudflareOutages, fetchIodaAlerts, fetchOnsInterruptions, fetchOdinOutages, fetchUsgsEarthquakes, fetchGdacsAlerts } from '../src/sources.mjs';
import { clusterMarkers, drawCountries } from '../public/map.js';
const json = (data) => async () => ({ ok: true, json: async () => data });
const text = (data) => async () => ({ ok: true, text: async () => data });
const start = '2026-11-05T12:00:00Z';
const point = (item, country, precisao) => {
  assert.equal(item.country, country);
  assert.equal(item.precisao, precisao);
  assert.ok(Number.isFinite(item.lat) && Number.isFinite(item.lon));
};

test('tabelas: nomes en/pt, ISO-3, 27 UFs e FIPS com zero inicial', async () => {
  assert.equal(resolveCountry('Brasil').country, 'BR');
  assert.equal(resolveCountry('United States').country, 'US');
  assert.equal(resolveCountry('Ucrânia').country, 'UA');
  assert.equal(resolveCountry('UKR').country, 'UA');
  assert.equal(resolveCountry('desconhecido'), null);
  const ufs = JSON.parse(await readFile(new URL('../data/geo/br-ufs.json', import.meta.url)));
  assert.equal(Object.keys(ufs).length, 27);
  for (const uf of Object.keys(ufs)) point(resolveBrUf(uf.toLowerCase()), 'BR', 'estado');
  point(resolveUsCounty('04019'), 'US', 'condado');
  assert.equal(resolveUsCounty(4019).name, 'Pima County');
  assert.equal(resolveUsCounty('99999'), null);
  assert.equal(resolveUsCounty(''), null);
  assert.deepEqual(attachGeo({ id: 'x' }, { country: 'BR', lat: null, lon: '', precisao: 'exata' }), { id: 'x', country: 'BR' });
  assert.equal(attachGeo({}, { lat: 91, lon: 0, precisao: 'exata' }).lat, undefined);
  assert.deepEqual(countriesInText('Internet in an unknown region'), []);
  assert.deepEqual(countriesInText('Outage in South Sudan').map((g) => g.country), ['SS']);
});

test('Radar: código preferido, locations, múltiplos países e Zhytomyr sem locations', async (t) => {
  const previous = process.env.CLOUDFLARE_RADAR_TOKEN;
  process.env.CLOUDFLARE_RADAR_TOKEN = 'fixture-token';
  t.after(() => previous === undefined ? delete process.env.CLOUDFLARE_RADAR_TOKEN : process.env.CLOUDFLARE_RADAR_TOKEN = previous);
  const annotations = [
    { id: 1, startDate: start, locationsDetails: [{ code: 'BR', name: 'Nome não padronizado' }], locations: ['BR', 'PT'], description: 'Power outage' },
    { id: 1744, startDate: start, locations: [], locationsDetails: [], description: 'Power outage in Zhytomyr' },
    { id: 3, startDate: start, locations: [], description: 'Connectivity disruption in Brazil and Portugal' },
    { id: 4, startDate: start, locations: ['ZZ'], description: 'Unknown outage' },
  ];
  const items = await fetchCloudflareOutages(json({ success: true, result: { annotations } }));
  assert.deepEqual(items.map((i) => i.country), ['BR', 'PT', 'UA', 'BR', 'PT', undefined]);
  for (const i of items.slice(0, -1)) point(i, i.country, 'pais');
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
});

test('IODA: country, region, asn/geoasn com e sem país; gravidade', async () => {
  const entities = [
    { type: 'country', code: 'UA' },
    { type: 'region', code: '1234', attrs: { country_code: 'BR' } },
    { type: 'asn', code: '64500', attrs: { country_code: 'US' } },
    { type: 'geoasn', code: '64501', attrs: { country_code: 'PT' } },
    { type: 'asn', code: '64502' },
    { type: 'geoasn', code: 'BR' }, // Não inferir país pelo código da entidade.
  ];
  const items = await fetchIodaAlerts(json({ data: entities.map((entity, i) => ({ entity, datasource: 'bgp', time: 1793880000, level: ['critical','warning','normal'][i % 3] })) }));
  for (const [i,c] of ['UA','BR','US','PT'].entries()) point(items[i], c, 'pais');
  assert.equal(items[4].lat, undefined);
  assert.equal(items[5].country, undefined);
  assert.deepEqual(items.slice(0,3).map((i) => i.severity), ['alta','media','baixa']);
});

test('ONS: soma MW por evento/UF e usa limiares de gravidade', async () => {
  const csv = 'cod_perturbacao;din_interrupcaocarga;id_estado;val_cargainterrompida_mw\n1;2026-11-05 12:00:00;SP;80\n1;2026-11-05 12:00:00;SP;20\n1;2026-11-05 12:00:00;RJ;20\n2;2026-11-05 12:00:00;BA;19';
  const items = await fetchOnsInterruptions(text(csv));
  assert.equal(items.length, 3);
  for (const i of items) point(i, 'BR', 'estado');
  assert.deepEqual(items.map((i) => i.mw), [100,20,19]);
  assert.deepEqual(items.map((i) => i.severity), ['alta','media','baixa']);
  assert.notEqual(items[0].lat, items[1].lat);
});

test('ODIN: FIPS, clientes e gravidade; FIPS desconhecido sem coordenadas', async () => {
  const items = await fetchOdinOutages(json({ outage: [10000,1000,999].map((metersAffected, i) => ({ communityDescriptor: i === 2 ? '99999' : '04019', metersAffected, reportedStartTime: start })) }));
  point(items[0], 'US', 'condado');
  assert.match(items[0].region, /Pima County.*AZ/);
  assert.equal(items[0].clientes, 10000);
  assert.deepEqual(items.map((i) => i.severity), ['alta','media','baixa']);
  assert.equal(items[2].lat, undefined);
  assert.equal(items[2].region, 'EUA / FIPS 99999');
});

test('USGS: ordem lon/lat e coordenadas exatas inclusive zero', async () => {
  const items = await fetchUsgsEarthquakes(json({ features: [{ id: 'one', geometry: { coordinates: [0,-18.1,20] }, properties: { time: Date.parse(start), place: 'Fiji' } }] }));
  point(items[0], 'FJ', 'exata');
  assert.equal(items[0].lat, -18.1);
  assert.equal(items[0].lon, 0);
});

test('GDACS: geo:lat/long, bbox e fallback ISO-3 para país', async () => {
  const entry = (id, geo) => `<item><title>Evento ${id}</title><link>https://gdacs.org/${id}</link><guid>${id}</guid><pubDate>${start}</pubDate><gdacs:iso3>BRA</gdacs:iso3>${geo}</item>`;
  const items = await fetchGdacsAlerts(text(`<rss>${entry(1,'<geo:lat>-22</geo:lat><geo:long>-45</geo:long>')}${entry(2,'<gdacs:bbox>-50 -40 -24 -20</gdacs:bbox>')}${entry(3,'')}</rss>`));
  point(items[0], 'BR', 'exata');
  assert.equal(items[0].lat, -22);
  assert.equal(items[0].lon, -45);
  point(items[1], 'BR', 'exata');
  assert.equal(items[1].lat, -22);
  assert.equal(items[1].lon, -45);
  point(items[2], 'BR', 'pais');
});

test('mapa agrupa pontos, soma métricas e mantém desastres/país separados', () => {
  const base = { lat: 10.1, lon: 20.1, kind: 'power', precisao: 'condado', clientes: 100, label: 'A', severity: 'baixa' };
  const groups = clusterMarkers([base, { ...base, lat:10.2, clientes:200, mw:30, label:'B', severity:'alta' }, { ...base, kind:'disaster' }, { ...base, precisao:'pais', country:'US' }]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].clientes, 300);
  assert.equal(groups[0].mw, 30);
  assert.equal(groups[0].severity, 'alta');
  assert.match(groups[0].label, /A\nB/);
});

test('heatmap resolve ISO_A2 e fallback ISO_A2_EH', (t) => {
  const element = () => ({ setAttribute() {}, appendChild() {} });
  const previous = globalThis.document;
  globalThis.document = { createElementNS: element };
  t.after(() => previous === undefined ? delete globalThis.document : globalThis.document = previous);
  const codes = [];
  drawCountries(element(), { features: ['BR', '-99'].map((ISO_A2) => ({ properties: { NAME: 'Nome diferente', ISO_A2, ISO_A2_EH:'FR' }, geometry:{ type:'Polygon',coordinates:[] } })) }, (code) => { codes.push(code); });
  assert.deepEqual(codes, ['BR','FR']);
});
