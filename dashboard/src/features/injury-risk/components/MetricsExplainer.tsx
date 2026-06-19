import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Panel expandible que explica cada métrica mostrada en el diagnóstico de lesiones.
 * Describe qué es, de dónde sale, cómo se calcula y para qué se usa.
 */
export function MetricsExplainer() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-2xl px-5 py-4 sm:px-7 sm:py-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Info className="w-5 h-5 text-neon-blue shrink-0" />
          <span className="font-display text-base font-bold text-white">
            ¿Qué significan estos números?
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-5 space-y-5 text-sm leading-relaxed">
          {/* Veredicto */}
          <section>
            <h4 className="text-neon-blue font-bold text-base mb-1">
              🩺 Veredicto de Riesgo (HEALTHY / LOW_RISK / CRITICAL_RISK)
            </h4>
            <p className="text-gray-200">
              <strong>Qué es:</strong> La clasificación de riesgo de lesión del jugador en los próximos 6 meses.
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Cómo se calcula:</strong> El modelo <code className="text-purple-300">injury_xgboost_model</code> (XGBoost Classifier) 
              recibe 123 variables del jugador — historial de lesiones (frecuencia, días de baja, recurrencia), 
              estadísticas de juego (minutos, partidos, tarjetas), y datos biométricos (edad, posición, liga). 
              Devuelve una probabilidad (0 a 1) que se convierte en: HEALTHY (&lt;30%), LOW_RISK (30-70%), CRITICAL_RISK (&gt;70%).
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Fuente de datos:</strong> Transfermarkt (historial de lesiones) + FBref (stats de juego). 
              Entrenado con 6,888 registros históricos de lesiones (2001-2025). AUC-ROC: 0.63.
            </p>
          </section>

          {/* Fatigue Index */}
          <section>
            <h4 className="text-yellow-400 font-bold text-base mb-1">
              ⚡ Índice de Fatiga (0-100%)
            </h4>
            <p className="text-gray-200">
              <strong>Qué es:</strong> La probabilidad de lesión × 100, expresada como porcentaje. Es el output principal del modelo XGBoost.
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Cómo se usa:</strong> Valores altos (&gt;50%) indican que el jugador debería reducir carga de entrenamiento 
              o ser rotado del siguiente partido. El cuerpo médico lo usa para tomar decisiones de convocatoria.
            </p>
          </section>

          {/* Radar */}
          <section>
            <h4 className="text-green-400 font-bold text-base mb-1">
              📊 Radar de Performance (5 ejes)
            </h4>
            <div className="text-gray-300 space-y-1 mt-1">
              <p><strong className="text-white">Cardio:</strong> min(Playing_Time_90s × 10, 99). Cuántos "90 minutos completos" jugó — más minutos = mejor capacidad cardiovascular demostrada.</p>
              <p><strong className="text-white">Endurance:</strong> Playing_Time_Min%. Porcentaje de minutos disponibles que efectivamente jugó en la temporada.</p>
              <p><strong className="text-white">Engagement:</strong> min(Performance_Int × 5, 99). Intercepciones por partido — mide la participación defensiva activa del jugador.</p>
              <p><strong className="text-white">Respiratory:</strong> max(90 - riesgo × 0.5, 50). Inversamente proporcional al riesgo de lesión.</p>
              <p><strong className="text-white">Recovery:</strong> max(100 - riesgo, 40). Capacidad de recuperación estimada basada en el riesgo general.</p>
            </div>
            <p className="text-gray-400 mt-2 text-xs">
              Los 3 primeros ejes provienen de datos reales de FBref (estadísticas de juego).
              Los 2 últimos son derivados del modelo de riesgo.
            </p>
          </section>

          {/* Physiological metrics */}
          <section>
            <h4 className="text-purple-400 font-bold text-base mb-1">
              🧬 Métricas Fisiológicas (KNN Model)
            </h4>
            <p className="text-gray-200">
              <strong>Modelo:</strong> <code className="text-purple-300">physiological_knn.pkl</code> — K-Nearest Neighbors Regressor (K=15, weights='distance').
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Cómo funciona:</strong> Recibe 3 inputs (edad, BMI, índice de fatiga) y busca los 15 atletas 
              más similares en un dataset de sensores biométricos reales. Devuelve el promedio ponderado de sus 
              métricas fisiológicas:
            </p>
            <div className="text-gray-300 space-y-1 mt-2 ml-4">
              <p><strong className="text-white">Calidad de Sueño (0-100%):</strong> Estimación de la calidad del descanso basada en perfiles similares. Valores bajos (&lt;60%) sugieren acumulación de fatiga.</p>
              <p><strong className="text-white">Hidratación (0-100%):</strong> Nivel de hidratación estimado. Valores &lt;70% incrementan el riesgo de calambres y lesiones musculares.</p>
              <p><strong className="text-white">Temperatura Corporal (°C):</strong> Temperatura basal estimada. Valores &gt;37.5°C pueden indicar proceso inflamatorio activo.</p>
              <p><strong className="text-white">Nivel de Estrés (LOW/MODERATE/HIGH/CRITICAL):</strong> Categorización del estrés fisiológico basada en umbrales empíricos del modelo.</p>
            </div>
            <p className="text-gray-400 mt-2 text-xs">
              Fuente original: dataset multimodal_sports_injury_dataset.csv con registros reales de sensores biométricos de atletas de élite.
            </p>
          </section>

          {/* Training Load */}
          <section>
            <h4 className="text-orange-400 font-bold text-base mb-1">
              🏋️ Carga de Entrenamiento Semanal (valor escalar)
            </h4>
            <p className="text-gray-200">
              <strong>Qué es:</strong> Un valor numérico predicho por el modelo KNN que representa la carga total de entrenamiento 
              semanal estimada para el jugador, en unidades arbitrarias del dataset de sensores.
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Cómo se calcula:</strong> El KNN busca los 15 atletas con edad, BMI y fatiga más similares al jugador 
              analizado y promedia su variable <code className="text-purple-300">training_load</code> ponderada por distancia.
              No se descompone en días individuales porque esa distribución diaria no es predicha por el modelo.
            </p>
          </section>

          {/* Geoclimatic */}
          <section>
            <h4 className="text-blue-400 font-bold text-base mb-1">
              🌍 Contexto Geoclimático
            </h4>
            <p className="text-gray-300">
              <strong>Altitud (m):</strong> Elevación del estadio. A mayor altitud (&gt;1500m), menor presión de oxígeno, 
              lo que reduce el rendimiento aeróbico en jugadores no aclimatados. Dato de <code className="text-purple-300">world_cup_stadiums.csv</code>.
            </p>
            <p className="text-gray-300 mt-1">
              <strong>Temperatura / Precipitación / Viento:</strong> Condiciones climáticas reales obtenidas de la 
              <code className="text-purple-300"> Open-Meteo API</code> usando las coordenadas GPS del estadio y la fecha del partido.
              El calor extremo (&gt;30°C) y la lluvia afectan el riesgo de lesiones musculares.
            </p>
          </section>

          {/* Summary */}
          <section className="border-t border-white/10 pt-4">
            <p className="text-gray-400 text-xs">
              <strong>Nota metodológica:</strong> Las métricas fisiológicas son estimaciones del modelo KNN, no mediciones directas de sensores. 
              Su precisión depende de la similitud entre el jugador analizado y los atletas del dataset de entrenamiento. 
              El radar y el fatigue index provienen del modelo XGBoost de lesiones que tiene un AUC-ROC de 0.63 
              (comparable a la literatura académica en predicción de lesiones deportivas).
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
