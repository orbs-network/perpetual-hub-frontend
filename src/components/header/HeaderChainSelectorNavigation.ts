const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type HeaderChainSelectorNavigationOptions = {
  assign?: (href: string) => void;
  hostname?: string;
  isDev?: boolean;
};

function getBrowserHostname() {
  return typeof window === "undefined" ? "" : window.location.hostname;
}

export function shouldReloadHeaderChainSelectorHref({
  hostname = getBrowserHostname(),
  isDev = import.meta.env.DEV,
}: HeaderChainSelectorNavigationOptions = {}) {
  return Boolean(isDev && LOCAL_DEV_HOSTNAMES.has(hostname));
}

export function applyHeaderChainSelectorHref(
  href: string,
  navigate: (href: string) => void,
  options: HeaderChainSelectorNavigationOptions = {},
) {
  if (shouldReloadHeaderChainSelectorHref(options)) {
    const assign =
      options.assign ?? window.location.assign.bind(window.location);
    assign(href);
    return;
  }

  navigate(href);
}
