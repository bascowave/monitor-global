import { SOURCE_FETCHERS } from '../src/sources.mjs';

let failed = 0;
for (const [source, fetcher] of SOURCE_FETCHERS) {
  if (source === 'GDELT') await new Promise((r) => setTimeout(r, 6000));
  try {
    const items = await fetcher();
    if (source === 'GDELT' && items.length === 0) {
      console.log(`${source}: 0 itens (rate-limited 429 ou vazio), 0 erros`);
    } else {
      console.log(`${source}: ${items.length} itens, 0 erros`);
    }
  } catch (e) {
    console.log(`${source}: 0 itens, 1 erro (${e.message})`);
    failed = 1;
  }
}
process.exitCode = failed;
