import type { AlbumCard, AlbumDetail, GraphData, RecentAddition, Place } from './types';
import { buildPlacesData, type PlacesData } from './places-data';
import type { Basemap } from './places-geo';

let albumsPromise: Promise<AlbumCard[]> | null = null;
let detailsPromise: Promise<Record<string, AlbumDetail>> | null = null;
let graphPromise: Promise<GraphData> | null = null;
let recentPromise: Promise<RecentAddition[]> | null = null;
let placesPromise: Promise<PlacesData> | null = null;
let basemapPromise: Promise<Basemap> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function loadAlbums(): Promise<AlbumCard[]> {
  return (albumsPromise ??= fetchJson<AlbumCard[]>('/data/albums.json'));
}

export function loadDetails(): Promise<Record<string, AlbumDetail>> {
  return (detailsPromise ??= fetchJson<Record<string, AlbumDetail>>('/data/details.json'));
}

export function loadGraph(): Promise<GraphData> {
  return (graphPromise ??= fetchJson<GraphData>('/data/graph.json'));
}

export function loadRecentlyAdded(): Promise<RecentAddition[]> {
  return (recentPromise ??= fetchJson<RecentAddition[]>('/data/recently-added.json'));
}

export function loadPlaces(): Promise<PlacesData> {
  return (placesPromise ??= fetchJson<Place[]>('/data/places.json').then(buildPlacesData));
}

export function loadBasemap(): Promise<Basemap> {
  return (basemapPromise ??= fetchJson<Basemap>('/map/basemap.json'));
}

export async function albumMap(): Promise<Map<string, AlbumCard>> {
  const albums = await loadAlbums();
  return new Map(albums.map((a) => [a.id, a]));
}
