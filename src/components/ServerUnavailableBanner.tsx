import { useEffect, useState } from "react";

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

  if (!unavailable) return null;

  return (
    <section
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
