import { create } from 'zustand';

const STORAGE_KEY = 'favoriteMarkets';

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface FavoritesState {
  favorites: string[];
  toggleFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: loadFavorites(),
  toggleFavorite: (symbol) => {
    const current = get().favorites;
    const next = current.includes(symbol)
      ? current.filter((s) => s !== symbol)
      : [...current, symbol];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ favorites: next });
  },
  isFavorite: (symbol) => get().favorites.includes(symbol),
}));
