# World Cup 2026 - Data Science Project Documentation

**Target Audience:** Data Scientists / Machine Learning Engineers  
**Project Scope:** End-to-End Data Pipeline, Feature Engineering, Unsupervised/Supervised Learning, and Linear Optimization for Football Analytics.

---

## 1. Introducción y Arquitectura de Datos

Este proyecto es una tubería (pipeline) de ciencia de datos de principio a fin, diseñada para analizar el rendimiento de jugadores, predecir resultados de partidos y optimizar la selección de plantillas para un torneo internacional (Copa del Mundo).

### Estructura del Data Lake
Los datos se organizaron semánticamente para mantener la inmutabilidad de los crudos y la reproducibilidad:
- `data/1_raw/`: Archivos base obtenidos mediante web scraping (Transfermarkt, FIFA, etc.).
- `data/2_cleaned/`: Datos con tipos corregidos y normalizados.
- `data/3_master/`: Tablas de hechos principales unidas mediante llaves compuestas.
- `data/4_featured/`: Matrices de características (Feature Matrices) listas para algoritmos de ML.

### Cómo utilizar los datos preparados
Para cualquier experimentación futura de Machine Learning, el científico de datos debe consumir **exclusivamente** los archivos de la carpeta `data/4_featured/`. 
- `master_matches_featured.csv`: Para predecir variables a nivel de equipo/partido.
- `master_players_clustered.csv` / `X_players.csv`: Para regresión de rendimiento individual o análisis táctico.

---

## 2. Limpieza y Unificación (Fases 1 y 2)

**Hipótesis de Integración:** La identidad de un jugador o equipo en diferentes portales web puede variar (ej. "dz Algeria" vs "Algeria"). La normalización de cadenas y el emparejamiento estricto por `(Player, Country)` o `(Country, Date)` era fundamental.

**Decisiones de Ingeniería:**
1. **Manejo de Valores Nulos:** En las estadísticas de ligas menores (`all_competitions`), muchos valores estaban vacíos. En lugar de imputarlos prematuramente con la media, se rellenaron temporalmente con 0 para "stats de conteo" y se dejaron nulos en "stats de ratios" hasta la etapa de feature engineering.
2. **Enriquecimiento (Scraping):** Se identificó que las estadísticas de juego no eran suficientes para explicar los resultados del partido. Se escribieron scrapers adicionales para inyectar:
   - **FIFA Rankings:** Para tener un proxy cuantitativo de la fuerza de una selección.
   - **Market Values:** (Transfermarkt) Para cuantificar la jerarquía individual.

---

## 3. Feature Engineering (Fase 3)

Se crearon variables derivadas basándose en el conocimiento de dominio del fútbol (Football Analytics).

**Características Creadas:**
- **Momentum (Equipos)**: Variables en ventana de tiempo móvil (Rolling Windows). `form_last_5` (puntos en los últimos 5 partidos) y `goals_scored_last_5`. 
  - *Hipótesis*: El fútbol tiene un fuerte componente psicológico y de inercia ("estar en racha").
- **Diferencial de Calidad**: `ranking_diff` entre Country y Opponent.
- **Riesgo Clínico**: `injury_count_last_12m` y `avg_recovery_time`. 
  - *Hipótesis*: El mejor predictor de una rotura fibrilar o lesión recurrente es el historial médico a corto/mediano plazo, más que la edad.
- **Impacto del Jugador**: Se consolidó un `impact_score_raw` basado en aportes de Goles/Asistencias por 90 minutos y métricas de On/Off (si estaban disponibles).

---

## 4. Análisis Exploratorio (Fase 4)

- **Multicolinealidad**: La matriz de correlación demostró alta colinealidad (Pearson > 0.8) entre métricas ofensivas (ej. Tiros al arco y Goles Esperados `xG`). Esto motivó el uso de modelos basados en árboles (XGBoost), los cuales son robustos frente a características correlacionadas.
- **Outliers**: Se encontraron valores atípicos severos en la eficiencia goleadora, correspondiendo a defensores que anotaron en su único tiro al arco. 

