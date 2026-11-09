import type { Epistemic } from './types';

export interface MethodologyStats {
  publishedAlbums: number;
  sources: number;
  citations: number;
  checkedOn: string;
}

export interface ReportSource {
  title: string;
  type: string;
  url: string;
}

export interface RecordingSite {
  session_date: string;
  site_raw: string | null;
  site_slug: string | null;
  site_new: unknown;
  epistemic: Epistemic;
  source: string | null;
}

export interface ReportPerson {
  name: string;
  instrument: string;
  scope: 'all-tracks' | 'selected-tracks' | 'unknown';
  tracks: string[] | null;
  session_dates: string[];
  epistemic: Epistemic;
  sources: string[];
  name_variants: string[];
  notes: string;
}

export interface ReportTrack {
  title: string;
  track_number: number;
  side: string | null;
  duration: string | null;
  session_date: string | null;
  composers: string[];
  personnel: string[];
  bonus_track: boolean;
  alternate_take: boolean;
  epistemic_track: Epistemic;
  sources: string[];
}

export interface CoverArt {
  role: string;
  source: string;
  url: string;
  is_original_cover: boolean | null;
  epistemic: Epistemic;
  notes: string;
}

export interface CouncilMetadata {
  references: string[];
  references_answered: number;
  aggregator: string;
  preset: string;
}

export interface CandidateBallot {
  album: string;
  scope_check: { in_window: boolean; boundary_note: string | null };
  tier: string;
  priority: string;
  case_for: string;
  case_against: string;
  disagreement: string | null;
  recommendation: string;
  confidence: string;
  _council: CouncilMetadata;
}

export interface CandidateReport {
  id: string;
  artist: string;
  album: string;
  year: number;
  label: string;
  apple_album_id: number | string | null;
  musicbrainz_release_group_mbid: string | null;
  cover_art_url: string | null;
  style_primary: string;
  style_tags: string[];
  rationale: string;
  priority: string;
  epistemic: Epistemic;
  sources: Record<string, ReportSource>;
  personnel_record: {
    recording_dates: string[];
    multi_session: boolean;
    studio: string | null;
    recording_sites: RecordingSite[];
    producer: string | null;
    engineer: string | null;
    epistemic_production: Epistemic;
    personnel: ReportPerson[];
    tracks: ReportTrack[];
    track_assignments_complete: boolean;
    musicbrainz_release_group_mbid: string | null;
    apple_album_id: number | string | null;
    cover_art: CoverArt[];
    notes: string;
  };
  ballot: CandidateBallot;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

let statsPromise: Promise<MethodologyStats> | null = null;
let reportPromise: Promise<CandidateReport> | null = null;

export function loadMethodologyStats(): Promise<MethodologyStats> {
  return (statsPromise ??= fetchJson<MethodologyStats>('/data/methodology-stats.json'));
}

export function loadCandidateReport(): Promise<CandidateReport> {
  return (reportPromise ??= fetchJson<CandidateReport>('/methodology/steamin-candidate-report.json'));
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Parse YYYY-MM-DD by hand so the display never crosses a timezone boundary. */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day || !MONTHS[month - 1]) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day || !MONTHS[month - 1]) return iso;
  return `${MONTHS[month - 1].slice(0, 3)} ${day}, ${year}`;
}

export function readableCode(code: string): string {
  const labels: Record<string, string> = {
    consensus_core: 'Consensus core',
    must_have: 'Must-have',
    high: 'High',
    hard_bop: 'Hard bop',
    'hard-bop': 'Hard bop',
    'all-tracks': 'All tracks',
    'selected-tracks': 'Selected tracks',
    unknown: 'Unknown',
    obs: 'Observed',
    inf: 'Inferred',
    unk: 'Uncertain'
  };
  return labels[code] ?? code.replaceAll('_', ' ').replaceAll('-', ' ');
}

export function trackLineup(track: ReportTrack, allPersonnel: ReportPerson[], fullLabel = 'Full ensemble'): string {
  const present = new Set(track.personnel);
  const missing = allPersonnel.map((person) => person.name).filter((name) => !present.has(name));
  if (missing.length === 0) return fullLabel;
  if (missing.length === 1) return `${missing[0]} absent`;
  return `Absent: ${missing.join(', ')}`;
}
