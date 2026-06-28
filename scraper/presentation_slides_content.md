# Prompts e Índice para Presentación en NotebookLM (PPT)

*Pásale el documento `academic_paper_world_cup_ai.md` a NotebookLM junto con este prompt para generar la presentación en PowerPoint.*

## Prompt Maestro para NotebookLM
> "Eres un Data Scientist Senior preparando una presentación para el directorio técnico de un club de élite. Utilizando el documento base proporcionado, genera el contenido para una presentación de PowerPoint de 8 diapositivas. Para cada diapositiva, especifica el 'Título', los 'Bullet points principales', y las 'Notas del orador' (lo que diré en voz alta para explicar los conceptos técnicos de forma didáctica). El foco de la presentación debe estar en el pipeline de datos, la hipótesis climática y los resultados."

---

## Estructura de Diapositivas Sugerida (PPT Outline)

### Slide 1: Título y Objetivo
- **Título:** AI Football Analytics: Predicción de Partidos y Riesgo de Lesiones.
- **Puntos Clave:** 
  - Objetivo: Ir más allá del scouting tradicional usando Machine Learning.
  - Alcance: Optimización de plantillas, predicción de lesiones y simulación climática.

### Slide 2: El Desafío de los Datos (Data Ingestion)
- **Título:** Ingestión de Datos: Rompiendo Silos.
- **Puntos Clave:** 
  - Fragmentación masiva: FBREF, Kaggle, Transfermarkt, Open-Meteo, EA Sports FIFA.
  - El problema de las llaves primarias asimétricas.

### Slide 3: Construcción del Pipeline (Merge & Clean)
- **Título:** Limpieza y Fusión: Uniendo los Puntos.
- **Puntos Clave:** 
  - Resolución de Nombres: Algoritmos de *Fuzzy Matching* (Distancia de Levenshtein).
  - Proxy Espacial: Uso de capitales nacionales para geolocalizar partidos neutrales.
  - Imputación inteligente de nulos (Mediana posicional).

### Slide 4: Ingeniería de Características (Feature Engineering)
- **Título:** De Datos Estáticos a Proxies Dinámicos.
- **Puntos Clave:** 
  - Táctica: `xg_overperformance`.
  - Momentum: Promedios móviles a 5 partidos (`form_last_5`).
  - Biometría: Días de baja y carga acumulada en 12 meses.

### Slide 5: Selección de Algoritmos
- **Título:** El Cerebro del Sistema: Modelos ML.
- **Puntos Clave:** 
  - *Clustering:* K-Means + PCA para perfiles de juego.
  - *Predicción (Lesiones y Partidos):* XGBoost (robusto a outliers y colinealidad).
  - *Optimización:* Programación Lineal (PuLP) para armar plantillas.

### Slide 6: Integración Biométrica y de Scouting
- **Título:** Expansión del Modelo: FIFA y Biometría.
- **Puntos Clave:** 
  - Inyección de 40 atributos granulares de scouting (Pace, Vision).
  - Descubrimiento Clínico: El sueño (`recovery_score`) predice lesiones mejor que la carga física.

### Slide 7: La Hipótesis Climática (Fase 10)
- **Título:** El Factor Clima: Simulando el Entorno.
- **Puntos Clave:** 
  - Extracción de APIs (Open-Meteo).
  - Resultado: La lluvia y el viento entraron al Top 5 de importancia (SHAP values).
  - Conclusión: El clima severo actúa como "nivelador" a favor de los empates o el Underdog.

### Slide 8: Conclusiones
- **Título:** Conclusiones y Futuro.
- **Puntos Clave:** 
  - Framework modular y escalable.
  - La XAI (Explicabilidad) asegura que los entrenadores confíen en el modelo.
