import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  SERVER_AVAILABLE_EVENT,
  SERVER_UNAVAILABLE_EVENT,
} from "@/lib/serverAvailability";

/**
 * Shown while the API is answering 502/503, timing out or unreachable, which in
 * practice means a deploy is switching slots. The client already fires these
 * events; nothing displayed them, so a deploy looked like a frozen page.
 * It disappears on the first successful request.
 */
export function ServerUnavailableBanner() {
  const [unavailable, setUnavailable] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onUnavailable = () => setUnavailable(true);
    const onAvailable = () => setUnavailable(false);
    window.addEventListener(SERVER_UNAVAILABLE_EVENT, onUnavailable);
    window.addEventListener(SERVER_AVAILABLE_EVENT, onAvailable);
    return () => {
      window.removeEventListener(SERVER_UNAVAILABLE_EVENT, onUnavailable);
      window.removeEventListener(SERVER_AVAILABLE_EVENT, onAvailable);
    };
  }, []);

  useLayoutEffect(() => {
    const banner = bannerRef.current;
    const shell = banner?.closest<HTMLElement>('[data-testid="app-shell"]');
    if (!banner || !shell) return;
    const measure = () => {
      shell.style.setProperty('--app-status-height', `${banner.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--app-status-height');
    };
  }, [unavailable]);

  if (!unavailable) return null;

  return (
    <section
      ref={bannerRef}
      role="status"
      aria-live="polite"
      aria-label="Trading server reconnecting"
      className="flex min-h-9 items-center justify-center border-y border-accent-primary/30 bg-raised px-4 py-1.5 text-center text-sm"
    >
      <span className="font-semibold text-accent-primary">Reconnecting to the trading server.</span>
      <span className="ml-2">Data refreshes automatically once it is back.</span>
    </section>
  );
}
