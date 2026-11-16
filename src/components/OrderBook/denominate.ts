export type Denom = 'BASE' | 'QUOTE';

export function denominateSize(size: number, price: number, denom: Denom): number {
  if (!Number.isFinite(size) || !Number.isFinite(price)) return 0;
  if (denom === 'QUOTE') {
    if (size === 0 || price === 0) return 0;
    return size * price;
  }
  return size;
}
