import type { IChartApi, ISeriesApi, Logical, SeriesType } from 'lightweight-charts';
import type { ThemeColors } from '@/config/partners';
import i18n from '@/i18n';
import type { ChartCandle, ChartDrawing, ChartPlotArea, DrawingTool } from '@/lib/chart/model';
import { DRAWING_POINT_COUNTS } from '@/lib/chart/model';
import { drawingFigureContainsPoint, getDrawingFigures, type DrawingFigure, type DrawingPixel } from '@/lib/chart/drawingGeometry';
import { DRAWING_TOOLS } from './toolbarOptions';

type DrawingPoint = ChartDrawing['points'][number];
type PriceSeries = Pick<ISeriesApi<SeriesType>, 'priceToCoordinate' | 'coordinateToPrice'>;

export interface DrawingManagerOptions {
  container: HTMLElement;
  chart: IChartApi;
  getSeries: () => PriceSeries | null;
  getTheme: () => ThemeColors;
  getData: () => readonly ChartCandle[];
  getPlotArea?: () => ChartPlotArea;
  getToolLabel?: (tool: DrawingTool) => string;
  onChange?: () => void;
}

export interface DrawingManager {
  startDrawing: (tool: DrawingTool, onFinish: () => void) => string;
  cancelDrawing: (id?: string) => void;
  getDrawings: () => ChartDrawing[];
  restoreDrawings: (drawings: readonly ChartDrawing[]) => void;
  setDrawingsLocked: (locked: boolean) => void;
  clearDrawings: () => void;
  refresh: () => void;
  destroy: () => void;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const requiredPoints = DRAWING_POINT_COUNTS;
let drawingSequence = 0;

function copyPoints(points: readonly DrawingPoint[]): DrawingPoint[] {
  return points.map(({ timestamp, value }) => ({ timestamp, value }));
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function attributes(element: SVGElement, values: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(values)) element.setAttribute(name, String(value));
}

/** Drawings keep exchange timestamps so changing history/timeframes does not move their anchors to different candles. */
export function createDrawingManager(options: DrawingManagerOptions): DrawingManager {
  const { container, chart, getSeries, getTheme, getData, onChange } = options;
  const svg = svgElement('svg');
  svg.dataset.chartDrawings = 'true';
  attributes(svg, { tabindex: -1 });
  Object.assign(svg.style, { position: 'absolute', zIndex: '5', overflow: 'hidden', pointerEvents: 'none' });
  container.appendChild(svg);

  interface DrawingGroup { group: SVGGElement; hitArea: SVGGElement; figures: SVGGElement; handles: SVGCircleElement[] }
  interface Draft {
    id: string; tool: DrawingTool; points: DrawingPoint[]; preview: DrawingPoint | null;
    onFinish: () => void;
  }
  interface PointerSession { firstAnchor: boolean; start: DrawingPixel }
  interface Drag { id: string; anchor: number | null; origin: DrawingPixel; before: DrawingPoint[]; moved: boolean }
  const groups = new Map<string, DrawingGroup>();
  let drawings: ChartDrawing[] = [];
  let draft: Draft | null = null;
  let session: PointerSession | null = null;
  let drag: Drag | null = null;
  let pointerId: number | null = null;
  let selectedId: string | null = null;
  let drawingsLocked = false;
  let destroyed = false;
  let previousInteraction: Pick<ReturnType<IChartApi['options']>, 'handleScroll' | 'handleScale'> | null = null;
  let previousTouchAction = '';

  function plotArea(): ChartPlotArea {
    if (options.getPlotArea) return options.getPlotArea();
    const { width, height } = chart.paneSize(0);
    return { left: 0, top: 0, width, height, right: width };
  }

  function timestampAtLogical(logical: number): number | null {
    const data = getData();
    if (!data.length || !Number.isFinite(logical)) return null;
    if (data.length === 1) return data[0].timestamp + logical * 60_000;
    const index = Math.max(0, Math.min(data.length - 2, Math.floor(logical)));
    const interval = Math.max(1, data[index + 1].timestamp - data[index].timestamp);
    return data[index].timestamp + (logical - index) * interval;
  }

  function logicalAtTimestamp(timestamp: number): number | null {
    const data = getData();
    if (!data.length) return null;
    if (data.length === 1) return (timestamp - data[0].timestamp) / 60_000;
    let low = 0;
    let high = data.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (data[middle].timestamp < timestamp) low = middle + 1;
      else high = middle;
    }
    const index = Math.max(0, Math.min(data.length - 2, low - (data[low].timestamp >= timestamp ? 1 : 0)));
    const interval = Math.max(1, data[index + 1].timestamp - data[index].timestamp);
    return index + (timestamp - data[index].timestamp) / interval;
  }