---

## 5. Modelado Predictivo - Targets Principales (Fase 5)

Se entrenaron algoritmos de Gradient Boosting (`xgboost`) por su capacidad para manejar relaciones no lineales y datos tabulares dispersos.

### 5.1 Injury Risk Score (Clasificación / Supervivencia)
- **Target**: `will_be_injured_next_6months`.
- **Decisión**: Se utilizó un enfoque temporal estricto (Split cronológico) para evitar el "Data Leakage" (fuga de datos del futuro al pasado). 
- **Resultados**: AUC-ROC ~0.62-0.63. El análisis de explicabilidad (SHAP) validó que los "Días de baja históricos" impulsan fuertemente el riesgo.

### 5.2 Match Outcome Prediction (Clasificación Multiclase)
- **Target**: `Result` (Victoria, Empate, Derrota).
- **Decisión**: Se priorizó `Log Loss` como métrica de evaluación por encima del Accuracy, dado que en apuestas o analítica probabilística nos interesa la certidumbre de las probabilidades (`predict_proba`).
- **Resultados**: Accuracy del 50% (Baseline de bosque aleatorio sobre-ajustaba). El modelo predecía victorias de favoritos con un 68% de precisión. Los empates probaron ser estocásticamente difíciles de atrapar (como en la bibliografía científica).

### 5.3 Player Impact Score (Regresión)
- **Target**: `impact_score_normalized`.
- **Decisión**: Predecir el impacto de un jugador en base a factores externos (Edad, Posición, Liga, Experiencia). Útil para scouting de "perfiles tapados".

---

## 6. Clustering y Optimización (Fase 6)

### 6.1 Perfiles Tácticos (Unsupervised Learning)
- **Método**: PCA (para reducir dimensionalidad) + K-Means (k=6 optimizado por el método del Codo y Silhouette Score).
- **Hipótesis**: La posición de un jugador ("Mediocampista") es demasiado genérica.
- **Resultados**: El algoritmo descubrió de forma agnóstica perfiles reales (ej. "Destructor", "Creador", "Carrilero").

### 6.2 Squad Optimization (Investigación de Operaciones)
- **Método**: Programación Lineal Entera Mixta (Librería `Pulp`).
- **Función Objetivo**: Maximizar la suma ponderada del `impact_score` de 26 jugadores.
- **Restricciones**: Selección obligatoria de exactamente 3 Arqueros, y mínimos rigurosos de Defensores (7), Medios (6) y Delanteros (5).
- **Penalización**: Se restaron 5 puntos por cada lesión histórica. 
- **Impacto**: Un algoritmo perfecto para Entrenadores Nacionales, garantizando plantillas competitivas sin "jugadores de cristal".

---

## 7. Despliegue de Arquitectura (Fase 8)

**Toma de Decisiones de Arquitectura de Software:**
En lugar de depender de ecosistemas complejos y propensos a conflictos en Windows (como React/NodeJS), se optó por una separación de responsabilidades limpia:
1. **Backend API (FastAPI)**: Código Python que carga los `.pkl` entrenados en RAM y expone endpoints de inferencia rápida (`/api/squad`, `/api/predict_match`).
2. **Frontend SPA**: Vanilla JavaScript y CSS moderno puro (*Glassmorphism*). Llama asíncronamente a FastAPI. Cero tiempos de compilación.

---

## Resumen para Nuevos Científicos de Datos
1. Si quieres **retrenar un modelo**, modifica los scripts en `scripts/5_modeling/` y los `.pkl` se actualizarán en la carpeta `models/pkl/`.
2. Si descubres **nuevos features**, añádelos en `scripts/3_feature_eng/` y re-ejecuta desde allí.
3. El frontend de la aplicación web se nutre en tiempo real de estas predicciones, garantizando un ciclo de vida MLOps continuo.
