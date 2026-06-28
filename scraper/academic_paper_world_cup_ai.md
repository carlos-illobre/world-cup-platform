# End-to-End Artificial Intelligence Architecture for Football Analytics: From Raw Data to Tactical and Medical Predictions

## 1. Abstract e Introducción
**Objetivo del Proyecto:** Desarrollar una plataforma integral de inteligencia artificial aplicada al fútbol de élite (enfocado en el Mundial 2026), capaz de perfilar jugadores tácticamente, optimizar convocatorias, predecir el riesgo de lesiones y simular resultados de partidos bajo diversas condiciones exógenas (clima).

**Público Objetivo:** Este documento detalla el pipeline completo paso a paso, diseñado para que científicos de datos e ingenieros de machine learning puedan comprender, reproducir y escalar la arquitectura.

---

## 2. Fase de Ingestión y Limpieza de Datos (Data Pipeline)
El mayor desafío en *Sports Analytics* es la fragmentación de los datos. El pipeline fue diseñado para unificar fuentes dispares:

### 2.1 Fuentes de Datos
1. **FBREF (Vía Web Scraping):** Estadísticas de rendimiento en el campo (Goles, xG, Pases Progresivos, Minutos jugados).
2. **Kaggle / Bases de Datos Clínicas:** Historial de lesiones macro (días de baja) y micro (dataset multimodal biométrico por sesión).
3. **APIs Externas:** 
   - **Transfermarkt (Mock/Proxy):** Valores de mercado.
   - **FIFA:** Rankings históricos y puntuación Elo.
   - **EA Sports FIFA 22:** Más de 40 atributos granulares de *scouting* (OVR, PAC, SHO).
   - **Open-Meteo:** API de clima histórico.

### 2.2 Estrategia de Unificación y Limpieza
El proceso de unificación (Merge) no se realizó mediante bases de datos relacionales tradicionales, sino mediante *Dataframes* secuenciales en Python (Pandas) debido a la asimetría de las llaves primarias:
- **Cruce de Jugadores:** Se enfrentó el problema de múltiples convenciones de nombres (ej. "L. Messi" vs "Lionel Andrés Messi"). Se implementó **Fuzzy Matching** (Algoritmos de Distancia de Levenshtein vía `difflib`) con un fallback geo-referenciado por `Nationality` para evitar colisiones homónimas.
- **Cruce de Partidos:** Los registros de partidos de FBREF solo indicaban si era "Home/Away/Neutral". Para geolocalizar y extraer el clima (Fase 10), se usó una **Heurística de Proxy Host**, asumiendo la capital del país local como coordenada para cruzar con la API de Open-Meteo.
- **Imputación de Nulos:** Se utilizaron estrategias de imputación basadas en la mediana por posición (ej. llenar la velocidad de un delantero faltante con la velocidad mediana de todos los delanteros) para no distorsionar la varianza del modelo.

---

## 3. Ingeniería de Características (Feature Engineering)
Para que los algoritmos pudieran predecir el futuro, transformamos datos estáticos en métricas dinámicas (Time-Series Proxies):

- **Variables Tácticas:** Se crearon métricas como `xg_overperformance` (Goles Reales - Goles Esperados) y `minutes_per_goal` para medir la letalidad.
- **Variables de Racha (Momentum):** `form_last_5` (puntos en los últimos 5 partidos) y promedios móviles de goles concedidos/anotados.
- **Variables Médicas:** `injury_count_last_12m` (conteo de lesiones rodante) y `avg_recovery_time`.

---

## 4. Selección de Algoritmos y Modelado

El proyecto se dividió en 5 modelos independientes que se retroalimentan entre sí:

### 4.1 Player Profiling (Aprendizaje No Supervisado)
- **Algoritmo:** K-Means Clustering + PCA.
- **Por qué:** Necesitábamos agrupar jugadores por su estilo de juego, no por su posición nominal. PCA redujo la dimensionalidad de 30+ variables tácticas para evitar la "maldición de la dimensionalidad".
- **Resultado:** Se descubrieron 5 clústeres claros (ej. Creadores de Juego, Destructores Defensivos, Finalizadores Puros).

