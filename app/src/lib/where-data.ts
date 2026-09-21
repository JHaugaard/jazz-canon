import type { Place } from './types';

/* Pure derivation for the Where route. The export remains the source of truth;
   this module only validates dates, removes exact duplicate events and builds
   deterministic row/month groups for rendering. */

const DEV: boolean = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;

export interface RecordingEvent {
  date: string;
  albumId: string;
}

export interface DateGroup {
  date: string;
  events: RecordingEvent[];
  laneIndex: number;
  laneCount: number;
}

export interface WhereRow {
  place: Place;
  groups: DateGroup[];
  first: string | null;
  unsupportedDates: string[];
}

export interface WhereData {
  rows: WhereRow[];
  yearStart: number;
  yearEnd: number;
  eventCount: number;
  representedAlbumCount: number;
  unsupportedDateCount: number;
}

export interface ParsedRecordingDate {
  year: number;
  month: number | null;
  day: number | null;
}

export function parseRecordingDate(value: string): ParsedRecordingDate | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (month === null) return { year, month, day: null };
  if (month < 1 || month > 12) return null;
  const lastDay = daysInMonth(year, month);
  if (day !== null && (day < 1 || day > lastDay)) return null;
  return { year, month, day };
}

export function buildWhereData(places: Place[]): WhereData {
  const rows: WhereRow[] = [];
  const representedAlbums = new Set<string>();
  let eventCount = 0;
  let unsupportedDateCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const place of places) {
    const byDate = new Map<string, RecordingEvent[]>();
    const seen = new Set<string>();
    const unsupportedDates: string[] = [];

    for (const ref of place.albums) {
      representedAlbums.add(ref.albumId);
      /* Empty dates means year-grade precision by the places.json contract.
         Keep that event, centred in its known year, rather than dropping it. */
      const dates = ref.dates.length ? ref.dates : [String(ref.year)];
      for (const date of dates) {
        if (!parseRecordingDate(date)) {
          unsupportedDates.push(date);
          unsupportedDateCount += 1;
          if (DEV)
            console.warn(
              `places.json: recording date "${date}" for album "${ref.albumId}" at place "${place.id}" cannot be plotted`,
            );
          continue;
        }
        const key = `${date}|${ref.albumId}`;
        if (seen.has(key)) {
          if (DEV) console.warn(`places.json: duplicate recording event (${key}) at place "${place.id}" — dropped`);
          continue;
        }
        seen.add(key);
        const event = { date, albumId: ref.albumId };
        const list = byDate.get(date);
        if (list) list.push(event);
        else byDate.set(date, [event]);
        eventCount += 1;
        if (firstDate === null || date < firstDate) firstDate = date;
        if (lastDate === null || date > lastDate) lastDate = date;
      }
    }

    /* One group per event, including albums sharing an exact date. Those
       events retain the same x coordinate and receive separate micro-lanes,
       so each recording stays a directly clickable dot. */
    const groups: DateGroup[] = [...byDate.entries()]
      .flatMap(([date, events]) =>
        events
          .sort((a, b) => compareStr(a.albumId, b.albumId))
          .map((event) => ({ date, events: [event], laneIndex: 0, laneCount: 1 })),
      )
      .sort((a, b) => compareStr(a.date, b.date));

    /* Events crowded into the same month receive vertical micro-lanes,
       preserving every true x value, including exact-date collisions. */
    const byMonth = new Map<string, DateGroup[]>();
    for (const group of groups) {
      const key = group.date.slice(0, 7);
      const list = byMonth.get(key);
      if (list) list.push(group);
      else byMonth.set(key, [group]);
    }
    for (const monthGroups of byMonth.values()) {
      monthGroups.forEach((group, index) => {
        group.laneIndex = index;
        group.laneCount = monthGroups.length;
      });
    }

    rows.push({
      place,
      groups,
      /* An unplottable span still dates the place for row ordering. Its
         leading year is evidence we can use without inventing a point. */
      first: groups[0]?.date ?? unsupportedDates.map(leadingYear).filter(isString).sort(compareStr)[0] ?? null,
      unsupportedDates: [...new Set(unsupportedDates)].sort(compareStr),
    });
  }

  rows.sort((a, b) => {
    if (a.first === null) return b.first === null ? compareStr(a.place.id, b.place.id) : 1;
    if (b.first === null) return -1;
    return a.first === b.first ? compareStr(a.place.id, b.place.id) : compareStr(a.first, b.first);
  });

  if (firstDate === null || lastDate === null) throw new Error('places.json has no plottable recording dates');

  return {
    rows,
    yearStart: Number(firstDate.slice(0, 4)),
    yearEnd: Number(lastDate.slice(0, 4)),
    eventCount,
    representedAlbumCount: representedAlbums.size,
    unsupportedDateCount,
  };
}

/* Continuous month coordinate. Day-grade dates occupy their true fraction of
   the calendar month; month-grade dates sit at the month centre. */
export function recordingMonthOffset(date: string, yearStart: number): number {
  const parsed = parseRecordingDate(date);
  if (!parsed) throw new Error(`Unsupported recording date: ${date}`);
  if (parsed.month === null) return (parsed.year - yearStart) * 12 + 6;
  const fraction =
    parsed.day === null ? 0.5 : (parsed.day - 0.5) / daysInMonth(parsed.year, parsed.month);
  return (parsed.year - yearStart) * 12 + (parsed.month - 1) + fraction;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function compareStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function leadingYear(value: string): string | null {
  return /^\d{4}/.exec(value)?.[0] ?? null;
}

function isString(value: string | null): value is string {
  return value !== null;
}
