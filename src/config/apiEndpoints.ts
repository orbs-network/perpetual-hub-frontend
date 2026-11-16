export const PUBLIC_API_URL = "https://perps-api.orbs.network";
export const PUBLIC_WS_URL = "wss://perps-api.orbs.network/ws";
export const DEV_PROXY_API_PREFIX = "/__backend";
export const DEV_PROXY_WS_PREFIX = "/__backend-ws";

export function resolveDefaultApiUrl(isDev: boolean): string {
  return isDev ? DEV_PROXY_API_PREFIX : PUBLIC_API_URL;
}

export function resolveDefaultWsUrl(isDev: boolean): string {
  return isDev ? DEV_PROXY_WS_PREFIX : PUBLIC_WS_URL;
}
