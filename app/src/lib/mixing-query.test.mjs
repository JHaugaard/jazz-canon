import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mixingIndex, mixingQuery } from './mixing-query.ts';

const credit = (personId, role, e = 'obs', sessionId = null) => ({ personId, name: personId === 'p2' ? 'Same Name' : personId, role, e, sessionId });
const details = {
  a: { productionCredits: [credit('p1', 'producer'), credit('p1', 'producer', 'inf', 's2'), credit('p1', 'engineer'), credit('p2', 'engineer', 'unk')] },
  b: { productionCredits: [credit('p1', 'producer'), credit('p2', 'engineer', 'obs'), credit('p3', 'engineer')] },
  c: { productionCredits: [credit('p3', 'producer'), credit('p1', 'engineer')] },
};
const graph = { people: { p1: 'Same Name', p2: 'Same Name', p3: 'Third', m: 'Musician' }, edges: [
  { p: 'm', a: 'a', entries: [{ instrument: 'piano', e: 'obs' }] },
  { p: 'm', a: 'b', entries: [{ instrument: 'piano', e: 'inf' }] },
  { p: 'p1', a: 'a', entries: [{ instrument: 'bass', e: 'obs' }] },
] };
const order = ['a', 'b', 'c'];
const ix = mixingIndex(details, graph);
const query = (selection) => mixingQuery(ix, selection, order);

test('production credits dedupe sessions without promoting uncertain edges', () => {
  assert.deepEqual(query({ producer: 'p1' }).albumIds, ['a', 'b']);
  assert.equal(ix.uncertainty.get('a:producer:p1'), 'inf');
  assert.equal(ix.uncertainty.get('a:engineer:p2'), 'unk');
});
test('roles intersect independently of order, including dual-role identity', () => {
  assert.deepEqual(query({ producer: 'p1', engineer: 'p2', musician: 'm' }).albumIds, ['a', 'b']);
  assert.deepEqual(query({ musician: 'm', engineer: 'p2', producer: 'p1' }).albumIds, ['a', 'b']);
  assert.deepEqual(query({ producer: 'p1', engineer: 'p1' }).albumIds, ['a']);
  assert.deepEqual(query({ producer: 'p1', engineer: 'p1', musician: 'p1' }).albumIds, ['a']);
  assert.deepEqual(query({ producer: 'p3', engineer: 'p2' }).albumIds, []);
});
test('same names retain distinct IDs and typed zero-match suggestions remain', () => {
  const result = query({ producer: 'p1' });
  assert.equal(result.suggestions.engineer.find(x => x.id === 'p2').shared, 2);
  assert.equal(result.suggestions.engineer.find(x => x.id === 'p3').shared, 1);
  assert.equal(result.suggestions.producer.find(x => x.id === 'p3').shared, 1);
  assert.notEqual(ix.membership.engineer.get('p1'), ix.membership.engineer.get('p2'));
  const replace = query({ producer: 'p1', engineer: 'p2', musician: 'm' });
  assert.equal(replace.suggestions.engineer.find(x => x.id === 'p1').shared, 1);
  assert.equal(replace.suggestions.engineer.find(x => x.id === 'p3').shared, 1);
  assert.equal(replace.suggestions.producer.find(x => x.id === 'p3').shared, 0);
});
test('current public export joins album and person IDs without invented production instruments', () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url)));
  const cards = load('albums'), source = load('details'), performance = load('graph');
  const current = mixingIndex(source, performance);
  assert.equal(cards.length, 248);
  assert.equal(current.membership.producer.size, 46);
  assert.equal(current.membership.engineer.size, 49);
  for (const [role, people] of Object.entries(current.membership)) {
    for (const [id, albumIds] of people) {
      assert.ok(id);
      for (const aid of albumIds) assert.ok(source[aid], `${role} ${id}: unknown album ${aid}`);
    }
  }
});
