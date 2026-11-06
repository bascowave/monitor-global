"""Gera tabelas estáticas sem dependências. Downloads de origem ficam em /tmp.
Veja data/geo/README.md para URLs, licenças e limites de precisão.
"""
import csv, io, json, pathlib, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
def write(name, data):
    (ROOT / 'data/geo' / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def ring_centroid(ring):
    area = x = y = 0
    for a,b in zip(ring, ring[1:]):
        cross = a[0]*b[1] - b[0]*a[1]
        area += cross; x += (a[0]+b[0])*cross; y += (a[1]+b[1])*cross
    return (abs(area/2), x/(3*area), y/(3*area)) if area else (0,0,0)
def geometry_centroid(geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    rings=[]
    for poly in polys:
        for i, ring in enumerate(poly):
            area,x,y=ring_centroid(ring)
            rings.append((area if i==0 else -area,x,y))
    anchor=max(rings)[1]
    # Alinhar ilhas dos dois lados do antimeridiano ao maior polígono.
    aligned=[(a, anchor+(x-anchor+180)%360-180, y) for a,x,y in rings]
    total=sum(a for a,x,y in aligned)
    lon=(sum(a*x for a,x,y in aligned)/total+180)%360-180
    return round(sum(a*y for a,x,y in aligned)/total,5),round(lon,5)

countries = {}
for c in json.load(open('/tmp/mapa-countries.json')):
    if len(c['latlng']) != 2: continue
    names = [c['name']['common'], c['name']['official'], *c.get('altSpellings', [])]
    for lang in ['por', 'spa']:
        names.extend(c.get('translations', {}).get(lang, {}).values())
    countries[c['cca2']] = dict(iso3=c['cca3'], name=c['name']['common'], names=sorted(set(names)), lat=c['latlng'][0], lon=c['latlng'][1])
for f in json.load(open(ROOT / 'public/geo/countries.geojson'))['features']:
    p=f['properties']; code=p['ISO_A2_EH'] if p['ISO_A2']=='-99' else p['ISO_A2']
    if code in countries:
        countries[code]['lat'],countries[code]['lon']=geometry_centroid(f['geometry'])
write('countries.json', dict(sorted(countries.items())))
with zipfile.ZipFile('/tmp/mapa-counties.zip') as z:
    rows = csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig')), delimiter='|')
    counties = {}
    for row in rows:
        r = {k.strip(): v.strip() for k,v in row.items()}
        counties[r['GEOID']] = dict(name=r['NAME'], state=r['USPS'], lat=float(r['INTPTLAT']), lon=float(r['INTPTLONG']))
write('us-counties.json', counties)
# Centróides planares ponderados pela área de cada anel da malha pública de UFs (Click That Hood).
states = {}
for f in json.load(open('/tmp/mapa-br.json'))['features']:
    p=f['properties']; geom=f['geometry']
    lat,lon=geometry_centroid(geom)
    states[p['sigla']] = dict(lat=lat, lon=lon)
assert len(states)==27
write('br-ufs.json',dict(sorted(states.items())))
