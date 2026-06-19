# Arquitectura del Proyecto: World Cup AI

Este documento describe la estructura y el funcionamiento del nuevo sistema `world-cup`, producto de la fusión de la plataforma analítica (`world-cup-platform`) con los modelos y datos avanzados (`world_cup_scraper`).

## 📁 Estructura de Directorios

El proyecto sigue una arquitectura orientada a microservicios (Backend y Frontend desacoplados) orquestada con Docker.

```
world-cup/
├── backend/            # API REST desarrollada en FastAPI
├── dashboard/          # Frontend desarrollado en React (Vite)
├── traefik/            # Configuración del proxy inverso Traefik
├── docker-compose.yml  # Orquestador de contenedores
└── .env                # Variables de entorno
```

---

## 🖥️ Backend (`/backend`)

El backend expone la inteligencia artificial mediante una API RESTful limpia (v1), sirviendo predicciones en tiempo real usando modelos pre-entrenados (XGBoost). No realiza reentrenamiento, lo que garantiza tiempos de respuesta mínimos.

- **`Dockerfile` & `requirements.txt`**: Definen el entorno de ejecución (Python 3.12) y las dependencias clave (`fastapi`, `xgboost`, `pandas`, `scikit-learn`).
- **`app/main.py`**: El punto de entrada de la aplicación.
  - *Función principal*: En su evento `lifespan`, carga los modelos `.pkl` pesados a memoria (RAM) y los datasets `.csv` estáticos. Almacenarlos en memoria permite que la API consulte predicciones en milisegundos sin latencia de disco.
- **`app/api/v1/router.py`**: Agrupa y define los prefijos de las diferentes entidades REST.
- **`app/api/v1/endpoints/`**:
  - `players.py`: Implementa `/api/v1/players`. Filtra el dataset de jugadores y devuelve sus atributos FIFA, clúster táctico e `ImpactScore`. Es el motor de la pestaña de *Scouting*.
  - `squads.py`: Implementa `/api/v1/squads/{country}`. Devuelve una lista optimizada de 26 jugadores para una selección nacional, considerando el riesgo de lesión y el impacto (Programación Lineal).
  - `matches.py`: Implementa `/api/v1/matches/predictions`. Recibe dos equipos y variables climáticas, ejecutando el modelo XGBoost (`match_outcome_weather_xgb.pkl`) para calcular las probabilidades de victoria.
  - `injuries.py`: Implementa `/api/v1/injuries/risk/{player_id}`. Emite un diagnóstico de riesgo de lesión para alimentar el dashboard principal.

- **`data/models/`**: Contiene los archivos `.pkl` (modelos de Machine Learning ya entrenados).
- **`data/csv/`**: Contiene los datasets procesados y enriquecidos (`master_players_enriched.csv`, etc.).

---

## 🎨 Frontend (`/dashboard`)

Es una aplicación de una sola página (SPA) construida con React, Vite y TanStack Router. Utiliza TailwindCSS para el estilado y efectos de *Glassmorphism* (paneles semitransparentes).

- **`src/shared/components/AppHeader.tsx`**: Contiene la barra de navegación "Fixar Analytics". Se modificó para inyectar el sistema de pestañas (`<Link>`), permitiendo al usuario moverse entre las diferentes capacidades de la IA.
- **`src/router.tsx` & `src/routes/`**: Controlan el enrutamiento de la aplicación (URL a Componente). Hemos añadido las nuevas rutas para *Scouting*, *Predicción* y *Optimizador*.
- **`src/pages/`**:
  - `InjuryRiskPage.tsx`: La página original que muestra el dashboard médico y de altitud.
  - `ScoutingPage.tsx`: Una interfaz con barra de búsqueda para explorar la base de datos de jugadores, revelando métricas avanzadas que no son evidentes (ej. en qué clúster táctico caen).
  - `MatchPredictionPage.tsx`: Un simulador interactivo donde el usuario cruza dos países e ingresa condiciones climáticas (lluvia, viento) para ver cómo el algoritmo XGBoost recalcula las probabilidades dinámicamente.
  - `SquadOptimizerPage.tsx`: Permite visualizar cómo la IA armó matemáticamente la lista de convocados ideal para cada país.

## 🚀 Infraestructura (`docker-compose.yml`)

- **`backend`**: Ejecuta la API de FastAPI en el puerto 8000.
- **`dashboard`**: Ejecuta el servidor de Vite en el puerto 3000.
- **`traefik`**: Un proxy inverso moderno que expone estos servicios al exterior y rutea el tráfico automáticamente. 

## 🧠 Flujo de Datos

1. El usuario interactúa con una de las pestañas en el `dashboard`.
2. El componente React hace un `fetch` hacia el endpoint correspondiente en `backend/app/api/v1/...`.
3. FastAPI toma la petición, extrae los datos del dataset en memoria de Pandas, o le pasa el input a la función `predict_proba()` de XGBoost.
4. FastAPI serializa el resultado a JSON y lo devuelve.
5. El frontend renderiza la respuesta manteniendo la estética *Neon/Dark Mode*.
