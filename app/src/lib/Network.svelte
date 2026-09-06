<script lang="ts">
  import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCollide,
    forceX,
    forceY,
    type Simulation,
  } from 'd3-force';
  import type { AlbumCard, GraphData } from './types';
  import { loadGraph, albumMap } from './data';
  import { groupQuery, MAX_GROUP, type Collaborator } from './group-query';

  /* DOM ownership (DECISIONS.md D4): d3-force computes positions only.
     Svelte owns every SVG element; the tick handler updates state and
     Svelte re-renders. d3 never selects or mutates a DOM node. */

  /* personIds: one musician is the classic constellation; two to MAX_GROUP
     is a group, and only albums crediting every one of them are drawn. The
     selection lives in the nav entry — this component asks for changes via
     onGroupChange and never edits it locally. */
  let {
    personIds,
    onOpenAlbum,
    onRecenter,
    onGroupChange,
    onmeta,
  }: {
    personIds: string[];
    onOpenAlbum: (albumId: string) => void;
    onRecenter: (personId: string) => void;
    onGroupChange: (ids: string[]) => void;
    onmeta?: (m: { name: string }) => void;
  } = $props();

  interface AlbumNode {
    kind: 'album';
    id: string;
    album: AlbumCard;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
  }
  interface PersonNode {
    kind: 'person';
    id: string;
    name: string;
    shared: number; // albums shared with the selected musician(s)
    instruments: string;
    center: boolean;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
  }
  type Node = AlbumNode | PersonNode;
  interface Link {
    source: Node;
    target: Node;
    weight: number; // for musician-album links: that musician's shared-count with center
  }

  // viewBox units — a generous canvas the forces spread across; the
  // zoom/fit layer frames it to the window regardless of graph size.
  // Width follows the stage's aspect ratio at build time, so a tall phone
  // screen gets a tall canvas instead of a letterboxed miniature.
  const H = 1040;
  let W = $state(1600);

  // simNodes/simLinks are d3's stable, mutable objects (positions live here).
  // nodes/links are per-frame *clones* pushed to Svelte — new references each
  // tick so keyed {#each} actually re-renders moved nodes. (Svelte owns the
  // DOM; d3 owns the numbers — DECISIONS.md D4.)
  let simNodes: Node[] = [];
  let simLinks: Link[] = [];
  let nodes = $state<Node[]>([]);
  let links = $state<Link[]>([]);
  let albumNodesR = $derived(nodes.filter((n): n is AlbumNode => n.kind === 'album'));
  let personNodesR = $derived(nodes.filter((n): n is PersonNode => n.kind === 'person'));

  const snapshot = () => {
    nodes = simNodes.map((n) => ({ ...n }));
    links = simLinks.map((l) => ({ ...l }));
  };
  let centerName = $state(''); // selected names, ' · ' joined
  let centerInstruments = $state('');
  let selected = $state<{ id: string; name: string }[]>([]);
  let isGroup = $derived(selected.length > 1);
  let centerProse = $derived(
    selected.length < 2
      ? selected.map((p) => p.name).join('')
      : selected.slice(0, -1).map((p) => p.name).join(', ') + ' and ' + selected[selected.length - 1].name
  );
  // for the Add-musician suggestions: everyone else on the shared albums,
  // best first, and each person's whole album set for typed lookups
  let collaborators = $state<Collaborator[]>([]);
  let graphRef: GraphData | null = null;
  let albumSetOf = new Map<string, Set<string>>();
  let sharedAlbumIds = new Set<string>();
  let albumCount = $state(0);
  let peopleCount = $state(0);
  let loading = $state(true);
  let hovered = $state<PersonNode | null>(null);
  let hoverPos = $state({ x: 0, y: 0 });

  // zoom/pan transform applied to the whole graph group (viewBox units):
  // screen = graph * k + (tx,ty)
  let zoom = $state({ k: 1, tx: 0, ty: 0 });
  let userAdjusted = false;

  let sim: Simulation<Node, undefined> | null = null;
  let svgEl = $state<SVGSVGElement | null>(null);
  let gEl = $state<SVGGElement | null>(null);
  let stageEl = $state<HTMLDivElement | null>(null);
  let stageW = $state(0);
  let stageH = $state(0);
  let fitted = false;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  function radius(n: Node): number {
    if (n.kind === 'album') return 30;
    if (n.center) return 40;
    return 13 + Math.min(15, (n.shared - 1) * 3.5);
  }

  function edgeWidth(l: Link): number {
    return 1.2 + Math.min(5, (l.weight - 1) * 1.3);
  }

  $effect(() => {
    const ids = [...personIds];
    const key = ids.join('|');
    loading = true;
    hovered = null;
    userAdjusted = false;
    fitted = false;
    zoom = { k: 1, tx: 0, ty: 0 };
    let cancelled = false;

    Promise.all([loadGraph(), albumMap()]).then(([graph, albums]) => {
      if (cancelled || key !== personIds.join('|')) return;
      buildGraph(graph, albums, ids);
      loading = false;
    });

    return () => {
      cancelled = true;
      sim?.stop();
      sim = null;
    };
  });

  function buildGraph(graph: GraphData, albums: Map<string, AlbumCard>, ids: string[]) {
    sim?.stop();
    graphRef = graph;
    if (albumSetOf.size === 0) {
      for (const e of graph.edges) {
        let set = albumSetOf.get(e.p);
        if (!set) albumSetOf.set(e.p, (set = new Set()));
        set.add(e.a);
      }
    }

    // match the canvas to the stage's shape (kept for this graph's lifetime;
    // a later window resize just re-frames via zoom, it doesn't re-run forces)
    if (stageW > 0 && stageH > 0) W = clamp((H * stageW) / stageH, 560, 2600);

    const q = groupQuery(graph, ids);
    sharedAlbumIds = new Set(q.albumIds);
    collaborators = q.collaborators;
    selected = q.ids.map((id) => ({ id, name: graph.people[id] ?? '?' }));
    centerName = selected.map((p) => p.name).join(' · ');
    // instruments are only a clean one-liner for a single musician; a group's
    // instruments belong on the chips, not the strip
    centerInstruments = q.ids.length === 1 ? (q.instruments.get(q.ids[0]) ?? []).join(', ') : '';
    onmeta?.({ name: centerName });

    const cx = W / 2;
    const cy = H / 2;
    const n = q.ids.length;
    const group = n > 1;

    // selected musicians: one sits at the center; a group is pinned on a
    // ring around it with the shared albums seeded inside, so every selected
    // name is equally prominent and the albums read as what they have in common
    const ringR = n === 2 ? 300 : 330;
    const centers: PersonNode[] = q.ids.map((id, i) => {
      const angle = n === 2 ? Math.PI * i : (2 * Math.PI * i) / n - Math.PI / 2;
      const x = group ? cx + ringR * Math.cos(angle) : cx;
      const y = group ? cy + ringR * Math.sin(angle) : cy;
      return {
        kind: 'person', id, name: graph.people[id] ?? '?', shared: q.albumIds.length,
        instruments: (q.instruments.get(id) ?? []).join(', '), center: true,
        x, y, fx: x, fy: y,
      };
    });

    const albumR = group ? 150 : 320;
    const albumNodes: AlbumNode[] = q.albumIds.map((aid, i) => {
      const angle = (2 * Math.PI * i) / q.albumIds.length - Math.PI / 2;
      return {
        kind: 'album', id: aid, album: albums.get(aid)!,
        x: cx + albumR * Math.cos(angle), y: cy + albumR * Math.sin(angle),
      };
    });
    const albumNodeById = new Map(albumNodes.map((n) => [n.id, n]));

    const personNodes: PersonNode[] = q.collaborators.map((c) => {
      // seed near one of their shared albums
      const firstAlbum = graph.edges.find((e) => e.p === c.id && sharedAlbumIds.has(e.a))!;
      const anchor = albumNodeById.get(firstAlbum.a)!;
      const jitter = () => (Math.random() - 0.5) * 80;
      const spread = group ? 2.4 : 0.6;
      return {
        kind: 'person', id: c.id, name: c.name, shared: c.shared,
        instruments: c.instruments.join(', '),
        center: false,
        x: anchor.x + (anchor.x - cx) * spread + jitter(),
        y: anchor.y + (anchor.y - cy) * spread + jitter(),
      };
    });

    simNodes = [...centers, ...albumNodes, ...personNodes];
    const allNodes = simNodes;

    const allLinks: Link[] = [];
    for (const c of centers) {
      for (const an of albumNodes) allLinks.push({ source: c, target: an, weight: 1 });
    }
    const personNodeById = new Map(personNodes.map((n) => [n.id, n]));
    for (const e of graph.edges) {
      const pn = personNodeById.get(e.p);
      if (!pn || !sharedAlbumIds.has(e.a)) continue;
      allLinks.push({ source: pn, target: albumNodeById.get(e.a)!, weight: pn.shared });
    }

    simLinks = allLinks;
    albumCount = albumNodes.length;
    peopleCount = personNodes.length;

    sim = forceSimulation<Node>(allNodes)
      .force('link', forceLink<Node, Link>(allLinks)
        .distance((l) => ((l.source as Node) as PersonNode).center ? (group ? 220 : 300) : 145)
        .strength(0.5))
      .force('charge', forceManyBody<Node>().strength((n) =>
        // in a group the shared albums all sit between the same few pinned
        // centers; stronger album repulsion keeps them from stacking there
        n.kind === 'album' ? (group ? -2600 : -900) : (n as PersonNode).center ? -1400 : -260))
      .force('collide', forceCollide<Node>()
        // the center node gets a wide collision halo; every musician carries
        // a visible name label, so each gets generous personal space
        .radius((n) => (n.kind === 'person' && n.center ? (group ? 80 : 110) : radius(n) + (group && n.kind === 'album' ? 40 : 16)))
        .iterations(2))
      .force('x', forceX<Node>(cx).strength(0.03))
      .force('y', forceY<Node>(cy).strength(0.03))
      .on('tick', () => {
        // clamp into the viewBox, then push a fresh snapshot to Svelte
        for (const n of allNodes) {
          const r = radius(n) + 6;
          n.x = clamp(n.x, r, W - r);
          n.y = clamp(n.y, r, H - r);
        }
        snapshot();
        // auto-fit exactly once, when the layout has calmed down
        if (!fitted && !userAdjusted && sim && sim.alpha() < 0.06) {
          fitted = true;
          fitView();
        }
      });

    snapshot();
  }

  /** Frame all nodes to fill the stage with padding. */
  function fitView() {
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = radius(n);
      // labels hang below each node, so pad more on the bottom
      minX = Math.min(minX, n.x - r - 42);
      maxX = Math.max(maxX, n.x + r + 42);
      minY = Math.min(minY, n.y - r - 26);
      maxY = Math.max(maxY, n.y + r + 50);
    }
    const bw = maxX - minX, bh = maxY - minY;
    // shrink big graphs to fit; let sparse graphs grow, but only modestly
    // (unbounded magnification made small graphs load correct, then jump huge)
    const k = clamp(Math.min(W / bw, H / bh), 0.4, 1.6);
    zoom = {
      k,
      tx: (W - k * (minX + maxX)) / 2,
      ty: (H - k * (minY + maxY)) / 2,
    };
  }

  // --- pointer geometry (accounts for viewBox mapping AND zoom transform) ---
  function graphPoint(e: PointerEvent): { x: number; y: number } {
    const m = gEl?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function rootPoint(e: PointerEvent): { x: number; y: number } {
    const m = svgEl?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  // --- node drag / pan / pinch ---
  let dragNode: Node | null = null;
  let dragMoved = false;
  let panning = false;
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  // all pointers currently down on the graph, for two-finger pinch (iPad)
  let pointers = new Map<number, { x: number; y: number }>();
  let pinchPrev: { dist: number; mx: number; my: number } | null = null;

  // node drag and background pan both track pointer moves at the WINDOW
  // level: the per-tick re-render of node <g>s makes pointer-capture on them
  // unreliable, and window listeners keep working no matter what is under the
  // cursor. (Same pattern as the window resize.)
  function nodeDown(n: Node, e: PointerEvent) {
    e.stopPropagation(); // don't also start a background pan
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // n is a render clone; grab the live simulation node by identity
    dragNode = simNodes.find((s) => s.kind === n.kind && s.id === n.id) ?? null;
    dragMoved = false;
  }
  function bgDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panning = true;
    userAdjusted = true;
    const pv = rootPoint(e);
    panStart = { x: pv.x, y: pv.y, tx: zoom.tx, ty: zoom.ty };
  }
  function onWinMove(e: PointerEvent) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // two fingers → pinch-zoom + pan, and nothing else
    if (pointers.size >= 2) {
      dragNode = null;
      panning = false;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinchPrev) {
        const m = svgEl?.getScreenCTM();
        if (m) {
          const pv = new DOMPoint(mx, my).matrixTransform(m.inverse());
          const prevPv = new DOMPoint(pinchPrev.mx, pinchPrev.my).matrixTransform(m.inverse());
          const k2 = clamp(zoom.k * (dist / pinchPrev.dist), 0.4, 4);
          // zoom around the pinch midpoint, and pan by the midpoint's drift
          zoom = {
            k: k2,
            tx: pv.x - (pv.x - zoom.tx) * (k2 / zoom.k) + (pv.x - prevPv.x),
            ty: pv.y - (pv.y - zoom.ty) * (k2 / zoom.k) + (pv.y - prevPv.y),
          };
          userAdjusted = true;
        }
      }
      pinchPrev = { dist, mx, my };
      return;
    }

    if (dragNode && sim) {
      dragMoved = true;
      userAdjusted = true;
      const { x, y } = graphPoint(e);
      const r = radius(dragNode) + 6;
      const nx = clamp(x, r, W - r);
      const ny = clamp(y, r, H - r);
      // pin for the simulation AND move immediately so it tracks the cursor
      dragNode.fx = nx; dragNode.fy = ny;
      dragNode.x = nx; dragNode.y = ny;
      sim.alphaTarget(0.15).restart();
      snapshot(); // reflect the new position this frame
    } else if (panning) {
      const pv = rootPoint(e);
      zoom = { ...zoom, tx: panStart.tx + (pv.x - panStart.x), ty: panStart.ty + (pv.y - panStart.y) };
    }
  }
  function onWinUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchPrev = null;
    if (dragNode && sim) sim.alphaTarget(0);
    dragNode = null;
    panning = false;
  }
  function unpin(n: Node, e: Event) {
    e.stopPropagation();
    if (n.kind === 'person' && n.center) return; // center stays anchored
    const s = simNodes.find((x) => x.kind === n.kind && x.id === n.id);
    if (!s) return;
    s.fx = null;
    s.fy = null;
    sim?.alphaTarget(0.15).restart();
    setTimeout(() => sim?.alphaTarget(0), 400);
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    userAdjusted = true;
    const m = svgEl?.getScreenCTM();
    if (!m) return;
    const pv = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const factor = Math.exp(-e.deltaY * 0.0015);
    const k2 = clamp(zoom.k * factor, 0.4, 4);
    zoom = {
      k: k2,
      tx: pv.x - (pv.x - zoom.tx) * (k2 / zoom.k),
      ty: pv.y - (pv.y - zoom.ty) * (k2 / zoom.k),
    };
  }
  function resetView() {
    fitView();
  }
  const wasDrag = () => dragMoved;

  function onHover(n: PersonNode) {
    hovered = n;
    const m = gEl?.getScreenCTM();
    const sr = stageEl?.getBoundingClientRect();
    if (!m || !sr) return;
    const sx = m.a * n.x + m.c * n.y + m.e;
    const sy = m.b * n.x + m.d * n.y + m.f;
    hoverPos = { x: sx - sr.left, y: sy - sr.top - radius(n) * Math.abs(m.d) - 8 };
  }

  // --- Add musician (chips + autocomplete) ---
  let addOpen = $state(false);
  let addQuery = $state('');
  let addActive = $state(0);
  let addInput = $state<HTMLInputElement | null>(null);
  let addBox = $state<HTMLElement | null>(null);
  let atCap = $derived(selected.length >= MAX_GROUP);
  const MAX_SUGGEST = 8;

  const fold = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  interface Suggestion { id: string; name: string; shared: number; instruments: string }

  /* Empty query: the people who'd narrow this group least, best first — "who
     completes the group". Typed query: any musician in the canon, with the
     album count they'd leave (0 is allowed and shown, never hidden: an empty
     result is a real answer). */
  let suggestions = $derived.by((): Suggestion[] => {
    const q = fold(addQuery.trim());
    const chosen = new Set(selected.map((p) => p.id));
    if (!q) {
      return collaborators
        .slice(0, MAX_SUGGEST)
        .map((c) => ({ id: c.id, name: c.name, shared: c.shared, instruments: c.instruments.slice(0, 2).join(', ') }));
    }
    if (!graphRef) return [];
    const byId = new Map(collaborators.map((c) => [c.id, c]));
    const hits: (Suggestion & { r: number })[] = [];
    for (const [id, name] of Object.entries(graphRef.people)) {
      if (chosen.has(id)) continue;
      const norm = fold(name);
      const at = norm.indexOf(q);
      if (at < 0) continue;
      const r = at === 0 ? 0 : norm[at - 1] === ' ' ? 1 : 2;
      const c = byId.get(id);
      let shared = c?.shared ?? 0;
      if (!c) {
        const mine = albumSetOf.get(id);
        if (mine) for (const a of sharedAlbumIds) if (mine.has(a)) shared++;
      }
      hits.push({ id, name, shared, instruments: c?.instruments.slice(0, 2).join(', ') ?? '', r });
    }
    return hits
      .sort((a, b) => a.r - b.r || b.shared - a.shared || a.name.localeCompare(b.name))
      .slice(0, MAX_SUGGEST);
  });

  $effect(() => {
    void suggestions.length;
    addActive = 0;
  });

  function openAdd() {
    if (atCap) return;
    addOpen = true;
    addQuery = '';
    requestAnimationFrame(() => addInput?.focus());
  }
  function closeAdd() {
    addOpen = false;
    addQuery = '';
  }
  function addMusician(id: string) {
    if (atCap || selected.some((p) => p.id === id)) return;
    closeAdd();
    onGroupChange([...selected.map((p) => p.id), id]);
  }
  function removeMusician(id: string) {
    onGroupChange(selected.filter((p) => p.id !== id).map((p) => p.id));
  }
  function addKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // the window's Escape pops the nav stack
      closeAdd();
      return;
    }
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      addActive = (addActive + 1) % suggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      addActive = (addActive - 1 + suggestions.length) % suggestions.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addMusician(suggestions[addActive].id);
    }
  }
  function onWinDown(e: PointerEvent) {
    if (addOpen && addBox && !addBox.contains(e.target as HTMLElement)) closeAdd();
  }

  function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
