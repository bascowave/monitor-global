import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchKev } from './sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.resolve(here, '..', 'data', 'incidents.json');

export async function runIngest({ fetchFn = fetch, outFile = DATA_FILE } = {}) {
  const started = new Date().toISOString();
  const errors = [];
  let items = [];
  try { items = items.concat(await fetchKev(fetchFn)); } catch (e) { errors.push({ source: 'CISA KEV', message: e.message }); }
  items.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  const doc = { collectedAt: started, count: items.length, errors, items: items.slice(0, 500) };
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIngest().then((d) => console.log(`ok: ${d.count} itens, erros: ${d.errors.length}`)).catch((e) => { console.error(e); process.exit(1); });
}
