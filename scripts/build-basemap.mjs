// Build the committed mini-map basemap from Natural Earth 10m GeoJSON.
// Authoring-time tool — not part of the runtime or build. Re-run only to
// extend coverage or retune fidelity; the output is committed.
//
//   node scripts/build-basemap.mjs
//
// Downloads (cached in scripts/.ne-cache/, gitignored) → clips each layer
// to per-region bboxes (Sutherland–Hodgman for rings, inside-run splitting
// for lines) → Douglas–Peucker simplification → rounded coords → single
// JSON at app/public/map/basemap.json. HARD BUDGET: ≤ 250 KB gzipped.
// Over budget or a pin outside every region → exit 1, nothing written.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.ne-cache');
const OUT = path.join(ROOT, 'app', 'public', 'map', 'basemap.json');
const BUDGET = 250 * 1024;

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const SOURCES = {
  land: 'ne_10m_land.geojson',
  lakes: 'ne_10m_lakes.geojson',
  states: 'ne_10m_admin_1_states_provinces_lines.geojson',
  countries: 'ne_10m_admin_0_boundary_lines_land.geojson',
};

// Region bboxes are sized so a single-pin 120 km city-grade window at any
// covered pin stays inside the region. [west, south, east, north].
// tol = Douglas–Peucker tolerance (deg), dec = coordinate decimals.
const REGIONS = [
  { id: 'nyc',            bbox: [-75.0, 40.0, -72.4, 41.4],  tol: 0.0006, dec: 4 },
  { id: 'la',             bbox: [-119.2, 33.2, -117.4, 34.7], tol: 0.0006, dec: 4 },
  { id: 'sf-monterey',    bbox: [-123.2, 36.0, -121.0, 38.5], tol: 0.0008, dec: 4 },
  { id: 'chicago',        bbox: [-88.6, 41.2, -86.6, 42.6],   tol: 0.0008, dec: 4 },
  { id: 'oslo',           bbox: [9.5, 59.2, 12.0, 60.6],      tol: 0.0008, dec: 4 },
  { id: 'stuttgart',      bbox: [8.0, 48.2, 10.4, 49.6],      tol: 0.0008, dec: 4 },
  { id: 'paris',          bbox: [1.3, 48.1, 3.3, 49.5],       tol: 0.0008, dec: 4 },
  { id: 'continental-us', bbox: [-125.5, 24.0, -66.5, 49.8],  tol: 0.02,   dec: 2 },
];

async function fetchCached(name) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const url = `${NE}/${name}`;
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, text);
  return JSON.parse(text);
}

