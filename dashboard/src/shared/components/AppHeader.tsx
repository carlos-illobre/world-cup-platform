import { Wifi } from "lucide-react";
import { UI_LABELS } from "@/shared/constants/uiLabels";

/** Cabecera de la aplicación con la marca Fixar Analytics. */
export function AppHeader() {
  return (
    <header className="glass-panel flex items-center gap-2.5 rounded-2xl px-4 py-3 sm:px-6">
      <Wifi className="h-7 w-7 -rotate-45 text-neon-blue drop-shadow-[0_0_10px_oklch(0.72_0.18_232_/_0.6)]" />
      <span className="font-display text-xl font-extrabold tracking-wide sm:text-2xl">
        <span className="text-glow-blue">{UI_LABELS.app.brand}</span>{" "}
        <span className="font-light text-muted-foreground">
          {UI_LABELS.app.brandSuffix}
        </span>
      </span>
    </header>
  );
}
