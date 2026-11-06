# Tabelas estáticas de localização

Sem geocoding externo durante a ingestão. Pontos de país/estado/condado são aproximações, não o local exato da interrupção.

- `countries.json`: centróides planares ponderados pela área dos polígonos Natural Earth 1:110m, com alinhamento das ilhas no antimeridiano. ISO-2, ISO-3 e nomes comuns/oficiais em inglês, português e espanhol do dataset público [mledoze/countries](https://github.com/mledoze/countries) (ODbL). Países/territórios pequenos ausentes na malha 1:110m usam o campo `latlng` desse dataset como centro aproximado; não representa cidades. Download: https://raw.githubusercontent.com/mledoze/countries/master/countries.json
- `br-ufs.json`: centróides planares ponderados pela área das 27 UFs, calculados dos polígonos [Click That Hood / Brazil states](https://github.com/codeforamerica/click_that_hood/blob/master/public/data/brazil-states.geojson) (dados abertos, ODbL). Download: https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson
- `us-counties.json`: `GEOID` (FIPS preservado com cinco dígitos), `NAME`, `USPS`, `INTPTLAT`, `INTPTLONG` do [Census Gazetteer 2025](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html), domínio público. INTPT é ponto interno representativo do condado. Download oficial: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip
- `../../public/geo/countries.geojson`: limites Natural Earth 1:110m, versão 5.1.2, [domínio público](https://www.naturalearthdata.com/about/terms-of-use/). Download: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson

Para reproduzir: baixe os três primeiros arquivos para `/tmp/mapa-countries.json`, `/tmp/mapa-br.json`, `/tmp/mapa-counties.zip` e baixe também o Natural Earth para `public/geo/countries.geojson` e execute `python3 scripts/build-geo.py`. O ZIP não é versionado. O mapa usa o GeoJSON local para não depender de GitHub na renderização.

Topônimos conhecidos usados no fallback textual do Radar ficam em `src/geo.mjs`; entidades desconhecidas permanecem sem coordenadas. Nomes de países são comparados por palavras completas, sem interpretar siglas curtas no texto livre.
