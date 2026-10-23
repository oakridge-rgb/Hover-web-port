"use client";

/**
 * PWA capability hook: service-worker registration, install prompt,
 * online/offline detection and offline-readiness (cache inspection).
 */
import { useCallback, useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type OfflineReady = { checked: boolean; ready: boolean; assets: number };

export function usePwa() {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [offlineReady, setOfflineReady] = useState<OfflineReady>({
    checked: false,
    ready: false,
    assets: 0,
  });
  const [canInstall, setCanInstall] = useState(false);
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null);

  /** Inspect CacheStorage: is the app shell stored? How many entries? */
  const checkOfflineReady = useCallback(async () => {
    if (typeof caches === "undefined") return;
    try {
      const keys = await caches.keys();
      const shellKey = keys.find((k) => k.endsWith("-shell"));
      if (!shellKey) {
        setOfflineReady({ checked: true, ready: false, assets: 0 });
        return;
      }
      const shell = await caches.open(shellKey);
      const entries = await shell.keys();
      setOfflineReady({
        checked: true,
        ready: entries.length > 0,
        assets: entries.length,
      });
    } catch {
      setOfflineReady({ checked: true, ready: false, assets: 0 });
    }
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Sync current status after hydration (deferred — keeps SSR markup stable).
    const syncId = window.setTimeout(() => {
      setIsOnline(navigator.onLine);
      syncStandalone();
    }, 0);

    const mq = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () =>
      setIsStandalone(
        mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
      );
    syncStandalone();
    mq.addEventListener?.("change", syncStandalone);

    // Register the service worker
    let cancelled = false;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(async (reg) => {
          if (cancelled) return;
          await navigator.serviceWorker.ready.catch(() => {});
          setSwActive(!!reg.active || (await navigator.serviceWorker.getRegistration()) !== undefined);
          await checkOfflineReady();
        })
        .catch(() => setSwActive(false));
    }

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "OFFLINE_READY") {
        setSwActive(true);
        checkOfflineReady();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    const onBip = (e: Event) => {
      e.preventDefault();
      installEvent.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      setCanInstall(false);
      installEvent.current = null;
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      cancelled = true;
      window.clearTimeout(syncId);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", syncStandalone);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [checkOfflineReady]);

  const promptInstall = useCallback(async(): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const ev = installEvent.current;
    if (!ev) return "unavailable";
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === "accepted") {
      setCanInstall(false);
      installEvent.current = null;
    }
    return choice.outcome;
  }, []);

  return { isOnline, isStandalone, swActive, offlineReady, canInstall, promptInstall };
}
