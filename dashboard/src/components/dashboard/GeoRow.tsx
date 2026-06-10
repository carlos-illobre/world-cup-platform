import type { ReactNode } from "react";
import { Skeleton } from "@/components/dashboard/Panel";

interface GeoRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  loading: boolean;
}

/** Fila de información geoclimática con icono y valor alineado a la derecha. */
export function GeoRow({ icon, label, value, loading }: GeoRowProps) {
  return (
    <li className="flex items-center gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      {icon}
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      {loading ? (
        <Skeleton className="ml-auto h-5 w-20" />
      ) : (
        <span className="ml-auto font-display text-sm font-bold text-foreground">
          {value}
        </span>
      )}
    </li>
  );
}
