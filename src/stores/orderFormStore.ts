import { create } from 'zustand';
import type { OrderSide, UIOrderType } from '../types';

export type SizeUnit = "asset" | "usd";
export type SizeSource = "input" | "slider";

const clearedAttachedExits = {
  takeProfitEnabled: false,
  takeProfitPrice: '',
  takeProfitLimitPrice: '',
  stopLossEnabled: false,
  stopLossPrice: '',
  stopLossLimitPrice: '',
};

export interface OrderFormState {
  side: OrderSide;
  uiOrderType: UIOrderType;
  marginPercent: number;
  sizeValue: string;
  sizeSource: SizeSource;
  price: string;
  stopPrice: string;
  takeProfitEnabled: boolean;
  takeProfitPrice: string;
  takeProfitLimitPrice: string;
  stopLossEnabled: boolean;
  stopLossPrice: string;
  stopLossLimitPrice: string;
  attachedExitsResetKey: number;
  reduceOnly: boolean;
  closePosition: boolean;
  skipRiskEngine: boolean;
  sizeUnit: SizeUnit;
}

interface OrderFormStore extends OrderFormState {

  setSide: (side: OrderSide) => void;
  setUiOrderType: (uiOrderType: UIOrderType) => void;
  setMarginPercent: (marginPercent: number) => void;
  setSizeFromInput: (value: string, marginPercent: number) => void;
  setSizeFromSlider: (value: string, marginPercent: number) => void;
  setPrice: (price: string) => void;
  setStopPrice: (stopPrice: string) => void;
  setTakeProfitEnabled: (enabled: boolean) => void;
  setTakeProfitPrice: (price: string) => void;
  setTakeProfitLimitPrice: (price: string) => void;
  setStopLossEnabled: (enabled: boolean) => void;
  setStopLossPrice: (price: string) => void;
  setStopLossLimitPrice: (price: string) => void;
  resetAttachedExits: () => void;
  setReduceOnly: (reduceOnly: boolean) => void;
  setClosePosition: (closePosition: boolean) => void;
  setSkipRiskEngine: (skipRiskEngine: boolean) => void;
  onOrderBookPrice: (price: number, size?: number) => void;
  setSizeUnit: (unit: SizeUnit) => void;
  resetSize: () => void;
}

function formatOrderBookSizeForInput(
  price: number,
  size: number | undefined,
  sizeUnit: SizeUnit,
): string {
  if (!Number.isFinite(price) || !Number.isFinite(size) || !size || size <= 0) {
    return "";
  }

  const value = sizeUnit === "usd" ? size * price : size;
  if (!Number.isFinite(value) || value <= 0) return "";

  return value.toFixed(12).replace(/\.?0+$/, "");
}

export const useOrderFormStore = create<OrderFormStore>((set) => ({
  side: 'BUY',
  uiOrderType: 'MARKET',
  marginPercent: 0,
  sizeValue: '',
  sizeSource: 'slider',
  price: '',
  stopPrice: '',
  takeProfitEnabled: false,
  takeProfitPrice: '',
  takeProfitLimitPrice: '',
  stopLossEnabled: false,
  stopLossPrice: '',
  stopLossLimitPrice: '',
  attachedExitsResetKey: 0,
  reduceOnly: false,
  closePosition: false,
  skipRiskEngine: false,
  sizeUnit: 'asset',

  setSide: (side) => set((state) => ({
    side,
    ...(state.side !== side
      ? { ...clearedAttachedExits, attachedExitsResetKey: state.attachedExitsResetKey + 1 }
      : {}),
  })),
  setUiOrderType: (uiOrderType) => set((state) => ({
    uiOrderType,
    ...(state.uiOrderType !== uiOrderType
      ? { ...clearedAttachedExits, attachedExitsResetKey: state.attachedExitsResetKey + 1 }
      : {}),
  })),
  setMarginPercent: (marginPercent) => set({ marginPercent, sizeSource: 'slider', sizeValue: '' }),
  setSizeFromInput: (value, marginPercent) => set({ sizeValue: value, sizeSource: 'input', marginPercent }),
  setSizeFromSlider: (value, marginPercent) => set({ sizeValue: value, sizeSource: 'slider', marginPercent }),
  setPrice: (price) => set({ price }),
  setStopPrice: (stopPrice) => set({ stopPrice }),
  setTakeProfitEnabled: (takeProfitEnabled) => set({ takeProfitEnabled }),
  setTakeProfitPrice: (takeProfitPrice) => set({ takeProfitPrice }),
  setTakeProfitLimitPrice: (takeProfitLimitPrice) => set({ takeProfitLimitPrice }),
  setStopLossEnabled: (stopLossEnabled) => set({ stopLossEnabled }),
  setStopLossPrice: (stopLossPrice) => set({ stopLossPrice }),
  setStopLossLimitPrice: (stopLossLimitPrice) => set({ stopLossLimitPrice }),
  resetAttachedExits: () => set((state) => ({
    ...clearedAttachedExits,
    attachedExitsResetKey: state.attachedExitsResetKey + 1,
  })),
  setReduceOnly: (reduceOnly) => set((state) => ({
    reduceOnly,
    ...(reduceOnly
      ? { ...clearedAttachedExits, attachedExitsResetKey: state.attachedExitsResetKey + 1 }
      : {}),
  })),
  setClosePosition: (closePosition) => set({ closePosition }),
  setSkipRiskEngine: (skipRiskEngine) => set({ skipRiskEngine }),
  onOrderBookPrice: (price, size) => set((state) => {
    const nextState: Partial<OrderFormState> = {
      price: price.toString(),
      uiOrderType: "LIMIT",
      ...(state.uiOrderType !== "LIMIT"
        ? { ...clearedAttachedExits, attachedExitsResetKey: state.attachedExitsResetKey + 1 }
        : {}),
    };
    const shouldSeedSize =
      state.sizeValue.trim() === "" && state.marginPercent <= 0;
    const sizeValue = shouldSeedSize
      ? formatOrderBookSizeForInput(price, size, state.sizeUnit)
      : "";

    if (sizeValue) {
      nextState.sizeValue = sizeValue;
      nextState.sizeSource = "input";
    }

    return nextState;
  }),
  setSizeUnit: (sizeUnit) => set({ sizeUnit }),
  resetSize: () => set({ marginPercent: 0, sizeValue: '', sizeSource: 'slider' }),
}));
