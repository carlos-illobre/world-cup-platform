import { useEffect, useState } from "react";
import { X, UserPlus, ArrowRight } from "lucide-react";
import { fetchJson } from "@/shared/lib/apiClient";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "../constants";

interface SimilarPlayersPanelProps {
  player: any;
  onClose: () => void;
  onAddToCompare: (player: any) => void;
}

/**
 * Shows players similar to the selected one:
 * Same cluster + sorted by closest Impact Score.
 * This answers: "Who else plays like this player?"
 */
export function SimilarPlayersPanel({ player, onClose, onAddToCompare }: SimilarPlayersPanelProps) {
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player) return;

    setLoading(true);
    // Fetch players in the same cluster, sorted by impact
    fetchJson(`/api/v1/players?cluster=${player.cluster}&sort_by=impact_score_raw&order=desc&limit=20`)
      .then((data) => {
        const items = (data.items || []).filter((p: any) => p.id !== player.id);
        
        // Sort by similarity: closest impact score + same position preferred
        const playerImpact = Number(player.impact_score) || 0;
        const scored = items.map((p: any) => {
          const pImpact = Number(p.impact_score) || 0;
          const impactDist = Math.abs(pImpact - playerImpact);
          const samePosition = p.position === player.position ? 0 : 0.5;
          const ageDist = Math.abs((p.age || 27) - (player.age || 27)) / 20;
          return { ...p, similarity: impactDist + samePosition + ageDist };
        });
        
        scored.sort((a: any, b: any) => a.similarity - b.similarity);
        setSimilar(scored.slice(0, 8));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [player]);

  if (!player) return null;

  const clusterColor = CLUSTER_COLORS[player.cluster] || "#888";
  const clusterName = CLUSTER_NAMES[player.cluster] || "Desconocido";

  return (
    <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-md">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div className="relative h-full ml-auto w-full max-w-md bg-[#0f0f0f] border-l border-white/10 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/5 p-5 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-bold text-white">Jugadores Similares</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Reference player */}
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-black/30" style={{ borderColor: `${clusterColor}40` }}>
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: clusterColor }} />
            ) : (
              <div className="w-12 h-12 rounded-full bg-black/50 border-2 flex items-center justify-center" style={{ borderColor: clusterColor }}>
                <span className="text-lg font-bold text-gray-300">{player.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{player.name}</p>
              <p className="text-xs text-gray-400">{player.country} • {player.position} • {player.club}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Alternativas con el mismo perfil táctico (<span style={{ color: clusterColor }}>{clusterName}</span>) 
            ordenadas por similitud en impacto, posición y edad.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
          </div>
        )}

        {/* Similar players list */}
        {!loading && (
          <div className="p-5 space-y-3">
            {similar.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No se encontraron jugadores similares.</p>
            )}
            {similar.map((p, i) => {
              const impactDiff = (Number(p.impact_score) || 0) - (Number(player.impact_score) || 0);
              const impactDiffText = impactDiff > 0 ? `+${impactDiff.toFixed(2)}` : impactDiff.toFixed(2);
              const impactDiffColor = impactDiff > 0 ? "text-green-400" : impactDiff < 0 ? "text-red-400" : "text-gray-400";

              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-black/20 hover:bg-black/40 hover:border-white/10 transition-all group">
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-600 w-5 text-center">{i + 1}</span>

                  {/* Photo */}
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-white/10 bg-black/50" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-400">{p.name.charAt(0)}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{p.country} • {p.position} • {p.age ? Math.floor(p.age) : "?"} años</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-gray-300">
                        Impact: <strong className="text-white">{Number(p.impact_score)?.toFixed(2) || "—"}</strong>
                      </span>
                      <span className={`text-[11px] font-medium ${impactDiffColor}`}>
                        ({impactDiffText} vs referencia)
                      </span>
                    </div>
                  </div>

                  {/* Add to compare button */}
                  <button
                    onClick={() => onAddToCompare(p)}
                    className="p-2 rounded-lg text-gray-500 hover:text-neon-blue hover:bg-neon-blue/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Agregar a comparación"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            {similar.length > 0 && (
              <p className="text-[10px] text-gray-600 text-center pt-3">
                Similitud calculada por: distancia en Impact Score + posición + cercanía en edad, dentro del mismo perfil K-Means.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