  function toPixel(point: DrawingPoint): DrawingPixel | null {
    const logical = logicalAtTimestamp(point.timestamp);
    const series = getSeries();
    if (logical === null || !series) return null;
    // Native logicalToCoordinate accepts integer bar indices. Interpolate
    // adjacent bars to keep freehand and keyboard anchors between candles.
    const index = Math.floor(logical);
    const first = chart.timeScale().logicalToCoordinate(index as Logical);
    const second = chart.timeScale().logicalToCoordinate((index + 1) as Logical);
    const x = first === null || second === null ? null : first + (logical - index) * (second - first);
    const y = series.priceToCoordinate(point.value);
    return x === null || y === null || !Number.isFinite(x + y) ? null : { x, y };
  }

  function fromPixel(pixel: DrawingPixel): DrawingPoint | null {
    if (!Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) return null;
    const timeScale = chart.timeScale();
    const nearest = timeScale.coordinateToLogical(pixel.x);
    if (nearest === null || !Number.isFinite(nearest)) return null;
    // Native coordinateToLogical snaps to a bar. Recover the position within
    // that bar so one-pixel edits and freehand anchors are not quantized.
    const atNearest = timeScale.logicalToCoordinate(nearest);
    const atNext = timeScale.logicalToCoordinate((nearest + 1) as Logical);
    if (atNearest === null || atNext === null) return null;
    const spacing = atNext - atNearest;
    if (!Number.isFinite(spacing) || Math.abs(spacing) <= Number.EPSILON) return null;
    const logical = nearest + (pixel.x - atNearest) / spacing;
    const value = getSeries()?.coordinateToPrice(pixel.y);
    const timestamp = timestampAtLogical(logical);
    return timestamp === null || value == null || !Number.isFinite(timestamp + value) ? null : { timestamp, value };
  }

  function eventPixel(event: PointerEvent, clamp = false): DrawingPixel | null {
    const area = plotArea();
    const bounds = container.getBoundingClientRect();
    const x = event.clientX - bounds.left - area.left;
    const y = event.clientY - bounds.top - area.top;
    if (!area.width || !area.height) return null;
    if (!clamp && (x < 0 || y < 0 || x > area.width || y > area.height)) return null;
    return { x: Math.max(0, Math.min(area.width, x)), y: Math.max(0, Math.min(area.height, y)) };
  }

  function suspendChartInteractions(): void {
    if (previousInteraction) return;
    const chartOptions = chart.options();
    previousInteraction = structuredClone({ handleScroll: chartOptions.handleScroll, handleScale: chartOptions.handleScale });
    previousTouchAction = container.style.touchAction;
    container.style.touchAction = 'none';
    chart.applyOptions({ handleScroll: false, handleScale: false });
  }

  function restoreChartInteractions(): void {
    if (!previousInteraction) return;
    const previous = previousInteraction;
    previousInteraction = null;
    container.style.touchAction = previousTouchAction;
    chart.applyOptions(previous);
  }

  function capturePointer(event: PointerEvent): void {
    pointerId = event.pointerId;
    svg.setPointerCapture(event.pointerId);
  }

  function releasePointer(): void {
    const previous = pointerId;
    pointerId = null;
    if (previous !== null && svg.hasPointerCapture(previous)) svg.releasePointerCapture(previous);
    session = null;
  }

