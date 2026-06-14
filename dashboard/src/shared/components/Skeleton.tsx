/** Skeleton de carga — placeholder animado mientras se obtienen datos. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-secondary/60 ${className ?? ""}`}
    />
  );
}
