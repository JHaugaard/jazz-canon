/* Pure Web Mercator mini-map geometry — no DOM, no dependencies, so it
   runs under plain Node for verification. Forward projection only; at
   metro-to-continental extents against a pre-clipped asset there is no
   clipping or resampling to do here. */

export interface LonLat { lon: number; lat: number }
export interface Bbox { west: number; south: number; east: number; north: number }
export interface Viewport { width: number; height: number }
export interface Transform { scale: number; tx: number; ty: number }

/* One region of the committed basemap asset. Layer coordinates are
   [lon, lat] pairs: land/lakes are arrays of rings, borders are arrays
   of polylines. */
export interface BasemapRegion {
  id: string;
  bbox: Bbox;
  land: number[][][];
  lakes: number[][][];
  borders: number[][][];
}
export interface Basemap { regions: BasemapRegion[] }

const RAD = Math.PI / 180;

export function mercX(lon: number): number {
  return lon * RAD;
}
export function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

/* Fit a lon/lat bbox into a pixel viewport with uniform padding,
   preserving aspect. Screen y grows downward:
   px = tx + scale·mercX(lon), py = ty − scale·mercY(lat). */
export function fitBbox(bbox: Bbox, vp: Viewport, padding: number): Transform {
  const x0 = mercX(bbox.west), x1 = mercX(bbox.east);
  const y0 = mercY(bbox.south), y1 = mercY(bbox.north);
  const scale = Math.min(
    (vp.width - 2 * padding) / (x1 - x0),
    (vp.height - 2 * padding) / (y1 - y0),
  );
  return {
    scale,
    tx: vp.width / 2 - (scale * (x0 + x1)) / 2,
    ty: vp.height / 2 + (scale * (y0 + y1)) / 2,
  };
}

export function project(p: LonLat, t: Transform): { x: number; y: number } {
  return { x: t.tx + t.scale * mercX(p.lon), y: t.ty - t.scale * mercY(p.lat) };
}

export function pinsBbox(pins: LonLat[]): Bbox {
  return {
    west: Math.min(...pins.map((p) => p.lon)),
    east: Math.max(...pins.map((p) => p.lon)),
    south: Math.min(...pins.map((p) => p.lat)),
    north: Math.max(...pins.map((p) => p.lat)),
  };
}

export function expandBbox(b: Bbox, ratio: number): Bbox {
  const dw = (b.east - b.west) * ratio;
  const dh = (b.north - b.south) * ratio;
  return { west: b.west - dw, east: b.east + dw, south: b.south - dh, north: b.north + dh };
}

export function kmToLonDeg(km: number, lat: number): number {
  return km / (111.32 * Math.cos(lat * RAD));
}
export function kmToLatDeg(km: number): number {
  return km / 110.574;
}

/* Grow a bbox (about its center) until it is at least minWidthKm wide and
   the matching height for `aspect` (w/h). A tight cluster never gets a
   tight frame. */
export function ensureMinExtent(b: Bbox, minWidthKm: number, aspect: number): Bbox {
  const midLat = (b.south + b.north) / 2;
  const minW = kmToLonDeg(minWidthKm, midLat);
  const minH = kmToLatDeg(minWidthKm / aspect);
  const cx = (b.west + b.east) / 2, cy = midLat;
  const w = Math.max(b.east - b.west, minW);
  const h = Math.max(b.north - b.south, minH);
  return { west: cx - w / 2, east: cx + w / 2, south: cy - h / 2, north: cy + h / 2 };
}

/* Single pin: a fixed metro window centered on it. */
export function metroExtent(pin: LonLat, widthKm: number, aspect: number): Bbox {
  const w = kmToLonDeg(widthKm, pin.lat);
  const h = kmToLatDeg(widthKm / aspect);
  return {
    west: pin.lon - w / 2, east: pin.lon + w / 2,
    south: pin.lat - h / 2, north: pin.lat + h / 2,
  };
}

export function bboxContains(b: Bbox, p: LonLat): boolean {
  return p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;
}

/* The smallest region whose bbox contains every pin; null when none does
   (the coverage-honesty path: render pins on paper, warn in dev). */
export function chooseRegion(pins: LonLat[], regions: BasemapRegion[]): BasemapRegion | null {
  const area = (b: Bbox) => (mercX(b.east) - mercX(b.west)) * (mercY(b.north) - mercY(b.south));
  const containing = regions.filter((r) => pins.every((p) => bboxContains(r.bbox, p)));
  if (!containing.length) return null;
  return containing.sort((a, b) => area(a.bbox) - area(b.bbox))[0];
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

export function ringPath(ring: number[][], t: Transform): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const p = project({ lon, lat }, t);
        return `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
      })
      .join('') + 'Z'
  );
}

export function linePath(line: number[][], t: Transform): string {
  return line
    .map(([lon, lat], i) => {
      const p = project({ lon, lat }, t);
      return `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
    })
    .join('');
}

/* Display-only de-overlap for pins that coincide at mini-map scale
   (Sound Makers and Nola share a block; five city-grade NYC places share
   one coordinate). Symmetric pairwise repulsion along the connecting
   axis — deterministic, centroid-preserving, data untouched. Never drop
   a pin. */
export function spreadPins(
  pts: { x: number; y: number }[],
  minGap = 12,
): { x: number; y: number }[] {
  const out = pts.map((p) => ({ ...p }));
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x, dy = out[j].y - out[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        moved = true;
        const ux = d < 1e-6 ? 1 : dx / d;
        const uy = d < 1e-6 ? 0 : dy / d;
        const push = (minGap - d) / 2;
        out[i].x -= ux * push; out[i].y -= uy * push;
        out[j].x += ux * push; out[j].y += uy * push;
      }
    }
    if (!moved) break;
  }
  return out;
}
