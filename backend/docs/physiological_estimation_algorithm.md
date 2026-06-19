# Algoritmo de Estimación Fisiológica (ML)

## Resumen Ejecutivo

Para proveer métricas biométricas detalladas en el panel fisiológico del **World Cup AI Dashboard** sin recurrir a datos simulados o variables fijas (mocks), hemos implementado un algoritmo de predicción basado en Ciencia de Datos. El modelo emplea **K-Nearest Neighbors (KNN)** para estimar las constantes vitales del jugador basándose en perfiles históricamente similares.

## Fuentes de Datos

Los datos utilizados para entrenar el modelo provienen del dataset propietario `multimodal_sports_injury_dataset.csv` (parte del proyecto original *World Cup Scraper*). Esta base de datos cuenta con registros reales de sensores biométricos aplicados a jugadores de fútbol, incluyendo:
- `sleep_quality` (Calidad de sueño, 0-100)
- `hydration_level` (Nivel de hidratación, 0-100)
- `body_temperature` (Temperatura basal corporal, °C)
- `stress_level` (Nivel de estrés fisiológico)
- `training_load` (Carga de entrenamiento semanal)

## Metodología del Algoritmo Predictivo

Dado un jugador específico en la aplicación, normalmente sólo conocemos su **Edad**, su **IMC (Índice de Masa Corporal)** y su **Riesgo Histórico de Lesión (Fatigue Index)** calculado a partir de la frecuencia y severidad de lesiones pasadas. 

Para derivar sus métricas fisiológicas actuales, hemos implementado el siguiente flujo de Machine Learning:

1. **Preprocesamiento y Escalamiento**: 
   Se utiliza un `StandardScaler` de la librería `scikit-learn` para normalizar las tres variables de entrada (`age`, `bmi`, `fatigue_index`) de forma que una métrica no domine sobre la otra en el cálculo euclidiano.

2. **K-Nearest Neighbors Regressor (KNN)**:
   Utilizamos el algoritmo de regresión KNN para encontrar a los $K=15$ "deportistas más parecidos" dentro del dataset original. 
   - El peso de cada vecino se calcula por distancia (`weights='distance'`), lo que significa que los historiales de jugadores que tengan una edad, complexión y nivel de fatiga *casi idénticos* al jugador analizado influirán más fuertemente en el resultado.

3. **Inferencia**:
   El modelo calcula el promedio ponderado de la calidad de sueño, temperatura y nivel de hidratación de los 15 "vecinos" y los devuelve como el panorama fisiológico actual estimado para el jugador.

4. **Categorización de Estrés**:
   La salida continua de la regresión para el nivel de estrés se mapea al sistema categórico esperado por el frontend de React (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`) utilizando umbrales probabilísticos.

## Serialización y Carga

El modelo fue entrenado previamente en un proceso offline y serializado usando `joblib` bajo el formato `.pkl` en el directorio `backend/data/models/physiological_knn.pkl`.
Durante el `lifespan` startup event de la aplicación **FastAPI**, este modelo se carga a memoria (`app.state.models['physiological_knn']`), permitiendo realizar las inferencias vectoriales en milisegundos cuando un usuario hace click en un jugador en el dashboard.
