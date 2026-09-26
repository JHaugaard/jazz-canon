import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStyleIndex } from './styles.ts';
import { styleRank } from './search-match.ts';

const albums = JSON.parse(readFileSync(new URL('../../public/data/albums.json', import.meta.url)));
const index = buildStyleIndex(albums);
const hits = (query) => index.filter((s) => styleRank(s.keys, query) !== null).map((s) => s.code);

test('every style code in the data is indexed, primary and tag-only alike', () => {
  const codes = new Set(albums.flatMap((a) => [a.styleCode, ...(a.styleTags ?? [])]));
  assert.deepEqual(new Set(index.map((s) => s.code)), codes);
  // spiritual-jazz only ever arrives as a tag
  assert.ok(index.find((s) => s.code === 'spiritual-jazz').tagged.length > 0);
});

test('spacing, hyphens and case never decide a style match', () => {
  for (const q of ['Bebop', 'be bop', 'Be-Bop', 'BEBOP']) assert.ok(hits(q).includes('bebop'), q);
  for (const q of ['Hard Bop', 'hardbop', 'hard-bop']) assert.ok(hits(q).includes('hard-bop'), q);
  for (const q of ['avant-garde', 'avant garde', 'Avantgarde']) assert.ok(hits(q).includes('avant-garde-jazz'), q);
  for (const q of ['post bop', 'postbop', 'Post-Bop']) assert.ok(hits(q).includes('post-bop'), q);
  // spellings no alias lists: only the compact comparison can match these
  for (const [q, code] of [['cooljazz', 'cool-jazz'], ['Modal-Jazz', 'modal-jazz'], ['soul  jazz', 'soul-jazz'], ['jazzrock', 'jazz-rock']]) {
    assert.ok(hits(q).includes(code), q);
  }
});

test('a style query finds every album in that style, primary and tagged', () => {
  // built from reversed input so the order is the index's doing, not the export's
  const hardBop = buildStyleIndex([...albums].reverse()).find((s) => s.code === 'hard-bop');
  assert.equal(hardBop.primary.length, albums.filter((a) => a.styleCode === 'hard-bop').length);
  assert.equal(hardBop.tagged.length, albums.filter((a) => a.styleCode !== 'hard-bop' && a.styleTags.includes('hard-bop')).length);
  for (const list of [hardBop.primary, hardBop.tagged]) {
    const years = list.map((a) => a.year);
    assert.deepEqual(years, [...years].sort((x, y) => x - y));
  }
});

test('"bop" reaches every bop style; unrelated words reach none', () => {
  assert.deepEqual(new Set(hits('bop')), new Set(['bebop', 'hard-bop', 'post-bop']));
  assert.deepEqual(hits('coltrane'), []);
  assert.deepEqual(hits('   '), []);
});

test('ECM is indexed as a label, never as a style', () => {
  assert.equal(index.find((s) => s.code === 'ecm').kind, 'label');
  assert.ok(index.filter((s) => s.code !== 'ecm').every((s) => s.kind === 'style'));
});

test('a code missing from the vocabulary still indexes under its export name', () => {
  const fixture = [{ ...albums[0], id: 'x', styleCode: 'third-stream', style: 'Third Stream', styleTags: [] }];
  const [entry] = buildStyleIndex(fixture);
  assert.equal(entry.name, 'Third Stream');
  assert.notEqual(styleRank(entry.keys, 'third stream'), null);
});
