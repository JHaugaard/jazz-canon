import type { NavEntry } from './types';

/* Navigation stack for the panel layer. The timeline never unmounts;
   panels render the top entry. Pushing walks deeper into the discovery
   loop (album → musician → album → …); back pops one step. */

class Nav {
  stack = $state<NavEntry[]>([]);

  get top(): NavEntry | null {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  openAlbum(id: string) {
    const t = this.top;
    if (t && t.kind === 'album' && t.id === id) return;
    this.stack.push({ kind: 'album', id });
  }

  openPerson(id: string) {
    const t = this.top;
    if (t && t.kind === 'person' && t.id === id) return;
    this.stack.push({ kind: 'person', id });
  }

  openPlace(id: string) {
    const t = this.top;
    if (t && t.kind === 'place' && t.id === id) return;
    this.stack.push({ kind: 'place', id });
  }

  back() {
    this.stack.pop();
  }

  close() {
    this.stack = [];
  }
}

export const nav = new Nav();

/* Dev-only test seam: the repo has no test suite, and behavioral probes
   (playwright against `npm run dev`) need a way to drive navigation
   without scripting the full click path. Absent from production builds. */
import { DEV } from './places-data';
if (DEV) (window as unknown as { __nav?: Nav }).__nav = nav;
