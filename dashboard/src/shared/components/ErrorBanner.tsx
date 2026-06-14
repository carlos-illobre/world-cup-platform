interface ErrorBannerProps {
  message: string;
}

/** Banner de error reutilizable con estilo glass. */
export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="glass-panel rounded-xl border-neon-red/60 px-4 py-3 text-center text-sm text-neon-red">
      {message}
    </div>
  );
}
