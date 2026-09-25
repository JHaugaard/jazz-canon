import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fold, rank } from './search-match.ts';

const places = JSON.parse(readFileSync(new URL('../../public/data/places.json', import.meta.url)));
const matches = (query, source = places) => source.filter(p => rank(fold(p.name), fold(query)) !== null);

test('all exported places are indexed by their literal name, including clubs and venues', () => {
  assert.equal(places.length, 63);
  for (const place of places) assert.ok(matches(place.name).some(p => p.id === place.id));
  assert.ok(matches('Birdland').some(p => p.kind === 'club'));
  assert.ok(matches('oper').some(p => p.kind === 'hall'));
});
test('place matching is diacritic-insensitive but not fuzzy or city-based', () => {
  assert.ok(matches('cafe').some(p => p.name === 'Five Spot Café'));
  assert.ok(matches('koln').some(p => p.name.includes('Köln')));
  assert.deepEqual(matches('Fve Spot'), []);
  assert.deepEqual(matches('New York, NY'), []);
  assert.deepEqual(matches('made-up alias'), []);
  assert.equal(rank(fold('Cologne Opera House'), fold('opera')), 1);
  assert.equal(rank(fold('Cologne Opera House'), fold('logne')), 2);
});
test('same-name places in different cities remain separate canonical results', () => {
  const fixtures = [{ id: 'a', name: 'Blue Room', city: 'Paris', kind: 'club' },
    { id: 'b', name: 'Blue Room', city: 'New York', kind: 'studio' }];
  assert.deepEqual(matches('blue room', fixtures).map(p => [p.id, p.city]), [['a', 'Paris'], ['b', 'New York']]);
});
