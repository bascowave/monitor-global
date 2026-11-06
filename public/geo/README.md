# Limites locais

`br-ufs.geojson` (27 UFs, 102 KB) e `us-states.geojson` (50 estados + DC, 200 KB) derivam do [Natural Earth admin-1 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson), [domínio público](https://www.naturalearthdata.com/about/terms-of-use/).

Foram filtrados por ISO-2, reduzidos às propriedades `country`, `state`, `name`, e arredondados a três casas decimais. Geometrias cartográficas generalizadas, impróprias para fins legais. Regenerar com `python3 scripts/build-local-geo.py`; nenhum download de terceiros ocorre em runtime. Apenas os arquivos locais do país escolhido são carregados sob demanda.
