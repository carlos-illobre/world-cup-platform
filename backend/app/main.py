from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import joblib
import pandas as pd
import numpy as np
import os
import time
from app.api.v1.router import api_v1_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración global para almacenar modelos y datos
class AppState:
    models = {}
    data = {}
    # Pre-computed caches (built at startup, served instantly)
    cache = {}

state = AppState()


def _time_it(label: str):
    """Context-manager-like helper for timing startup steps."""
    class Timer:
        def __init__(self, label):
            self.label = label
            self.start = time.perf_counter()
        def done(self):
            elapsed = (time.perf_counter() - self.start) * 1000
            logger.info(f"  ✓ {self.label} ({elapsed:.0f}ms)")
            return elapsed
    return Timer(label)


@asynccontextmanager
async def lifespan(app: FastAPI):
    total_start = time.perf_counter()

    # ===== FASE 1: Cargar Modelos =====
    model_files = {
        'injury':          'data/models/injury_xgboost_model.pkl',
        'injury_logistic': 'data/models/injury_logistic_model.pkl',
        'match_outcome':   'data/models/match_outcome_xgb.pkl',
        'match_weather':   'data/models/match_outcome_weather_xgb.pkl',
        'physiological_knn': 'data/models/physiological_knn.pkl',
        'player_impact':   'data/models/player_impact_xgb_enriched.pkl',
        'team_points':     'data/models/team_points_xgb_model.pkl',
        'formation':       'data/models/formation_xgb_model.pkl',
        'micro_injury':    'data/models/micro_injury_xgb.pkl',
        'xg_overperf':     'data/models/xg_overperformance_xgb_model.pkl',
    }
    logger.info("═══ FASE 1: Cargando modelos ML ═══")
    t = _time_it("Todos los modelos")
    for name, path in model_files.items():
        try:
            state.models[name] = joblib.load(path)
        except Exception as e:
            logger.warning(f"  ✗ {name}: {e}")
    t.done()
    logger.info(f"  → {len(state.models)} modelos cargados en RAM")
        
    # ===== FASE 2: Cargar Datasets CSV =====
    csv_files = {
        'players':          ('data/csv/master_players_enriched.csv',    {'low_memory': False}),
        'matches_featured': ('data/csv/master_matches_featured.csv',    {}),
        'injuries':         ('data/csv/master_injuries_featured.csv',   {'low_memory': False}),
        'teams_featured':   ('data/csv/master_teams_featured.csv',      {}),
        'world_cup_matches':('data/csv/world_cup_matches.csv',          {}),
        'wc_groups':        ('data/csv/world_cup_2026_groups.csv',      {}),
    }
    logger.info("═══ FASE 2: Cargando datasets CSV ═══")
    t = _time_it("Todos los CSVs")
    for name, (path, kwargs) in csv_files.items():
        try:
            state.data[name] = pd.read_csv(path, **kwargs)
        except Exception as e:
            logger.warning(f"  ✗ {name}: {e}")
    t.done()

    # CSVs con índice especial
    try:
        state.data['world_cup_teams'] = pd.read_csv('data/csv/world_cup_teams.csv').set_index("id")
        state.data['stadium_mapping'] = pd.read_csv('data/csv/stadium_mapping.csv').set_index("stadium_id")
        # Rich stadium data with coordinates
        state.data['stadiums_geo'] = pd.read_csv('data/csv/world_cup_stadiums.csv').set_index("ID")
    except Exception as e:
        logger.warning(f"  ✗ world_cup_teams/stadium_mapping: {e}")

    # ===== FASE 3: Construir índices y caches =====
    logger.info("═══ FASE 3: Pre-computando índices y caches ═══")

    players_df = state.data.get('players', pd.DataFrame())
    if not players_df.empty:
        # 3a. Photo URL mapping
        t = _time_it("Photo URL mapping (1186 imágenes)")
        players_df['player_id'] = players_df.index + 1
        player_images_dir = os.path.join(os.path.dirname(__file__), "../static/player_images")
        id_to_photo = {}
        if os.path.exists(player_images_dir):
            for f in os.listdir(player_images_dir):
                if '_' in f and f.endswith('.jpg'):
                    pid = f.split('_')[0]
                    if pid.isdigit():
                        id_to_photo[int(pid)] = f"/static/player_images/{f}"
        players_df['photo_url'] = players_df['player_id'].map(id_to_photo).fillna("")
        state.data['players'] = players_df
        t.done()

        # 3b. Players dict for O(1) lookups
        t = _time_it("Players dict (dedup + indexado)")
        unique_players = players_df.drop_duplicates(subset=['Player'])
        state.data['players_dict'] = unique_players.set_index('Player').to_dict('index')
        t.done()

        # 3c. Pre-compute countries list (llamado en cada page load)
        t = _time_it("Cache: lista de países")
        state.cache['countries'] = sorted(players_df['Country'].dropna().unique().tolist())
        t.done()

        # 3d. Pre-compute cluster averages (llamado en cada page load)
        t = _time_it("Cache: cluster averages")
        clustered = players_df[players_df['cluster'].notna()]
        attrs = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
                 'xg_overperformance', 'impact_score_raw']
        existing_attrs = [a for a in attrs if a in clustered.columns]
        averages = clustered.groupby('cluster')[existing_attrs].mean()
        cache_averages = {}
        for cluster_id, metrics in averages.iterrows():
            c_id = str(int(cluster_id)) if isinstance(cluster_id, (float, np.floating)) else str(cluster_id)
            formatted = {}
            for k, v in metrics.items():
                if pd.notna(v):
                    formatted[k if k != 'physic' else 'physical'] = round(float(v), 2)
                else:
                    formatted[k if k != 'physic' else 'physical'] = None
            cache_averages[c_id] = formatted
        state.cache['cluster_averages'] = cache_averages
        t.done()

        # 3e. Pre-compute player names list for fuzzy search
        t = _time_it("Cache: lista de nombres (fuzzy search)")
        state.cache['player_names'] = players_df['Player'].dropna().tolist()
        t.done()

    # 3f. Build squads with photo urls
    t = _time_it("Squads + photo mapping")
    try:
        squads_df = pd.read_csv('data/csv/optimal_squads.csv')
        if not players_df.empty:
            player_to_photo = (
                players_df
                .drop_duplicates(subset=['Player', 'Country'])
                .set_index(['Player', 'Country'])['photo_url']
                .to_dict()
            )
            squads_df['photo_url'] = squads_df.apply(
                lambda row: player_to_photo.get((row.get('Player'), row.get('Country')), ""),
                axis=1,
            )
        state.data['squads'] = squads_df
    except Exception as e:
        logger.warning(f"  ✗ squads: {e}")
    t.done()

    # Alias para compatibilidad con endpoints legacy
    if 'matches_featured' in state.data:
        state.data['matches'] = state.data['matches_featured']

    total_ms = (time.perf_counter() - total_start) * 1000
    logger.info(f"═══ STARTUP COMPLETO en {total_ms:.0f}ms ═══")
    logger.info(f"  → {len(state.models)} modelos | {len(state.data)} datasets | {len(state.cache)} caches")

    app.state.models = state.models
    app.state.data = state.data
    app.state.cache = state.cache
    
    yield
    
    # Limpieza si fuese necesaria
    state.models.clear()
    state.data.clear()

