export interface PublicEnvironmentInput {
  readonly [key: string]: unknown;
  VITE_PARTNER?: string;
  VITE_APP_ORIGIN?: string;
  VITE_WALLETCONNECT_PROJECT_ID?: string;
}

export interface PublicEnvironment {
  partnerId: string;
  appOrigin: string;
  walletConnectProjectId: string;
}

export function resolvePartnerId(value: string | undefined): string {
  const id = value?.trim();
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    throw new Error('VITE_PARTNER must contain a partner ID using letters, numbers, underscores or hyphens.');
  }
  return id;
}

function resolveAppOrigin(value: string | undefined): string {
  const message = 'VITE_APP_ORIGIN must be an HTTP(S) origin without credentials, a path, query or fragment.';
  if (!value?.trim()) throw new Error(message);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(message);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error(message);
  }
  return url.origin;
}

/** The same validated deployment inputs are used by Vite and browser startup. */
export function resolvePublicEnvironment(env: PublicEnvironmentInput): Readonly<PublicEnvironment> {
  return Object.freeze({
    partnerId: resolvePartnerId(env.VITE_PARTNER),
    appOrigin: resolveAppOrigin(env.VITE_APP_ORIGIN),
    walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || '',
  });
}
