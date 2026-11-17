export interface PublicEnvironmentInput {
  readonly [key: string]: unknown;
  VITE_PARTNER?: string;
  VITE_WALLETCONNECT_PROJECT_ID?: string;
}

export interface PublicEnvironment {
  partnerId: string;
  walletConnectProjectId: string;
}

export function resolvePartnerId(value: string | undefined): string {
  const id = value?.trim();
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    throw new Error('VITE_PARTNER must contain a partner ID using letters, numbers, underscores or hyphens.');
  }
  return id;
}

/** The same validated deployment inputs are used by Vite and browser startup. */
export function resolvePublicEnvironment(env: PublicEnvironmentInput): Readonly<PublicEnvironment> {
  return Object.freeze({
    partnerId: resolvePartnerId(env.VITE_PARTNER),
    walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || '',
  });
}
