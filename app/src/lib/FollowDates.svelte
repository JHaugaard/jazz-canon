<script lang="ts">
  import { onMount } from 'svelte';
  import {
    horizontalTarget,
    nextFollowMode,
    selectAnchorRow,
    type FollowMode,
    type RowGeometry,
  } from './follow-dates';

  let {
    scrollElement = null,
    inspectionActive = false,
    revision = '',
  }: {
    scrollElement?: HTMLElement | null;
    inspectionActive?: boolean;
    revision?: string | number;
  } = $props();

  let mode = $state<FollowMode>('active');
  let frame = 0;
  let lastTop = 0;
  let lastLeft = 0;
  let anchorId: string | null = null;
  let programTarget: number | null = null;
  let programDeadline = 0;
  /* Focus and search can invoke native scrollIntoView. Those scroll events are
     assisted navigation, not manual panning; direct input handlers still pause
     immediately during this short suppression window. */
  let assistedDeadline = 0;
  let touchStart: { x: number; y: number } | null = null;
  let pointerHeld = false;
  let nativeTouch = false;
  let gestureTimer: ReturnType<typeof setTimeout> | undefined;

  const EDGE_PADDING = 20;
  const DEAD_ZONE = 8;
  const AXIS_SELECTOR = '.axis';
  const NAME_SELECTOR = '.axis-name';
  const ROW_SELECTOR = '[data-follow-row]';
  const MARK_SELECTOR = '[data-follow-mark]';

  function setMode(event: 'manual' | 'resume' | 'toggle-on' | 'toggle-off') {
    mode = nextFollowMode(mode, event);
    if (mode !== 'active') cancelProgrammatic();
    else {
      anchorId = null;
      scheduleFollow(true);
    }
  }

  function cancelProgrammatic() {
    const el = scrollElement;
    if (el && programTarget !== null) {
      el.scrollTo({ left: el.scrollLeft, behavior: 'instant' });
      lastLeft = el.scrollLeft;
      // A cancelled animation can still have one queued scroll event.
      // Direct gesture/wheel/key handlers take precedence over this guard.
      assistedDeadline = Math.max(assistedDeadline, performance.now() + 100);
    }
    programTarget = null;
    programDeadline = 0;
  }

  function pauseForManualInput() {
    if (mode === 'active') setMode('manual');
  }

  function scheduleFollow(force = false) {
    if (force) {
      cancelProgrammatic();
      anchorId = null;
    }
    if (mode !== 'active' || inspectionActive || !scrollElement) return;
    if (pointerHeld || nativeTouch) return;
    if (frame) return;
    frame = requestAnimationFrame(runFollow);
  }

  function runFollow() {
    frame = 0;
    const el = scrollElement;
    if (!el || mode !== 'active' || inspectionActive || pointerHeld || nativeTouch) return;
    if ((document.activeElement as Element | null)?.closest?.('[data-follow-control]')) return;

    const box = el.getBoundingClientRect();
    const axis = el.querySelector<HTMLElement>(AXIS_SELECTOR);
    const axisBottom = axis?.getBoundingClientRect().bottom ?? box.top;
    const visibleTop = Math.max(box.top, axisBottom);
    const visibleBottom = box.bottom;
    const selectionLine = visibleTop + (visibleBottom - visibleTop) / 3;
    const rowElements = [...el.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
    const rows: RowGeometry[] = rowElements.map((row, index) => {
      const rect = row.getBoundingClientRect();
      return {
        id: row.dataset.followRow || String(index),
        top: rect.top,
        bottom: rect.bottom,
        markCount: row.querySelectorAll(MARK_SELECTOR).length,
      };
    });
    const nextAnchor = selectAnchorRow(rows, selectionLine, visibleTop, visibleBottom);
    if (!nextAnchor || nextAnchor === anchorId) return;
    anchorId = nextAnchor;

    const row = rowElements.find((candidate, index) => (candidate.dataset.followRow || String(index)) === nextAnchor);
    if (!row) return;
    const nameWidth = el.querySelector<HTMLElement>(NAME_SELECTOR)?.getBoundingClientRect().width ?? 0;
    const markCenters = [...row.querySelectorAll<HTMLElement | SVGGraphicsElement>(MARK_SELECTOR)].map((mark) => {
      const rect = mark.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    const target = horizontalTarget({
      scrollLeft: el.scrollLeft,
      maxScrollLeft: Math.max(0, el.scrollWidth - el.clientWidth),
      usableLeft: box.left + nameWidth + EDGE_PADDING,
      usableRight: box.right - EDGE_PADDING,
      markCenters,
      deadZone: DEAD_ZONE,
    });
    if (target === null) return;

    cancelProgrammatic();
    programTarget = target;
    programDeadline = performance.now() + 1200;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' });
  }

  function onScroll() {
    const el = scrollElement;
    if (!el) return;
    const topChanged = el.scrollTop !== lastTop;
    const leftChanged = Math.abs(el.scrollLeft - lastLeft) > 0.5;
    const now = performance.now();
    const isProgrammatic =
      (programTarget !== null &&
        (now <= programDeadline || Math.abs(el.scrollLeft - programTarget) <= 1)) ||
      now <= assistedDeadline;

    if (leftChanged && (pointerHeld || nativeTouch || !isProgrammatic)) pauseForManualInput();
    if (nativeTouch && !pointerHeld) finishGestureSoon();
    if (programTarget !== null && Math.abs(el.scrollLeft - programTarget) <= 1) {
      programTarget = null;
      programDeadline = 0;
    }
    lastTop = el.scrollTop;
    lastLeft = el.scrollLeft;
    if (topChanged) scheduleFollow();
  }

  function onWheel(event: WheelEvent) {
    if (Math.abs(event.deltaX) > 0.5 || (event.shiftKey && Math.abs(event.deltaY) > 0.5)) {
      pauseForManualInput();
    }
  }

  function onPointerDown(event: PointerEvent) {
    const el = scrollElement;
    if (!el) return;
    pointerHeld = true;
    cancelProgrammatic();
    if (event.pointerType === 'touch') {
      nativeTouch = true;
      touchStart = { x: event.clientX, y: event.clientY };
      return;
    }
    const box = el.getBoundingClientRect();
    const scrollbarHeight = Math.max(6, el.offsetHeight - el.clientHeight);
    if (el.scrollWidth > el.clientWidth && event.clientY >= box.bottom - scrollbarHeight) {
      pauseForManualInput();
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = Math.abs(event.clientX - touchStart.x);
    const dy = Math.abs(event.clientY - touchStart.y);
    if (dx > 8 && dx > dy) {
      touchStart = null;
      pauseForManualInput();
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      (event.shiftKey && (event.key === 'PageUp' || event.key === 'PageDown'))
    ) pauseForManualInput();
  }

  function onFocusIn(event: FocusEvent) {
    if ((event.target as Element | null)?.closest?.('[data-follow-control]')) {
      assistedDeadline = performance.now() + 800;
      cancelProgrammatic();
      // Native focus can leave a dot hidden under the sticky name column.
      const mark = (event.target as Element).closest('[data-follow-mark]');
      const el = scrollElement;
      if (mark && el) {
        const box = el.getBoundingClientRect();
        const rect = mark.getBoundingClientRect();
        const nameWidth = el.querySelector(NAME_SELECTOR)?.getBoundingClientRect().width ?? 0;
        const target = horizontalTarget({
          scrollLeft: el.scrollLeft,
          maxScrollLeft: Math.max(0, el.scrollWidth - el.clientWidth),
          usableLeft: box.left + nameWidth + EDGE_PADDING,
          usableRight: box.right - EDGE_PADDING,
          markCenters: [rect.left + rect.width / 2],
          deadZone: 0,
        });
        if (target !== null) el.scrollTo({ left: target, behavior: 'instant' });
      }
    }
  }

  function onFocusOut() {
    scheduleFollow(true);
  }

  function finishGesture() {
    clearTimeout(gestureTimer);
    pointerHeld = false;
    nativeTouch = false;
    touchStart = null;
    scheduleFollow(true);
  }

  function finishGestureSoon() {
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(finishGesture, 180);
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pointerHeld && !nativeTouch) return;
    pointerHeld = false;
    touchStart = null;
    // Touch pointercancel means native scroll takeover, not gesture end.
    if (event.pointerType === 'touch') finishGestureSoon();
    else finishGesture();
  }

  onMount(() => {
    let current: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    function detach() {
      if (!current) return;
      current.removeEventListener('scroll', onScroll);
      current.removeEventListener('wheel', onWheel);
      current.removeEventListener('pointerdown', onPointerDown);
      current.removeEventListener('pointermove', onPointerMove);

      current.removeEventListener('keydown', onKeyDown, true);
      current.removeEventListener('focusin', onFocusIn);
      current.removeEventListener('focusout', onFocusOut);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      current = null;
    }

    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);

    const stop = $effect.root(() => {
      $effect(() => {
        const el = scrollElement;
        revision;
        detach();
        if (!el) return;
        current = el;
        lastTop = el.scrollTop;
        lastLeft = el.scrollLeft;
        el.addEventListener('scroll', onScroll, { passive: true });
        el.addEventListener('wheel', onWheel, { passive: true });
        el.addEventListener('pointerdown', onPointerDown, { passive: true });
        el.addEventListener('pointermove', onPointerMove, { passive: true });

        el.addEventListener('keydown', onKeyDown, true);
        el.addEventListener('focusin', onFocusIn);
        el.addEventListener('focusout', onFocusOut);
        resizeObserver = new ResizeObserver(() => scheduleFollow(true));
        resizeObserver.observe(el);
        const field = el.querySelector('.field');
        if (field) resizeObserver.observe(field);
        mutationObserver = new MutationObserver(() => scheduleFollow(true));
        mutationObserver.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
        scheduleFollow(true);
        return detach;
      });
    });

    return () => {
      stop();
      detach();
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      clearTimeout(gestureTimer);
      cancelProgrammatic();
      if (frame) cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    if (inspectionActive) {
      assistedDeadline = performance.now() + 1500;
      cancelProgrammatic();
    } else scheduleFollow(true);
  });
</script>

<div class="follow-controls" aria-label="Date following controls">
  <label>
    <input
      type="checkbox"
      checked={mode !== 'off'}
      onchange={(event) => setMode(event.currentTarget.checked ? 'toggle-on' : 'toggle-off')}
    />
    Follow dates
  </label>
  {#if mode === 'paused'}
    <span class="paused" role="status">Paused after horizontal navigation</span>
    <button type="button" onclick={() => setMode('resume')}>Resume</button>
  {/if}
</div>

<style>
  .follow-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: 12px;
    color: var(--muted);
  }
  label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  input { accent-color: var(--bn-blue); }
  .paused { color: var(--impulse-amber); }
  button {
    padding: 2px 7px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--bg);
    color: var(--bn-blue);
    font: inherit;
    cursor: pointer;
  }
  button:hover,
  button:focus-visible { border-color: var(--bn-blue-light); }
</style>
