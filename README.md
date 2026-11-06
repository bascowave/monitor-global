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
| ONS | CSV de interrupções de carga; 200 eventos mais recentes, agrupados por perturbação e data |
| ODIN / ORNL | Até 100 interrupções nos EUA por medidores afetados; exclui restauração estimada há mais de 24h |
| GDELT DOC 2.0 | Uma consulta multilíngue, até 50 notícias com status `reportado` |
| USGS | Terremotos de magnitude 4,5 ou superior no feed diário |
| GDACS | Até 50 alertas de desastres mais recentes do RSS |

Sem token, os dois adaptadores Radar retornam zero itens e registram o aviso em stderr, sem erro no ingest. As outras fontes não exigem chave. ENTSO-E continua pendente de obtenção manual de token e não foi implementada. Detalhes e URLs em [PROPOSTA-FONTES.md](PROPOSTA-FONTES.md).

Cada falha fica em `errors` com fonte e mensagem; as demais coletas continuam. Os itens são ordenados por `publishedAt` decrescente. Outages de internet usam `kind=power`; ataques usam `cyber`, notícias `news` e desastres `disaster`. `confirmado` indica registro pela fonte, sem validação independente pelo monitor. O Radar de ataques é um agregado estatístico, não um incidente individual.

No ONS, horários sem fuso são interpretados como Brasília (UTC-3). No ODIN, quando não existe data de início, `publishedAt` representa a coleta e `timeBasis=observed` sinaliza essa situação. No GDELT, a data é a primeira observação (`seendate`) do artigo pelo agregador.

Não execute coletas com intervalo inferior a 5 segundos: o GDELT recebe uma única requisição por ingest. Para uso recorrente, mantenha cache e respeite os limites das fontes; não consulte as APIs a cada visita.

O diagnóstico opcional `node scripts/smoke.mjs` usa as APIs reais e imprime apenas contagens por adaptador, sem gravar `incidents.json`. O Radar usa a variável de ambiente se configurada. Para carregar `.env`, use `node --env-file=.env scripts/smoke.mjs`.

## Deploy

Não publicado. Criar o app na Coolify, o domínio e o DNS exigem autorização explícita.
