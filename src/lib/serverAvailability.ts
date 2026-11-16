export const SERVER_UNAVAILABLE_EVENT = "perpetual-hub:server-unavailable";
export const SERVER_AVAILABLE_EVENT = "perpetual-hub:server-available";

export type ServerUnavailableDetail = {
  endpoint?: string;
  message?: string;
  path?: string;
  status?: number;
};

function dispatchAppEvent<T>(eventName: string, detail?: T) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function notifyServerUnavailable(detail: ServerUnavailableDetail = {}) {
  dispatchAppEvent(SERVER_UNAVAILABLE_EVENT, detail);
}

export function notifyServerAvailable() {
  dispatchAppEvent(SERVER_AVAILABLE_EVENT);
}
