# Guía de Reproducibilidad y Arquitectura - World Cup AI Platform

Esta guía está diseñada para explicar de forma coloquial pero exhaustiva **qué hicimos, cómo lo hicimos, y por qué lo hicimos**, desde el Día 1 (Fase 1) hasta el Día 10 (Fase 10).

---

## 📂 ¿Qué archivos deberías llevarte si quieres integrar esto en otro lado?
Si quieres llevarte este proyecto a otra computadora o empresa, solo necesitas llevarte la carpeta raíz `world_cup_scraper`, pero los archivos **más críticos** que contienen la "inteligencia" final son:
1. **La carpeta `models/pkl/`**: Aquí viven los cerebros pre-entrenados (XGBoost, K-Means). Son archivos `.pkl`. Sin ellos, no hay IA.
2. **Los CSVs finales (`data/4_featured/`)**: Principalmente `master_players_enriched.csv` (contiene todo el perfil de los jugadores) y `master_matches_weather.csv` (partidos con clima).
3. **El backend (`app/backend/main.py`)**: Aquí está la lógica que conecta los CSVs y los `.pkl` con el usuario a través de una API.
4. **El frontend (`app/frontend/`)**: La interfaz gráfica de usuario.

---

## 🛠️ Explicación Paso a Paso (El Pipeline)

### Fases 1 y 2: Ingestión y Limpieza (Data Ingestion & Cleaning)
* **El Problema:** Teníamos datos de goles y minutos jugados de la página *FBREF*, datos de lesiones clínicas de *Kaggle* (`all_countries_injuries.csv`), y listas de estadios (`world_cup_stadiums.csv`). Todos venían de páginas diferentes, con nombres diferentes (ej. "Lionel Messi" vs "L. Messi").
* **Qué hicimos:** Creamos scripts en la carpeta `scripts/1_scraping/` y `scripts/2_cleaning/`.
* **Cómo lo combinamos:** Usamos `pandas` en Python. Para unir los nombres escritos distinto, usamos la librería `difflib` (Fuzzy Matching), que calcula matemáticamente qué tan parecido es un nombre a otro.
* **Archivos generados:** Todos los CSVs limpios se guardaron en `data/2_cleaned/` y luego se unieron en "Masters" en `data/3_master/` (ej. `master_players.csv`).

### Fase 3: Feature Engineering (Creación de Variables)
* **El Problema:** La IA no entiende si un jugador es bueno solo viendo que metió "5 goles". Necesita contexto histórico y tendencias.
* **Qué hicimos (Variables creadas):**
  - **Tácticas:** `xg_overperformance` (Goles menos Goles Esperados). Si es positivo, el jugador es letal.
  - **Racha:** `form_last_5` (Puntos ganados en los últimos 5 partidos).
  - **Médicas:** `injury_count_last_12m` (Cuántas lesiones tuvo en el último año).
* **Archivos generados:** Se guardaron en `data/4_featured/` (ej. `master_players_featured.csv`).

### Fase 4 y 5: Perfilamiento y Modelado (Machine Learning)
Aquí elegimos los algoritmos "cerebros".

#### 1. Perfilado de Jugadores (Player Profiling)
* **Hipótesis:** La posición oficial de un jugador ("Mediocampista") es muy genérica. Hay mediocampistas defensivos y creadores de juego.
* **Algoritmo elegido:** **K-Means Clustering** + **PCA** (Análisis de Componentes Principales).
* **Por qué:** K-Means agrupa automáticamente a los jugadores por sus similitudes estadísticas sin que le digamos su posición. PCA comprime las variables para que el modelo no se confunda.
* **Resultado:** Descubrimos 5 "Clústeres" o Roles de IA reales.

