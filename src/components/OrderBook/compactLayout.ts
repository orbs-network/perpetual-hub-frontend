export const ORDER_BOOK_CHROME_HEIGHT = 75;
export const ORDER_BOOK_MOBILE_SIDE_BY_SIDE_CHROME_HEIGHT = 64;
export const COMPACT_VISIBLE_LEVELS = 5;
export const COMPACT_ROW_HEIGHT_PX = 26;
export const COMPACT_ROW_GAP_PX = 4;
export const COMPACT_HEADER_HEIGHT_PX = 24;
export const COMPACT_CENTER_HEIGHT_PX = 36;
export const COMPACT_GROUPING_HEIGHT_PX = 24;
export const COMPACT_BOTTOM_PADDING_PX = 4;

export function calculateCompactVisibleLevels(containerHeight: number) {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return COMPACT_VISIBLE_LEVELS;
  }

  const fixedHeight =
    COMPACT_HEADER_HEIGHT_PX +
    COMPACT_CENTER_HEIGHT_PX +
    COMPACT_GROUPING_HEIGHT_PX +
    COMPACT_BOTTOM_PADDING_PX;
  const gapHeight = COMPACT_ROW_GAP_PX;
  const levelPairHeight = 2 * (COMPACT_ROW_HEIGHT_PX + COMPACT_ROW_GAP_PX);

  return Math.max(
    COMPACT_VISIBLE_LEVELS,
    Math.floor((containerHeight - fixedHeight - gapHeight) / levelPairHeight),
  );
}
