import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatLongDate, formatShortDate, hasHumanReadableSourceLink, readableCode, trackLineup } from './methodology-data.ts';

test('methodology dates are formatted without timezone conversion', () => {
  assert.equal(formatLongDate('2026-11-09'), 'November 9, 2026');
  assert.equal(formatShortDate('1956-05-11'), 'May 11, 1956');
  assert.equal(formatShortDate(null), 'Unknown');
  assert.equal(formatLongDate('November 1961'), 'November 1961');
});

test('reader-facing labels replace internal codes', () => {
  assert.equal(readableCode('consensus_core'), 'Consensus core');
  assert.equal(readableCode('must_have'), 'Must-have');
  assert.equal(readableCode('hard-bop'), 'Hard bop');
  assert.equal(readableCode('obs'), 'Observed');
});

test('track lineup names absences without mutating the source arrays', () => {
  const people = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const full = { personnel: ['C', 'B', 'A'] };
  const oneOut = { personnel: ['A', 'C'] };
  const twoOut = { personnel: ['B'] };
  assert.equal(trackLineup(full, people, 'Full trio'), 'Full trio');
  assert.equal(trackLineup(oneOut, people), 'B absent');
  assert.equal(trackLineup(twoOut, people), 'Absent: A, C');
  assert.deepEqual(full.personnel, ['C', 'B', 'A']);
});

test('JSON API endpoints do not produce reader-facing source links', () => {
  assert.equal(hasHumanReadableSourceLink('https://en.wikipedia.org/wiki/Example'), true);
  assert.equal(hasHumanReadableSourceLink('https://musicbrainz.org/release-group/example'), true);
  assert.equal(hasHumanReadableSourceLink('https://itunes.apple.com/search?term=example&entity=album'), false);
  assert.equal(hasHumanReadableSourceLink('https://itunes.apple.com/lookup?id=123&entity=album'), false);
  assert.equal(hasHumanReadableSourceLink('https://coverartarchive.org/release-group/example'), false);
});

test('candidate report retains the sessions, personnel, tracks, sources, and ballot used by the page', () => {
  const report = JSON.parse(readFileSync(new URL('../../public/methodology/steamin-candidate-report.json', import.meta.url)));
  assert.equal(report.personnel_record.recording_sites.length, 2);
  assert.equal(report.personnel_record.personnel.length, 5);
  assert.equal(report.personnel_record.tracks.length, 6);
  assert.equal(Object.keys(report.sources).length, 7);
  assert.equal(report.ballot._council.references_answered, 2);
  assert.equal(report.ballot.disagreement, null);
  for (const field of ['case_for', 'case_against', 'recommendation']) assert.ok(report.ballot[field].length > 40);
  for (const n of [3, 6]) assert.ok(!report.personnel_record.tracks[n - 1].personnel.includes('John Coltrane'));
  for (const n of [1, 2, 4, 5]) assert.equal(trackLineup(report.personnel_record.tracks[n - 1], report.personnel_record.personnel, 'Full quintet'), 'Full quintet');
});
