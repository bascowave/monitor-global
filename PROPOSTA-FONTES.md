# Monitor global de incidentes (apagões e ciberataques) — proposta de fontes

Status: proposta, nada construído nem publicado. Pesquisa feita em 05/11/2026.
Idiomas: pt, en, es. Hospedagem: VPS Coolify (exige GO para criar app/subdomínio).

## Fontes recomendadas para o MVP

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

## Decisões que preciso de você

1. Aprovar esta lista de fontes para o MVP, ou pedir mais alguma.
2. Confirmar que o token da ENTSO-E pode ser criado com sua conta de e-mail (eu não crio conta por você).
3. Autorizar eu criar a estrutura do repositório local (sem deploy) depois da aprovação.
4. Quando for ao ar: subdomínio e GO para criar o app na Coolify (hoje não tenho autorização para isso).