#### 2. Predicción de Partidos y Riesgo de Lesiones
* **Target (Objetivo a predecir):** Para partidos: "Ganar, Empatar o Perder". Para lesiones: "Probabilidad de lesión en los próximos 6 meses".
* **Algoritmo elegido:** **XGBoost** (Extreme Gradient Boosting).
* **Por qué XGBoost:** Es el rey actual de los datos tabulares (tablas de Excel/CSV). Maneja de forma excelente valores extremos (como los datos anormales de Mbappé o Messi) y entiende relaciones "No Lineales".
* **Desventajas de XGBoost:** Es una "caja negra" (cuesta entender por qué tomó una decisión). Para solucionarlo, en la **Fase 6** usamos **SHAP values**, que destripan el modelo y explican qué variables empujaron la predicción hacia arriba o hacia abajo.

### Fase 7: Optimizador de Plantillas (Squad Builder)
* **El Problema:** El entrenador necesita elegir 26 jugadores para el mundial que maximicen el impacto total, pero cumpliendo reglas (máximo 3 arqueros, mínimo 8 defensas, etc.).
* **Algoritmo:** Programación Lineal (`PuLP`).
* **Cómo funcionó:** Le dimos la orden al algoritmo de maximizar el `Impact_Score` de la suma de 26 jugadores, penalizando/prohibiendo a los jugadores con alto riesgo de lesión.

### Fase 8: El Dashboard y Despliegue
* **Qué hicimos:** Programamos un Backend en `FastAPI` (Python) y un Frontend interactivo en HTML/CSS/JS. El frontend le manda preguntas al backend (ej. "Alinea al equipo de Brasil"), el backend usa los `.pkl` guardados en la Fase 5, calcula en milisegundos y le devuelve la respuesta a la pantalla.

### Fase 9: Inyección de FIFA 22 y Biometría
* **El Problema:** FBREF solo tiene estadísticas genéricas (pases, tiros). Queríamos atributos reales de *Scouting* (Velocidad Sprint, Visión).
* **Qué hicimos:** Tomamos el dataset `players_22.csv` (del videojuego EA Sports FIFA 22), que tiene atributos creados por miles de ojeadores reales en todo el mundo.
* **Combinación:** Volvimos a usar Fuzzy Matching y creamos `master_players_enriched.csv` en `data/4_featured/`. 
* **Resultado:** Al re-entrenar XGBoost, descubrimos que atributos como `Vision` y `Positioning` (Posicionamiento) explican mejor la calidad de un jugador que sus simples goles por partido.

### Fase 10: La Hipótesis Climática
* **El Problema/Hipótesis:** Creíamos que el Clima actúa como un "Nivelador". Es decir, si llueve mucho o hay viento, un equipo chico tiene más chances de empatarle a un equipo grande porque se cometen más errores.
* **Qué hicimos:** Usamos la API de `Open-Meteo`. Geolocalizamos en qué ciudad se jugó cada uno de los 800+ partidos históricos y descargamos el clima exacto (Temperatura, Viento, Lluvia) que hubo ese día.
* **Archivos:** Se generó `historical_weather.csv` en `data/1_raw/` y se fusionó en `master_matches_weather.csv`.
* **Conclusiones:** ¡La hipótesis era correcta! Al re-entrenar XGBoost, la Precipitación (Lluvia) se convirtió en la 3ra variable matemática más importante para adivinar el resultado de un partido (8% de peso en la decisión total), superando la racha de partidos ganados recientemente.

---

## 📝 Resumen de Conclusiones Finales
1. Las estadísticas tradicionales no bastan. Agrupar jugadores por comportamiento de IA (Clústeres) y medir su Impacto + Riesgo de Lesión crea un equipo matemáticamente más robusto.
2. El sueño y el estrés (datos biométricos de la Fase 9) predicen roturas musculares mucho mejor que la carga de entrenamiento.
3. El clima altera fundamentalmente los partidos; ignorar si llovió en un partido histórico contamina las predicciones.
4. El pipeline modular permitió conectar Python (Limpieza y Modelado) con un Dashboard web ágil que la directiva técnica puede usar sin saber programar.