  function stopEvent(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function toolLabel(tool: DrawingTool): string {
    return options.getToolLabel?.(tool) ?? String(i18n.t(DRAWING_TOOLS.find(({ name }) => name === tool)?.label ?? tool));
  }

  function renderFigure(figure: DrawingFigure, color: string): SVGElement {
    switch (figure.kind) {
      case 'line': {
        const element = svgElement('line');
        attributes(element, { x1: figure.from.x, y1: figure.from.y, x2: figure.to.x, y2: figure.to.y });
        if (figure.dashed) element.setAttribute('stroke-dasharray', '4 4');
        return element;
      }
      case 'rect': {
        const element = svgElement('rect');
        attributes(element, { x: figure.x, y: figure.y, width: figure.width, height: figure.height, fill: color, 'fill-opacity': 0.08 });
        return element;
      }
      case 'circle': {
        const element = svgElement('circle');
        attributes(element, { cx: figure.center.x, cy: figure.center.y, r: figure.radius, fill: color });
        return element;
      }
      case 'polyline':
      case 'polygon': {
        const element = svgElement(figure.kind);
        element.setAttribute('points', figure.points.map(({ x, y }) => `${x},${y}`).join(' '));
        if (figure.kind === 'polygon') attributes(element, { fill: color, 'fill-opacity': 0.08, stroke: 'none' });
        return element;
      }
      case 'text': {
        const element = svgElement('text');
        attributes(element, { x: figure.point.x, y: figure.point.y, fill: getTheme()['content-secondary'], stroke: 'none', 'font-size': 11 });
        element.textContent = figure.text;
        return element;
      }
    }
  }

  function ensureGroup(id: string): DrawingGroup {
    let entry = groups.get(id);
    if (!entry) {
      const group = svgElement('g');
      group.dataset.drawingId = id;
      const hitArea = svgElement('g');
      const figures = svgElement('g');
      group.append(hitArea, figures);
      svg.appendChild(group);
      entry = { group, hitArea, figures, handles: [] };
      groups.set(id, entry);
    }
    return entry;
  }

  function renderDrawing(drawing: ChartDrawing, isDraft = false): void {
    const area = plotArea();
    const entry = ensureGroup(drawing.id);
    const pixels = drawing.points.map(toPixel);
    const validPixels = pixels.filter((point): point is DrawingPixel => point !== null);
    const theme = getTheme();
    const selected = selectedId === drawing.id;
    const color = selected ? theme.focus : theme['accent-primary'];
    attributes(entry.group, {
      fill: 'none', stroke: color, 'stroke-width': selected ? 2 : 1.5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: drawing.locked ? 0.65 : 1,
      tabindex: isDraft ? -1 : 0,
    });
    entry.group.style.pointerEvents = 'none';
    if (isDraft) entry.group.removeAttribute('role');
    else attributes(entry.group, { role: 'button', 'aria-label': toolLabel(drawing.tool), 'aria-pressed': String(selected), 'aria-disabled': String(drawing.locked) });
    const geometry = getDrawingFigures(drawing.tool, validPixels, area.width, area.height);
    entry.figures.replaceChildren(...geometry.map((figure) => renderFigure(figure, color)));
    entry.hitArea.replaceChildren(...geometry.filter(figure => figure.kind !== 'text').map(figure => {
      const hit = renderFigure(figure, 'transparent');
      attributes(hit, { stroke: 'transparent', 'stroke-width': 16, fill: 'none' });
      hit.style.pointerEvents = 'stroke';
      return hit;
    }));
    const handleCount = selected && !drawing.locked && !isDraft ? pixels.length : 0;
    while (entry.handles.length > handleCount) entry.handles.pop()?.remove();
    while (entry.handles.length < handleCount) {
      const circle = svgElement('circle');
      circle.dataset.anchorIndex = String(entry.handles.length);
      circle.style.pointerEvents = 'all';
      entry.group.appendChild(circle);
      entry.handles.push(circle);
    }
    entry.handles.forEach((circle, index) => {
      const pixel = pixels[index];
      circle.style.display = pixel ? '' : 'none';
      if (!pixel) return;
      attributes(circle, { cx: pixel.x, cy: pixel.y, r: 5, fill: theme.surface, stroke: theme.focus, 'stroke-width': 1.5, tabindex: 0, role: 'button', 'aria-label': `${toolLabel(drawing.tool)} ${index + 1}` });
    });
  }

  function refresh(): void {
    if (destroyed) return;
    const area = plotArea();
    attributes(svg, { width: area.width, height: area.height, viewBox: `0 0 ${area.width} ${area.height}` });
    svg.style.left = `${area.left}px`;
    svg.style.top = `${area.top}px`;
    svg.style.pointerEvents = draft ? 'auto' : 'none';
    // Gesture policy must be present before pointerdown. Applying it only after
    // a drag starts lets the browser cancel that drag for native page scrolling.
    // Only drawing strokes/handles receive events; empty space still pans the chart.
    svg.style.touchAction = 'none';
    svg.style.cursor = draft ? 'crosshair' : '';
    const visibleIds = new Set(drawings.map(({ id }) => id));
    for (const drawing of drawings) renderDrawing(drawing);
    if (draft) {
      visibleIds.add(draft.id);
      const points = copyPoints(draft.points);
      if (draft.preview && draft.tool !== 'brush') points.push({ ...draft.preview });
      renderDrawing({ id: draft.id, tool: draft.tool, points, locked: false }, true);
    }
    for (const [id, entry] of groups) {
      if (visibleIds.has(id)) continue;
      entry.group.remove();
      groups.delete(id);
    }
  }

  function hitTest(pixel: DrawingPixel): { drawing: ChartDrawing; anchor: number | null } | null {
    const selected = drawings.find(({ id }) => id === selectedId);
    if (selected && !selected.locked) {
      for (let anchor = 0; anchor < selected.points.length; anchor += 1) {
        const point = toPixel(selected.points[anchor]);
        if (point && Math.hypot(pixel.x - point.x, pixel.y - point.y) <= 10) return { drawing: selected, anchor };
      }
    }
    const area = plotArea();
    for (let index = drawings.length - 1; index >= 0; index -= 1) {
      const drawing = drawings[index];
      const points = drawing.points.map(toPixel).filter((point): point is DrawingPixel => point !== null);
      if (getDrawingFigures(drawing.tool, points, area.width, area.height).some((figure) => drawingFigureContainsPoint(figure, pixel))) return { drawing, anchor: null };
    }
    return null;
  }

  function completeDraft(): void {
    if (!draft) return;
    const completed = draft;
    draft = null;
    drawings.push({ id: completed.id, tool: completed.tool, points: copyPoints(completed.points), locked: drawingsLocked });
    selectedId = completed.id;
    releasePointer();
    restoreChartInteractions();
    refresh();
    onChange?.();
    completed.onFinish();
    groups.get(completed.id)?.group.focus({ preventScroll: true });
  }

  function cancelDraft(notify = true): void {
    const previous = draft;
    draft = null;
    releasePointer();
    if (!drag) restoreChartInteractions();
    refresh();
    if (notify) previous?.onFinish();
  }

  function finishDrag(rollback = false): void {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (rollback) {
      const drawing = drawings.find(({ id }) => id === previous.id);
      if (drawing) drawing.points = copyPoints(previous.before);
    }
    releasePointer();
    if (!draft) restoreChartInteractions();
    refresh();
    if (previous.moved && !rollback) onChange?.();
  }

  function onPointerDown(event: PointerEvent): void {
    if (destroyed || event.button !== 0) return;
    if (pointerId !== null) {
      if (draft || drag) stopEvent(event);
      return;
    }
    const target = event.target;
    if (!(target instanceof Node) || (!svg.contains(target) && !chart.chartElement().contains(target))) return;
    const pixel = eventPixel(event);
    if (!pixel) return;
    if (draft) {
      const point = fromPixel(pixel);
      if (!point) return;
      stopEvent(event);
      const firstAnchor = draft.points.length === 0;
      if (firstAnchor || draft.tool === 'brush') draft.points.push(point);
      draft.preview = point;
      session = { firstAnchor, start: pixel };
      capturePointer(event);
      refresh();
      return;
    }
    const hit = hitTest(pixel);
    if (!hit) {
      if (selectedId) { selectedId = null; refresh(); }
      return;
    }
    stopEvent(event);
    selectedId = hit.drawing.id;
    refresh();
    const entry = groups.get(hit.drawing.id);
    (hit.anchor === null ? entry?.group : entry?.handles[hit.anchor])?.focus({ preventScroll: true });
    if (hit.drawing.locked) return;
    drag = { id: hit.drawing.id, anchor: hit.anchor, origin: pixel, before: copyPoints(hit.drawing.points), moved: false };
    suspendChartInteractions();
    capturePointer(event);
  }

  function appendBrushPoint(point: DrawingPoint, pixel: DrawingPixel): void {
    if (!draft) return;
    const last = draft.points.at(-1);
    const previous = last ? toPixel(last) : null;
    if (!previous || Math.hypot(previous.x - pixel.x, previous.y - pixel.y) >= 2) draft.points.push(point);
  }

  function onPointerMove(event: PointerEvent): void {
    if (destroyed || (pointerId !== null && pointerId !== event.pointerId)) return;
    if (!draft && !drag) return;
    const pixel = eventPixel(event, pointerId !== null);
    if (!pixel) return;
    const point = fromPixel(pixel);
    if (!point) return;
    stopEvent(event);
    if (draft) {
      draft.preview = point;
      if (draft.tool === 'brush' && pointerId !== null) appendBrushPoint(point, pixel);
    } else if (drag) {
      const drawing = drawings.find(({ id }) => id === drag?.id);
      if (!drawing) return;
      const dx = pixel.x - drag.origin.x;
      const dy = pixel.y - drag.origin.y;
      const next = drag.before.map((anchor, index) => {
        if (drag?.anchor !== null && drag?.anchor !== index) return { ...anchor };
        const origin = toPixel(anchor);
        return origin ? fromPixel({ x: origin.x + dx, y: origin.y + dy }) ?? { ...anchor } : { ...anchor };
      });
      drawing.points = next;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 0.1;
    }
    refresh();
  }

  function onPointerUp(event: PointerEvent): void {
    if (destroyed || pointerId !== event.pointerId) return;
    stopEvent(event);
    if (drag) { finishDrag(); return; }
    const pixel = eventPixel(event, true);
    const point = pixel ? fromPixel(pixel) : null;
    if (!draft || !session || !pixel || !point) { releasePointer(); return; }
    if (draft.tool === 'brush') {
      appendBrushPoint(point, pixel);
      if (draft.points.length === 1) draft.points.push({ ...point });
      completeDraft();
      return;
    }
    const needed = requiredPoints[draft.tool];
    const dragged = Math.hypot(pixel.x - session.start.x, pixel.y - session.start.y) > 4;
    if (!session.firstAnchor || (needed === 2 && dragged)) draft.points.push(point);
    if (draft.points.length >= needed) completeDraft();
    else { releasePointer(); refresh(); }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    if (drag) finishDrag(true);
    if (draft) cancelDraft();
    else releasePointer();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || destroyed) return;
    if (event.key === 'Escape') {
      if (!draft && !drag && !svg.contains(event.target as Node | null)) return;
      stopEvent(event);
      if (drag) finishDrag(true);
      if (draft) cancelDraft();
      else { selectedId = null; refresh(); }
      return;
    }
    if (!svg.contains(event.target as Node | null) || draft) return;
    if (drag) {
      if (['Enter', ' ', 'Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) stopEvent(event);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const group = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-drawing-id]') : null;
      if (!group) return;
      stopEvent(event);
      selectedId = group.dataset.drawingId ?? null;
      refresh();
      return;
    }
    if (!selectedId) return;
    const drawing = drawings.find(({ id }) => id === selectedId);
    if (!drawing) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      stopEvent(event);
      if (drawing.locked) return;
      const index = drawings.indexOf(drawing);
      drawings.splice(index, 1);
      selectedId = null;
      refresh();
      onChange?.();
      groups.get(drawings[Math.min(index, drawings.length - 1)]?.id)?.group.focus({ preventScroll: true });
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    stopEvent(event);
    if (drawing.locked) return;
    const distance = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0;
    const dy = event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0;
    const target = event.target instanceof Element ? event.target.closest<SVGElement>('[data-anchor-index]') : null;
    const anchorIndex = target ? Number(target.dataset.anchorIndex) : null;
    drawing.points = drawing.points.map((point, index) => {
      if (anchorIndex !== null && index !== anchorIndex) return point;
      const pixel = toPixel(point);
      return pixel ? fromPixel({ x: pixel.x + dx, y: pixel.y + dy }) ?? point : point;
    });
    refresh();
    onChange?.();
  }

  function onFocusIn(event: FocusEvent): void {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-drawing-id]') : null;
    if (!target || selectedId === target.dataset.drawingId) return;
    selectedId = target.dataset.drawingId ?? null;
    refresh();
  }