// Sutherland–Hodgman: clip one ring against an axis-aligned bbox.
function clipRing(ring, [W, S, E, N]) {
  const passes = [
    [(p) => p[0] >= W, (a, b) => [W, a[1] + ((b[1] - a[1]) * (W - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= E, (a, b) => [E, a[1] + ((b[1] - a[1]) * (E - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= S, (a, b) => [a[0] + ((b[0] - a[0]) * (S - a[1])) / (b[1] - a[1]), S]],
    [(p) => p[1] <= N, (a, b) => [a[0] + ((b[0] - a[0]) * (N - a[1])) / (b[1] - a[1]), N]],
  ];
  let out = ring;
  for (const [inside, cross] of passes) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ai = inside(a), bi = inside(b);
      if (ai) out.push(a);
      if (ai !== bi) out.push(cross(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

// Polylines: keep inside runs, split at exits. Crossing segments lose the
// exact boundary point — the render window sits well inside the clip bbox,
// so the truncation is never visible.
function clipLine(line, [W, S, E, N]) {
  const inside = (p) => p[0] >= W && p[0] <= E && p[1] >= S && p[1] <= N;
  const segs = [];
  let cur = [];
  for (const p of line) {
    if (inside(p)) cur.push(p);
    else if (cur.length) { if (cur.length > 1) segs.push(cur); cur = []; }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

// Plain Douglas–Peucker over an open chain (first/last are distinct).
function simplifyOpen(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-12;
    let maxD = 0, maxI = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol) { keep[maxI] = 1; stack.push([i0, maxI], [maxI, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Douglas–Peucker anchors first/last, so a closed ring (first point ===
// last point) collapses: both anchors are the same coordinate, every
// intermediate distance is 0, nothing survives. Split the ring at its
// farthest-from-start point into two open chains, simplify each, and
// rejoin — this keeps the ring's true extent instead of degenerating to
// a point.
function simplify(pts, tol) {
  const first = pts[0], last = pts[pts.length - 1];
  const closed = pts.length > 2 && first[0] === last[0] && first[1] === last[1];
  if (!closed) return simplifyOpen(pts, tol);

  const open = pts.slice(0, -1); // drop the duplicated closing point
  let maxD = -1, k = 0;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - first[0], open[i][1] - first[1]);
    if (d > maxD) { maxD = d; k = i; }
  }
  const chainA = simplifyOpen(open.slice(0, k + 1), tol);
  const chainB = simplifyOpen(open.slice(k), tol);
  return [...chainA, ...chainB.slice(1), first];
}

const roundPts = (pts, dec) => {
  const f = 10 ** dec;
  const out = [];
  for (const [x, y] of pts) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
};

function* rings(geojson) {
  for (const feat of geojson.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') for (const r of g.coordinates) yield r;
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) for (const r of poly) yield r;
  }
}
function* lines(geojson) {
  for (const feat of geojson.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'LineString') yield g.coordinates;
    else if (g.type === 'MultiLineString') for (const l of g.coordinates) yield l;
  }
}

const src = {};
for (const [key, name] of Object.entries(SOURCES)) src[key] = await fetchCached(name);

// Every place must fall inside at least one region — coverage is extended
// deliberately, never discovered broken at render time.
const places = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'app', 'public', 'data', 'places.json'), 'utf8'),
);
const uncovered = places.filter(
  (p) => !REGIONS.some(({ bbox: [W, S, E, N] }) => p.lon >= W && p.lon <= E && p.lat >= S && p.lat <= N),
);
if (uncovered.length) {
  console.error('places outside every region bbox:');
  for (const p of uncovered) console.error(`  ${p.id} (${p.lat}, ${p.lon})`);
  process.exit(1);
}

const regions = [];
for (const { id, bbox, tol, dec } of REGIONS) {
  const region = { id, bbox: { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] }, land: [], lakes: [], borders: [] };
  for (const [layer, source, isLine] of [
    ['land', src.land, false],
    ['lakes', src.lakes, false],
    ['borders', src.states, true],
    ['borders', src.countries, true],
  ]) {
    const geoms = isLine ? lines(source) : rings(source);
    for (const geom of geoms) {
      if (isLine) {
        for (const seg of clipLine(geom, bbox)) {
          const s = roundPts(simplify(seg, tol), dec);
          if (s.length > 1) region[layer].push(s);
        }
      } else {
        const clipped = clipRing(geom, bbox);
        if (clipped.length < 3) continue;
        const s = roundPts(simplify(clipped, tol), dec);
        if (s.length > 2) region[layer].push(s);
      }
    }
  }
  const verts = ['land', 'lakes', 'borders'].reduce(
    (n, l) => n + region[l].reduce((m, g) => m + g.length, 0), 0);
  console.log(
    `${id}: land ${region.land.length} rings, lakes ${region.lakes.length}, ` +
    `borders ${region.borders.length} lines, ${verts} vertices`,
  );
  regions.push(region);
}

// Ray-cast point-in-ring (even-odd rule). `ring` is [lon, lat] pairs.
function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Guard born from the 2026-08-17 closed-ring simplify collapse: every
// place must land on drawn land, not open water. Region choice mirrors
// the app's chooseRegion — smallest-bbox region containing the pin.
{
  const regionArea = ({ west, south, east, north }) => (east - west) * (north - south);
  const badPlaces = [];
  for (const p of places) {
    const pt = [p.lon, p.lat];
    const candidates = regions
      .filter((r) => p.lon >= r.bbox.west && p.lon <= r.bbox.east && p.lat >= r.bbox.south && p.lat <= r.bbox.north)
      .sort((a, b) => regionArea(a.bbox) - regionArea(b.bbox));
    const region = candidates[0];
    if (!region) { badPlaces.push({ p, reason: 'no covering region' }); continue; }
    const onLand = region.land.some((ring) => pointInRing(pt, ring));
    const inLake = region.lakes.some((ring) => pointInRing(pt, ring));
    if (!onLand || inLake) {
      badPlaces.push({ p, reason: !onLand ? 'not on any land ring' : 'inside a lake ring', region: region.id });
    }
  }
  if (badPlaces.length) {
    console.error('places not on land in their chosen region:');
    for (const { p, reason, region } of badPlaces) {
      console.error(`  ${p.id} (${p.lat}, ${p.lon}) region=${region ?? 'none'} — ${reason}`);
    }
    process.exit(1);
  }
}

const json = JSON.stringify({ regions });
const gz = zlib.gzipSync(json, { level: 9 }).length;
console.log(`raw ${(json.length / 1024).toFixed(0)} KB, gzip ${(gz / 1024).toFixed(0)} KB (budget 250 KB)`);
if (gz > BUDGET) {
  console.error('OVER BUDGET — raise tolerances or trim regions; nothing written.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json);
console.log(`wrote ${OUT}`);
