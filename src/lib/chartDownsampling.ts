export const MAX_RENDERED_CHART_POINTS = 1_000;

export function downsampleChartData<T>(
  points: T[],
  maxPoints = MAX_RENDERED_CHART_POINTS,
): T[] {
  if (points.length <= maxPoints || maxPoints < 3) return points;

  const sampled = [points[0]];
  const interiorSlots = maxPoints - 2;
  const interiorLength = points.length - 2;
  for (let slot = 0; slot < interiorSlots; slot += 1) {
    const index = 1 + Math.floor((slot * interiorLength) / interiorSlots);
    sampled.push(points[index]);
  }
  sampled.push(points[points.length - 1]);
  return sampled;
}
