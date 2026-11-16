import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  if (typeof document === "undefined") return () => {};

  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function getSnapshot() {
  return typeof document === "undefined"
    ? true
    : document.visibilityState === "visible";
}

function getServerSnapshot() {
  return true;
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}