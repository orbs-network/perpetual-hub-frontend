/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Hex } from 'viem';
import type { SessionPersistence } from '@/lib/authSession';
import { resolveCurrentPartnerChainKey } from '@/config/constants';

export interface Session {
  sessionKey: Hex;
  sessionPublicKey: Hex;
  sessionExpiresAt: number;
  loginSignature?: string;
  loginTimestamp?: number;
  persistence?: SessionPersistence;
}

interface AuthState {
  sessions: Record<string, Session>;

  setAuth: (params: {
    address: string;
    partnerChainKey?: string;
    sessionKey: Hex;
    sessionPublicKey: Hex;
    sessionExpiresAt: number;
    loginSignature?: string;
    loginTimestamp?: number;
    persistence?: SessionPersistence;
  }) => void;
  clearAuth: (address?: string, partnerChainKey?: string) => void;
  getSession: (address?: string, partnerChainKey?: string) => Session | null;
}

const STORAGE_KEY = 'sessionKey';

export function getAuthSessionKey(
  address: string,
  partnerChainKey = resolveCurrentPartnerChainKey(),
) {
  return `${partnerChainKey}:${address.toLowerCase()}`;
}

function isAuthSessionKeyForPartnerChain(
  key: string,
  partnerChainKey = resolveCurrentPartnerChainKey(),
) {
  return key.startsWith(`${partnerChainKey}:`);
}

type PersistedAuthPayload = {
  state?: {
    sessions?: Record<string, Session>;
  };
  version?: number;
};

function parsePersistedAuth(value: string | null): PersistedAuthPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as PersistedAuthPayload;
  } catch {
    return null;
  }
}

function browserStorage(persistence: SessionPersistence): Storage | null {
  if (typeof window === 'undefined') return null;
  return persistence === 'local' ? window.localStorage : window.sessionStorage;
}

function authStorageValue(
  value: string,
  sessions: Record<string, Session>,
): string {
  const payload = parsePersistedAuth(value) ?? {};
  return JSON.stringify({
    ...payload,
    state: {
      ...payload.state,
      sessions,
    },
  });
}

function writeAuthSessions(
  name: string,
  value: string,
  persistence: SessionPersistence,
  sessions: Record<string, Session>,
) {
  const storage = browserStorage(persistence);
  if (!storage) return;
  if (Object.keys(sessions).length === 0) {
    storage.removeItem(name);
    return;
  }
  storage.setItem(name, authStorageValue(value, sessions));
}

function readAuthSessions(name = STORAGE_KEY): Record<string, Session> {
  const localPayload = parsePersistedAuth(browserStorage('local')?.getItem(name) ?? null);
  const sessionPayload = parsePersistedAuth(browserStorage('session')?.getItem(name) ?? null);
  return {
    ...(localPayload?.state?.sessions ?? {}),
    ...(sessionPayload?.state?.sessions ?? {}),
  };
}

const browserAuthStorage: StateStorage = {
  getItem: (name) => {
    const sessions = readAuthSessions(name);
    if (Object.keys(sessions).length === 0) return null;
    return JSON.stringify({ state: { sessions } });
  },
  setItem: (name, value) => {
    const payload = parsePersistedAuth(value);
    const sessions = payload?.state?.sessions ?? {};
    const localSessions: Record<string, Session> = {};
    const tabSessions: Record<string, Session> = {};

    for (const [key, session] of Object.entries(sessions)) {
      if ((session.persistence ?? 'local') === 'session') {
        tabSessions[key] = session;
      } else {
        localSessions[key] = session;
      }
    }

    writeAuthSessions(name, value, 'local', localSessions);
    writeAuthSessions(name, value, 'session', tabSessions);
  },
  removeItem: (name) => {
    browserStorage('local')?.removeItem(name);
    browserStorage('session')?.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessions: {},

      setAuth: ({
        address,
        partnerChainKey,
        sessionKey,
        sessionPublicKey,
        sessionExpiresAt,
        loginSignature,
        loginTimestamp,
        persistence = 'local',
      }) => {
        const key = getAuthSessionKey(address, partnerChainKey);
        set((state) => ({
          sessions: {
            ...state.sessions,
            [key]: {
              sessionKey,
              sessionPublicKey,
              sessionExpiresAt,
              loginSignature,
              loginTimestamp,
              persistence,
            },
          },
        }));
      },

      clearAuth: (address?: string, partnerChainKey?: string) => {
        if (address) {
          const key = getAuthSessionKey(address, partnerChainKey);
          set((state) => {
            const { [key]: _, ...rest } = state.sessions;
            return { sessions: rest };
          });
        } else {
          set((state) => ({
            sessions: Object.fromEntries(
              Object.entries(state.sessions).filter(
                ([key]) => !isAuthSessionKeyForPartnerChain(key, partnerChainKey),
              ),
            ),
          }));
        }
      },

      getSession: (address?: string, partnerChainKey?: string) => {
        if (!address) return null;
        const key = getAuthSessionKey(address, partnerChainKey);
        return get().sessions[key] ?? null;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => browserAuthStorage),
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
);

// Sync store when durable storage is modified externally (other tab, devtools, manual clear).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      useAuthStore.setState({ sessions: readAuthSessions() });
    }
  });
}
