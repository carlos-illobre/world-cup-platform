import { useState, useEffect, useRef } from "react";
import { Wifi } from "lucide-react";

interface StartupScreenProps {
  children: React.ReactNode;
}

const HEALTH_URL = (import.meta.env.VITE_INJURY_API_BASE_URL ?? "http://localhost:8000") + "/health";
const POLL_INTERVAL_MS = 800;
const SIMULATED_DURATION_MS = 4000; // Total animation time for the progress bar

/**
 * Splash screen that shows while the backend is starting up.
 * Polls /health until the API responds with models_loaded=true,
 * then fades out and reveals the app.
 */
export function StartupScreen({ children }: StartupScreenProps) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Conectando con el servidor...");
  const startTime = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Progress simulation (visual feedback even before backend responds)
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      // Asymptotic progress: approaches 90% over SIMULATED_DURATION_MS, never reaches 100 until ready
      const simulated = Math.min(90, (elapsed / SIMULATED_DURATION_MS) * 90);
      if (!cancelled) setProgress(simulated);
    }, 50);

    // Status text rotation
    const statusMessages = [
      { at: 0, text: "Conectando con el servidor..." },
      { at: 1000, text: "Cargando modelos de Machine Learning..." },
      { at: 2500, text: "Inicializando datasets (1257 jugadores)..." },
      { at: 4000, text: "Pre-computando caches de búsqueda..." },
      { at: 6000, text: "Casi listo... finalizando carga..." },
    ];
    const statusTimers = statusMessages.map(({ at, text }) =>
      setTimeout(() => { if (!cancelled) setStatusText(text); }, at)
    );

    // Poll backend /health
    const poll = async () => {
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          if (data.models_loaded) {
            if (!cancelled) {
              setProgress(100);
              setStatusText("¡Listo!");
              // Short delay for the bar to fill visually
              setTimeout(() => { if (!cancelled) setFadeOut(true); }, 400);
              setTimeout(() => { if (!cancelled) setReady(true); }, 900);
            }
            return true; // Stop polling
          }
        }
      } catch {
        // Backend not up yet — keep polling
      }
      return false;
    };

    intervalRef.current = setInterval(async () => {
      const done = await poll();
      if (done && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, POLL_INTERVAL_MS);

    // Initial immediate check
    poll();

    return () => {
      cancelled = true;
      clearInterval(progressInterval);
      statusTimers.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (ready) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Splash screen */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        style={{ background: "var(--gradient-app)" }}
      >
        {/* Animated logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="relative mb-6">
            <Wifi className="h-16 w-16 -rotate-45 text-neon-blue animate-pulse drop-shadow-[0_0_25px_oklch(0.72_0.18_232_/_0.8)]" />
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-neon-blue blur-xl" />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-wide">
            <span className="text-glow-blue">Fixar</span>{" "}
            <span className="font-light text-muted-foreground">Analytics</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground tracking-wider uppercase">
            World Cup 2026 AI Platform
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-80 max-w-[80vw]">
          <div className="h-2 w-full rounded-full bg-black/40 border border-white/10 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--neon-blue), var(--neon-green))",
                boxShadow: "0 0 12px oklch(0.72 0.18 232 / 60%)",
              }}
            />
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-xs text-muted-foreground animate-pulse">
              {statusText}
            </p>
            <span className="text-xs font-bold text-neon-blue">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="absolute bottom-8 text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          Cargando modelos XGBoost · K-Means · KNN · Programación Lineal
        </p>
      </div>

      {/* Hidden children (preloading in background) */}
      <div className="hidden">{children}</div>
    </>
  );
}
