# Monitor global de incidentes (apagões e ciberataques) — proposta de fontes

Status: adaptadores locais implementados em 06/11/2026, sem publicação. Pesquisa inicial em 05/11/2026.
Idiomas: pt, en, es. Hospedagem: VPS Coolify (exige GO para criar app/subdomínio).

## Fontes ativas no ingest local

| Fonte | Endpoint / referência | Comportamento |
|---|---|---|
| CISA KEV | [JSON oficial](https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json) | Catálogo de vulnerabilidades exploradas; sem chave |
| Cloudflare Radar | [Outages](https://developers.cloudflare.com/api/resources/radar/subresources/annotations/subresources/outages/methods/get/) e [resumo HTTP](https://developers.cloudflare.com/api/resources/radar/subresources/attacks/subresources/layer7/subresources/summary/methods/http_method/) | Token opcional em `CLOUDFLARE_RADAR_TOKEN`; desligado sem token; até 100 outages e um agregado de 7 dias |
| IODA v2 | [API de alertas](https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts) | Até 100 alertas dos últimos 7 dias; Unix absoluto |
| ONS | [Interrupção de Carga](https://dados.ons.org.br/dataset/interrupcao_carga) | CSV público, 200 eventos mais recentes; agrega linhas de mesma perturbação e data |
| ODIN / ORNL | [JSON público](https://odin.ornl.gov/odi?format=JSON) | Até 100 eventos por medidores afetados; remove ETR há mais de 24h |
| GDELT DOC 2.0 | [API DOC](https://api.gdeltproject.org/api/v2/doc/doc) | Uma query multilíngue, até 50 artigos, status `reportado`; intervalo mínimo de 5s entre ingests |
| USGS | [GeoJSON diário M4.5+](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson) | Terremotos, status `confirmado` |
| GDACS | [RSS público](https://www.gdacs.org/xml/rss.xml) | Até 50 alertas mais recentes, status `confirmado` |

Os adaptadores usam apenas Node stdlib e falhas isoladas por fonte. Radar sem token é sucesso com zero itens. Os testes usam mocks, sem chamadas externas. `scripts/smoke.mjs` é opcional e consulta APIs reais exibindo somente contagens.

No ODIN, datas de início ausentes usam o horário da coleta, com `timeBasis=observed`. No ONS, datas sem fuso usam UTC-3. GDELT fornece a data de observação do artigo. O agregado Radar descreve a distribuição dos ataques HTTP, sem criar milhares de incidentes.

## Fontes pendentes e alternativas

- **ENTSO-E**: pendente de token manual; nenhum adaptador ou stub executável implementado.
- **ANEEL** e **cves.live**: alternativas avaliadas, fora do escopo atual.

## Avaliação inicial de acesso e termos

A tabela abaixo preserva a pesquisa inicial; não substitui a verificação dos termos antes de republicar dados.

| Tema | Fonte | Acesso | Licença / termos | Observação |
|---|---|---|---|---|
| Vulnerabilidades exploradas | CISA KEV (JSON oficial) | público, sem chave | domínio público (governo EUA) | atualizar no máximo 1x/hora |
| Vulnerabilidades (alternativa) | cves.live/data/kev.json | público | KEV domínio público; EPSS exige atribuição à FIRST | mostra EPSS e CVSS juntos |
| Apagões Europa | ENTSO-E Transparency Platform (outages) | API REST com token gratuito | verificar termos de reuso do token | dados de indisponibilidade de geração e transmissão |
| Apagões EUA | ODIN (DOE/ORNL), API pública por condado | público (API pública) | dados federais | mais detalhe exige conta autenticada |
| Apagões Brasil | ONS, Interrupção de Carga | CSV/JSON em dados.ons.org.br | CC-BY (crédito ao ONS) | só eventos > 100 MW por 10 min; atualiza 2x/dia |
| Apagões Brasil (distribuição) | ANEEL, interrupções nas redes | CSV/ZIP em dadosabertos.aneel.gov.br | ODbL | mensal, não é tempo real |
| Notícias multilíngue | GDELT | API pública | verificar termos antes de republicar | base para detectar eventos em pt/en/es |

## Fontes avaliadas e descartadas (por enquanto)

- **Recent Breaches**: API gratuita, mas só para uso não comercial; uso comercial exige licença. Descartada se o projeto tiver receita.
- **MassOutage / PowerOutageTracker / PowerOutage.com**: agregadores de EUA e Canadá; uso livre com atribuição, mas dependem de terceiros e limitam requisições.
- **blackoutmap.net**: agregador global com JSON (`/data/status.json`). Serve como referência para conferir, não como fonte de republicação sem permissão.
- **outages.uk**: só Reino Unido e exige chave.

## Como o sistema deve tratar os dados

1. Ingestão por worker separado, com cache. Nunca consultar as fontes a cada visita do usuário.
2. Cada item guarda: fonte, URL original, data de coleta, status (confirmado pela fonte oficial / reportado / a confirmar).
3. Mostrar a fonte e a data de atualização em cada card. Não somar números de regiões diferentes como se fossem medida global.
4. Respeitar os intervalos de cache de cada fonte.

## Pendências

1. Obter manualmente o token ENTSO-E antes de implementar essa fonte.
2. Verificar os termos de reuso aplicáveis antes de publicação.
3. Autorizar separadamente eventual criação do app, domínio, DNS e deploy. Nenhum desses passos foi executado nesta integração.
