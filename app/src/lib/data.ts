import type { AlbumCard, AlbumDetail, GraphData, RecentAddition } from './types';

let albumsPromise: Promise<AlbumCard[]> | null = null;
let detailsPromise: Promise<Record<string, AlbumDetail>> | null = null;
let graphPromise: Promise<GraphData> | null = null;
let recentPromise: Promise<RecentAddition[]> | null = null;

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

export async function albumMap(): Promise<Map<string, AlbumCard>> {
  const albums = await loadAlbums();
  return new Map(albums.map((a) => [a.id, a]));
}
