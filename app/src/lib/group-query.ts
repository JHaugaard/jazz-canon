import type { GraphData } from './types';

/* Pure group query over graph.json — no DOM, no fetch, so it runs under plain
   Node for verification. One meaning of "together": an album counts when it
   credits EVERY selected musician (same album, not same track — track-level
   co-presence is a separate, stronger claim the graph export doesn't carry). */

/* Cap on selected musicians. A starting musician plus three: Ron Carter plus
   a rhythm section, Miles plus the Kind of Blue front line. Interface limit,
   not a data one — the intersection is cheap at any size. Edit here only. */
export const MAX_GROUP = 4;

export interface Collaborator {
  id: string;
  name: string;
  /* shared albums this person would leave if added: |group albums ∩ theirs| */
  shared: number;
  instruments: string[];
}

export interface GroupResult {
  ids: string[]; // deduped, in selection order
  albumIds: string[]; // stable order: as first encountered in graph.edges
  collaborators: Collaborator[]; // everyone else on those albums, by shared desc
  instruments: Map<string, string[]>; // per selected id, across their whole graph
}

function albumsOf(graph: GraphData): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    let s = m.get(e.p);
    if (!s) m.set(e.p, (s = new Set()));
    s.add(e.a);
  }
  return m;
}

export function dedupe(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

export function groupQuery(graph: GraphData, selected: string[]): GroupResult {
  const ids = dedupe(selected);
  const byPerson = albumsOf(graph);

  let sharedSet = new Set<string>();
  ids.forEach((id, i) => {
    const mine = byPerson.get(id) ?? new Set<string>();
    sharedSet = i === 0 ? new Set(mine) : new Set([...sharedSet].filter((a) => mine.has(a)));
  });
  // order albums as the export orders them, not by selection-dependent sets
  const albumIds: string[] = [];
  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (sharedSet.has(e.a) && !seen.has(e.a)) {
      seen.add(e.a);
      albumIds.push(e.a);
    }
  }

  const count = new Map<string, number>();
  const inst = new Map<string, Set<string>>();
  const selectedSet = new Set(ids);
  for (const e of graph.edges) {
    if (!sharedSet.has(e.a) || selectedSet.has(e.p)) continue;
    count.set(e.p, (count.get(e.p) ?? 0) + 1);
    let s = inst.get(e.p);
    if (!s) inst.set(e.p, (s = new Set()));
    for (const en of e.entries) s.add(en.instrument);
  }
  const collaborators: Collaborator[] = [...count.entries()]
    .map(([id, n]) => ({
      id,
      name: graph.people[id] ?? '?',
      shared: n,
      instruments: [...(inst.get(id) ?? [])],
    }))
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name));

  const instruments = new Map<string, string[]>();
  for (const id of ids) {
    const s = new Set<string>();
    for (const e of graph.edges) if (e.p === id) for (const en of e.entries) s.add(en.instrument);
    instruments.set(id, [...s]);
  }

  return { ids, albumIds, collaborators, instruments };
}
