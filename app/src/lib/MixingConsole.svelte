<script lang="ts">
  import { untrack } from 'svelte';
  import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, type Simulation } from 'd3-force';
  import { loadDetails, loadGraph, loadAlbums } from './data';
  import { mixingIndex, mixingQuery, roles, type Role, type MixingSelection, type MixingIndex, type MixingPerson } from './mixing-query';
  import type { AlbumCard, Epistemic } from './types';

  let { selection, anchor, onChange, onOpenAlbum, onmeta }: {
    selection: MixingSelection;
    anchor: { role: 'producer' | 'engineer'; id: string };
    onChange: (value: MixingSelection) => void;
    onOpenAlbum: (id: string) => void;
    onmeta: (name: string) => void;
  } = $props();

  type Node = { id: string; kind: 'album' | 'person'; name: string; album?: AlbumCard; roles?: Role[];
    e?: Epistemic; x: number; y: number; fx?: number | null; fy?: number | null };
  type Link = { source: Node; target: Node; role: Role; e: Epistemic; offset: number };
  let index = $state<MixingIndex | null>(null);
  let albums = $state<AlbumCard[]>([]);
  let error = $state('');
  let busy = $state(true);
  let picker = $state<Role | null>(null);
  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  let pickerBox = $state<HTMLElement | null>(null);
  let stage = $state<HTMLElement | null>(null);
  let svg = $state<SVGSVGElement | null>(null);
  let group = $state<SVGGElement | null>(null);
  let stageW = $state(0);
  let stageH = $state(0);
  const H = 900;
  let W = $derived(Math.max(600, Math.min(2200, stageW && stageH ? H * stageW / stageH : 1500)));
  let zoom = $state({ k: 1, tx: 0, ty: 0 });
  let nodes = $state<Node[]>([]);
  let links = $state<Link[]>([]);
  let liveNodes: Node[] = [];
  let sim: Simulation<Node, undefined> | null = null;
  let adjusted = false;
  let fitted = false;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const label = (r: Role) => r[0].toUpperCase() + r.slice(1);
  let result = $derived(index ? mixingQuery(index, selection, albums.map((a) => a.id)) : null);
  let candidates = $derived.by(() => {
    if (!result || !picker) return [] as MixingPerson[];
    const q = fold(query.trim());
    return result.suggestions[picker]
      .filter((p) => !q || fold(p.name).includes(q))
      .slice(0, 12);
  });
  $effect(() => { void candidates.length; active = 0; });
  $effect(() => {
    let cancelled = false;
    Promise.all([loadDetails(), loadGraph(), loadAlbums()])
      .then(([details, graph, cards]) => {
        if (cancelled) return;
        index = mixingIndex(details, graph);
        albums = cards;
        busy = false;
      }).catch((e) => { if (!cancelled) { error = String(e); busy = false; } });
    return () => { cancelled = true; sim?.stop(); };
  });
  $effect(() => {
    if (!result) return;
    const selected = result.selected;
    onmeta(selected.map((p) => `${p.name} (${label(p.role)})`).join(' · '));
    sim?.stop();
    adjusted = false;
    fitted = false;
    zoom = { k: 1, tx: 0, ty: 0 };
    // Resizing changes the viewBox, not the selections or the user's view.
    const width = untrack(() => W);
    const cx = width / 2, cy = H / 2;
    // One identity per person even when the same ID occupies two role slots.
    const people = new Map<string, Node>();
    for (const p of selected) {
      const n = people.get(p.id);
      if (n) n.roles!.push(p.role);
      else people.set(p.id, { id: p.id, kind: 'person', name: p.name, roles: [p.role], x: cx, y: cy });
    }
    const personNodes = [...people.values()];
    personNodes.forEach((n, i) => {
      const angle = personNodes.length === 1 ? 0 : 2 * Math.PI * i / personNodes.length - Math.PI / 2;
      n.x = cx + (personNodes.length === 1 ? 0 : 265 * Math.cos(angle));
      n.y = cy + (personNodes.length === 1 ? 0 : 265 * Math.sin(angle));
      n.fx = n.x; n.fy = n.y;
    });
    const cards = new Map(albums.map((a) => [a.id, a]));
    const albumNodes: Node[] = result.albumIds.flatMap((id, i) => {
      const card = cards.get(id);
      if (!card) return [];
      const angle = 2 * Math.PI * i / result.albumIds.length - Math.PI / 2;
      const uncertainty = selected.map((p) => result.uncertainty.get(`${id}:${p.role}:${p.id}`) ?? 'unk');
      const e = uncertainty.includes('unk') ? 'unk' : uncertainty.includes('inf') ? 'inf' : 'obs';
      return [{ id, kind: 'album' as const, name: card.title, album: card, e,
        x: cx + 170 * Math.cos(angle), y: cy + 170 * Math.sin(angle) }];
    });
    liveNodes = [...personNodes, ...albumNodes];
    const edges: Link[] = selected.flatMap((p) => albumNodes.map((a) => {
      const source = people.get(p.id)!;
      const matching = selected.filter((s) => s.id === p.id);
      return { source, target: a, role: p.role,
        e: result.uncertainty.get(`${a.id}:${p.role}:${p.id}`) ?? 'unk',
        offset: (matching.findIndex((s) => s.role === p.role) - (matching.length - 1) / 2) * 28 };
    }));
    const forceEdges = personNodes.flatMap((p) => albumNodes.map((a) => ({ source: p, target: a })));
    const snapshot = () => { nodes = liveNodes.map((n) => ({ ...n })); links = edges.map((e) => ({ ...e, source: { ...e.source }, target: { ...e.target } })); };
    sim = forceSimulation<Node>(liveNodes)
      .force('link', forceLink<Node, { source: Node; target: Node }>(forceEdges).distance(personNodes.length === 1 ? 245 : 190).strength(0.45))
      .force('charge', forceManyBody<Node>().strength(-850))
      .force('collide', forceCollide<Node>().radius((n) => n.kind === 'person' ? 95 : 65))
      .force('x', forceX<Node>(cx).strength(0.025))
      .force('y', forceY<Node>(cy).strength(0.025))
      .on('tick', () => {
        for (const n of liveNodes) { n.x = clamp(n.x, 50, width - 50); n.y = clamp(n.y, 50, H - 50); }
        snapshot();
        if (!fitted && !adjusted && sim && sim.alpha() < 0.06) { fitted = true; fit(); }
      });
    snapshot();
    return () => { sim?.stop(); };
  });

  function fit() {
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x - 95));
    const maxX = Math.max(...nodes.map((n) => n.x + 95));
    const minY = Math.min(...nodes.map((n) => n.y - 65));
    const maxY = Math.max(...nodes.map((n) => n.y + 90));
    const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.4, 1.6);
    zoom = { k, tx: (W - k * (minX + maxX)) / 2, ty: (H - k * (minY + maxY)) / 2 };
  }
  function rootPoint(e: PointerEvent | WheelEvent) {
    const m = svg?.getScreenCTM();
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : new DOMPoint();
  }
  function graphPoint(e: PointerEvent) {
    const m = group?.getScreenCTM();
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : new DOMPoint();
  }
  let pointers = new Map<number, { x: number; y: number }>();
  let drag: Node | null = null;
  let moved = false;
  let pan: { x: number; y: number; tx: number; ty: number } | null = null;
  let pinch: { d: number; x: number; y: number } | null = null;
  function down(n: Node, e: PointerEvent) {
    e.preventDefault(); e.stopPropagation();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = liveNodes.find((v) => v.kind === n.kind && v.id === n.id) ?? null;
    moved = false;
  }
  function backgroundDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = rootPoint(e);
    pan = { x: p.x, y: p.y, tx: zoom.tx, ty: zoom.ty };
  }
  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      drag = null; pan = null;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      if (pinch && d > 0) {
        const m = svg?.getScreenCTM();
        if (m) {
          const now = new DOMPoint(x, y).matrixTransform(m.inverse());
          const before = new DOMPoint(pinch.x, pinch.y).matrixTransform(m.inverse());
          const k = clamp(zoom.k * d / pinch.d, 0.4, 4);
          zoom = { k, tx: now.x - (now.x - zoom.tx) * k / zoom.k + now.x - before.x,
            ty: now.y - (now.y - zoom.ty) * k / zoom.k + now.y - before.y };
          adjusted = true;
        }
      }
      pinch = { d, x, y };
    } else if (drag && sim) {
      const p = graphPoint(e);
      if (Math.hypot(e.movementX, e.movementY) > 0) moved = true;
      drag.fx = drag.x = clamp(p.x, 45, W - 45);
      drag.fy = drag.y = clamp(p.y, 45, H - 45);
      sim.alphaTarget(0.15).restart(); adjusted = true;
    } else if (pan) {
      const p = rootPoint(e);
      zoom = { ...zoom, tx: pan.tx + p.x - pan.x, ty: pan.ty + p.y - pan.y };
      adjusted = true;
    }
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag) sim?.alphaTarget(0);
    drag = null; pan = null;
  }
  function wheel(e: WheelEvent) {
    e.preventDefault(); adjusted = true;
    const p = rootPoint(e), k = clamp(zoom.k * Math.exp(-e.deltaY * 0.0015), 0.4, 4);
    zoom = { k, tx: p.x - (p.x - zoom.tx) * k / zoom.k, ty: p.y - (p.y - zoom.ty) * k / zoom.k };
  }
  function linkPath(link: Link) {
    const dx = link.target.x - link.source.x, dy = link.target.y - link.source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ox = -dy / distance * link.offset, oy = dx / distance * link.offset;
    return `M ${link.source.x + ox} ${link.source.y + oy} L ${link.target.x + ox} ${link.target.y + oy}`;
  }
  function choose(id: string) {
    if (!picker) return;
    onChange({ ...selection, [picker]: id });
    picker = null; query = '';
  }
  function openPicker(role: Role) {
    picker = role; query = ''; active = 0;
    requestAnimationFrame(() => input?.focus());
  }
  function remove(role: Role) { onChange({ ...selection, [role]: undefined }); }
  function pickerKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); picker = null; return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, candidates.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + Math.max(1, candidates.length)) % Math.max(1, candidates.length); }
    if (e.key === 'Enter' && candidates.length) { e.preventDefault(); choose(candidates[active].id); }
  }
  function outside(e: PointerEvent) { if (picker && pickerBox && !pickerBox.contains(e.target as globalThis.Node)) picker = null; }
  const truncate = (s: string) => s.length > 27 ? s.slice(0, 26) + '…' : s;
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={up} onpointerdown={outside} />
<div class="net">
  <div class="strip"><strong class="display">Mixing Console</strong>
    <span>{result?.albumIds.length ?? 0} shared canon album{result?.albumIds.length === 1 ? '' : 's'}</span>
    <button class="reset" onclick={fit}>Reset view</button>
  </div>
  <div class="slots" role="group" aria-label="Mixing Console selections">
    {#each roles as role}
      <div class="slot">
        <span class="role">{label(role)}</span>
        {#if selection[role]}
          <span class="chosen">{index?.names.get(selection[role]!) ?? selection[role]}</span>
          {#if role !== anchor.role}
            <button aria-label={`Replace ${label(role)}`} onclick={() => openPicker(role)}>Change</button>
            <button aria-label={`Remove ${label(role)}`} onclick={() => remove(role)}>×</button>
          {:else}
            <span class="anchor">Starting role</span>
          {/if}
        {:else if role !== 'musician' || selection.producer || selection.engineer}
          <button class="add" onclick={() => openPicker(role)}>+ Add {role}</button>
        {/if}
        {#if picker === role}
          <div class="picker" bind:this={pickerBox}>
            <input type="search" placeholder={`Find a ${role}…`} aria-label={`Find ${role}`}
              role="combobox" aria-expanded="true" aria-controls="mix-options"
              aria-activedescendant={candidates.length ? `mix-opt-${active}` : undefined}
              bind:value={query} bind:this={input} onkeydown={pickerKey} />
            <div id="mix-options" class="options" role="listbox" aria-label={`${label(role)} suggestions`}>
              {#if !candidates.length}<p>No recorded matches.</p>{/if}
              {#each candidates as candidate, i (candidate.id)}
                <button id={`mix-opt-${i}`} role="option" aria-selected={active === i}
                  class:active={active === i} onpointerenter={() => active = i} onclick={() => choose(candidate.id)}>
                  {candidate.name} <small>{candidate.shared} shared album{candidate.shared === 1 ? '' : 's'}</small>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <p class="note">Shared album credits, not evidence of a shared recording session. Inferred (?) and unknown (!) credits retain their uncertainty.</p>
  <div class="stage" bind:this={stage} bind:clientWidth={stageW} bind:clientHeight={stageH}>
    {#if error}<p class="message">Couldn’t load Mixing Console ({error}).</p>
    {:else if busy}<p class="message">Loading Mixing Console…</p>
    {:else if result && !result.albumIds.length}
      <div class="none"><h3 class="display">No recorded shared albums</h3>
        <p>This canon does not record an album crediting everyone in the selected roles. Missing credits are not proof that people never worked together. Remove or change a selection to widen the question.</p></div>
    {:else}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mixing Console shared album graph"
        bind:this={svg} onpointerdown={backgroundDown} onwheel={wheel} ondblclick={fit}>
        <g bind:this={group} transform={`translate(${zoom.tx} ${zoom.ty}) scale(${zoom.k})`}>
          {#each links as l}
            <path d={linkPath(l)} fill="none"
              stroke={l.e === 'unk' ? 'var(--impulse-amber)' : 'var(--bn-blue)'}
              stroke-dasharray={l.e === 'obs' ? undefined : l.e === 'inf' ? '6 4' : '2 5'}
              stroke-opacity="0.6" stroke-width="2">
              <title>{l.source.name} as {label(l.role)} on {l.target.name}: {l.e === 'obs' ? 'recorded' : l.e === 'inf' ? 'inferred' : 'unknown'} credit</title>
            </path>
          {/each}
          {#each nodes as n (`${n.kind}:${n.id}`)}
            {#if n.kind === 'album' && n.album}
              <g class="node album" transform={`translate(${n.x},${n.y})`}
                role="button" tabindex="0" aria-label={`${n.album.title} (${n.album.year})${n.e !== 'obs' ? `, ${n.e === 'inf' ? 'inferred' : 'unknown'} credit` : ''}`}
                onpointerdown={(e) => down(n, e)} onclick={() => !moved && onOpenAlbum(n.id)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAlbum(n.id); } }}>
                <circle class="hit" r="44"/><circle r="31" fill="var(--surface)" stroke="var(--bn-blue)" stroke-width="2.5" />
                <clipPath id={`mix-clip-${n.id}`}><circle r="28" /></clipPath>
                <image href={n.album.artUrl} x="-28" y="-28" width="56" height="56" clip-path={`url(#mix-clip-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                <text y="49" class="album-label">{truncate(n.name)}{n.e === 'inf' ? ' ?' : n.e === 'unk' ? ' !' : ''}</text>
                <text y="63" class="year">{n.album.year}</text>
              </g>
            {:else if n.kind === 'person'}
              <g class="node person" transform={`translate(${n.x},${n.y})`}
                role="img" aria-label={`${n.name}, ${n.roles?.map(label).join(' and ')}`}
                onpointerdown={(e) => down(n, e)}>
                <circle class="hit" r="54"/><circle r="39" fill="var(--bn-blue)" stroke="var(--ink)" stroke-width="2.5" />
                <text y="59" class="person-label">{n.name}</text>
                <text y="75" class="year">{n.roles?.map(label).join(' · ')}</text>
              </g>
            {/if}
          {/each}
        </g>
      </svg>
    {/if}
  </div>
</div>

<style>
  .net { padding: 8px 40px 24px; height: 100%; display: flex; flex-direction: column; }
  .strip { display: flex; align-items: baseline; gap: 14px; margin-bottom: 12px; }
  .strip strong { font-size: var(--fs-xl); color: var(--bn-blue); font-weight: 400; }
  .strip span, .note { font-size: var(--fs-md); color: var(--muted); }
  .reset { margin-left: auto; background: none; border: 1px solid var(--line); border-radius: var(--radius); padding: 4px 10px; color: var(--bn-blue); }
  .slots { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
  .slot { position: relative; display: flex; gap: 5px; align-items: center; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); padding: 5px 8px; font-size: var(--fs-md); }
  .slot .role { color: var(--muted); font-weight: 600; }
  .slot .chosen { color: var(--bn-blue); font-weight: 600; }
  .slot .anchor { color: var(--muted); font-size: var(--fs-xs); }
  .slot button { background: none; border: none; color: var(--bn-blue); padding: 4px; }
  .slot .add { border: 1px dashed var(--bn-blue-light); border-radius: var(--radius); }
  .picker { position: absolute; z-index: 40; top: 100%; left: 0; width: min(310px, 82vw); padding: 5px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); }
  .picker input { width: 100%; padding: 8px; border: 1px solid var(--bn-blue-light); border-radius: var(--radius); font: inherit; }
  .options { max-height: min(360px, 45vh); overflow-y: auto; }
  .options button { display: flex; flex-direction: column; text-align: left; width: 100%; padding: 7px; border-radius: var(--radius); }
  .options button.active { background: var(--bg); }
  .options small { color: var(--muted); }
  .options p { padding: 8px; color: var(--muted); }
  .note { margin: 0 0 8px; }
  .stage { position: relative; flex: 1; min-height: 0; }
  svg, .none { width: 100%; height: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); }
  svg { display: block; touch-action: none; cursor: grab; }
  svg:active { cursor: grabbing; }
  .node { cursor: pointer; }
  .person { cursor: grab; }
  .hit { fill: transparent; pointer-events: all; }
  text { font-family: var(--font-body); text-anchor: middle; pointer-events: none; fill: var(--ink); }
  .album-label { font-size: var(--fs-md); font-weight: 600; }
  .person-label { font: 600 18px var(--font-display); }
  .year { font-size: var(--fs-xs); fill: var(--muted); }
  .none { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 25px; }
  .none h3 { font-size: var(--fs-xl); color: var(--bn-blue); }
  .none p { max-width: 52ch; color: var(--muted); line-height: 1.5; }
  .message { padding: 20px; color: var(--muted); }
  @media (max-width: 620px) {
    .net { padding: 6px 14px 14px; }
    .strip { flex-wrap: wrap; gap: 5px 10px; }
    .strip strong { font-size: var(--fs-lg); }
    .strip span, .note { font-size: var(--fs-sm); }
    .slot { font-size: var(--fs-sm); }
  }
</style>
