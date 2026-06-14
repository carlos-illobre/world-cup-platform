import type { ReactNode } from "react";

interface GlassPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Panel base con estilo glassmorphism. Wrapper para secciones del dashboard. */
export function GlassPanel({ title, children, className }: GlassPanelProps) {
  return (
    <section className={`glass-panel rounded-2xl p-4 sm:p-5 ${className ?? ""}`}>
      {title && (
        <h2 className="mb-4 font-display text-base font-bold tracking-wide text-foreground sm:text-lg">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
