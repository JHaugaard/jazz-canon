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

  /* DOM ownership (DECISIONS.md D4): d3-force computes positions only.
     Svelte owns every SVG element; the tick handler updates state and
     Svelte re-renders. d3 never selects or mutates a DOM node. */

  let {
    personId,
    onOpenAlbum,
    onRecenter,
    onmeta,
  }: {
    personId: string;
    onOpenAlbum: (albumId: string) => void;
    onRecenter: (personId: string) => void;
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
    shared: number; // albums shared with the center musician
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
  const W = 1600;
  const H = 1040;

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
  let centerName = $state('');
  let centerInstruments = $state('');
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
    const id = personId;
    loading = true;
    hovered = null;
    userAdjusted = false;
    fitted = false;
    zoom = { k: 1, tx: 0, ty: 0 };
    let cancelled = false;

    Promise.all([loadGraph(), albumMap()]).then(([graph, albums]) => {
      if (cancelled || id !== personId) return;
      buildGraph(graph, albums, id);
      loading = false;
    });

    return () => {
      cancelled = true;
      sim?.stop();
      sim = null;
    };
  });

  function buildGraph(graph: GraphData, albums: Map<string, AlbumCard>, id: string) {
    sim?.stop();

    const myEdges = graph.edges.filter((e) => e.p === id);
    const myAlbumIds = new Set(myEdges.map((e) => e.a));

    // collaborators: everyone sharing at least one of those albums
    const sharedCount = new Map<string, number>();
    const collabInstruments = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      if (!myAlbumIds.has(e.a) || e.p === id) continue;
      sharedCount.set(e.p, (sharedCount.get(e.p) ?? 0) + 1);
      let set = collabInstruments.get(e.p);
      if (!set) collabInstruments.set(e.p, (set = new Set()));
      for (const en of e.entries) set.add(en.instrument);
    }

    centerName = graph.people[id] ?? '?';
    centerInstruments = [...new Set(myEdges.flatMap((e) => e.entries.map((en) => en.instrument)))].join(', ');
    onmeta?.({ name: centerName });

    const cx = W / 2;
    const cy = H / 2;

    const center: PersonNode = {
      kind: 'person', id, name: centerName, shared: myAlbumIds.size,
      instruments: centerInstruments, center: true,
      x: cx, y: cy, fx: cx, fy: cy,
    };

    const albumNodes: AlbumNode[] = [...myAlbumIds].map((aid, i) => {
      const angle = (2 * Math.PI * i) / myAlbumIds.size - Math.PI / 2;
      return {
        kind: 'album', id: aid, album: albums.get(aid)!,
        x: cx + 320 * Math.cos(angle), y: cy + 320 * Math.sin(angle),
      };
    });
    const albumNodeById = new Map(albumNodes.map((n) => [n.id, n]));

    const personNodes: PersonNode[] = [...sharedCount.entries()].map(([pid, count]) => {
      // seed near one of their shared albums
      const firstAlbum = graph.edges.find((e) => e.p === pid && myAlbumIds.has(e.a))!;
      const anchor = albumNodeById.get(firstAlbum.a)!;
      const jitter = () => (Math.random() - 0.5) * 80;
      return {
        kind: 'person', id: pid, name: graph.people[pid] ?? '?', shared: count,
        instruments: [...(collabInstruments.get(pid) ?? [])].join(', '),
        center: false,
        x: anchor.x + (anchor.x - cx) * 0.6 + jitter(),
        y: anchor.y + (anchor.y - cy) * 0.6 + jitter(),
      };
    });

    simNodes = [center, ...albumNodes, ...personNodes];
    const allNodes = simNodes;

    const allLinks: Link[] = [];
    for (const an of albumNodes) {
      allLinks.push({ source: center, target: an, weight: 1 });
    }
    for (const e of graph.edges) {
      if (!myAlbumIds.has(e.a) || e.p === id) continue;
      const pn = personNodes.find((n) => n.id === e.p)!;
      allLinks.push({ source: pn, target: albumNodeById.get(e.a)!, weight: pn.shared });
    }

    simLinks = allLinks;
    albumCount = albumNodes.length;
    peopleCount = personNodes.length;

    sim = forceSimulation<Node>(allNodes)
      .force('link', forceLink<Node, Link>(allLinks)
        .distance((l) => ((l.source as Node) as PersonNode).center ? 300 : 145)
        .strength(0.5))
      .force('charge', forceManyBody<Node>().strength((n) =>
        n.kind === 'album' ? -900 : (n as PersonNode).center ? -1400 : -260))
      .force('collide', forceCollide<Node>()
        // the center node gets a wide collision halo; every musician carries
        // a visible name label, so each gets generous personal space
        .radius((n) => (n.kind === 'person' && n.center ? 110 : radius(n) + 16))
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
    // never magnify past natural size (k > 1) — that made sparse graphs
    // load correct, then jump too large; only shrink to fit big graphs
    const k = clamp(Math.min(W / bw, H / bh), 0.4, 1);
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

  function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
</script>

<svelte:window onpointermove={onWinMove} onpointerup={onWinUp} />

<div class="net">
  <div class="net-strip">
    <span class="const-label display">Constellation</span>
    <span class="stats">
      {#if centerInstruments}{centerInstruments}&ensp;·&ensp;{/if}
      {albumCount} canon album{albumCount === 1 ? '' : 's'} · {peopleCount} collaborator{peopleCount === 1 ? '' : 's'}
    </span>
    <button class="reset" onclick={resetView}>Reset view</button>
  </div>

  <div class="stage" bind:this={stageEl}>
    {#if loading}
      <p class="loading">Loading constellation…</p>
    {:else}
      <svg
        viewBox="0 0 {W} {H}"
        role="img"
        aria-label={`Constellation for ${centerName}`}
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
                <text class="center-label" y={radius(n) + 20}>{n.name}</text>
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
          <span class="tip-shared">{hovered.shared} shared album{hovered.shared === 1 ? '' : 's'} with {centerName}</span>
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

  .stage { position: relative; flex: 1; min-height: 0; }
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
  }
</style>
