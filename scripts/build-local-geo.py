"""Regera limites locais Natural Earth 1:50m, sem dependências.
Uso: python3 scripts/build-local-geo.py [arquivo-admin1.geojson]
Sem argumento, baixa o dataset público. Não é necessário no boot nem na coleta.
"""
import json
import pathlib
import sys
import urllib.request

SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
ROOT = pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv) > 1:
    data = json.loads(pathlib.Path(sys.argv[1]).read_text())
else:
    with urllib.request.urlopen(SOURCE, timeout=60) as response:
        data = json.load(response)

def rounded(coords):
    return [rounded(value) for value in coords] if isinstance(coords, list) else round(coords, 3)

for country, filename, count in [('BR', 'br-ufs', 27), ('US', 'us-states', 51)]:
    features = []
    for feature in data['features']:
        p = feature['properties']
        if p.get('iso_a2') != country:
            continue
        state = p['iso_3166_2'].split('-')[-1]
        if len(state) != 2:
            continue
        features.append(dict(type='Feature', properties=dict(country=country, state=state, name=p['name']),
                             geometry=dict(type=feature['geometry']['type'], coordinates=rounded(feature['geometry']['coordinates']))))
    assert len(features) == count
    output = json.dumps(dict(type='FeatureCollection', features=features), ensure_ascii=False, separators=(',', ':')) + '\n'
    assert len(output.encode()) < 500000
    (ROOT / 'public/geo' / f'{filename}.geojson').write_text(output)
