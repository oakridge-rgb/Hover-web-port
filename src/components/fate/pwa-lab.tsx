"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePwa } from "@/hooks/use-pwa";
import { useFateStore } from "@/lib/store";
import {
  CheckCircle2, CircleDashed, Download, HardDrive, RefreshCw, Trash2, Wifi, WifiOff, XCircle,
} from "lucide-react";

type Status = "pass" | "fail" | "pending";

function StatusRow({
  state,
  label,
  detail,
  icon: Icon,
}: {
  state: Status;
  label: string;
  detail: string;
  icon: typeof Wifi;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/60">
        <Icon className="h-4 w-4 text-amber-400" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-200">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {state === "pass" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-label="pass" />}
      {state === "fail" && <XCircle className="h-5 w-5 shrink-0 text-rose-400" aria-label="fail" />}
      {state === "pending" && <CircleDashed className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="pending" />}
    </div>
  );
}

export function PwaLab() {
  const { isOnline, isStandalone, swActive, offlineReady, canInstall, promptInstall } = usePwa();
  const clearAll = useFateStore((s) => s.clearAll);
  const { toast } = useToast();

  const onClear = () => {
    clearAll();
    toast({ title: "Ledger cleared", description: "All local fate data erased from this device." });
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="text-center">
        <HardDrive className="mx-auto mb-2 h-8 w-8 text-amber-400" aria-hidden />
        <h2 className="font-display text-xl text-amber-100">PWA Lab</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything that makes Fate v6 a Progressive Web App, live and inspectable.
        </p>
      </div>

      <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card/40 px-4">
        <StatusRow
          state={swActive ? "pass" : "pending"}
          label="Service worker"
          detail={swActive ? "Registered — caching and offline fallbacks are live" : "Registering…"}
          icon={RefreshCw}
        />
        <StatusRow
          state={offlineReady.ready ? "pass" : offlineReady.checked ? "fail" : "pending"}
          label="Offline-ready app shell"
          detail={
            offlineReady.ready
              ? `${offlineReady.assets} assets cached — you can go offline now`
              : offlineReady.checked
                ? "Shell not cached yet — reload once while online"
                : "Inspecting cache storage…"
          }
          icon={HardDrive}
        />
        <StatusRow
          state={isStandalone ? "pass" : "fail"}
          label="Running installed"
          detail={
            isStandalone
              ? "Launched from the home screen / app window — standalone mode"
              : "Currently in a browser tab — install to run standalone"
          }
          icon={Download}
        />
        <StatusRow
          state={isOnline ? "pass" : "pass"}
          label={isOnline ? "Network: online" : "Network: offline — app keeps working"}
          detail="All features run locally; the network only matters for the first visit"
          icon={isOnline ? Wifi : WifiOff}
        />
      </div>

      {!isStandalone && (
        <Button
          onClick={() => promptInstall()}
          className="w-full bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400"
          data-testid="lab-install"
        >
          <Download className="h-4 w-4" />
          {canInstall ? "Install Fate v6 now" : "Install (see browser menu if nothing happens)"}
        </Button>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <h3 className="mb-2 text-sm font-semibold text-amber-200">60-second field test</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-300">
          <li>Tap <span className="text-amber-300">Install</span> — Fate v6 lands on your home screen with its own icon.</li>
          <li>Close the browser, launch Fate v6 from the icon — it opens standalone, no address bar.</li>
          <li>Turn on airplane mode, reopen the app — the daily card, Oracle and Threads all still work.</li>
          <li>Draw your card, write a journal line, then fully restart the device — the data is still there (local-first).</li>
        </ol>
      </div>

      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <h3 className="mb-1 text-sm font-semibold text-rose-200">Danger zone</h3>
        <p className="mb-3 text-xs text-rose-200/70">
          Wipes every roll, journal line, thread and whisper from this device. The fates will not
          remember you.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <Trash2 className="h-4 w-4" />
          Clear all local data
        </Button>
      </div>
    </div>
  );
}
