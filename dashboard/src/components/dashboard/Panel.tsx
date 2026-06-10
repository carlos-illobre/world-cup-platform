import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
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

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-secondary/60 ${className ?? ""}`}
    />
  );
}
