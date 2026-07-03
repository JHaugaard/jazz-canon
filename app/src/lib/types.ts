export type Epistemic = 'obs' | 'inf' | 'unk';

export interface AlbumCard {
  id: string;
  title: string;
  artist: string;
  year: number;
  label: string | null;
  catalog: string;
  style: string;
  styleCode: string;
  artUrl: string;
  appleAlbumId: string | null;
}

export interface TrackPerson {
  personId: string;
  name: string;
  instrument: string;
  e: Epistemic;
}

export interface Track {
  n: number | null;
  title: string;
  side: string | null;
  duration: string | null;
  appleTrackId: string | null;
  previewUrl?: string | null;
  e: Epistemic;
  personnel: TrackPerson[];
}

export interface PersonnelRow {
  personId: string;
  name: string;
  entries: { instrument: string; e: Epistemic }[];
  scope: 'all-tracks' | 'selected-tracks' | 'unknown';
}

export interface AlbumDetail {
  description: string | null;
  recordingDates: string | null;
  leader: string | null;
  studios: string[];
  tracks: Track[];
  personnel: PersonnelRow[];
}

export interface GraphEdge {
  p: string; // person id
  a: string; // album id
  entries: { instrument: string; e: Epistemic }[];
}

export interface GraphData {
  people: Record<string, string>; // id -> canonical name
  edges: GraphEdge[];
}

export type NavEntry =
  | { kind: 'album'; id: string }
  | { kind: 'person'; id: string };

/* A hand-kept, site-side "what's new" entry. NOT canon data — `added` is the
   date the album first appeared on the site (a site-update date), edited by
   hand in public/data/recently-added.json when a batch ships. */
export interface RecentAddition {
  id: string;
  added: string; // ISO date, YYYY-MM-DD
}
