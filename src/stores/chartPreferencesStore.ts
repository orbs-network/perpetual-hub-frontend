import { create } from 'zustand';
import { CHART_PERIODS, CHART_TYPES } from '@/components/trading-chart/toolbarOptions';
import { getSupportedIndicators, isValidIndicatorParams } from '@/lib/chart/indicators';
import { DRAWING_POINT_COUNTS, type ChartDrawing, type ChartPeriod, type ChartType, type DrawingTool } from '@/lib/chart/model';

export const CHART_PREFERENCES_STORAGE_KEY = 'perpetual-hub-chart-preferences';
const MAX_STORAGE_LENGTH = 2_000_000;
const MAX_SETTINGS_SCOPES = 24;
const MAX_DRAWING_SCOPES = 64;
const MAX_DRAWINGS = 100;
const MAX_POINTS_PER_SCOPE = 4_000;
const MAX_POINTS_PER_DRAWING = 2_000;
const supportedIndicators = new Set(getSupportedIndicators());

export interface ChartIndicatorPreference {
  name: string;
  calcParams: number[];
}

export interface ChartAppearancePreferences {
  period: ChartPeriod;
  chartType: ChartType;
  /** null preserves the renderer's initial volume study; [] explicitly removes all studies. */
  indicators: ChartIndicatorPreference[] | null;
}

interface SavedChartPreferences {
  settings: Record<string, ChartAppearancePreferences>;
  drawings: Record<string, ChartDrawing[]>;
}

