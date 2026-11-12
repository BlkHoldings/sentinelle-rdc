#!/usr/bin/env python3
"""Reduce geoBoundaries COD ADM0/ADM1 GeoJSON to something a browser can load.

Source: geoBoundaries gbOpen COD (OpenStreetMap / Wambacher, ODbL 1.0).
Usage:  build-boundaries.py <ADM0.geojson> <ADM1.geojson> <out_dir>

Douglas-Peucker at ~1 km, coordinates rounded to 3 decimals (~110 m).
These are display outlines, not survey boundaries.
"""
import json, sys

FR = {
    'CD-BU': 'Bas-Uele', 'CD-EQ': 'Équateur', 'CD-HK': 'Haut-Katanga', 'CD-HL': 'Haut-Lomami',
    'CD-HU': 'Haut-Uele', 'CD-IT': 'Ituri', 'CD-KS': 'Kasaï', 'CD-KC': 'Kasaï-Central',
    'CD-KE': 'Kasaï-Oriental', 'CD-KN': 'Kinshasa', 'CD-BC': 'Kongo-Central', 'CD-KG': 'Kwango',
    'CD-KL': 'Kwilu', 'CD-LO': 'Lomami', 'CD-LU': 'Lualaba', 'CD-MN': 'Mai-Ndombe',
    'CD-MA': 'Maniema', 'CD-MO': 'Mongala', 'CD-NK': 'Nord-Kivu', 'CD-NU': 'Nord-Ubangi',
    'CD-SA': 'Sankuru', 'CD-SK': 'Sud-Kivu', 'CD-SU': 'Sud-Ubangi', 'CD-TA': 'Tanganyika',
    'CD-TO': 'Tshopo', 'CD-TU': 'Tshuapa',
}

def dp(pts, tol):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = dx * dx + dy * dy
        best, bi = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if n == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / n))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best: best, bi = d, i
        if best > tol * tol:
            keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def ring(r, tol):
    out = [[round(x, 3), round(y, 3)] for x, y in dp(r, tol)]
    return out if len(out) >= 4 else None

def area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2

def geom(g, tol, min_area):
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    out = []
    for poly in polys:
        if area(poly[0]) < min_area: continue          # drop slivers and islets
        rings = [x for x in (ring(r, tol) for r in poly) if x]
        if rings: out.append(rings)
    return {'type': 'MultiPolygon', 'coordinates': out}

def centroid(g):
    big = max(g['coordinates'], key=lambda p: area(p[0]))[0]
    return [round(sum(p[0] for p in big) / len(big), 3), round(sum(p[1] for p in big) / len(big), 3)]

adm0, adm1, out = sys.argv[1:4]
j0 = json.load(open(adm0)); j1 = json.load(open(adm1))
f0 = [{'type': 'Feature', 'properties': {'name': 'République démocratique du Congo'},
       'geometry': geom(f['geometry'], 0.01, 0.002)} for f in j0['features']]
f1 = []
for f in j1['features']:
    iso = f['properties']['shapeISO']
    g = geom(f['geometry'], 0.01, 0.002)
    f1.append({'type': 'Feature',
               'properties': {'iso': iso, 'name': FR.get(iso, f['properties']['shapeName']), 'label': centroid(g),
                              'area': round(sum(area(p[0]) for p in g['coordinates']), 2)},
               'geometry': g})
meta = {'source': 'geoBoundaries gbOpen COD (OpenStreetMap / Wambacher)', 'license': 'ODbL 1.0', 'boundaryYear': '2017'}
json.dump({'type': 'FeatureCollection', 'meta': meta, 'features': f0}, open(f'{out}/cod-adm0.json', 'w'), separators=(',', ':'), ensure_ascii=False)
json.dump({'type': 'FeatureCollection', 'meta': meta, 'features': f1}, open(f'{out}/cod-adm1.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(f0), len(f1), sorted(p['properties']['name'] for p in f1))