  const timeScale = chart.timeScale();
  timeScale.subscribeVisibleLogicalRangeChange(refresh);
  timeScale.subscribeSizeChange(refresh);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
  observer?.observe(container);
  container.addEventListener('pointerdown', onPointerDown, true);
  container.addEventListener('pointermove', onPointerMove, true);
  container.addEventListener('pointerup', onPointerUp, true);
  container.addEventListener('pointercancel', onPointerCancel, true);
  svg.addEventListener('lostpointercapture', onPointerCancel);
  svg.addEventListener('focusin', onFocusIn);
  document.addEventListener('keydown', onKeyDown);
  i18n.on('languageChanged', refresh);
  refresh();

  return {
    startDrawing(tool, onFinish) {
      if (destroyed) return '';
      if (drag) finishDrag(true);
      if (draft) cancelDraft();
      const id = `drawing-${Date.now()}-${++drawingSequence}`;
      draft = { id, tool, points: [], preview: null, onFinish };
      selectedId = null;
      suspendChartInteractions();
      refresh();
      return id;
    },
    cancelDrawing(id) {
      if (draft && (!id || id === draft.id)) cancelDraft();
    },
    getDrawings() {
      return drawings.map((drawing) => ({ ...drawing, points: copyPoints(drawing.points) }));
    },
    restoreDrawings(nextDrawings) {
      if (destroyed) return;
      if (drag) finishDrag(true);
      if (draft) cancelDraft();
      const ids = new Set<string>();
      drawings = nextDrawings.filter((drawing) => {
        const valid = typeof drawing.id === 'string' && drawing.id.length > 0 && !ids.has(drawing.id)
          && Object.hasOwn(requiredPoints, drawing.tool) && Array.isArray(drawing.points)
          && drawing.points.length >= requiredPoints[drawing.tool]
          && drawing.points.every((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
        if (valid) ids.add(drawing.id);
        return valid;
      }).map((drawing) => ({ id: drawing.id, tool: drawing.tool, points: copyPoints(drawing.points), locked: drawing.locked === true }));
      drawingsLocked = drawings.length > 0 && drawings.every((drawing) => drawing.locked);
      selectedId = null;
      refresh();
    },
    setDrawingsLocked(locked) {
      if (destroyed) return;
      if (drag) finishDrag(true);
      const focused = selectedId ? groups.get(selectedId)?.group : undefined;
      if (locked && focused?.contains(document.activeElement)) focused.focus({ preventScroll: true });
      drawingsLocked = locked;
      drawings.forEach((drawing) => { drawing.locked = locked; });
      refresh();
      onChange?.();
    },
    clearDrawings() {
      if (destroyed) return;
      if (drag) finishDrag(true);
      drawings = [];
      selectedId = null;
      if (draft) cancelDraft();
      refresh();
      onChange?.();
    },
    refresh,
    destroy() {
      if (destroyed) return;
      if (drag) finishDrag(true);
      if (draft) cancelDraft(false);
      releasePointer();
      restoreChartInteractions();
      destroyed = true;
      observer?.disconnect();
      timeScale.unsubscribeVisibleLogicalRangeChange(refresh);
      timeScale.unsubscribeSizeChange(refresh);
      container.removeEventListener('pointerdown', onPointerDown, true);
      container.removeEventListener('pointermove', onPointerMove, true);
      container.removeEventListener('pointerup', onPointerUp, true);
      container.removeEventListener('pointercancel', onPointerCancel, true);
      svg.removeEventListener('lostpointercapture', onPointerCancel);
      svg.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKeyDown);
      i18n.off('languageChanged', refresh);
      groups.clear();
      svg.remove();
    },
  };
}
