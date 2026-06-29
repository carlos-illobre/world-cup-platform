import { useState } from "react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";

interface ModelPlotProps {
  /** Filename of the plot (e.g., "injury_shap_summary.png") */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional caption below the image */
  caption?: string;
}

/**
 * Displays a model training plot served from the backend static folder.
 * Shows a loading state and handles errors gracefully.
 */
export function ModelPlot({ src, alt, caption }: ModelPlotProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const url = `${INJURY_API_BASE_URL}/static/model_plots/${src}`;

  if (error) {
    return (
      <div className="rounded-lg border border-white/5 bg-black/30 p-4 text-center">
        <p className="text-xs text-gray-500">No se pudo cargar: {src}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/5 bg-black/30 overflow-hidden">
      {!loaded && (
        <div className="flex items-center justify-center py-8">
          <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500/60 to-neon-blue/60 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
          </div>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className={`w-full h-auto transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {caption && loaded && (
        <p className="text-xs text-gray-500 px-3 py-2 border-t border-white/5 italic">
          {caption}
        </p>
      )}
    </div>
  );
}
