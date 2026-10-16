"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePwa } from "@/hooks/use-pwa";
import { Download, Wifi, WifiOff } from "lucide-react";

/** Header controls: online/offline pill + install button. */
export function PwaBar() {
  const { isOnline, canInstall, isStandalone, promptInstall } = usePwa();
  const { toast } = useToast();

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast({ title: "Fate v6 installed", description: "Find it on your home screen." });
    } else if (outcome === "dismissed") {
      toast({ title: "Install dismissed", description: "The button will stay right here." });
    } else {
      toast({
        title: "Install not available here",
        description:
          "Use your browser menu: Chrome → “Install app”, iOS Safari → Share → “Add to Home Screen”.",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-label={isOnline ? "Online" : "Offline"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          isOnline
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/40 bg-amber-500/10 text-amber-400"
        }`}
      >
        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {isOnline ? "Online" : "Offline"}
      </span>

      {!isStandalone && (
        <Button
          size="sm"
          variant="outline"
          onClick={onInstall}
          className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
        >
          <Download className="h-4 w-4" />
          Install
        </Button>
      )}
    </div>
  );
}
