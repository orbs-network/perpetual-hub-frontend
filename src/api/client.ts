import axios, {
  AxiosHeaders,
  CanceledError,
  type AxiosInstance,
  type AxiosError,
} from 'axios';
import { toast } from 'sonner';
import {
  API_URL,
  resolveCurrentPartnerChainIdentity,
} from '../config/constants';
import {
  notifyServerAvailable,
  notifyServerUnavailable,
} from '@/lib/serverAvailability';
import { useAuthStore } from '../stores/authStore';

import { getPublicDisplayReadIdentity, isPartnerApprovalPending } from '@/config/partners/availability';

const PARTNER_CHAIN_NOT_SUPPORTED_CODE = "INVALID_PARTNER_CHAIN_KEY";
const PARTNER_CHAIN_NOT_SUPPORTED_TOAST_ID = "partner-chain-not-supported";
const SERVER_UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/**
 * Upper bound for any API request. Without it a request that reaches the proxy
 * while the backend is switching slots can hang until the proxy gives up (75 s)
 * and the page stays on skeletons the whole time. A timeout is reported as
 * "server unavailable" so the retry and banner paths treat it like a 502.
 */
export const API_REQUEST_TIMEOUT_MS = 15_000;

type ApiPartnerChain = {
  partnerChainKey: string;
  partnerId: string;
  chainId: number;
};

type ApiPartnerChainResolver = () => ApiPartnerChain;
type ApiPartnerChainSource = ApiPartnerChain | ApiPartnerChainResolver;

function isPartnerChainNotSupportedError(
  error: AxiosError<{ error?: string; code?: string }>,
) {
  const errorMessage = error.response?.data?.error ?? "";
  return (
    error.response?.status === 400 &&
    (error.response?.data?.code === PARTNER_CHAIN_NOT_SUPPORTED_CODE ||
      errorMessage.includes("partner-chain key"))
  );
}

function withPartnerChainHeaders(
  headers: Parameters<typeof AxiosHeaders.from>[0],
  partnerChain: ApiPartnerChain,
) {
  const nextHeaders = AxiosHeaders.from(headers);
  nextHeaders.set('Content-Type', 'application/json');
  nextHeaders.set('X-Partner-Chain-Key', partnerChain.partnerChainKey);
  nextHeaders.set('X-Partner-ID', partnerChain.partnerId);
  nextHeaders.set('X-Chain-ID', String(partnerChain.chainId));
  return nextHeaders;
}

function partnerChainResolver(
  source: ApiPartnerChainSource = resolveCurrentPartnerChainIdentity,
): ApiPartnerChainResolver {
  return typeof source === 'function' ? source : () => source;
}

function getRequestPartnerChainKey(
  error: AxiosError<{ error?: string; code?: string }>,
) {
  const headers = AxiosHeaders.from(error.config?.headers);
  const partnerChainKey = headers.get('X-Partner-Chain-Key');
  return typeof partnerChainKey === 'string' ? partnerChainKey : undefined;
}

function isCanceledRequest(error: AxiosError) {
  return (
    axios.isCancel(error) ||
    error.code === "ERR_CANCELED" ||
    error.name === "CanceledError"
  );
}

export function isServerUnavailableError(error: AxiosError) {
  if (isCanceledRequest(error)) {
    return false;
  }

  const status = error.response?.status;
  if (status && SERVER_UNAVAILABLE_STATUSES.has(status)) {
    return true;
  }

  return (
    !error.response &&
    (error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      error.message === "Network Error" ||
      Boolean(error.request))
  );
}

function notifyIfServerUnavailable(error: AxiosError<{ error?: string; code?: string }>) {
  if (!isServerUnavailableError(error)) {
    return;
  }

  notifyServerUnavailable({
    endpoint: error.config?.baseURL,
    message: error.response?.data?.error ?? error.message,
    path: error.config?.url,
    status: error.response?.status,
  });
}

function attachApiClientInterceptors(
  apiClient: AxiosInstance,
  resolvePartnerChain: ApiPartnerChainResolver,
) {
  apiClient.interceptors.request.use((config) => {
    if (isPartnerApprovalPending()) {
      const identity = getPublicDisplayReadIdentity(config.method, config.url);
      if (!identity) throw new CanceledError('Read-only app permits public market reads only');
      config.headers = withPartnerChainHeaders(undefined, identity);
    } else {
      config.headers = withPartnerChainHeaders(config.headers, resolvePartnerChain());
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => {
      notifyServerAvailable();
      return response;
    },
    (error: AxiosError<{ error?: string; code?: string }>) => {
      notifyIfServerUnavailable(error);

      const errorMessage = error.response?.data?.error;
      if (
        !isPartnerApprovalPending() &&
        (error.response?.status === 401 ||
          errorMessage?.includes("invalid signature") ||
          errorMessage?.includes("INVALID_SIGNATURE"))
      ) {
        useAuthStore.getState().clearAuth(
          undefined,
          getRequestPartnerChainKey(error),
        );
      }
      if (isPartnerChainNotSupportedError(error)) {
        toast.error("Partner chain not supported", {
          id: PARTNER_CHAIN_NOT_SUPPORTED_TOAST_ID,
        });
      }
      // Extract server error message so callers get meaningful errors
      const serverMessage = error.response?.data?.error;
      if (serverMessage) {
        error.message = serverMessage;
      }
      return Promise.reject(error);
    }
  );
}

export function createApiClient(
  endpoint: string,
  partnerChain: ApiPartnerChainSource = resolveCurrentPartnerChainIdentity,
) {
  const apiClient: AxiosInstance = axios.create({
    baseURL: endpoint,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  attachApiClientInterceptors(apiClient, partnerChainResolver(partnerChain));
  return apiClient;
}

const apiClient = createApiClient(API_URL);

export default apiClient;

// Helper to generate unique request IDs
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
