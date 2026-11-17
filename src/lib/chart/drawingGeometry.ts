import type { DrawingTool } from './model';

export interface DrawingPixel { x: number; y: number }

export type DrawingFigure =
  | { kind: 'line'; from: DrawingPixel; to: DrawingPixel; dashed?: boolean }
  | { kind: 'polyline'; points: DrawingPixel[] }
  | { kind: 'polygon'; points: DrawingPixel[] }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; center: DrawingPixel; radius: number }
  | { kind: 'text'; point: DrawingPixel; text: string };

/** Clip a segment, ray or infinite line to the main price pane. */
function clipLine(a: DrawingPixel, b: DrawingPixel, width: number, height: number, mode: 'segment' | 'ray' | 'line' = 'segment'): DrawingFigure[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) < 0.0001) return [{ kind: 'circle', center: a, radius: 1.5 }];
  let start = mode === 'line' ? -Infinity : 0;
  let end = mode === 'segment' ? 1 : Infinity;
  for (const [origin, delta, limit] of [[a.x, dx, width], [a.y, dy, height]]) {
    if (Math.abs(delta) < 0.0001) {
      if (origin < 0 || origin > limit) return [];
      continue;
    }
    const first = -origin / delta;
    const second = (limit - origin) / delta;
    start = Math.max(start, Math.min(first, second));
    end = Math.min(end, Math.max(first, second));
    if (start > end) return [];
  }
  return [{ kind: 'line', from: { x: a.x + dx * start, y: a.y + dy * start }, to: { x: a.x + dx * end, y: a.y + dy * end } }];
}

function channelFigures(points: DrawingPixel[], width: number, height: number, symmetric: boolean): DrawingFigure[] {
  const [a, b, c] = points;
  if (!b) return [];
  if (!c) return clipLine(a, b, width, height);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return [];
  const normal = { x: -dy / length, y: dx / length };
  const offset = (c.x - a.x) * normal.x + (c.y - a.y) * normal.y;
  const shift = (point: DrawingPixel, scale: number): DrawingPixel => ({ x: point.x + normal.x * offset * scale, y: point.y + normal.y * offset * scale });
  const first = clipLine(shift(a, symmetric ? -1 : 0), shift(b, symmetric ? -1 : 0), width, height, 'line');
  const second = clipLine(shift(a, 1), shift(b, 1), width, height, 'line');
  const figures: DrawingFigure[] = [];
  if (first[0]?.kind === 'line' && second[0]?.kind === 'line') {
    figures.push({ kind: 'polygon', points: [first[0].from, first[0].to, second[0].to, second[0].from] });
  }
  figures.push(...first, ...second);
  if (symmetric) {
    figures.push(...clipLine(a, b, width, height, 'line').map((figure) => figure.kind === 'line' ? { ...figure, dashed: true } : figure));
  }
  return figures;
}

/** Pure geometry shared by drawing rendering and pointer hit-testing. */
export function getDrawingFigures(tool: DrawingTool, points: DrawingPixel[], width: number, height: number): DrawingFigure[] {
  const [a, b] = points;
  if (!a) return [];
  switch (tool) {
    case 'horizontal-line':
      return clipLine({ x: 0, y: a.y }, { x: width, y: a.y }, width, height);
    case 'horizontal-ray':
      return clipLine(a, { x: a.x + 1, y: a.y }, width, height, 'ray');
    case 'vertical-line':
      return clipLine({ x: a.x, y: 0 }, { x: a.x, y: height }, width, height);
    case 'trend-line':
    case 'extended-line':
    case 'ray':
      return b ? clipLine(a, b, width, height, tool === 'extended-line' ? 'line' : tool === 'ray' ? 'ray' : 'segment') : [];
    case 'rectangle':
      return b ? [{ kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }] : [];
    case 'parallel-channel':
    case 'price-channel':
      return channelFigures(points, width, height, tool === 'price-channel');
    case 'fibonacci':
      if (!b) return [];
      return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].flatMap((level): DrawingFigure[] => {
        const y = a.y + (b.y - a.y) * level;
        return [
          { kind: 'line', from: { x: a.x, y }, to: { x: b.x, y } },
          { kind: 'text', point: { x: Math.min(a.x, b.x) + 4, y: y - 4 }, text: `${Math.round(level * 1000) / 10}%` },
        ];
      });
    case 'brush':
      return points.length > 1 ? [{ kind: 'polyline', points }] : [{ kind: 'circle', center: a, radius: 1.5 }];
  }
}

function distanceToSegment(point: DrawingPixel, a: DrawingPixel, b: DrawingPixel): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
  const position = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared));
  return Math.hypot(point.x - a.x - position * (b.x - a.x), point.y - a.y - position * (b.y - a.y));
}

export function drawingFigureContainsPoint(figure: DrawingFigure, point: DrawingPixel, tolerance = 8): boolean {
  switch (figure.kind) {
    case 'text': return false;
    case 'circle': return Math.hypot(point.x - figure.center.x, point.y - figure.center.y) <= figure.radius + tolerance;
    case 'line': return distanceToSegment(point, figure.from, figure.to) <= tolerance;
    case 'rect': {
      const { x, y, width, height } = figure;
      const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
      return corners.some((corner, index) => distanceToSegment(point, corner, corners[(index + 1) % corners.length]) <= tolerance);
    }
    case 'polyline':
    case 'polygon':
      return figure.points.some((value, index) => {
        const next = figure.points[index + 1] ?? (figure.kind === 'polygon' ? figure.points[0] : undefined);
        return next ? distanceToSegment(point, value, next) <= tolerance : false;
      });
  }
}
