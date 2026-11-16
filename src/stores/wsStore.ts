import { create } from 'zustand';

export type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WSState {
  status: WSConnectionStatus;
  lastMessage: unknown | null;
  error: string | null;

  setStatus: (status: WSConnectionStatus) => void;
  setLastMessage: (message: unknown) => void;
  setError: (error: string | null) => void;
}

export const useWSStore = create<WSState>((set) => ({
  status: 'disconnected',
  lastMessage: null,
  error: null,

  setStatus: (status: WSConnectionStatus) => set({ status }),
  setLastMessage: (message: unknown) => set({ lastMessage: message }),
  setError: (error: string | null) => set({ error, status: error ? 'error' : 'connected' }),
}));
