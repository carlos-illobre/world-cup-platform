import { useState, useEffect, useRef } from "react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { useAppSelector } from "@/app/hooks";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";

/**
 * Panel "What-If" para simular cambios en parámetros de lesión.
 * Modifica injury_frequency y days_since_last_injury para ver
 * cómo cambia la predicción de riesgo del modelo XGBoost.
 * Se ejecuta automáticamente al mover los sliders (con debounce).
 */
export function WhatIfSimulator() {
  const jugadorId = useAppSelector(selectJugadorSeleccionadoId);
  const [additionalMatches, setAdditionalMatches] = useState(0);
  const [daysSinceInjury, setDaysSinceInjury] = useState(180);
  const [simResult, setSimResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-run simulation when sliders change (debounced 500ms)
  useEffect(() => {
    if (!jugadorId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const overrideFrequency = additionalMatches * 0.5; // 5 matches → frequency of 2.5/year
      const overrideDays = daysSinceInjury;

      setLoading(true);
      setError(null);

      fetch(
        `${INJURY_API_BASE_URL}/api/v1/injuries/risk/${encodeURIComponent(jugadorId)}?override_frequency=${overrideFrequency.toFixed(3)}&override_days_since=${overrideDays}`
      )
        .then(res => { if (!res.ok) throw new Error(`Error ${res.status}`); return res.json(); })
        .then(data => setSimResult(data.data))
        .catch(e => setError(e.message || "Error en simulación"))
        .finally(() => setLoading(false));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [additionalMatches, daysSinceInjury, jugadorId]);

  if (!jugadorId) return null;

  const riskScore = simResult?.ai_inference?.risk_proba
    ? (simResult.ai_inference.risk_proba * 100).toFixed(1)
    : null;
  const diagnosis = simResult?.ai_inference?.label || simResult?.ai_inference?.class;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-display font-bold text-white">
          Simulador What-If de Lesiones
        </h3>
      </div>
      <p className="text-base text-gray-200 mb-6">
        Ajusta los parámetros para simular escenarios hipotéticos. El resultado se actualiza automáticamente.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Slider: Additional matches */}
        <div>
          <label className="block text-base font-medium text-white mb-2">
            Partidos adicionales en 15 días: <span className="text-neon-blue font-bold text-lg">{additionalMatches}</span>
          </label>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={additionalMatches}
            onChange={(e) => setAdditionalMatches(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-blue"
          />
          <div className="flex justify-between text-sm text-gray-300 mt-1.5">
            <span>0 (descanso)</span>
            <span>5 (sobrecarga)</span>
          </div>
        </div>

        {/* Slider: Days since last injury */}
        <div>
          <label className="block text-base font-medium text-white mb-2">
            Días desde última lesión: <span className="text-neon-blue font-bold text-lg">{daysSinceInjury}</span>
          </label>
          <input
            type="range"
            min={0}
            max={365}
            step={5}
            value={daysSinceInjury}
            onChange={(e) => setDaysSinceInjury(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-blue"
          />
          <div className="flex justify-between text-sm text-gray-300 mt-1.5">
            <span>0 (recién lesionado)</span>
            <span>365 (hace 1 año)</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
          Recalculando...
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Simulation Result */}
      {simResult && (
        <div className="mt-6 bg-black/30 rounded-xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-3">
            {simResult.ai_inference?.risk_proba > 0.5 ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <Activity className="w-5 h-5 text-green-400" />
            )}
            <h4 className="text-base font-bold text-white">Resultado de Simulación</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
              <p className="text-sm text-gray-200 uppercase tracking-wider font-medium">Riesgo Simulado</p>
              <p className={`text-3xl font-black mt-1 ${
                (simResult.ai_inference?.risk_proba ?? 0) > 0.5 ? "text-red-400" : 
                (simResult.ai_inference?.risk_proba ?? 0) > 0.3 ? "text-yellow-400" : "text-green-400"
              }`}>
                {riskScore}%
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
              <p className="text-sm text-gray-200 uppercase tracking-wider font-medium">Diagnóstico</p>
              <p className="text-xl font-bold text-white mt-1">{diagnosis || "—"}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
              <p className="text-sm text-gray-200 uppercase tracking-wider font-medium">Modelo</p>
              <p className="text-base font-medium text-purple-300 mt-1">
                {simResult.ai_inference?.model_used || "injury_xgboost_model"}
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-200">
            <p>
              <strong className="text-white">Parámetros de simulación:</strong>{" "}
              injury_frequency = <span className="text-neon-blue font-bold">{(additionalMatches * 0.15).toFixed(3)}</span>,{" "}
              days_since_last_injury = <span className="text-neon-blue font-bold">{daysSinceInjury}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
