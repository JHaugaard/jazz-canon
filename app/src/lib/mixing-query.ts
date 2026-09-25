import type { AlbumDetail, GraphData, Epistemic, ProductionCredit } from './types';

export type Role = ProductionCredit['role'] | 'musician';
export type MixingSelection = { producer?: string; engineer?: string; musician?: string };
export interface MixingPerson {
  id: string;
  name: string;
  role: Role;
  shared: number;
}
export interface MixingResult {
  albumIds: string[];
  selected: MixingPerson[];
  suggestions: Record<Role, MixingPerson[]>;
  // Uncertainty is attached to the matched album/role/person edge, never the identity.
  uncertainty: Map<string, Epistemic>;
}

export const roles: Role[] = ['producer', 'engineer', 'musician'];
const severity: Record<Epistemic, number> = { obs: 0, inf: 1, unk: 2 };

export function mixingIndex(details: Record<string, AlbumDetail>, graph: GraphData) {
  const membership: Record<Role, Map<string, Set<string>>> = {
    producer: new Map(), engineer: new Map(), musician: new Map(),
  };
  const names = new Map<string, string>(Object.entries(graph.people));
  const uncertainty = new Map<string, Epistemic>();
  for (const [albumId, detail] of Object.entries(details)) {
    for (const credit of detail.productionCredits ?? []) {
      if (credit.role !== 'producer' && credit.role !== 'engineer') continue;
      names.set(credit.personId, credit.name);
      const set = membership[credit.role].get(credit.personId) ?? new Set<string>();
      set.add(albumId);
      membership[credit.role].set(credit.personId, set);
      const key = `${albumId}:${credit.role}:${credit.personId}`;
      const prior = uncertainty.get(key);
      if (!prior || severity[credit.e] > severity[prior]) uncertainty.set(key, credit.e);
    }
  }
  for (const edge of graph.edges) {
    const set = membership.musician.get(edge.p) ?? new Set<string>();
    set.add(edge.a);
    membership.musician.set(edge.p, set);
    const key = `${edge.a}:musician:${edge.p}`;
    for (const entry of edge.entries) {
      const prior = uncertainty.get(key);
      if (!prior || severity[entry.e] > severity[prior]) uncertainty.set(key, entry.e);
    }
  }
  return { membership, names, uncertainty };
}

export type MixingIndex = ReturnType<typeof mixingIndex>;

export function mixingQuery(index: MixingIndex, selection: MixingSelection, albumOrder: string[]): MixingResult {
  const chosen = roles.filter((role) => selection[role]).map((role) => ({ role, id: selection[role]! }));
  let shared: Set<string> | null = null;
  for (const { role, id } of chosen) {
    const mine = index.membership[role].get(id) ?? new Set<string>();
    shared = shared === null ? new Set(mine) : new Set(Array.from(shared as Set<string>).filter((album) => mine.has(album)));
  }
  const albumIds = shared ? albumOrder.filter((id) => shared!.has(id)) : [];
  const selected = chosen.map(({ role, id }) => ({ id, role, name: index.names.get(id) ?? id, shared: albumIds.length }));
  const suggestions = Object.fromEntries(roles.map((role) => {
    // Replacing a filled slot must not be restricted by its previous occupant.
    const otherSlots = chosen.filter((item) => item.role !== role);
    const base = otherSlots.length
      ? albumOrder.filter((album) => otherSlots.every((item) => index.membership[item.role].get(item.id)?.has(album)))
      : albumOrder;
    const people = [...index.membership[role]].filter(([id]) => id !== selection[role]).map(([id, albums]) => ({
      id, role, name: index.names.get(id) ?? id,
      shared: base.filter((album) => albums.has(album)).length,
    }));
    people.sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return [role, people];
  })) as Record<Role, MixingPerson[]>;
  return { albumIds, selected, suggestions, uncertainty: index.uncertainty };
}
