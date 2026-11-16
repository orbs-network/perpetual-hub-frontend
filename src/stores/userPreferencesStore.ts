import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferencesState {
  skipOpenOrderConfirm: boolean;
  skipClosePositionConfirm: boolean;
  showBuysSellsOnChart: boolean;
  hidePnl: boolean;
  selectedBottomTabs: Record<string, string>;
  setSkipOpenOrderConfirm: (value: boolean) => void;
  setSkipClosePositionConfirm: (value: boolean) => void;
  setShowBuysSellsOnChart: (value: boolean) => void;
  setHidePnl: (value: boolean) => void;
  setSelectedBottomTab: (key: string, value: string) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      skipOpenOrderConfirm: false,
      skipClosePositionConfirm: false,
      showBuysSellsOnChart: true,
      hidePnl: false,
      selectedBottomTabs: {},
      setSkipOpenOrderConfirm: (value: boolean) => set({ skipOpenOrderConfirm: value }),
      setSkipClosePositionConfirm: (value: boolean) => set({ skipClosePositionConfirm: value }),
      setShowBuysSellsOnChart: (value: boolean) => set({ showBuysSellsOnChart: value }),
      setHidePnl: (value: boolean) => set({ hidePnl: value }),
      setSelectedBottomTab: (key: string, value: string) =>
        set((state) => ({
          selectedBottomTabs: {
            ...state.selectedBottomTabs,
            [key]: value,
          },
        })),
    }),
    {
      name: 'user-preferences',
    }
  )
);