export const DEFAULT_CHART_APPEARANCE: ChartAppearancePreferences = {
  period: { span: 1, type: 'hour' },
  chartType: 'candles',
  indicators: null,
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validKey(key: string): boolean {
  return key.length > 0 && key.length <= 512;
}

function normalizeAppearance(value: unknown): ChartAppearancePreferences {
  const input = record(value) ? value : {};
  const period = record(input.period)
    ? CHART_PERIODS.find(({ period }) => period.span === (input.period as Record<string, unknown>).span && period.type === (input.period as Record<string, unknown>).type)?.period
    : undefined;
  const chartType = CHART_TYPES.find(({ value }) => value === input.chartType)?.value;
  let indicators: ChartIndicatorPreference[] | null = null;
  if (Array.isArray(input.indicators)) {
    const seen = new Set<string>();
    indicators = input.indicators.slice(0, supportedIndicators.size).flatMap((entry: unknown) => {
      if (!record(entry) || typeof entry.name !== 'string' || !supportedIndicators.has(entry.name) || seen.has(entry.name) ||
          !Array.isArray(entry.calcParams) ||
          !entry.calcParams.every((value) => typeof value === 'number') ||
          !isValidIndicatorParams(entry.name, entry.calcParams)) return [];
      seen.add(entry.name);
      return [{ name: entry.name, calcParams: [...entry.calcParams] as number[] }];
    });
  }
  return {
    period: period ? { ...period } : { ...DEFAULT_CHART_APPEARANCE.period },
    chartType: chartType ?? DEFAULT_CHART_APPEARANCE.chartType,
    indicators,
  };
}

function normalizeDrawings(value: unknown): ChartDrawing[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  let pointCount = 0;
  return value.slice(0, MAX_DRAWINGS).flatMap((entry: unknown) => {
    if (!record(entry) || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(entry.id) || seen.has(entry.id) ||
        typeof entry.tool !== 'string' || !Object.hasOwn(DRAWING_POINT_COUNTS, entry.tool) || !Array.isArray(entry.points)) return [];
    const tool = entry.tool as DrawingTool;
    const required = DRAWING_POINT_COUNTS[tool];
    if (entry.points.length < required || entry.points.length > MAX_POINTS_PER_DRAWING ||
        (tool !== 'brush' && entry.points.length !== required) || pointCount + entry.points.length > MAX_POINTS_PER_SCOPE) return [];
    const points = entry.points.flatMap((point: unknown) => {
      if (!record(point) || typeof point.timestamp !== 'number' || !Number.isFinite(point.timestamp) || point.timestamp < 0 || point.timestamp > 8.64e15 ||
          typeof point.value !== 'number' || !Number.isFinite(point.value) || Math.abs(point.value) > 1e18) return [];
      return [{ timestamp: point.timestamp, value: point.value }];
    });
    if (points.length !== entry.points.length) return [];
    seen.add(entry.id);
    pointCount += points.length;
    return [{ id: entry.id, tool, points, locked: entry.locked === true }];
  });
}

/** Decode only display preferences; stored account/order data is never consumed. */
export function parseChartPreferences(value: unknown): SavedChartPreferences {
  const settings: SavedChartPreferences['settings'] = {};
  const drawings: SavedChartPreferences['drawings'] = {};
  if (!record(value) || value.version !== 1) return { settings, drawings };
  if (record(value.settings)) {
    for (const [key, entry] of Object.entries(value.settings).slice(-MAX_SETTINGS_SCOPES)) {
      if (validKey(key)) Object.defineProperty(settings, key, { value: normalizeAppearance(entry), enumerable: true, configurable: true, writable: true });
    }
  }
  if (record(value.drawings)) {
    for (const [key, entry] of Object.entries(value.drawings).slice(-MAX_DRAWING_SCOPES)) {
      if (validKey(key)) Object.defineProperty(drawings, key, { value: normalizeDrawings(entry), enumerable: true, configurable: true, writable: true });
    }
  }
  return { settings, drawings };
}

function loadPreferences(): SavedChartPreferences {
  try {
    if (typeof window === 'undefined') return { settings: {}, drawings: {} };
    const text = window.localStorage.getItem(CHART_PREFERENCES_STORAGE_KEY);
    return text && text.length <= MAX_STORAGE_LENGTH ? parseChartPreferences(JSON.parse(text)) : { settings: {}, drawings: {} };
  } catch {
    return { settings: {}, drawings: {} };
  }
}

function putLatest<T>(entries: Record<string, T>, key: string, value: T, limit: number): Record<string, T> {
  return Object.fromEntries([...Object.entries(entries).filter(([entryKey]) => entryKey !== key), [key, value]].slice(-limit));
}

function boundSize(value: SavedChartPreferences): SavedChartPreferences {
  const drawings = { ...value.drawings };
  while (JSON.stringify({ version: 1, ...value, drawings }).length > MAX_STORAGE_LENGTH && Object.keys(drawings).length > 0) {
    delete drawings[Object.keys(drawings)[0]];
  }
  return { settings: value.settings, drawings };
}

function savePreferences(value: SavedChartPreferences): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(CHART_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, ...value }));
  } catch {
    // Private browsing, disabled storage or quota limits must not affect trading.
  }
}

export function chartDrawingStorageKey(scope: string, symbol: string, period: ChartPeriod): string {
  return JSON.stringify([scope, symbol, period.span, period.type]);
}

interface ChartPreferencesState extends SavedChartPreferences {
  updateAppearance: (scope: string, patch: Partial<ChartAppearancePreferences>) => void;
  saveDrawings: (key: string, drawings: readonly ChartDrawing[]) => void;
}

export const useChartPreferencesStore = create<ChartPreferencesState>((set, get) => ({
  ...loadPreferences(),
  updateAppearance(scope, patch) {
    if (!validKey(scope)) return;
    const current = get().settings[scope] ?? DEFAULT_CHART_APPEARANCE;
    const next = normalizeAppearance({ ...current, ...patch });
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    const settings = putLatest(get().settings, scope, next, MAX_SETTINGS_SCOPES);
    const value = boundSize({ settings, drawings: get().drawings });
    set(value);
    savePreferences(value);
  },
  saveDrawings(key, drawings) {
    if (!validKey(key)) return;
    const next = normalizeDrawings(drawings);
    if (JSON.stringify(get().drawings[key] ?? []) === JSON.stringify(next)) return;
    const value = boundSize({ settings: get().settings, drawings: putLatest(get().drawings, key, next, MAX_DRAWING_SCOPES) });
    set(value);
    savePreferences(value);
  },
}));
