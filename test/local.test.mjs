import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterLocal, parseLocal, localUrl } from '../public/local.js';
import { clusterMarkers } from '../public/map.js';
import { resolveBrUf, resolveUsCounty, resolveUsState } from '../src/geo.mjs';
import { fetchGdeltArticles, fetchOdinOutages, fetchOnsInterruptions } from '../src/sources.mjs';
const items = [
  { id: '1', country: 'BR', state: 'RR', kind: 'power', publishedAt: '2026-11-04' },
  { id: '2', country: 'BR', state: 'SP', kind: 'cyber', publishedAt: '2026-11-06' },
  { id: '3', country: 'BR', kind: 'news', publishedAt: '2026-11-05' },
  { id: '4', country: 'US', state: 'AZ', kind: 'power', publishedAt: '2026-11-06' },
  { id: '5', country: 'US', state: 'NY', kind: 'disaster', publishedAt: '2026-11-05' },
];
test('local: país ordenado, UF BR, estado US e filtros sem incluir itens sem estado', () => {
  assert.deepEqual(filterLocal(items, { country: 'BR' }).map(i => i.id), ['2','3','1']);
  assert.deepEqual(filterLocal(items, { country: 'BR', state: 'RR' }).map(i => i.id), ['1']);
  assert.deepEqual(filterLocal(items, { country: 'US', state: 'AZ' }).map(i => i.id), ['4']);
  assert.equal(filterLocal(items, { country: 'BR' }, 'power').length, 1);
  assert.equal(filterLocal(items, { country: 'BR' }, 'cyber').length, 1);
  assert.equal(filterLocal(items, { country: 'BR' }, 'disaster').length, 0);
  assert.deepEqual(filterLocal(items, null), []);
});
test('local: cluster preserva membros e filtra somente IDs do grupo', () => {
  const markers = items.slice(0,2).map(i => ({ ...i, lat: 1, lon: 2, kind: 'power' }));
  const [group] = clusterMarkers(markers);
  assert.equal(group.items.length, 2);
  assert.deepEqual(filterLocal(items, group).map(i => i.id), ['2','1']);
  assert.equal(filterLocal(items, group, 'cyber').length, 1);
});
test('local: URL país/estado, hash, fechamento e preservação de parâmetros', () => {
  assert.deepEqual(parseLocal('br-rr'), { country: 'BR', state: 'RR' });
  assert.deepEqual(parseLocal('US'), { country: 'US' });
  assert.equal(parseLocal('<BR>'), null);
  assert.equal(localUrl('https://example.org/?x=1#BR-RR', { country: 'US', state: 'AZ' }), '/?x=1&local=US-AZ');
  assert.equal(localUrl('https://example.org/?local=BR#BR', null), '/');
  assert.equal(localUrl('https://example.org/?local=BR#mapa', { items: [] }), '/#mapa');
});
test('geografia: campos state na coleta ONS/ODIN, inclusive FIPS sem condado cadastrado', async () => {
  assert.equal(resolveBrUf('rr').state, 'RR');
  assert.equal(resolveUsCounty('4019').state, 'AZ');
  assert.equal(resolveUsState('06000'), 'CA');
  assert.equal(resolveUsState('99999'), undefined);
  assert.equal(resolveUsState('invalid'), undefined);
  const json = (data) => async () => ({ ok: true, json: async () => data });
  const [odin] = await fetchOdinOutages(json({ outage: [{ communityDescriptor: '06000', metersAffected: 5 }] }));
  assert.equal(odin.state, 'CA');
  assert.equal(odin.country, 'US');
  const [ons] = await fetchOnsInterruptions(async () => ({ ok: true, text: async () => 'cod_perturbacao;din_interrupcaocarga;id_estado;val_cargainterrompida_mw\n1;2026-11-05 12:00:00;RR;20' }));
  assert.equal(ons.state, 'RR');
});
test('GDELT: sourcecountry por nome, ISO-2, ISO-3 e desconhecido', async () => {
  const countries = ['Brazil', 'US', 'ESP', 'Unknown'];
  const result = await fetchGdeltArticles(async () => ({ ok: true, json: async () => ({ articles: countries.map((sourcecountry, n) => ({ sourcecountry, url: `https://example.org/${n}`, seendate: '20261105T120000Z' })) }) }));
  assert.deepEqual(result.map(i => i.country), ['BR', 'US', 'ES', undefined]);
});
test('GeoJSON locais: 27 UFs, 50 estados + DC, códigos únicos, limites leves', () => {
  for (const [name, count, country] of [['br-ufs',27,'BR'], ['us-states',51,'US']]) {
    const raw = readFileSync(new URL(`../public/geo/${name}.geojson`, import.meta.url));
    const geo = JSON.parse(raw);
    assert.ok(raw.length < 500000);
    assert.equal(geo.features.length, count);
    assert.equal(new Set(geo.features.map(f => f.properties.state)).size, count);
    assert.ok(geo.features.every(f => f.properties.country === country && /^[A-Z]{2}$/.test(f.properties.state) && ['Polygon','MultiPolygon'].includes(f.geometry.type)));
  }
});
