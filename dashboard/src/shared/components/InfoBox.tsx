import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/Skeleton";

interface InfoBoxProps {
  icon: ReactNode;
  label: string;
  value: string;
  loading: boolean;
}

/** Caja informativa con icono, etiqueta y valor. */
export function InfoBox({ icon, label, value, loading }: InfoBoxProps) {
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-16" />
      ) : (
        <span className="font-display text-xl font-extrabold text-foreground">
          {value}
        </span>
      )}
    </div>
  );
}
