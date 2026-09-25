import type { Epistemic, ProductionCredit } from './types';

export interface ProductionRow {
  personId: string;
  name: string;
  role: ProductionCredit['role'];
  e: Epistemic;
  sessionOnly: boolean;
}

/* Display projection only. The original role/session edges stay intact for
   The Board. Deduplicate by identity AND role, never by display name. */
export function productionRows(credits: ProductionCredit[] = []): ProductionRow[] {
  const rows = new Map<string, ProductionRow>();
  const uncertainty: Record<Epistemic, number> = { obs: 0, inf: 1, unk: 2 };
  for (const credit of credits) {
    if (credit.role !== 'producer' && credit.role !== 'engineer') continue;
    const key = `${credit.personId}:${credit.role}`;
    const prior = rows.get(key);
    if (!prior) {
      rows.set(key, {
        personId: credit.personId,
        name: credit.name,
        role: credit.role,
        e: credit.e,
        sessionOnly: credit.sessionId != null,
      });
    } else {
      // Never promote a partly inferred/unknown collection to observed.
      if (uncertainty[credit.e] > uncertainty[prior.e]) prior.e = credit.e;
      prior.sessionOnly &&= credit.sessionId != null;
    }
  }
  return [...rows.values()].sort((a, b) =>
    (a.role === b.role ? 0 : a.role === 'producer' ? -1 : 1)
    || a.name.localeCompare(b.name) || a.personId.localeCompare(b.personId)
  );
}