</script>

<svelte:window onpointermove={onWinMove} onpointerup={onWinUp} onpointerdown={onWinDown} />

<div class="net">
  <div class="net-strip">
    <span class="const-label display">Constellation</span>
    <span class="stats">
      {#if centerInstruments}{centerInstruments}&ensp;·&ensp;{/if}
      {#if isGroup}
        {albumCount} canon album{albumCount === 1 ? '' : 's'} featuring all {selected.length} · {peopleCount} other collaborator{peopleCount === 1 ? '' : 's'}
      {:else}
        {albumCount} canon album{albumCount === 1 ? '' : 's'} · {peopleCount} collaborator{peopleCount === 1 ? '' : 's'}
      {/if}
    </span>
    <button class="reset" onclick={resetView}>Reset view</button>
  </div>

  <!-- the selection: who is in the group, and the one way to add to it.
       Adding narrows (only albums crediting everyone stay); removing widens. -->
  <div class="group-bar" role="group" aria-label="Selected musicians">
    {#each selected as p (p.id)}
      <span class="chip">
        <span class="chip-name">{p.name}</span>
        {#if isGroup}
          <button class="chip-x" onclick={() => removeMusician(p.id)} aria-label={`Remove ${p.name} from the group`}>×</button>
        {/if}
      </span>
    {/each}
    {#if !atCap}
      <div class="add" bind:this={addBox}>
        {#if addOpen}
          <input
            class="add-input"
            type="search"
            placeholder="Add a musician…"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            aria-label="Add a musician to the group"
            aria-expanded={addOpen}
            aria-controls="add-results"
            aria-activedescendant={suggestions.length ? `add-opt-${addActive}` : undefined}
            bind:value={addQuery}
            bind:this={addInput}
            onkeydown={addKeydown}
          />
          <div class="add-results" id="add-results" role="listbox" aria-label="Musicians to add">
            {#if !suggestions.length}
              <div class="add-empty">No matches in the canon.</div>
            {:else}
              {#if !addQuery.trim()}<div class="add-group display">Also on these albums</div>{/if}
              {#each suggestions as sg, i (sg.id)}
                <button
                  class="add-row"
                  class:active={addActive === i}
                  id={`add-opt-${i}`}
                  role="option"
                  aria-selected={addActive === i}
                  onpointerenter={() => (addActive = i)}
                  onclick={() => addMusician(sg.id)}
                >
                  <span class="add-main">{sg.name}</span>
                  <span class="add-meta">
                    {#if sg.instruments}{sg.instruments}&ensp;·&ensp;{/if}{sg.shared} shared album{sg.shared === 1 ? '' : 's'}
                  </span>
                </button>
              {/each}
            {/if}
          </div>
        {:else}
          <button class="add-btn" onclick={openAdd}>+ Add musician</button>
        {/if}
      </div>
    {:else}
      <span class="cap-note">Up to {MAX_GROUP} musicians</span>
    {/if}
  </div>

  <div class="stage" bind:this={stageEl} bind:clientWidth={stageW} bind:clientHeight={stageH}>
    {#if loading}
      <p class="loading">Loading constellation…</p>
    {:else if isGroup && albumCount === 0}
      <div class="none">
        <p class="none-head display">No shared albums in this canon</p>
        <p class="none-body">
          No album here credits all of {centerProse}. That is a fact about this
          collection, not about the musicians — remove a name to widen the question.
        </p>
      </div>
    {:else}
      <svg
        viewBox="0 0 {W} {H}"
        role="img"
        aria-label={isGroup ? `Albums featuring ${centerName}` : `Constellation for ${centerName}`}
        bind:this={svgEl}
        onpointerdown={bgDown}
        onwheel={onWheel}
        ondblclick={resetView}
      >
        <g class="zoom" bind:this={gEl} transform="translate({zoom.tx} {zoom.ty}) scale({zoom.k})">
          <!-- edges -->
          {#each links as l}
            <line
              x1={l.source.x} y1={l.source.y}
              x2={l.target.x} y2={l.target.y}
              stroke="var(--bn-blue)"
              stroke-opacity={((l.source as any).center || (l.target as any).center) ? 0.32 : 0.16}
              stroke-width={edgeWidth(l)}
            />
          {/each}

          <!-- album nodes -->
          {#each albumNodesR as n (n.id)}
            <g
              class="album-node"
              transform="translate({n.x},{n.y})"
              onpointerdown={(e) => nodeDown(n, e)}
              onclick={() => !wasDrag() && onOpenAlbum(n.id)}
              ondblclick={(e) => unpin(n, e)}
              onkeydown={(e) => e.key === 'Enter' && onOpenAlbum(n.id)}
              role="button"
              tabindex="0"
              aria-label={`${n.album.title} (${n.album.year})`}
            >
              <circle class="hit" r={radius(n) + 12} />
              <circle r={radius(n)} fill="var(--surface)" stroke="var(--bn-blue)" stroke-width="2.5" />
              <clipPath id="clip-{n.id}"><circle r={radius(n) - 3} /></clipPath>
              <image
                href={n.album.artUrl}
                x={-(radius(n) - 3)} y={-(radius(n) - 3)}
                width={(radius(n) - 3) * 2} height={(radius(n) - 3) * 2}
                clip-path="url(#clip-{n.id})"
                preserveAspectRatio="xMidYMid slice"
              />
              <text class="album-label" y={radius(n) + 16}>{truncate(n.album.title, 26)}</text>
              <text class="album-year" y={radius(n) + 30}>{n.album.year}</text>
            </g>
          {/each}

          <!-- musician nodes -->
          {#each personNodesR as n (n.id)}
            <g
              class="person-node"
              class:center={n.center}
              transform="translate({n.x},{n.y})"
              onpointerdown={(e) => nodeDown(n, e)}
              onclick={() => !wasDrag() && !n.center && onRecenter(n.id)}
              ondblclick={(e) => unpin(n, e)}
              onkeydown={(e) => e.key === 'Enter' && !n.center && onRecenter(n.id)}
              onmouseenter={() => onHover(n)}
              onmouseleave={() => (hovered = null)}
              role="button"
              tabindex="0"
              aria-label={`${n.name}${n.instruments ? ', ' + n.instruments : ''}`}
            >
              <circle class="hit" r={radius(n) + 12} />
              <circle
                r={radius(n)}
                fill={n.center ? 'var(--bn-blue)' : 'var(--bn-blue-light)'}
                fill-opacity={n.center ? 1 : 0.9}
                stroke={n.center ? 'var(--ink)' : 'var(--surface)'}
                stroke-width={n.center ? 2.5 : 1.6}
              />
              {#if n.center}
                <text class="center-label" class:small={isGroup} y={radius(n) + 20}>{n.name}</text>
              {:else}
                <text class="person-label" y={radius(n) + 14}>{n.name}</text>
              {/if}
            </g>
          {/each}
        </g>
      </svg>

      {#if hovered && !hovered.center}
        <div class="tip" style:left="{hoverPos.x}px" style:top="{hoverPos.y}px">
          <strong>{hovered.name}</strong>
          {#if hovered.instruments}<span class="tip-inst">{hovered.instruments}</span>{/if}
          <span class="tip-shared">{hovered.shared} shared album{hovered.shared === 1 ? '' : 's'} with {isGroup ? `all ${selected.length}` : centerName}</span>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .net { padding: 8px 40px 24px; height: 100%; display: flex; flex-direction: column; }

  .net-strip {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin-bottom: 12px;
  }
  .const-label {
    font-size: 21px;
    color: var(--bn-blue);
    letter-spacing: 0.03em;
  }
  .stats { font-size: 13px; color: var(--muted); }
  .reset {
    margin-left: auto;
    background: none;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--bn-blue);
  }
  .reset:hover { border-color: var(--bn-blue-light); background: var(--bg); }

  .group-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: -4px 0 10px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--bn-blue);
    color: var(--bg);
    border-radius: 999px;
    padding: 5px 8px 5px 12px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }
  .chip-name { padding-right: 4px; }
  .chip-x {
    background: none;
    border: none;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    opacity: 0.8;
  }
  .chip-x:hover, .chip-x:focus-visible { opacity: 1; background: rgba(255, 255, 255, 0.18); }
  .add { position: relative; }
  .add-btn {
    background: none;
    border: 1px dashed var(--bn-blue-light);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--bn-blue);
    line-height: 1;
    cursor: pointer;
  }
  .add-btn:hover, .add-btn:focus-visible { border-style: solid; background: var(--bg); }
  .add-input {
    width: 240px;
    height: 32px;
    padding: 0 12px;
    font-family: var(--font-body);
    font-size: 13.5px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--bn-blue-light);
    border-radius: 999px;
    outline: none;
  }
  .add-input::-webkit-search-cancel-button { -webkit-appearance: none; }
  .add-results {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 300px;
    max-width: calc(100vw - 40px);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(28, 26, 23, 0.16);
    max-height: min(400px, 60vh);
    overflow-y: auto;
    z-index: 40;
    padding: 4px;
  }
  .add-group { font-size: 12.5px; color: var(--bn-blue); letter-spacing: 0.06em; padding: 7px 10px 3px; }
  .add-row {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .add-row.active { background: rgba(43, 95, 122, 0.09); }
  .add-main { font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .add-meta { font-size: 12px; color: var(--muted); }
  .add-empty { padding: 12px; font-size: 13px; color: var(--muted); }
  .cap-note { font-size: 12px; color: var(--muted); }

  .stage { position: relative; flex: 1; min-height: 0; }
  .none {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .none-head { font-size: 22px; color: var(--bn-blue); margin: 0 0 8px; }
  .none-body { max-width: 46ch; color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0; }
  svg {
    width: 100%;
    height: 100%;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    touch-action: none;
    cursor: grab;
    display: block;
  }
  svg:active { cursor: grabbing; }

  /* invisible enlarged grab target so nodes are easy to click and drag */
  .hit { fill: transparent; pointer-events: all; }
  .album-node, .person-node { cursor: pointer; }
  .person-node.center { cursor: grab; }
  .album-node:hover circle { stroke-width: 3.5; }
  .person-node:not(.center):hover circle { fill: var(--bn-blue); fill-opacity: 1; }

  text {
    font-family: var(--font-body);
    text-anchor: middle;
    pointer-events: none;
    fill: var(--ink);
  }
  .album-label { font-size: 13px; font-weight: 600; }
  .album-year { font-size: 11px; fill: var(--muted); }
  .person-label { font-size: 12px; fill: var(--muted); }
  .center-label {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
  }
  .center-label.small { font-size: 16px; }

  .tip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: var(--ink);
    color: var(--bg);
    font-size: 12px;
    line-height: 1.4;
    padding: 7px 10px;
    border-radius: 6px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 5;
    display: flex;
    flex-direction: column;
  }
  .tip-inst { opacity: 0.85; }
  .tip-shared { opacity: 0.7; font-size: 11px; }

  .loading { color: var(--muted); padding: 20px; }

  @media (max-width: 620px) {
    .net { padding: 6px 14px 14px; }
    .net-strip { flex-wrap: wrap; gap: 6px 12px; }
    .const-label { font-size: 18px; }
    .stats { font-size: 12px; }
    .reset { margin-left: auto; }
    .chip { font-size: 12px; padding: 4px 6px 4px 10px; }
    .add-input { width: 190px; }
  }
</style>
