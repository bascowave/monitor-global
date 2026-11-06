import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_FETCHERS } from './sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.resolve(here, '..', 'data', 'incidents.json');

export async function runIngest({ fetchFn = fetch, outFile = DATA_FILE } = {}) {
  const started = new Date().toISOString();
  const errors = [];
  let items = [];
  for (const [source, fetcher] of SOURCE_FETCHERS) {
    try { items.push(...await fetcher(fetchFn)); }
    catch (e) { errors.push({ source, message: e.message }); }
  }
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const doc = { collectedAt: started, count: items.length, errors, items };
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIngest().then((d) => console.log(`ok: ${d.count} itens, erros: ${d.errors.length}`)).catch((e) => { console.error(e); process.exit(1); });
}
