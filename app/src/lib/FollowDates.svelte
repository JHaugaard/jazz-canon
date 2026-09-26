<script lang="ts">
  /* Date following for Working and Where. Renders nothing: vertical browsing
     settles the top row's first dot beside the name column; a deliberate
     horizontal gesture takes over until the reader scrolls vertically again. */
  import { onMount } from 'svelte';
  import {
    anchorLine,
    horizontalTarget,
    leadingMarkTarget,
    nextFollowMode,
    selectAnchorRow,
    verticalResumes,
    wheelIsHorizontal,
    type FollowEvent,
    type FollowMode,
    type RowGeometry,
  } from './follow-dates';

  let {
    scrollElement = null,
    inspectionActive = false,
    revision = '',
    keepTopRowInView = false,
  }: {
    scrollElement?: HTMLElement | null;
    inspectionActive?: boolean;
    revision?: string | number;
    /* Working: as the anchor travels to the final rows at the bottom, never
       push the top row's first dot past the left edge. Where leaves this off
       so its much later final places stay reachable. */
    keepTopRowInView?: boolean;
  } = $props();

  let mode: FollowMode = 'following';
  let frame = 0;
  let lastTop = 0;
  let lastHorizontalAt = -Infinity;
  /* Dots slide under a still pointer while the reader scrolls, opening their
     hover popovers. That is not inspection: while scroll input is recent,
     keep following. A deliberate hover or focus with no scrolling still
     holds the view, and so does a search jump (no scroll input). */
  let lastScrollInputAt = -Infinity;
  const SCROLL_INPUT_MS = 400;
  /* Set while our own smooth pan is under way. Only direct input handlers can
     hand control to the reader, so a long glide that outlasts any timer can
     never be mistaken for manual navigation. */
  let programTarget: number | null = null;
  let touchStart: { x: number; y: number } | null = null;
  let touchHorizontal = false;
  let pointerHeld = false;
  let nativeTouch = false;
  let gestureTimer: ReturnType<typeof setTimeout> | undefined;

  const EDGE_PADDING = 20;
  const DEAD_ZONE = 8;
  const AXIS_SELECTOR = '.axis';
  const NAME_SELECTOR = '.axis-name';
  const ROW_SELECTOR = '[data-follow-row]';
  const MARK_SELECTOR = '[data-follow-mark]';

  function setMode(event: FollowEvent) {
    const previous = mode;
    mode = nextFollowMode(mode, event);
    if (event === 'horizontal') lastHorizontalAt = performance.now();
    if (mode === 'manual') cancelProgrammatic();
    else if (previous === 'manual') scheduleFollow(true);
  }

  function cancelProgrammatic() {
    const el = scrollElement;
    if (el && programTarget !== null) el.scrollTo({ left: el.scrollLeft, behavior: 'instant' });
    programTarget = null;
  }

  function inspecting(): boolean {
    return inspectionActive && performance.now() - lastScrollInputAt > SCROLL_INPUT_MS;
  }

  function scheduleFollow(force = false) {
    if (force) cancelProgrammatic();
    if (mode !== 'following' || inspecting() || !scrollElement) return;
    if (pointerHeld || nativeTouch) return;
    if (frame) return;
    frame = requestAnimationFrame(runFollow);
  }

  /* The resting point is where the axis's first year sits when the field is
     scrolled fully left: the name column plus the field's leading pad. */
  function restingX(el: HTMLElement, box: DOMRect, nameWidth: number): number {
    const style = getComputedStyle(el);
    const pad = parseFloat(style.getPropertyValue('--leading-pad')) || 0;
    const gutter = parseFloat(style.getPropertyValue('--gutter')) || 0;
    return box.left + el.clientLeft + nameWidth + pad + gutter;
  }

  function runFollow() {
    frame = 0;
    const el = scrollElement;
    if (!el || mode !== 'following' || inspecting() || pointerHeld || nativeTouch) return;
    if ((document.activeElement as Element | null)?.closest?.('[data-follow-control]')) return;

    const box = el.getBoundingClientRect();
    const axis = el.querySelector<HTMLElement>(AXIS_SELECTOR);
    const visibleTop = Math.max(box.top, axis?.getBoundingClientRect().bottom ?? box.top);
    const visibleBottom = box.top + el.clientTop + el.clientHeight;
    const remainingScroll = el.scrollHeight - el.clientHeight - el.scrollTop;
    const line = el.scrollHeight > el.clientHeight
      ? anchorLine(visibleTop, visibleBottom, Math.max(0, remainingScroll))
      : visibleTop;
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
    const nextAnchor = selectAnchorRow(rows, line, visibleTop, visibleBottom);
    if (!nextAnchor) return;

    const rowById = (id: string | null) =>
      rowElements.find((candidate, index) => (candidate.dataset.followRow || String(index)) === id);
    const row = rowById(nextAnchor);
    if (!row) return;
    const nameWidth = el.querySelector<HTMLElement>(NAME_SELECTOR)?.getBoundingClientRect().width ?? 0;
    const markCenters = markCentersOf(row);
    const topRow = keepTopRowInView ? rowById(selectAnchorRow(rows, visibleTop, visibleTop, visibleBottom)) : undefined;
    const topCenters = topRow ? markCentersOf(topRow) : [];
    const target = leadingMarkTarget({
      scrollLeft: el.scrollLeft,
      maxScrollLeft: Math.max(0, el.scrollWidth - el.clientWidth),
      restingX: restingX(el, box, nameWidth),
      markCenters,
      deadZone: DEAD_ZONE,
      topRowLeading: topCenters.length ? Math.min(...topCenters) : undefined,
    });
    // Re-checking the same row every frame corrects small sideways drift from
    // trackpad swipes; the resting band keeps a settled row still. A glide
    // already heading to this target is left alone rather than restarted.
    if (target === null) return;
    if (programTarget !== null && Math.abs(target - programTarget) <= DEAD_ZONE) return;

    // Retarget the browser's current smooth scroll rather than snapping it
    // to the intermediate position as successive rows reach the top.
    programTarget = target;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' });
  }

  function markCentersOf(row: HTMLElement): number[] {
    return [...row.querySelectorAll<HTMLElement | SVGGraphicsElement>(MARK_SELECTOR)].map((mark) => {
      const rect = mark.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
  }

  function onScroll() {
    const el = scrollElement;
    if (!el) return;
    const topChanged = el.scrollTop !== lastTop;
    lastTop = el.scrollTop;
    if (programTarget !== null && Math.abs(el.scrollLeft - programTarget) <= 1) programTarget = null;
    if (!topChanged) return;
    if (mode === 'manual') {
      if (verticalResumes(performance.now(), lastHorizontalAt, touchHorizontal)) setMode('vertical');
      return;
    }
    scheduleFollow();
  }

  /* Wheel input can cut short one of our glides; when all motion stops,
     settle the current top row again. */
  function onScrollEnd() {
    programTarget = null;
    scheduleFollow();
  }

  function onWheel(event: WheelEvent) {
    lastScrollInputAt = performance.now();
    if (wheelIsHorizontal(event.deltaX, event.deltaY, event.shiftKey)) setMode('horizontal');
  }

  function onPointerDown(event: PointerEvent) {
    const el = scrollElement;
    if (!el) return;
    pointerHeld = true;
    cancelProgrammatic();
    if (event.pointerType === 'touch') {
      nativeTouch = true;
      touchHorizontal = false;
      touchStart = { x: event.clientX, y: event.clientY };
      return;
    }
    // A press on the horizontal scrollbar is a manual pan.
    const box = el.getBoundingClientRect();
    const scrollbarHeight = Math.max(6, el.offsetHeight - el.clientHeight);
    if (el.scrollWidth > el.clientWidth && event.clientY >= box.bottom - scrollbarHeight) {
      setMode('horizontal');
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' && nativeTouch) lastScrollInputAt = performance.now();
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = Math.abs(event.clientX - touchStart.x);
    const dy = Math.abs(event.clientY - touchStart.y);
    if (dx > 8 && dx > 1.5 * dy) {
      touchStart = null;
      touchHorizontal = true;
      setMode('horizontal');
    } else if (dy > 8) {
      touchStart = null;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      lastScrollInputAt = performance.now();
    }
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      (event.shiftKey && (event.key === 'PageUp' || event.key === 'PageDown'))
    ) setMode('horizontal');
  }

  function onFocusIn(event: FocusEvent) {
    if ((event.target as Element | null)?.closest?.('[data-follow-control]')) {
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
    if (touchHorizontal) lastHorizontalAt = performance.now();
    pointerHeld = false;
    nativeTouch = false;
    touchStart = null;
    touchHorizontal = false;
    scheduleFollow(true);
  }

  function finishGestureSoon() {
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(finishGesture, 180);
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pointerHeld && !nativeTouch) return;
    pointerHeld = false;
    // Touch pointercancel means native scroll takeover, not gesture end;
    // momentum keeps scrolling briefly after the finger lifts.
    if (event.pointerType === 'touch') finishGestureSoon();
    else finishGesture();
  }

  function onTouchScroll() {
    if (nativeTouch && !pointerHeld) finishGestureSoon();
  }

  onMount(() => {
    let current: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    function detach() {
      if (!current) return;
      current.removeEventListener('scroll', onScroll);
      current.removeEventListener('scroll', onTouchScroll);
      current.removeEventListener('scrollend', onScrollEnd);
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
        el.addEventListener('scroll', onScroll, { passive: true });
        el.addEventListener('scroll', onTouchScroll, { passive: true });
        el.addEventListener('scrollend', onScrollEnd, { passive: true });
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
    if (!inspectionActive) scheduleFollow(true);
    else if (inspecting()) cancelProgrammatic();
  });
</script>
