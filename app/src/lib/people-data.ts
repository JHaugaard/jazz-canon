import type { PeopleActivityFile, PeopleActivityMeta, PersonActivity, PersonSession } from './types';
import { DEV } from './places-data';

/* Pure derivation over the ratified people-activity.json — no DOM, no fetch,
   so it runs under plain Node for verification. Lane geometry (month offsets,
   day ordering, jitter spread) lives here so the UI hardcodes nothing. */

const JITTER = 0.22;

export interface Mark {
  m: number; // continuous month offset from January of yearStart (0 = start of that January)
  date: string;
  albumId: string;
}

export interface PeopleData {
  people: PersonActivity[];
  byId: Map<string, PersonActivity>;
  meta: PeopleActivityMeta;
  yearStart: number;
  yearEnd: number;
}

export function buildPeopleData(raw: PeopleActivityFile): PeopleData {
  /* Each kept person is rebuilt fresh with sessions deduped by (date, albumId)
     — a duplicate would otherwise double-count a mark and crash any keyed
     {#each} downstream. Dedup here, at the source; the raw objects are never
     mutated. A person left with zero sessions after dedupe has no lane to
     draw and is dropped. */
  const people: PersonActivity[] = [];
  for (const p of raw.people) {
    const seen = new Set<string>();
    const sessions: PersonSession[] = [];
    for (const s of p.sessions) {
      const key = `${s.date}|${s.albumId}`;
      if (seen.has(key)) {
        if (DEV) console.warn(`people-activity.json: duplicate session (${key}) for person "${p.personId}" — dropped`);
        continue;
      }
      seen.add(key);
      sessions.push(s);
    }
    if (sessions.length === 0) {
      if (DEV) console.warn(`people-activity.json: person "${p.personId}" has zero sessions after dedupe — dropped`);
      continue;
    }
    sessions.sort((a, b) => (a.date === b.date ? compareStr(a.albumId, b.albumId) : compareStr(a.date, b.date)));
    people.push({ ...p, sessions });
  }
  people.sort((a, b) => (a.first === b.first ? compareStr(a.personId, b.personId) : compareStr(a.first, b.first)));

  const byId = new Map(people.map((p) => [p.personId, p]));
  return {
    people,
    byId,
    meta: raw.meta,
    yearStart: Number(raw.meta.spanStart.slice(0, 4)),
    yearEnd: Number(raw.meta.spanEnd.slice(0, 4)),
  };
}

function compareStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* Day never shifts the month position — 1949-01-11 and 1949-01 both land at
   0.5 for yearStart 1949. Within-month spread (laneMarks) is layered on top
   of this center, never folded into it. */
export function monthOffset(date: string, yearStart: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return (year - yearStart) * 12 + (month - 1) + 0.5;
}

/* Day-of-month for YYYY-MM-DD; 0 for month-grade YYYY-MM so it sorts first
   within its month. */
export function dayOrder(date: string): number {
  return date.length === 10 ? Number(date.slice(8, 10)) : 0;
}

/* Sessions grouped by calendar month; a lone session sits at its month
   center, a group of N >= 2 spreads evenly across [-JITTER, +JITTER] in
   (dayOrder, albumId) order — leftmost is earliest-in-month. The endpoints
   use the full jitter range regardless of N, so no mark ever crosses into a
   neighboring month (|m - center| <= JITTER, and JITTER < 0.5). */
export function laneMarks(p: PersonActivity, yearStart: number): Mark[] {
  const groups = new Map<string, PersonSession[]>();
  for (const s of p.sessions) {
    const key = s.date.slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  const marks: Mark[] = [];
  for (const sessions of groups.values()) {
    const center = monthOffset(sessions[0].date, yearStart);
    if (sessions.length === 1) {
      const s = sessions[0];
      marks.push({ m: center, date: s.date, albumId: s.albumId });
      continue;
    }
    const ordered = [...sessions].sort((a, b) => {
      const byDay = dayOrder(a.date) - dayOrder(b.date);
      return byDay !== 0 ? byDay : compareStr(a.albumId, b.albumId);
    });
    const n = ordered.length;
    ordered.forEach((s, i) => {
      const offset = -JITTER + (i * (2 * JITTER)) / (n - 1);
      marks.push({ m: center + offset, date: s.date, albumId: s.albumId });
    });
  }
  return marks;
}

export function filterByYears(people: PersonActivity[], minYears: number): PersonActivity[] {
  return people.filter((p) => p.yearsActive >= minYears);
}
