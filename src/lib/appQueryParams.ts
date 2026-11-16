import {
  StringParam,
  type QueryParamConfig,
} from "use-query-params";

type EncodedValue = string | (string | null)[] | null | undefined;

function getEncodedString(value: EncodedValue) {
  if (Array.isArray(value)) return value[0] ?? undefined;
  return value ?? undefined;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const ViewerParam: QueryParamConfig<
  string | null | undefined,
  string | null | undefined
> = {
  encode: (value) => {
    if (!value) return undefined;
    return btoa(value);
  },
  decode: (value) => {

    const raw = getEncodedString(value);
    if (!raw) return null;
    try {
      const decoded = atob(raw);
      return ADDRESS_RE.test(decoded) ? decoded : null;
    } catch {

      return null;
    }
  },
};

export interface SharedSession {
  address: string;
  sessionKey: string;
  sessionPublicKey: string;
  sessionExpiresAt: number;
  loginSignature?: string;
  loginTimestamp?: number;
}

export const SessionParam: QueryParamConfig<
  SharedSession | null | undefined,
  SharedSession | null | undefined
> = {
  encode: (value) => {
    if (!value) return undefined;
    return btoa(JSON.stringify(value));
  },
  decode: (value) => {
    const raw = getEncodedString(value);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(atob(raw));
      if (
        !parsed ||
        !ADDRESS_RE.test(parsed.address) ||
        typeof parsed.sessionKey !== "string" ||
        typeof parsed.sessionPublicKey !== "string" ||
        typeof parsed.sessionExpiresAt !== "number" ||
        (parsed.loginSignature != null &&
          typeof parsed.loginSignature !== "string") ||
        (parsed.loginTimestamp != null &&
          typeof parsed.loginTimestamp !== "number")
      ) {
        return null;
      }
      return parsed as SharedSession;
    } catch {
      return null;
    }
  },
};

export const appQueryParamConfig = {
  walletReset: StringParam,
  address: StringParam,
  v: ViewerParam,
  s: SessionParam,
} as const;

export function stripUserSessionQueryParams(search: string) {
  const params = new URLSearchParams(search);
  params.delete("address");
  params.delete("days");
  params.delete("debug");
  params.delete("filterChain");
  params.delete("filterPartner");
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function stripDeprecatedAppQueryParams(search: string) {
  const params = new URLSearchParams(search);
  params.delete("debug");
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function stripReadOnlyPortfolioQueryParams(search: string) {
  const params = new URLSearchParams(search);
  const readOnly = params.get("readonly")?.toLowerCase();
  const isExplicitReadOnly = readOnly === "1" || readOnly === "true";
  if (!isExplicitReadOnly && !params.has("address")) return search;

  params.delete("address");
  params.delete("readonly");
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}