tags_metadata = [
    {
        "name": "Players",
        "description": "Operaciones relacionadas con los jugadores. Obtén estadísticas e información detallada.",
    },
    {
        "name": "Squads",
        "description": "Optimización y gestión de las plantillas de los equipos.",
    },
    {
        "name": "Matches",
        "description": "Predicción y obtención de resultados de los partidos.",
    },
    {
        "name": "Injuries",
        "description": "Predicción de probabilidades de lesiones para los jugadores (modelo XGBoost real).",
    },
    {
        "name": "Teams",
        "description": "Estadísticas de equipos, predicción de puntos de grupo y formación táctica.",
    },
]

app = FastAPI(
    title="World Cup AI API",
    description="API RESTful para predicción de resultados, lesiones y optimización de plantillas. **Incluye documentación interactiva vía OpenAPI**.",
    version="1.0.0",
    docs_url="/",  # Esto hace que Swagger UI cargue en http://localhost:8000/
    openapi_tags=tags_metadata,
    contact={
        "name": "Soporte Técnico API",
        "email": "soporte@worldcup-ai.example.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_request_timing(request, call_next):
    """Logs response time for every API request."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    # Only log API calls, not static files
    path = request.url.path
    if path.startswith("/api/") or path == "/health":
        level = "WARNING" if elapsed_ms > 500 else "INFO"
        logger.log(
            logging.WARNING if elapsed_ms > 500 else logging.INFO,
            f"[{elapsed_ms:>6.0f}ms] {request.method} {path}"
        )
    return response

app.include_router(api_v1_router, prefix="/api/v1")

# Servir archivos estáticos (imágenes de estadios)
static_dir = os.path.join(os.path.dirname(__file__), "../static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/health")
def health_check():
    return {"status": "ok", "models_loaded": len(app.state.models) > 0}
