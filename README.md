# Monitor global de incidentes

Mostra apagões, conectividade, incidentes cibernéticos, desastres e notícias com fonte e data, em pt, en e es. Tokens visuais em `public/styles.css`, extraídos da referência em 05/11/2026.

## Uso local

Requer Node.js 20 ou superior, sem dependências npm externas.

```sh
npm test          # testes com mocks, sem rede ou credenciais reais
npm run ingest    # coleta as fontes e grava data/incidents.json
npm start         # http://localhost:3000
```

A configuração está em `.env.example`. Para usar um `.env` local, copie o exemplo, preencha apenas as variáveis necessárias e execute `node --env-file=.env src/ingest.mjs` ou `node --env-file=.env src/server.mjs`. Os comandos npm não carregam `.env` automaticamente; também é possível exportar as variáveis no shell. `.env` e `node_modules/` são ignorados pelo Git. O arquivo `data/incidents.json` continua versionado.

## Fontes

| Fonte implementada | Dados e limite por coleta |
|---|---|
| CISA KEV | Catálogo de vulnerabilidades exploradas, preservado integralmente |
| Cloudflare Radar | Até 100 outages e um resumo global de ataques HTTP dos últimos 7 dias; requer `CLOUDFLARE_RADAR_TOKEN` |
| IODA v2 | Até 100 alertas de conectividade dos últimos 7 dias, com timestamps Unix absolutos |
| ONS | CSV de interrupções de carga; 200 eventos mais recentes, agrupados por perturbação, data e UF |
| ODIN / ORNL | Até 100 interrupções nos EUA por medidores afetados; exclui restauração estimada há mais de 24h |
| GDELT DOC 2.0 | Uma consulta multilíngue, até 50 notícias com status `reportado` |
| USGS | Terremotos de magnitude 4,5 ou superior no feed diário |
| GDACS | Até 50 alertas de desastres mais recentes do RSS |

Sem token, os dois adaptadores Radar retornam zero itens e registram o aviso em stderr, sem erro no ingest. As outras fontes não exigem chave. ENTSO-E continua pendente de obtenção manual de token e não foi implementada. Detalhes e URLs em [PROPOSTA-FONTES.md](PROPOSTA-FONTES.md).

Cada falha fica em `errors` com fonte e mensagem; as demais coletas continuam. Os itens são ordenados por `publishedAt` decrescente. Outages de internet usam `kind=power`; ataques usam `cyber`, notícias `news` e desastres `disaster`. `confirmado` indica registro pela fonte, sem validação independente pelo monitor. O Radar de ataques é um agregado estatístico, não um incidente individual.

No ONS, horários sem fuso são interpretados como Brasília (UTC-3). No ODIN, quando não existe data de início, `publishedAt` representa a coleta e `timeBasis=observed` sinaliza essa situação. No GDELT, a data é a primeira observação (`seendate`) do artigo pelo agregador.

Não execute coletas com intervalo inferior a 5 segundos: o GDELT recebe uma única requisição por ingest. Para uso recorrente, mantenha cache e respeite os limites das fontes; não consulte as APIs a cada visita.

O diagnóstico opcional `node scripts/smoke.mjs` usa as APIs reais e imprime apenas contagens por adaptador, sem gravar `incidents.json`. O Radar usa a variável de ambiente se configurada. Para carregar `.env`, use `node --env-file=.env scripts/smoke.mjs`.

## Localização no mapa

`src/geo.mjs` resolve ISO-2/ISO-3 e nomes en/pt, centróides das 27 UFs e pontos internos de condados por FIPS. Dados, proveniência e geração reproduzível estão em [data/geo/README.md](data/geo/README.md). Não há API de geocoding nem dependências de runtime adicionais.

O Radar usa `locationsDetails[].code` e `locations[]`, com fallback textual por país/topônimo (incluindo Zhytomyr → UA); eventos em vários países geram um item por país. IODA usa o código do país ou `attrs.country_code`; ASN/geoASN sem esse campo permanecem sem coordenadas. ONS soma MW por evento e UF; ODIN preserva medidores em `clientes` e resolve o FIPS. USGS e GDACS usam coordenadas dos feeds, com fallback GDACS por país.

`precisao` indica `pais`, `estado`, `condado` ou `exata`. O heatmap usa ISO-2. Pontos próximos são agrupados em células de 2°, com gravidade máxima e soma de MW/clientes em campos distintos; o raio usa MW ou clientes. Pontos de país são menores e menos opacos. O toggle **Desastres** começa desligado e acrescenta USGS/GDACS em roxo. O GeoJSON Natural Earth é servido localmente.

## Deploy

Não publicado. Criar o app na Coolify, o domínio e o DNS exigem autorização explícita.

### Painel local no mapa

Clique/toque em país, UF/estado ou ponto agrupado para abrir as ocorrências locais. Enter/Espaço também ativam os polígonos; X/Escape fecham e devolvem o foco. O painel fica à direita no desktop e na parte inferior no celular. Filtros locais (Tudo, Apagões, Ciber, Desastres) não dependem das abas da lista global; Notícias têm seção própria. Cada seção é ordenada por `publishedAt` decrescente.

Compartilhe `?local=BR`, `?local=BR-RR`, `?local=US-AZ` (também aceita `#BR` e `#BR-RR`). A seleção/fechamento atualiza a URL com `history.replaceState`. Grupos de pontos abrem somente seus membros, sem código geográfico compartilhável.

BR/EUA carregam limites apenas na seleção do país; há zoom e seletor de estados, inclusive Alaska, Havaí e DC. A visão inicial dos EUA destaca o território continental; os demais continuam acessíveis pelo seletor. Os [GeoJSON locais](public/geo/README.md) usam Natural Earth de domínio público. ONS preenche `state` com UF; ODIN usa tabela estática FIPS→USPS e mantém estado mesmo quando o condado não possui coordenadas. Reexecute `npm run ingest` para atualizar dados antigos sem esses campos.

GDELT preenche `country` pelo `sourcecountry`: é o país da fonte jornalística, que pode diferir do local do fato. Notícias sem estado conhecido aparecem somente no país; itens globais sem país não são atribuídos artificialmente a um local.

Validação: `npm test` (inclui filtros locais, clusters, URLs, GDELT, normalização de estado e integridade/tamanho dos limites). Merge e deploy somente com GO explícito.
