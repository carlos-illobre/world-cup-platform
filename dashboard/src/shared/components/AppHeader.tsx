import { Wifi } from "lucide-react";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { Link } from "@tanstack/react-router";

/** Cabecera de la aplicación con la marca Fixar Analytics y navegación. */
export function AppHeader() {
  return (
    <header className="glass-panel flex items-center justify-between gap-2.5 rounded-2xl px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <Wifi className="h-7 w-7 -rotate-45 text-neon-blue drop-shadow-[0_0_10px_oklch(0.72_0.18_232_/_0.6)]" />
        <span className="font-display text-xl font-extrabold tracking-wide sm:text-2xl">
          <span className="text-glow-blue">{UI_LABELS.app.brand}</span>{" "}
          <span className="font-light text-muted-foreground">
            {UI_LABELS.app.brandSuffix}
          </span>
        </span>
      </div>
      
      <nav className="flex gap-4">
        <Link 
          to="/" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Diagnóstico Lesiones
        </Link>
        <Link 
          to="/scouting" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Scouting & Perfilado
        </Link>
        <Link 
          to="/prediction" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Predicción de Partidos
        </Link>
        <Link 
          to="/groups" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Simulador Grupos
        </Link>
        <Link 
          to="/compare" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Comparador
        </Link>
        <Link 
          to="/optimizer" 
          className="text-sm font-medium text-muted-foreground hover:text-white transition-colors [&.active]:text-neon-blue [&.active]:font-bold"
        >
          Optimizador Plantillas
        </Link>
      </nav>
    </header>
  );
}