### 4.2 Impact Score & Scouting Predictor (Regresión)
- **Algoritmo:** XGBoost Regressor.
- **Por qué:** XGBoost maneja nativamente la no-linealidad y los valores atípicos (outliers como Messi o Mbappé), además de ser robusto ante la multicolinealidad inherente en los datos de fútbol (ej. goles y tiros a puerta están altamente correlacionados).
- **Atributos Clave:** Al inyectar la base de datos de FIFA (Fase 9), atributos granulares como `Positioning`, `Vision` y `Sprint Speed` dominaron la importancia del modelo sobre las estadísticas de volumen tradicionales.

### 4.3 Injury Risk Predictor (Clasificación)
- **Algoritmo:** XGBoost Classifier con `scale_pos_weight`.
- **Por qué:** El dataset de lesiones estaba altamente desbalanceado (la mayoría de los jugadores no se lesionan en una ventana de 6 meses). Se penalizó fuertemente a la clase mayoritaria.
- **Variante Micro (Sesión):** Se entrenó un segundo modelo con datos multimodales biométricos.
- **Conclusión Clínica:** El algoritmo demostró que la **Calidad del Sueño (`recovery_score`)** y el **Estrés (`stress_level`)** predicen mejor una rotura muscular que la Carga Física bruta (`training_load`).

### 4.4 Match Outcome Predictor con Clima (Clasificación Multiclase)
- **Algoritmo:** XGBoost Classifier (Win, Draw, Loss).
- **La Hipótesis Climática:** El clima actúa como un "nivelador" táctico.
- **Resultados:** Al inyectar la API de Open-Meteo (Fase 10), la **Precipitación** y la **Velocidad del Viento** se colocaron en el Top 5 de variables más importantes (superando a la racha de victorias recientes). Los climas extremos reducen la brecha técnica y aumentan las probabilidades del equipo no favorito (Underdog) o del empate.

### 4.5 Optimizador de Plantillas (Linear Programming)
- **Algoritmo:** PuLP (Programación Lineal).
- **Por qué:** La selección de una plantilla de 26 jugadores es un problema de optimización combinatoria clásica (Problema de la Mochila/Knapsack).
- **Función Objetivo:** Maximizar la sumatoria del `Impact_Score` de la plantilla.
- **Restricciones:** Límites posicionales exactos (ej. 3 Arqueros, 8 Defensas) y una penalización algorítmica: excluir a cualquier jugador con un `Injury_Risk` mayor al 60%.

---

## 5. Interpretabilidad (XAI - Explainable AI)
Para generar confianza en el cuerpo técnico, los modelos de "caja negra" fueron diseccionados utilizando **Valores SHAP (SHapley Additive exPlanations)**.
- Se generaron gráficos de *Summary Plots* y *Dependence Plots* que permiten a los entrenadores ver matemáticamente por qué el modelo predice que un equipo perderá o por qué un jugador tiene alto riesgo de lesión (explicabilidad local y global).

---

## 6. Despliegue y Arquitectura de Software
- **Backend:** FastAPI (Python). Elegido por su velocidad, soporte asíncrono y capacidad para cargar en memoria los archivos `.pkl` (Pickle) de los modelos XGBoost entrenados para inferencia en tiempo real.
- **Frontend:** Vanilla JS, HTML y CSS con diseño "Glassmorphism". Arquitectura sin dependencias (Serverless/Framework-less en el front) para máxima portabilidad y baja latencia.

## 7. Conclusiones
El pipeline demuestra cómo la agregación de datos no convencionales (clima, biometría, atributos de videojuegos proxy) supera con creces a los modelos basados puramente en estadísticas de tabla de posiciones. La arquitectura es un framework modular que permite reemplazar cualquier componente (ej. cambiar XGBoost por Redes Neuronales) sin quebrar el flujo de datos.
