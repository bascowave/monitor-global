// Fontes do MVP. Cada adaptador devolve itens normalizados:
// { id, kind: 'cyber'|'power', title, region, publishedAt, source, sourceUrl, status }
// status: 'confirmado' (fonte oficial) | 'reportado' (notícia/agregador) | 'a_confirmar'

export const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export async function fetchKev(fetchFn = fetch) {
  const res = await fetchFn(KEV_URL, { headers: { 'User-Agent': 'monitor-global/0.1 (contato do projeto)' } });
  if (!res.ok) throw new Error(`KEV HTTP ${res.status}`);
  const json = await res.json();
  return (json.vulnerabilities ?? []).map((v) => ({
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

// Apagões: adaptadores a implementar após aprovação das fontes (ENTSO-E exige token; ONS é CSV).
export const POWER_ADAPTERS_PENDING = ['ENTSO-E (token pendente)', 'ONS Interrupção de Carga', 'ODIN (EUA)'];
