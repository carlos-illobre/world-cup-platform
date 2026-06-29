# World Cup 2026 — Documentación Técnica del Pipeline de Ciencia de Datos

**Audiencia:** Científicos de Datos / Ingenieros de Machine Learning  
**Proyecto:** Sistema end-to-end de analytics predictivos para el Mundial FIFA 2026  
**Stack:** Python 3.12 · pandas · scikit-learn · XGBoost · PuLP · FastAPI · React

---

## Tabla de Contenidos

1. [Arquitectura del Data Lake](#1-arquitectura-del-data-lake)
2. [Fuentes de Datos y Scraping (Fase 1)](#2-fuentes-de-datos-y-scraping-fase-1)
3. [Limpieza de Datos (Fase 2 — Cleaning)](#3-limpieza-de-datos-fase-2--cleaning)
4. [Construcción de Tablas Maestras (Fase 2 — Merge)](#4-construcción-de-tablas-maestras-fase-2--merge)
5. [Feature Engineering (Fase 3)](#5-feature-engineering-fase-3)
6. [Análisis Exploratorio — EDA (Fase 4)](#6-análisis-exploratorio--eda-fase-4)
7. [Modelos de Machine Learning (Fase 5)](#7-modelos-de-machine-learning-fase-5)
8. [Optimización de Plantillas (Fase 5 — IO)](#8-optimización-de-plantillas-fase-5--io)
9. [Codificación Final y Feature Matrices (Fase 3b)](#9-codificación-final-y-feature-matrices-fase-3b)
10. [Despliegue — API + Dashboard (Fase 6)](#10-despliegue--api--dashboard-fase-6)
11. [Aplicaciones Profesionales para Ejecutivos de Negocio](#11-aplicaciones-profesionales-para-ejecutivos-de-negocio)
12. [Guía de Uso del Dashboard — ¿Para qué sirve cada página?](#12-guía-de-uso-del-dashboard--para-qué-sirve-cada-página)

---

## 1. Arquitectura del Data Lake

El proyecto implementa una arquitectura de Data Lake por capas semánticas que garantiza la **inmutabilidad de los datos crudos** y la **reproducibilidad** de todo el pipeline. Un científico de datos que reciba este repositorio puede regenerar cualquier artefacto ejecutando los scripts en orden.

```
scraper/
│
├── data/
│   ├── 1_raw/           → Archivos CSV originales (solo lectura — fuente de verdad)
│   ├── 2_cleaned/       → Tipos corregidos, fechas normalizadas, valores nulos tratados
│   ├── 3_master/        → Tablas de hechos (players, matches, teams, injuries)
│   └── 4_featured/      → Feature matrices listas para algoritmos ML
│
├── scripts/
│   ├── 1_scraping/      → Web scrapers (Transfermarkt, FBref, Open-Meteo, FIFA)
│   ├── 2_data_prep/     → Limpieza y merge (clean_*.py, merge_data.py)
│   ├── 3_feature_eng/   → Ingeniería de variables (feature_eng_*.py)
│   ├── 4_eda/           → Análisis exploratorio
│   └── 5_modeling/      → Entrenamiento de modelos (model_*.py)
│
└── models/
    ├── pkl/             → Modelos serializados (.pkl)
    └── metrics/         → Reportes de métricas de evaluación (.txt)
```

**Principio clave:** Los archivos en `data/4_featured/` son la única entrada válida para los modelos. Nunca se pasan datos de `data/1_raw/` directamente a un modelo.

---

## 2. Fuentes de Datos y Scraping (Fase 1)

### 2.1 FBref — Estadísticas de Jugadores y Partidos

**Script:** `scripts/1_scraping/scrape_and_process_fbref.py`  
**Fuente:** [FBref.com](https://fbref.com) (Sports Reference LLC)  
**Método:** Web scraping con `requests` + `BeautifulSoup`, con delays de cortesía entre peticiones.

Se extrajeron cinco tablas de estadísticas para cada jugador en dos contextos:
- **Contexto Mundial (WC):** Solo partidos de Copa del Mundo.
- **Contexto All Competitions:** Liga + Copa + Selección (mayor cobertura estadística).

| Tabla extraída | Columnas clave | Archivo raw |
|---|---|---|
| `standard` | MP, Gls, Ast, G+A, CrdY, CrdR, 90s | `world_cup_stats_standard.csv` |
| `shooting` | Sh, SoT, SoT%, G/Sh, xG | `world_cup_stats_shooting.csv` |
| `playing_time` | Starts, Min, Min%, PPM | `world_cup_stats_playing_time.csv` |
| `misc` | Fls, Fld, Off, Crs, TklW, PKwon | `world_cup_stats_misc.csv` |
| `keeper` | GA, GA90, SoTA, Saves, Save%, CS | `world_cup_stats_keeper.csv` |

**Roster base:** `world_cup_roster.csv` — 1,257 jugadores de las 48 selecciones clasificadas al Mundial 2026, con campos: `Player`, `Country`, `Pos`, `Club`, `Age`, `Birth Date`, `Birth Place`.

El campo `Club` en FBref viene en formato compuesto `"1.eng Manchester City"` (código de liga + nombre). El script `clean_roster.py` lo separa en dos columnas:

```python
# clean_roster.py — línea 14
def parse_club(club_val):
    parts = str(club_val).strip().split(' ', 1)
    if len(parts) == 2:
        return parts[0], parts[1]   # ('1.eng', 'Manchester City')
```

La edad se parsea desde el formato FBref `"26-361"` (años-días) a decimal:

```python
# clean_roster.py — línea 25
years + days / 365.25   # Ejemplo: 26 + 361/365.25 = 26.9879
```

---

### 2.2 Transfermarkt — Historial de Lesiones y Valores de Mercado

**Script:** `scripts/1_scraping/scrape_injuries.py`  
**Fuente:** [Transfermarkt.com](https://transfermarkt.com)

Para cada jugador del roster, el scraper realiza **dos requests HTTP consecutivos**:

1. **Búsqueda:** `GET /schnellsuche/ergebnis/schnellsuche?query={nombre}` → extrae la URL de perfil del primer resultado (`/profil/spieler/{id}`).
2. **Historial de lesiones:** Reemplaza `/profil/` por `/verletzungen/` en la URL y parsea la tabla de lesiones.

Delay entre jugadores: `time.sleep(3)` para respetar el `robots.txt` y evitar bloqueos por rate limiting.

**Campos extraídos por lesión:**

| Campo | Tipo | Descripción |
|---|---|---|
| `Jugador` | string | Nombre del jugador |
| `Seleccion` | string | Selección nacional |
| `Posicion` | string | Posición (del roster) |
| `Edad_FBref` | float | Edad al momento del scraping |
| `Altura` | float | Estatura en metros |
| `Temporada` | string | Temporada (ej: `2023/24`) |
| `Tipo_Lesion` | string | Diagnóstico (ej: `Hamstring Strain`) |
| `Desde` | date | Fecha de inicio de baja |
| `Hasta` | date | Fecha de alta médica |
| `Dias_Baja` | int | Días fuera de actividad |
| `Partidos_Perdidos` | int | Partidos no jugados |

**Volumen final:** 8,611 registros de lesiones para 1,257 jugadores (promedio ≈ 6.8 lesiones históricas por jugador activo en el dataset).

---

### 2.3 FIFA Rankings Históricos

**Script:** `scripts/1_scraping/scrape_fifa_rankings.py`  
**Fuente:** Rankings oficiales FIFA

Genera una tabla mensual de rankings para todos los países presentes en el dataset de partidos. Cada fila representa el estado del ranking de una selección en un mes determinado. Esto permite hacer un **join temporal asíncrono** (`merge_asof`) que asigna el ranking vigente a la fecha de cada partido sin filtración de datos futuros.

Campos: `team`, `date`, `total_points`, `rank`

---

### 2.4 Datos Climáticos — Open-Meteo API

**Script:** `scripts/1_scraping/scrape_weather.py`  
**Fuente:** [Open-Meteo Archive API](https://archive-api.open-meteo.com) (gratuita, sin API key)

Para cada partido histórico con coordenadas conocidas, el script consulta:

```
GET https://archive-api.open-meteo.com/v1/archive
    ?latitude={lat}&longitude={lon}
    &start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
    &daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max
```

Variables obtenidas: `temp_max` (°C), `precipitation` (mm), `wind_speed` (km/h).

Las coordenadas se asignan por país anfitrión. Para partidos en sede neutral, se usa Qatar como proxy geográfico.

---

### 2.5 Valores de Mercado — Transfermarkt

**Script:** `scripts/1_scraping/scrape_market_values.py`  
**Archivo:** `data/1_raw/player_market_values.csv`

Valor de mercado de cada jugador en EUR, scrapeado y convertido desde formato string (`"€45m"`, `"€500k"`) a float numérico mediante la función `clean_market_value()`:

```python
# merge_data.py
def clean_market_value(val):
    if val_str.endswith('m'):
        return float(val_str[:-1]) * 1_000_000   # "€45m" → 45000000.0
    elif val_str.endswith('k'):
        return float(val_str[:-1]) * 1_000        # "€500k" → 500000.0
```

---

### 2.6 Copa del Mundo 2026 — Grupos y Fixture

**Archivos raw:**
- `data/1_raw/world_cup_2026_groups.csv` — Grupos A–L con 48 selecciones
- `data/1_raw/world_cup_stadiums.csv` — 16 estadios sede con coordenadas y altitud
- `data/1_raw/historical_world_cups.csv` — Resultados históricos WC para calcular H2H

---

## 3. Limpieza de Datos (Fase 2 — Cleaning)

### 3.1 Limpieza de Lesiones (`clean_injuries.py`)

Este script procesa tres fuentes de lesiones independientes y las unifica:

```
argentina_injuries.csv           ─┐
all_countries_injuries.csv        ├─→ pd.concat → cleaned_injuries.csv
selected_countries_injuries.csv  ─┘
```

**Transformaciones aplicadas:**

| Columna | Problema original | Transformación |
|---|---|---|
| `Dias_Baja` | String con sufijo `" days"` (ej: `"21 days"`) | Strip + `pd.to_numeric` → `Int64` nullable |
| `Altura` | String con sufijo `" m"`, comas decimales (ej: `"1,85 m"`) | Strip + reemplazo `,` → `.` + `float` |
| `Peso` | Columna completamente vacía | Drop si `isna().all()` |
| `Tipo_Lesion` | Capitalización inconsistente | `.str.title()` |
| `Desde` / `Hasta` | Formato `DD/MM/YYYY` | `pd.to_datetime(format='%d/%m/%Y')` → `YYYY-MM-DD` |

El orden final de columnas se impone explícitamente para asegurar consistencia en los merges posteriores:
```python
column_order = ['Jugador','Seleccion','Posicion','Edad','Edad_FBref',
                'Altura','Temporada','Tipo_Lesion','Desde','Hasta',
                'Dias_Baja','Partidos_Perdidos']
```

### 3.2 Limpieza del Roster (`clean_roster.py`)

- **`Club`** → Separado en `League` (código FBref, ej: `1.eng`) y `Club` (nombre limpio).
- **`Age`** → Convertido de formato `"años-días"` a decimal (ej: `26-361` → `26.988`).
- **`Birth Date`** → Normalizado a `YYYY-MM-DD`.
- **`Birth Country`** → Extraído del último campo de `Birth Place` (separando por coma).
- Columnas eliminadas: `Category`, `MP`, `Min`, `Gls` (redundantes con stats tables).

### 3.3 Normalización de Nombres de País

El pipeline enfrenta un problema crítico de **entity resolution**: el mismo país puede aparecer como `"dz Algeria"` (FBref), `"Algeria"` (Transfermarkt), `"Algérie"` (FIFA). La función `clean_country_name()` en `merge_data.py` resuelve esto en dos pasos:

```python
def clean_country_name(name):
    # Paso 1: Quitar prefijos ISO de 2-3 letras (ej: "dz Algeria" → "Algeria")
    name = re.sub(r'^[a-z]{2,3}\s+', '', name)
    
    # Paso 2: Aplicar diccionario de sinónimos canónicos
    synonyms = {
        'United States': 'USA',
        'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
        'Cape Verde': 'Cabo Verde',
        'Equ. Guinea': 'Equatorial Guinea',
        ...
    }
    return synonyms.get(name, name)
```

Esta normalización se aplica **directamente sobre los archivos CSV** en la etapa de limpieza, garantizando que todos los datasets (`master_players_enriched.csv`, `master_matches_featured.csv`, `master_injuries_featured.csv`, `master_teams_featured.csv`, `world_cup_2026_groups.csv`) utilicen el mismo token canónico para cada país. No se realizan parches en runtime — los datos ya están limpios al momento de la carga.

---

## 4. Construcción de Tablas Maestras (Fase 2 — Merge)

El script `merge_data.py` construye cuatro tablas de hechos fundamentales a partir de los datos limpios. Todas las joins se realizan usando `(Player, Country)` o `(Country, Date)` como llaves compuestas para evitar colisiones de nombres.

### 4.1 `master_players.csv` (1,257 filas × 152 columnas)

**Estrategia:** LEFT JOIN desde el roster base hacia las estadísticas de juego y el historial de lesiones.

```
cleaned_roster.csv  ──────────────────────────────────────────► base (1,257 jugadores)
                                                                       │
cleaned_wc_stats_standard.csv    ─┐                                   │ LEFT JOIN
cleaned_wc_stats_shooting.csv     │ aggregate_player_stats()          │ on (Player_clean,
cleaned_wc_stats_misc.csv         ├─→ merged_wc_stats                 │    Country_clean)
cleaned_wc_stats_playing_time.csv │                                    │
cleaned_wc_stats_keeper.csv      ─┘                                   │
                                                                       ▼
cleaned_all_stats_*.csv (x5)  ──→ merged_all_stats (sufijo _allcomps) ▼
                                                                       │
cleaned_injuries.csv  ──→ inj_agg (total_injuries, total_days_out, avg_days_out, total_matches_missed)
```

**Función `aggregate_player_stats()`:** Cuando un jugador aparece en múltiples filas (ej: temporadas distintas), el script agrega por `(Player, Country)`:
- **Stats de conteo** (Goles, Asistencias, Tarjetas): `sum()`
- **Stats de ratio/tasa** (columnas con `%`, `per 90`, `PPM`, `On-Off`, `+/-`): `mean()`
- **Metadatos** (Pos, Age, Club): `first()`

Los porteros tienen sus columnas prefijadas `GK_` para evitar colisión con columnas de campo:
```python
if st_type == 'keeper':
    rename_dict = {col: f"GK_{col}" for col in df_agg.columns
                   if col not in ['Player', 'Country']}
```

**Join con lesiones:** Los `NaN` en las columnas de lesión se rellenan con `0` ya que ausencia de registro = cero lesiones documentadas.

---

### 4.2 `master_matches.csv` (825 filas × 41 columnas)

**Origen:** Concatenación de matchlogs del Mundial + partidos de clasificatoria y amistosos (todos los contextos), deduplicados por `(Country, Date, Opponent)`.

```
cleaned_wc_matchlogs.csv     ─┐
cleaned_all_matchlogs.csv    ─┴─→ pd.concat → dedup → matches_base
                                                           │
fifa_rankings_historical.csv ──→ pd.merge_asof ──────────►│ join temporal (por fecha)
                                                           │
historical_world_cups.csv ───→ h2h_dict ────────────────►│ lookup pre-computado
                                                           │
cleaned_stadiums.csv ────────────────────────────────────►│ LEFT JOIN on 'Stadium'
```

**Join temporal con FIFA Rankings (`merge_asof`):**

Este es el join más delicado del pipeline. Para evitar filtración de datos futuros (*data leakage*), se usa `pd.merge_asof` que asigna el **último ranking disponible anterior a la fecha del partido**:

```python
# merge_data.py
matches_merged = pd.merge_asof(
    matches.sort_values('Date'),
    fifa[['date','team_clean','rank','total_points']].sort_values('date'),
    left_on='Date',
    right_on='date',
    left_by='Country_clean',
    right_by='team_clean',
    direction='backward'   # ← solo registros pasados o del mismo día
)
```

Este proceso se ejecuta **dos veces**: una para el equipo local (`Country`) y otra para el rival (`Opponent`), generando `Country_FIFA_Rank`, `Country_FIFA_Points`, `Opponent_FIFA_Rank`, `Opponent_FIFA_Points`.

**Cálculo de H2H (Head-to-Head):**

Se pre-computa un diccionario `h2h[(teamA, teamB)]` desde los resultados históricos de todas las Copas del Mundo anteriores (`historical_world_cups.csv`). Para cada par ordenado `(A, B)` se acumulan: `matches`, `wins`, `losses`, `draws`, `goals_for`, `goals_against`. Este diccionario es simétrico: se calcula tanto `h2h[(A,B)]` como `h2h[(B,A)]`.

**Columnas derivadas calculadas en el merge:**
```python
matches_merged['ranking_diff']    = Country_FIFA_Rank - Opponent_FIFA_Rank
matches_merged['is_higher_ranked'] = (Country_FIFA_Rank < Opponent_FIFA_Rank).astype(int)
matches_merged['days_since_last_match'] = groupby('Country').Date.diff().dt.days
```

---

### 4.3 `master_teams.csv` (48 filas × 20 columnas)

Agregación de `master_players` a nivel de selección nacional mediante `groupby('Country')`:

| Feature agregado | Fuente | Operación |
|---|---|---|
| `squad_avg_age` | `Age` de jugadores | `mean()` |
| `squad_total_market_value` | `MarketValue_EUR` | `sum()` |
| `squad_injury_burden` | `total_days_out` | `sum()` |
| `squad_depth_GK/DF/MF/FW` | `Pos` | `count()` por posición primaria |
| `squad_total_wc_goals` | `Performance_Gls` (WC) | `sum()` |
| `squad_total_allcomps_goals` | `Performance_Gls_allcomps` | `sum()` |

**Nota:** Las columnas `group_rank`, `group_points`, `group_wins`, etc. fueron eliminadas del dataset de producción por representar solo 16 muestras de un único partido cada una (datos de WC 2022), insuficientes para entrenamiento confiable y potencialmente ruidosos para la inferencia. La predicción de puntos de grupo se realiza ahora mediante simulación de partidos (ver Sección 7.4).

---

### 4.4 `master_injuries.csv` (8,611 filas × 164 columnas)

Este es el dataset más rico y el más técnicamente complejo de construir. Cada fila representa **una lesión individual** de un jugador, enriquecida con:

1. **Variables de historial rolling** calculadas iterativamente por jugador (ver Sección 5.2).
2. **Variables biométricas** del jugador (Edad, Posición, Liga, MarketValue).
3. **Estadísticas de juego** desde `master_players` (todas las columnas de FBref).

El join se hace por `(Player_clean, Country_clean)` usando LEFT JOIN desde las lesiones:
```python
master_injuries = pd.merge(inj, players_feat,
                           on=['Player_clean','Country_clean'],
                           how='left')
```

Columnas excluidas del lado de `master_players` para evitar leakage: `total_injuries`, `total_days_out`, `avg_days_out`, `total_matches_missed` (estas se recalculan rolling en la fase de feature engineering).

---

## 5. Feature Engineering (Fase 3)

### 5.1 Features de Jugadores (`feature_eng_players.py`)

Entrada: `master_players.csv` → Salida: `master_players_featured.csv` (1,257 × 159 columnas)

Todas las variables se construyen a partir de estadísticas ya existentes en la tabla maestra. No se imputa ningún valor externo.

---

#### 5.1.1 `xg_overperformance` — Rendimiento sobre Expected Goals

**Hipótesis:** Un delantero que convierte más goles que los esperados por sus tiros (`xG`) es sistemáticamente más efectivo que la media, y ese talento no es aleatorio.

```python
xg_overperformance = Performance_Gls_allcomps - Performance_xG_allcomps
```

Valores positivos indican sobrerendimiento (finalizadores clínicos). Valores negativos indican infrarendimiento (mala racha o mala conversión estructural).

---

#### 5.1.2 `minutes_per_goal` — Eficiencia Goleadora

```python
minutes_per_goal = Playing_Time_Min_allcomps / Performance_Gls_allcomps
# Se asigna NaN cuando Gls == 0 para evitar división por cero
minutes_per_goal = np.where(df[gls_col] > 0, df[min_col] / df[gls_col], np.nan)
```

Métrica clásica de eficiencia ofensiva. Un valor de 90 equivale a un gol por partido completo.

---

#### 5.1.3 `discipline_score` — Índice de Disciplina

```python
discipline_score = (CrdY * 1) + (CrdR * 3) + (Fls * 0.5)
```

Ponderación inspirada en el sistema de puntos de suspensión UEFA/FIFA: tarjeta amarilla vale 1 punto, roja vale 3 (equivale a dos amarillas), falta cometida vale 0.5. A mayor valor, más indisciplinado.

---

#### 5.1.4 `impact_score_raw` — Puntuación de Impacto del Jugador

Variable compuesta que cuantifica el aporte del jugador al equipo desde tres dimensiones ortogonales:

```python
def standardize(series):
    return (series - series.mean()) / series.std()  # Z-score

impact = standardize(Team_Success_On-Off_allcomps)   # Diferencial +/- con/sin el jugador
       + standardize(Team_Success_PPM_allcomps)        # Puntos por partido del equipo
       + standardize(Per_90_Minutes_G+A_allcomps)      # Producción ofensiva por 90 min
```

Cada componente se estandariza (Z-score) antes de sumar para evitar que una métrica con mayor varianza domine. El resultado es una puntuación de media ≈ 0 sin escala fija — se normaliza a 0-100 antes del modelado.

---

#### 5.1.5 `position_encoded` — Codificación Ordinal de Posición

```python
{'GK': 1, 'DF': 2, 'MF': 3, 'FW': 4, 0: desconocido}
```

Se toma solo la posición primaria (el primer valor en strings como `"DF,MF"`).

---

#### 5.1.6 `league_tier` — Nivel de la Liga

Jerarquía de ligas en cuatro niveles según competitividad y exposición internacional:

| Tier | Ligas |
|---|---|
| 1 | Premier League, La Liga, Serie A, Bundesliga, Ligue 1 |
| 2 | Eredivisie, Championship, Primeira Liga, Brasileirão, Liga MX |
| 3 | MLS, J-League, Saudi Pro League, 2as divisiones top |
| 4 | Resto |

---

#### 5.1.7 `experience_level` — Nivel de Experiencia

Combina dos proxies de experiencia mediante Z-score:

```python
experience_level = standardize(Age) + standardize(MP_allcomps)
```

Un jugador de 32 años con 400 apariciones tiene mayor `experience_level` que uno de 24 con 80 partidos.

---

#### 5.1.8 Features per 90 (para clustering)

Calculadas sobre `Playing_Time_90s_allcomps` (solo jugadores con ≥ 0.5 90s jugados para evitar tasas extremas):

```python
goals_per_90        = Per_90_Minutes_Gls_allcomps           # campo directo
assists_per_90      = Per_90_Minutes_Ast_allcomps            # campo directo
shots_per_90        = Standard_Sh_allcomps / 90s_allcomps
sot_per_90          = Standard_SoT_allcomps / 90s_allcomps
tackles_won_per_90  = Performance_TklW_allcomps / 90s_allcomps
interceptions_per_90= Performance_Int_allcomps / 90s_allcomps
crosses_per_90      = Performance_Crs_allcomps / 90s_allcomps
fouls_committed_per_90 = Performance_Fls_allcomps / 90s_allcomps
fouls_drawn_per_90  = Performance_Fld_allcomps / 90s_allcomps
offsides_per_90     = Performance_Off_allcomps / 90s_allcomps
```

`np.inf` y `-np.inf` se reemplazan por `0` post-división.

---

### 5.2 Features de Lesiones (`feature_eng_injuries.py`)

Entrada: `master_injuries.csv` → Salida: `master_injuries_featured.csv` (8,611 × 170 columnas)

Estas son las features más complejas del pipeline porque requieren cálculo **iterativo por jugador** respetando el orden cronológico — si se hiciera con `shift()` global se produciría leakage entre jugadores distintos.

El algoritmo itera sobre cada grupo `groupby('Player')` ordenado por `Desde`:

```python
for player, group in df.groupby('Player'):
    group = group.sort_values('Desde')
    seen_types = set()

    for i, row in group.iterrows():
        past_slice = group.iloc[:i]  # Solo registros ANTERIORES al actual
        ...
```

---

#### 5.2.1 `injury_count_last_12m` — Lesiones en los últimos 12 meses

```python
one_year_ago = curr_date - pd.Timedelta(days=365)
last_12m = group.iloc[:i+1][group['Desde'] >= one_year_ago]
count_12m[i] = len(last_12m)
```

Incluye la lesión actual (ventana cerrada a la derecha). Mide la densidad de lesiones recientes.

---

#### 5.2.2 `total_days_out_last_12m` — Días de baja acumulados en 12 meses

```python
days_out_12m[i] = last_12m['Dias_Baja'].sum(skipna=True)
```

---

#### 5.2.3 `avg_recovery_time` — Tiempo medio de recuperación histórico

```python
past_dias = past_slice['Dias_Baja'].dropna()
avg_recov[i] = past_dias.mean() if len(past_dias) > 0 else 0.0
```

Solo usa registros **anteriores** al actual → no hay leakage.

---

#### 5.2.4 `is_recurrent` — Lesión recurrente

```python
seen_types = set()
if curr_type in seen_types:
    recurrent[i] = True    # Ya sufrió esta lesión antes
seen_types.add(curr_type)
```

Booleano que indica si el tipo de lesión ya se había producido antes en el mismo jugador. Lesiones recurrentes tienen mayor probabilidad de reaparecer (Meeuwisse et al., 2007).

---

#### 5.2.5 `months_since_last_injury` — Meses desde la última lesión

```python
last_end_date = past_slice['Hasta'].dropna().max()
days_diff = (curr_date - last_end_date).days
months_since[i] = max(0, days_diff / 30.44)
```

Usa `Hasta` (fecha de alta) del registro anterior. Si no hay registros previos, se asigna `NaN`.

---

#### 5.2.6 `injury_frequency` — Frecuencia anualizada de lesiones

```python
days_since_first = (curr_date - valid_desdes.min()).days
frequency[i] = (i / days_since_first) * 365.25  # lesiones por año
```

Normaliza el conteo de lesiones por el período de observación disponible, produciendo una tasa anualizada comparable entre jugadores con historiales de distinta longitud.

---

#### 5.2.7 `injury_severity_score` — Score de Severidad por Tipo

Mapa de severidad construido mediante reglas de dominio médico-deportivo:

| Score | Categoría | Ejemplos |
|---|---|---|
| 5 | Crítica | ACL, fractura, cirugía, ruptura de tendón |
| 4 | Grave | Desgarro, dislocación, menisco, ligamento |
| 3 | Moderada | Muslo, isquiotibiales, tobillo, rodilla, hombro |
| 1 | Leve | Golpe, contusión, fatiga, gripe, virus |
| 2 | Desconocida | NaN o no clasificada |

```python
def map_severity(injury):
    injury = str(injury).lower()
    if any(x in injury for x in ['cruciate','acl','fracture','surgery','rupture']):
        return 5
    if any(x in injury for x in ['torn','tear','dislocation','meniscus']):
        return 4
    ...
```

---

### 5.3 Features de Partidos (`feature_eng_matches.py`)

Entrada: `master_matches.csv` → Salida: `master_matches_featured.csv` (825 × 48 columnas)

Todas las features usan **ventanas temporales con shift(1)** para garantizar que en el momento de la predicción no se usa información del partido actual:

```python
df['Points_shifted'] = df.groupby('Country')['Points'].shift(1)
df['GF_shifted']     = df.groupby('Country')['GF'].shift(1)
```

---

#### 5.3.1 `form_last_5` y `form_last_10` — Forma reciente

```python
form_last_5  = Points_shifted.rolling(5,  min_periods=1).sum()
form_last_10 = Points_shifted.rolling(10, min_periods=1).sum()
```

Suma de puntos en los últimos N partidos (3 pts = victoria, 1 = empate, 0 = derrota). `min_periods=1` evita `NaN` cuando hay menos de N partidos disponibles.

---

#### 5.3.2 `goals_scored_last_5` y `goals_conceded_last_5`

```python
goals_scored_last_5   = GF_shifted.rolling(5, min_periods=1).mean()
goals_conceded_last_5 = GA_shifted.rolling(5, min_periods=1).mean()
```

---

#### 5.3.3 `days_since_last_match` — Días desde el último partido

```python
days_since_last_match = df.groupby('Country')['Date'].diff().dt.days
```

Proxy de fatiga y de tiempo de preparación previo al partido.

---

#### 5.3.4 `win_rate_home/away/neutral` — Tasas de victoria por sede

Calcula la **tasa acumulada hasta el momento del partido** (sin incluir el resultado actual), desglosada por sede:

```python
for venue in ['Home', 'Away', 'Neutral']:
    df[f'{venue}_win']    = is_win * (df['Venue'] == venue)
    df[f'{venue}_played'] = played * (df['Venue'] == venue)

    cum_wins   = groupby('Country')[f'{venue}_win'].cumsum().shift(1)
    cum_played = groupby('Country')[f'{venue}_played'].cumsum().shift(1)

    df[rate_col] = cum_wins / cum_played  # NaN cuando cum_played == 0
```

---

### 5.4 Features de Equipos (`feature_eng_teams.py`)

Entrada: `master_teams.csv` + `master_players_featured.csv` + `master_injuries_featured.csv`  
Salida: `master_teams_featured.csv` (52 × 31 columnas)

| Feature | Cálculo | Descripción |
|---|---|---|
| `squad_avg_age` | `players.groupby(Country).Age.mean()` | Edad promedio del plantel |
| `squad_total_caps` | `MP_allcomps.sum()` | Total de partidos jugados por el plantel |
| `squad_injury_burden` | `injuries[last_12m].Dias_Baja.sum()` | Días de baja acumulados en el año |
| `squad_top_league_ratio` | `(league_tier == 1).sum() / n` | Proporción de jugadores en Top-5 ligas |
| `squad_avg_impact_score` | `impact_score_raw.mean()` | Promedio del score de impacto por plantel |
| `squad_depth_GK/DF/MF/FW` | `count por posición primaria` | Profundidad por línea |

---

## 6. Análisis Exploratorio — EDA (Fase 4)

Los scripts en `scripts/4_eda/` generan visualizaciones y reportes estadísticos que motivaron decisiones de modelado. Los hallazgos clave se documentan a continuación.

### 6.1 Multicolinealidad en Features de Partidos

La matriz de correlación de `X_matches.csv` (504 columnas) reveló colinealidad alta (Pearson > 0.80) entre:
- `Standard_Sh` y `Standard_SoT` (r ≈ 0.92)
- `Performance_Gls` y `xG` (r ≈ 0.88)
- `Country_FIFA_Points` y `Country_FIFA_Rank` (r ≈ -0.96)

**Decisión de modelado:** Se eligieron modelos basados en árboles (XGBoost) que son robustos a la multicolinealidad porque no asumen independencia lineal entre features. Los modelos lineales como Regresión Logística requieren regularización adicional (L1/L2) o eliminación previa de variables colineales.

Los reportes VIF (Variance Inflation Factor) se almacenan en `docs/X_*_vif.csv`.

### 6.2 Distribución de Lesiones

Del análisis de `master_injuries_featured.csv`:
- **Lesiones musculares** representan ≈ 34% del total (`Hamstring`, `Calf`, `Thigh`, `Adductor`).
- **ACL/Cruciate** representa ≈ 4% pero con una media de `Dias_Baja = 189 días` (la mayor de todas las categorías).
- **Pico estacional:** Los meses de octubre–noviembre concentran el 22% de las lesiones (acumulación de carga tras inicio de temporada).
- **Correlación edad-lesiones:** Los jugadores de 28–32 años presentan mayor `injury_frequency` que los menores de 24, pero los menores de 22 tienen mayor `injury_severity_score` promedio (lesiones más graves cuando ocurren).

### 6.3 Distribución del Target de Partidos

De los 825 partidos en `master_matches_featured.csv` (excluyendo futuros):
- **Victoria (W):** 49.7%
- **Empate (D):** 24.2%
- **Derrota (L):** 26.1%

El desbalance hacia victorias se explica porque el dataset está orientado a la perspectiva del equipo local/anfitrión. Esta distribución justifica el uso de `scale_pos_weight` en XGBoost para los clasificadores de resultado de partido.

### 6.4 Outliers en Eficiencia Goleadora

El análisis de `minutes_per_goal` reveló outliers severos correspondientes a defensores o porteros que convirtieron goles en situaciones excepcionales (córners, penales). Se decidió **no eliminarlos** porque son datos reales y los modelos de árbol no son sensibles a estos valores extremos.

---

## 7. Modelos de Machine Learning (Fase 5)

Todos los modelos se serializan con `joblib` en `models/pkl/*.pkl` y se cargan en memoria RAM al iniciar la API FastAPI, eliminando latencia de disco en las predicciones.

---

### 7.1 Modelo de Riesgo de Lesión

**Archivo:** `model_injury_risk.py` → `injury_xgboost_model.pkl`, `injury_logistic_model.pkl`  
**Dataset:** `master_injuries_featured.csv` (8,611 registros × 123 features)

#### Variable Target

```
will_be_injured_next_6months  ∈ {0, 1}
```

Para cada registro de lesión del jugador en fecha `T`, se asigna `1` si existe otra lesión del mismo jugador con `Desde` en el intervalo `(T, T + 180 días]`, y `0` en caso contrario. La construcción es iterativa por jugador y respeta la temporalidad.

#### Split Temporal (anti-leakage)

Se utiliza un split cronológico estricto en lugar de `train_test_split` aleatorio, para simular la condición real de producción donde se predicen eventos futuros:

```
Train: 6,888 registros  → 2001-01-28 a 2025-04-21  (80%)
Test:  1,723 registros  → 2025-04-21 a 2026-06-11  (20%)
```

Un split aleatorio habría sido incorrecto: al haber múltiples lesiones por jugador, registros del mismo jugador podrían aparecer simultáneamente en train y test, filtrando información del historial futuro.

#### Preprocesamiento

```
Columnas eliminadas: Jugador, Hasta, Temporada, Seleccion, Edad (100% NaN),
                     Desde (solo para sorting), will_be_injured_next_6months (target),
                     Edad_FBref, Club, Birth Place, Birth Date, Birth Country,
                     Posicion (redundante con Pos), GK_Penalty Kicks_Save% (100% NaN)
                     + todas las columnas GK específicas con >90% NaN

Columnas categóricas codificadas con LabelEncoder:
    Pos, Country, Tipo_Lesion, League
    → Valores desconocidos en test → mapeados a 'MISSING'

Features finales: 123 columnas
```

XGBoost maneja `NaN` nativo — no requiere imputación previa. La Regresión Logística usa `SimpleImputer(strategy='median')` + `StandardScaler`.

#### Algoritmo: XGBoost Classifier

**Parámetros óptimos** (GridSearchCV 5-Fold Estratificado sobre training set):
```python
XGBClassifier(
    max_depth=4,
    n_estimators=300,
    learning_rate=0.01,
    objective='binary:logistic',
    eval_metric='logloss',
    tree_method='hist'
)
```

**¿Por qué XGBoost?**
- Manejo nativo de valores faltantes (NaN) sin imputación.
- Robusto a la multicolinealidad entre features de juego (≈500+ columnas antes de filtrado).
- Gradient boosting secuencial: cada árbol corrige los errores del anterior, capturando interacciones no lineales entre `injury_frequency` × `injury_severity_score` × `age`.

**Ventajas:**
- Alta interpretabilidad vía SHAP (SHapley Additive Explanations).
- No requiere normalización de datos.
- Maneja naturalmente datasets con features de distinto tipo (conteos, ratios, booleanos, categóricas codificadas).

**Desventajas:**
- Propenso a sobreajuste si `n_estimators` y `learning_rate` no están bien calibrados.
- No captura dependencias temporales secuenciales (para eso se necesitaría un modelo de supervivencia o LSTM).
- Rendimiento limitado cuando el dataset es pequeño (<500 filas) — en este caso el dataset es suficientemente grande (6,888 train).

#### Algoritmo Complementario: Cox Proportional Hazards (Análisis de Supervivencia)

```python
CoxPHFitter(penalizer=0.1).fit(
    surv_df,
    duration_col='Dias_Baja',
    event_col='event'
)
```

El modelo de Cox modela **cuánto tiempo** tarda un jugador en sufrir una nueva lesión, en lugar de solo predecir si ocurrirá. Usa `Dias_Baja` como duración y `will_be_injured_next_6months` como indicador de evento.

**C-Index obtenido: 0.7491** — interpretación: en el 74.9% de los pares de jugadores donde uno se lesiona antes que el otro, el modelo le asigna mayor riesgo al que realmente se lesionó primero. Un valor de 0.5 equivale a predicción aleatoria.

#### Métricas de Evaluación (Test Set Temporal)

| Métrica | XGBoost | Logistic Regression |
|---|---|---|
| AUC-ROC | 0.6221 | **0.6307** |
| F1-Score | 0.6066 | **0.6331** |
| Precision | 0.5572 | **0.5668** |
| Recall | **0.6655** | 0.7170 |
| Accuracy | 0.5821 | **0.5978** |

La Regresión Logística supera marginalmente a XGBoost en este dataset. Esto es consistente con la literatura: cuando las relaciones son aproximadamente lineales (historial de lesiones → riesgo futuro), un modelo lineal regularizado compite bien con modelos complejos. El AUC-ROC de ~0.63 es comparable con la bibliografía académica en predicción de lesiones deportivas (Carey et al., 2018, AUC 0.60–0.75).

#### Top 3 Features por importancia SHAP

1. **`Dias_Baja`** (SHAP medio = 0.2502) — Los días de baja de la lesión actual son el predictor más fuerte.
2. **`injury_frequency`** (0.1470) — La tasa anualizada de lesiones pasadas.
3. **`injury_count_last_12m`** (0.0811) — Densidad de lesiones recientes.

Estos tres resultados validan la hipótesis de dominio: el mejor predictor de una nueva lesión es el **historial médico reciente**, no las características biométricas o el nivel de liga.

---

### 7.2 Modelo de Resultado de Partido

**Archivo:** `model_match_outcome.py` → `match_outcome_xgb.pkl`, `match_outcome_weather_xgb.pkl`  
**Dataset:** `master_matches_featured.csv` (695 partidos históricos con datos climáticos)

#### Variable Target

```
Result ∈ {W, D, L}  →  target ∈ {2, 1, 0}   (multiclase)
```

Para el modelo con clima (`match_outcome_weather_xgb`), el target se binariza:
```
Target_Win ∈ {0, 1}   (0 = empate/derrota, 1 = victoria)
```

#### Features del Modelo Base (sin clima, 19 features)

```python
features = [
    'Country_FIFA_Rank', 'Opponent_FIFA_Rank', 'ranking_diff', 'is_higher_ranked',
    'days_since_last_match', 'form_last_5', 'form_last_10',
    'goals_scored_last_5', 'goals_conceded_last_5',
    'win_rate_home', 'win_rate_away', 'win_rate_neutral',
    'h2h_matches', 'h2h_wins', 'h2h_losses', 'h2h_draws',
    'h2h_goals_for', 'h2h_goals_against',
    'Venue_encoded'     # Home=1, Neutral=0, Away=-1
]
```

#### Features Adicionales del Modelo con Clima (14 features)

```python
features = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed',
    'is_raining',   # 1 si precipitation > 2.0 mm
    'is_hot'        # 1 si temp_max > 30.0 °C
]
```

#### Split Temporal

```
80/20 cronológico: los partidos más recientes forman el conjunto de test.
```

#### Métricas de Evaluación

| Métrica | Random Forest (baseline) | XGBoost |
|---|---|---|
| Accuracy | **0.5827** | 0.4964 |
| F1-Macro | **0.4920** | 0.4133 |
| Log Loss | **0.9027** | 0.9507 |

**Interpretación crítica:** El Random Forest supera a XGBoost en este caso. La predicción de resultados de fútbol es inherentemente difícil: el fútbol tiene alta varianza (la selección "peor" puede ganarle a la "mejor" en cualquier partido individual). La Accuracy del 58% del baseline supera el azar (33% en tres clases), pero los empates son notoriamente difíciles de predecir (precision 0.29, recall 0.44).

**Sobre la clase "Draw":** La literatura académica (Carpita et al., 2019; Dixon & Coles, 1997) documenta consistentemente que los empates son el resultado más difícil de predecir en el fútbol porque dependen de factores tácticos y psicológicos difíciles de cuantificar con estadísticas de juego tradicionales.

**Ventajas de XGBoost para predicción de partidos:**
- Maneja missing values (muchos partidos históricos no tienen datos de clima).
- Captura interacciones no lineales (ej: el ranking FIFA importa más cuando es muy grande la diferencia).
- `predict_proba()` produce probabilidades calibradas útiles para análisis de riesgo.

**Desventajas:**
- No modela la dinámica táctica del partido.
- Las variables de forma (`form_last_5`) son proxies de momentum pero no capturan rotación de plantilla ni lesiones recientes.
- El dataset de 695–825 partidos es relativamente pequeño para modelos complejos — Random Forest tiende a generalizar mejor en muestras pequeñas.

---

### 7.3 Modelo de Impacto del Jugador

**Archivos:** `model_player_impact.py` + `model_impact_enriched.py`  
→ `player_impact_xgb.pkl` y `player_impact_xgb_enriched.pkl`

#### Variable Target

```
impact_score_normalized ∈ [0, 100]
```

Normalización min-max del `impact_score_raw` calculado en feature engineering:
```python
impact_score_normalized = 100 * (impact_score_raw - min) / (max - min)
```

#### Modelo Base (`player_impact_xgb.pkl`) — 5 features

Predice el impacto a partir de características **observables externamente** (sin necesidad de datos de juego detallados):

```python
features = ['Age', 'position_encoded', 'league_tier', 'experience_level', 'MarketValue_EUR']
```

Útil para **scouting de jugadores sin historial estadístico detallado** — si se conoce la liga, la edad y el valor de mercado, se puede estimar el impacto esperado.

**Métricas:** RMSE = 7.47, MAE = 4.98, R² = -0.065

El R² negativo indica que el modelo base es peor que predecir siempre la media. Esto es esperado: el impacto de un jugador no puede inferirse solo de su edad, liga y posición — necesita estadísticas reales de juego.

#### Modelo Enriquecido (`player_impact_xgb_enriched.pkl`) — 40 features FIFA

```python
features = ['Age', 'overall', 'potential', 'value_eur', 'wage_eur',
            'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
            'attacking_crossing', 'attacking_finishing', 'attacking_heading_accuracy',
            'skill_dribbling', 'skill_fk_accuracy', 'skill_ball_control',
            'movement_acceleration', 'movement_sprint_speed', 'movement_agility',
            'movement_reactions', 'movement_balance', 'power_shot_power',
            'power_jumping', 'power_stamina', 'power_strength', 'power_long_shots',
            'mentality_aggression', 'mentality_interceptions', 'mentality_positioning',
            'mentality_vision', 'mentality_composure', 'defending_marking_awareness',
            'defending_standing_tackle', 'defending_sliding_tackle',
            'goalkeeping_diving', 'goalkeeping_handling', 'goalkeeping_kicking',
            'goalkeeping_positioning', 'goalkeeping_reflexes']
```

Estos atributos provienen del join con `players_22.csv` (base de datos FIFA 22/23) mediante `sofifa_id` o fuzzy matching de nombres. Son ratings curados por analistas de EA Sports y funcionan como proxy de habilidades técnicas.

**Arquitectura:**
```python
XGBRegressor(n_estimators=150, learning_rate=0.05, max_depth=4, random_state=42)
```

**Ventajas del modelo enriquecido:**
- Captura habilidades técnicas específicas por posición (portero vs delantero).
- Los atributos FIFA tienen alta correlación con el rendimiento real (Herm et al., 2014).

**Desventajas:**
- Dependencia de una fuente propietaria (EA Sports).
- Los ratings FIFA pueden estar desactualizados o sesgados hacia jugadores europeos.

---

### 7.4 Predicción de Puntos de Grupo por Equipo

**Método:** Simulación de partidos con `match_outcome_weather_xgb.pkl`  
**Enfoque:** Monte Carlo implícito — simular los 3 partidos del grupo y sumar puntos esperados.

#### Contexto y Decisión de Diseño

El modelo original `team_points_xgb_model.pkl` fue entrenado con solo 16 muestras (equipos que habían jugado 1 partido de grupo previo al scraping), donde el target `group_points ∈ {0, 1, 3}` representaba el resultado de un solo partido. Con 19 features y 16 muestras (ratio features:muestras de 1.2:1), el modelo sobreajustaba severamente y producía predicciones discretizadas e invertidas (asignaba 0 puntos a Argentina/Francia y 3 a equipos débiles).

**Decisión:** Se descartó el modelo `team_points_xgb` y las 16 muestras ruidosas. En su lugar, la predicción de puntos de grupo se realiza simulando los 3 enfrentamientos reales del equipo en su grupo usando el modelo de partido `match_outcome_weather_xgb` (entrenado con 825 partidos reales).

#### Algoritmo de Simulación

```python
def predict_team_group_points(team_name, group_opponents):
    total_expected_points = 0.0
    for opponent in group_opponents:  # 3 partidos de grupo
        result = predict_match_outcome(team_name, opponent)
        # Expected points = P(win) × 3 + P(draw) × 1 + P(loss) × 0
        expected_pts = result['win_A'] * 3.0 + result['draw'] * 1.0
        total_expected_points += expected_pts
    return total_expected_points  # Rango [0, 9]
```

**Ventajas:**
- Usa un modelo con 825 muestras de entrenamiento (vs 16 del modelo anterior).
- Considera la fuerza relativa de cada oponente específico del grupo.
- La predicción es transitiva: si Argentina es fuerte contra Jordán y también contra Argelia, sus puntos de grupo reflejan eso.
- Sin riesgo de sobreajuste: reutiliza un modelo validado con split temporal.

**Desventajas:**
- Asume independencia entre partidos (no modela el efecto de un resultado previo sobre el siguiente).
- No captura ventaja de sede (todos se simulan como neutral con clima estándar).

#### Resultados de ejemplo

| Equipo | Pts esperados | Interpretación |
|---|---|---|
| Argentina | 5.01 | Favorito claro de su grupo (J) |
| Brazil | 4.71 | Domina grupo C |
| England | 3.81 | Esperable ~1 victoria + 1 empate |
| USA | 3.38 | Anfitrión, grupo medio-bajo |
| New Zealand | 0.90 | Equipo más débil del grupo G |
| Haiti | 1.32 | Débil en grupo C con Brasil |

---

### 7.5 Clustering Táctico de Jugadores (K-Means)

**Archivo:** `model_clustering.py` → perfiles asignados en `master_players_clustered.csv`  
**Dataset:** `master_players_featured.csv` (jugadores de campo con ≥ 0.5 90s jugados)

#### Algoritmo: K-Means (k=5)

K-Means agrupa jugadores minimizando la inercia intra-cluster (suma de distancias euclidianas al centroide):

```
Minimizar: Σᵢ Σⱼ ||xᵢ - μⱼ||²
```

donde `xᵢ` es el vector de features per-90 de un jugador y `μⱼ` es el centroide del cluster `j`.

**Preprocesamiento:**
```python
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)  # Normalización Z-score
kmeans = KMeans(n_clusters=5, random_state=42, n_init=15)
```

La estandarización es **obligatoria** antes de K-Means para que ninguna feature domine por tener mayor varianza (ej: `crosses_per_90` tiene mayor magnitud que `offsides_per_90`).

**10 features de entrada:**
```
goals_per_90, assists_per_90, shots_per_90, sot_per_90,
tackles_won_per_90, interceptions_per_90, crosses_per_90,
fouls_committed_per_90, fouls_drawn_per_90, offsides_per_90
```

**Mapeo de clusters a perfiles tácticos** (asignación dinámica por centroides):

| Cluster | Criterio de asignación | Perfil táctico |
|---|---|---|
| Winger | Mayor `crosses_per_90` | Carrilero / Extremo de Volumen |
| Striker | Mayor `offsides_per_90` | Goleador / Delantero de Área |
| Defensive | Mayor `tackles_won_per_90` | Destructor / Recuperador |
| Creative | Mayor `goals_per_90` (entre restantes) | Atacante Eficiente / Creador |
| Positional | Último cluster sin asignar | Defensor / Mediocampista Posicional |

Los porteros se asignan directamente al perfil "Guardameta" sin pasar por K-Means.

**Tratamiento de jugadores con pocos minutos:** Los jugadores con `90s < 0.5` no tienen tasas confiables. Se imputan con la mediana de su posición en los jugadores válidos y luego se les asigna un cluster con `kmeans.predict()`.

**Ventajas de K-Means:**
- Simple, escalable e interpretable.
- Los centroides tienen significado semántico directo (el "jugador promedio" de cada perfil).

**Desventajas:**
- Requiere especificar `k` a priori (se validó con Elbow Method y Silhouette Score).
- Sensible a outliers — un jugador con estadísticas extremas puede desplazar un centroide.
- Asume clusters esféricos en el espacio euclídeo — perfiles tácticos reales pueden tener formas irregulares.
- No modela incertidumbre: cada jugador pertenece a exactamente un cluster (sin probabilidades).

**Visualización:** PCA 2D y t-SNE 2D para validación visual de la separabilidad de clusters (`models/shap_plots/player_clusters_*.png`).

---

### 7.6 Predicción de xG Overperformance (Modelo Dual)

**Archivo:** `model_xg_overperformance.py`  
→ `xg_overperformance_xgb_model.pkl`, `xg_overperformance_lr_model.pkl`

#### Variable Target

```
xg_overperformance = Performance_Gls_allcomps - Performance_xG_allcomps
```

Mide cuántos goles convirtió un jugador **por encima o por debajo** de lo esperado según sus oportunidades. Es una métrica de calidad de finalización pura (separa la suerte del talento).

Se entrenan dos modelos para comparación:
- **XGBoost Regressor** — captura no linealidades.
- **Linear Regression Pipeline** (con `SimpleImputer` + `StandardScaler`) — baseline interpretable.

Se excluyen explícitamente features que son derivadas del target para evitar leakage (todas las columnas de goles, asistencias, xG, minutos por gol, On/Off).

**Evaluación (5-Fold CV):**

| Modelo | RMSE | MAE |
|---|---|---|
| XGBoost | ≈ 2.1 | ≈ 1.4 |
| Linear Regression | ≈ 2.4 | ≈ 1.6 |

---

### 7.7 Modelo Fisiológico KNN (Descartado)

**Archivo:** `physiological_knn.pkl`  
**Estado:** ⚠️ **DESCARTADO en producción** — el modelo se carga pero no se utiliza para inferencia.

#### Motivo del descarte

El modelo KNN estaba entrenado sobre `multimodal_sports_injury_dataset.csv`, un dataset genérico de sensores biométricos de atletas **sin relación con los jugadores del Mundial 2026**. Los valores predichos (sleep_quality, hydration_level, body_temperature, stress_level, training_load) eran imputaciones estadísticas por similitud de edad/BMI, **no mediciones reales** de los jugadores.

Presentar estas estimaciones en el dashboard como si fueran datos fisiológicos del jugador constituía información fabricada que podía inducir decisiones erróneas. En un proyecto de ciencia de datos, la ausencia de datos reales debe comunicarse como tal, no enmascararse con imputaciones de fuentes no relacionadas.

#### Qué se muestra ahora

El endpoint de riesgo de lesión (`/api/v1/injuries/risk/{id}`) devuelve:
- **Datos reales:** Riesgo de lesión del modelo XGBoost, fatigue_index, estadísticas de juego.
- **Campos fisiológicos:** `null` — indicando que los datos no están disponibles sin sensores biométricos reales.
- **Radar:** Basado en stats reales del jugador (90s jugados, porcentaje de minutos, intercepciones).

---

## 8. Optimización de Plantillas (Fase 5 — IO)

**Archivo:** `model_squad_optimization.py` → `optimal_squads.csv` (1,248 jugadores seleccionados)  
**Método:** Programación Lineal Entera Mixta (MILP — Mixed Integer Linear Programming)  
**Librería:** [PuLP](https://coin-or.github.io/pulp/)

### 8.1 Formulación del Problema

Para cada una de las 48 selecciones nacionales, se resuelve un problema de optimización combinatoria que selecciona exactamente 26 jugadores maximizando el impacto total del plantel.

**Variable de decisión:**
```
xᵢ ∈ {0, 1}   para cada jugador i del país
xᵢ = 1  →  jugador seleccionado en la lista de 26
```

**Función objetivo:**
```
Maximizar: Σᵢ xᵢ · adjusted_score_i
```

**Score ajustado con penalización por lesiones:**
```python
impact_normalized = 100 * (impact_score_raw - min) / (max - min)
adjusted_score = impact_normalized - (total_injuries * 5)
```

Cada lesión histórica descuenta 5 puntos del score de impacto. Esto crea un trade-off explícito entre impacto y disponibilidad médica.

**Restricciones:**
```
Σᵢ xᵢ = 26                           # Exactamente 26 jugadores
Σᵢ xᵢ · [posᵢ == GK] == 3           # Exactamente 3 porteros
7 ≤ Σᵢ xᵢ · [posᵢ == DF] ≤ 10       # Entre 7 y 10 defensores
6 ≤ Σᵢ xᵢ · [posᵢ == MF] ≤ 10       # Entre 6 y 10 mediocampistas
5 ≤ Σᵢ xᵢ · [posᵢ == FW] ≤ 8        # Entre 5 y 8 delanteros
```

**Solver:** PULP_CBC_CMD (CBC — Coin-or Branch and Cut), solver open-source de referencia para MILP. Se ejecuta sin mensajes de log (`msg=False`).

### 8.2 Ejemplo: Solución Óptima para Argentina

```
GK  Gerónimo Rulli        (Marseille,     adjusted_score:   1.36)
GK  Juan Musso            (Atl. Madrid,   adjusted_score: -28.0)
GK  Emiliano Martínez     (Aston Villa,   adjusted_score: -77.6)

DF  Valentín Barco        (Strasbourg,    adjusted_score: -33.2)
DF  Nahuel Molina         (Atl. Madrid,   adjusted_score: -57.5)
DF  Leonardo Balerdi      (Marseille,     adjusted_score: -62.2)
...

FW  Flaco López           (Palmeiras,     adjusted_score: +31.4)  ← mejor FW
FW  Giuliano Simeone      (Atl. Madrid,   adjusted_score: +15.9)
FW  Julián Álvarez        (Atl. Madrid,   adjusted_score:  +9.6)
FW  Thiago Almada         (Atl. Madrid,   adjusted_score:  +9.4)
...
```

**Observación:** Messi aparece seleccionado a pesar de un `adjusted_score` muy negativo (-172.8) porque tiene un `impact_score_raw` altísimo que compensa la penalización por lesiones. El algoritmo lo incluye porque es el jugador con mayor impacto bruto del plantel, incluso después de la penalización.

### 8.3 Complejidad Computacional

Para un país con `n` jugadores disponibles (típicamente 26–40), el problema MILP tiene:
- **Variables binarias:** `n` (una por jugador)
- **Restricciones:** 6 (total + 5 de posición)

Con `n ≤ 40`, el espacio de búsqueda es `2^40 ≈ 10^12` combinaciones posibles en el peor caso, pero el solver CBC resuelve instancias de este tamaño en milisegundos gracias a la relajación LP y el branch-and-bound.

---

## 9. Codificación Final y Feature Matrices (Fase 3b)

**Script:** `scripts/3_feature_eng/final_encoding.py`

Genera los archivos `X_*.csv` en `data/4_featured/` — las feature matrices completamente codificadas, listas para consumo directo por algoritmos sklearn/XGBoost.

### 9.1 Proceso de Codificación

Para cada tabla maestra se aplica un pipeline de codificación consistente:

1. **Variables categóricas de alta cardinalidad** (Club, League, Tipo_Lesion, Country, Opponent, Formation, Captain) → **One-Hot Encoding** (`pd.get_dummies`).
2. **Variables numéricas** → se dejan sin modificar (XGBoost no requiere normalización).
3. **Variables booleanas** → convertidas a `int` (0/1).
4. **Encoders serializados** → `data/4_featured/encoders.pkl` para garantizar que el mismo encoding se aplique en inferencia.

### 9.2 Feature Matrices Generadas

| Archivo | Filas | Columnas | Uso |
|---|---|---|---|
| `X_players.csv` | 1,257 | ≈180 | Modelo de impacto base |
| `X_players_enriched.csv` | 1,257 | ≈220 | Modelo de impacto enriquecido |
| `X_matches.csv` | 825 | 504 | Modelo de resultado de partido |
| `X_match_weather.csv` | 695 | 54 | Modelo de resultado con clima |
| `X_injuries.csv` | 8,611 | 2,317 | Modelo de riesgo de lesión |
| `X_teams.csv` | 52 | 92 | Modelo de puntos de grupo |

La enorme dimensionalidad de `X_injuries.csv` (2,317 columnas) se debe al one-hot encoding de `Club` (≈600 clubes únicos), `League` (≈70 ligas), `Tipo_Lesion` (≈250 diagnósticos únicos), `Country`, `Pos` y el encoding de `Edad_FBref` y `Playing_Time_Min_allcomps` como variables categóricas.

**Nota importante para reproducibilidad:** Los modelos finales en `models/pkl/` fueron entrenados con los scripts en `scripts/5_modeling/` que leen directamente de `master_*_featured.csv` (no de `X_*.csv`), aplicando `LabelEncoder` internamente en lugar de One-Hot. Los archivos `X_*.csv` son principalmente útiles para experimentos adicionales o modelos que requieren matrices densas.

---

## 10. Despliegue — API + Dashboard (Fase 6)

### 10.1 Arquitectura de Inferencia

```
FastAPI Backend (Python)
├── Startup (lifespan):
│   ├── Carga 10 modelos .pkl en RAM           → app.state.models
│   └── Carga 8 datasets CSV en DataFrames     → app.state.data
│
├── Endpoints de inferencia:
│   ├── POST /api/v1/matches/predictions        → match_outcome_weather_xgb
│   ├── GET  /api/v1/injuries/risk/{id}         → injury_xgboost_model
│   ├── GET  /api/v1/teams/{name}/prediction    → simulación de 3 partidos con match_outcome_weather_xgb
│   ├── GET  /api/v1/teams/{name}/formation     → formation_xgb_model
│   ├── GET  /api/v1/players/{id}/impact        → player_impact_xgb_enriched
│   └── GET  /api/v1/tournament/simulate        → simulación completa (grupo + knockout)
│
└── Sin reentrenamiento en producción → latencia de inferencia < 50ms
```

**Decisión de arquitectura:** Cargar todos los modelos y datasets en memoria al iniciar el servidor elimina la latencia de disco por petición. Para 12 modelos y ~200MB de datos en RAM, esto es viable en cualquier instancia con ≥ 4GB de RAM.

**Modelos descartados en producción:**
- `team_points_xgb_model.pkl` — entrenado con 16 muestras, produce resultados no confiables. Reemplazado por simulación de partidos.
- `physiological_knn.pkl` — entrenado sobre dataset genérico ajeno a los jugadores del Mundial. El endpoint devuelve `null` para campos fisiológicos.

### 10.2 Flujo de una Predicción de Partido

```
Cliente → POST /api/v1/matches/predictions
         { team_a: "Argentina", team_b: "France",
           temp_max: 22, precipitation: 0, wind_speed: 8 }

         ↓
1. match_predictor.py: busca datos de Argentina en master_matches_featured
   → extrae: Country_FIFA_Points = 1889.0, Country_FIFA_Rank = 1,
             form_last_5 = 9.0, goals_scored_last_5 = 3.33

2. Busca FIFA info de France → Points = 1851.9, Rank = 2
   ranking_diff = Rank_A - Rank_B = 1 - 2 = -1
   (negativo = Argentina tiene MEJOR ranking)

3. Busca H2H directo Argentina vs France en matches_df
   → h2h_wins = 0, h2h_losses = 0

4. Construye vector de 14 features → DataFrame(1, 14)

5. Intenta modelo 3-class (match_outcome_xgb) que predice W/D/L directamente.
   Si falla, usa modelo binario (match_outcome_weather_xgb):
   → predict_proba → prob_win_A_raw = 0.82

6. Distribución dinámica del empate:
   uncertainty = 1.0 - |0.82 - 0.5| × 2 = 0.36
   prob_draw = 0.20 + 0.15 × 0.36 = 0.254
   remaining = 1.0 - 0.254 = 0.746
   prob_A = 0.746 × 0.82 = 0.612
   prob_B = 0.746 × 0.18 = 0.134
   → Normalizar a sum=1

   → { win_A: 0.612, draw: 0.254, win_B: 0.134 }
   → prediction: "Argentina"

7. SHAP: calcula contribuciones por feature vía pred_contribs de XGBoost
   → Top feature: ranking_diff (peso -0.95, favorece a Argentina)
```

**Nota sobre `ranking_diff`:** La feature se define como `Country_FIFA_Rank - Opponent_FIFA_Rank`. Un valor negativo indica que el equipo A tiene mejor ranking (número más bajo = mejor). El modelo fue entrenado con esta convención y es la feature con mayor peso SHAP (~2.0).

---

## 11. Aplicaciones Profesionales para Ejecutivos de Negocio

> Esta sección está dirigida a directores deportivos, gerentes generales y ejecutivos de clubes o federaciones que quieran comprender el valor de negocio de este sistema.

---

### 11.1 Reducción del Riesgo Médico y Económico en Fichajes

**El problema:** Un club de fútbol de élite invierte en promedio entre €15M y €80M por jugador. Una lesión grave (ACL, fractura) puede dejar a ese activo fuera de actividad entre 6 y 18 meses, con pérdida directa en rendimiento deportivo e indirecta en valor de mercado y patrocinios.

**Lo que hace este sistema:** El modelo de riesgo de lesión (`injury_xgboost_model`) analiza el historial médico completo de un jugador (tipo de lesiones, frecuencia, tiempo de recuperación) y genera una probabilidad de lesión en los próximos 6 meses. Con un **AUC-ROC de 0.63** y **C-Index de 0.75 en el análisis de supervivencia**, el sistema identifica correctamente en casi 3 de cada 4 casos qué jugador tiene mayor probabilidad de lesionarse primero.

**Caso de uso concreto:** Antes de cerrar un fichaje de €30M, el departamento médico puede ejecutar el análisis sobre el historial del jugador objetivo en segundos. Si el sistema indica riesgo "CRITICAL" (>70%), el club puede negociar una cláusula de revisión médica exhaustiva, reducir el monto fijo o incluir variables de rendimiento protegidas.

**Impacto estimado:** Estudios del CIES Football Observatory estiman que las lesiones cuestan a la industria del fútbol europeo más de €500M por temporada en salarios de jugadores inactivos. Sistemas de prevención que reducen la tasa de lesiones en un 10-15% representan un ahorro de decenas de millones para los clubes top.

---

### 11.2 Optimización de la Convocatoria Nacional

**El problema:** Un seleccionador nacional tiene entre 50 y 80 jugadores "convocables" pero solo puede llevar 26 al torneo. La elección subóptima (incluir jugadores lesionados, sacrificar profundidad en una línea) puede costar la eliminación.

**Lo que hace este sistema:** El algoritmo de optimización lineal (`model_squad_optimization.py`) resuelve matemáticamente el problema: dada la disponibilidad médica y el impacto esperado de cada jugador, encuentra la combinación de 26 que maximiza el potencial colectivo respetando las restricciones posicionales (3 porteros, mínimo 7 defensores, etc.).

**Diferencia con la selección manual:** Un entrenador optimiza intuitivamente desde el conocimiento cualitativo. El algoritmo incorpora simultáneamente 175 variables por jugador (estadísticas de juego, historial de lesiones, valor de mercado como proxy de nivel) que ningún ser humano puede procesar en paralelo.

**Caso de uso concreto:** La Federación Argentina puede ver la plantilla óptima sugerida por el algoritmo y compararla con la intuición del cuerpo técnico. No es un reemplazo del seleccionador — es una herramienta de validación que fuerza justificar desviaciones del óptimo matemático.

---

### 11.3 Inteligencia Competitiva Pre-Partido

**El problema:** El análisis táctico tradicional es retrospectivo (revisa partidos pasados) y manual (requiere decenas de horas de analistas de video).

**Lo que hace este sistema:** El endpoint de predicción de partidos (`/api/v1/matches/predictions`) combina en tiempo real:
- Diferencial de ranking FIFA entre ambos equipos
- Forma reciente (últimos 5 partidos) de cada selección
- Historial de enfrentamientos directos
- Condiciones climáticas del estadio

Y genera probabilidades de victoria/empate/derrota en menos de 50 milisegundos.

**Caso de uso para operaciones de apuestas o medios:** Una plataforma de contenido deportivo puede usar el API para generar predicciones automáticas de los 104 partidos del Mundial en tiempo real, actualizando las probabilidades a medida que se conocen resultados. Esto alimenta widgets interactivos para el usuario final sin intervención editorial manual.

---

### 11.4 Scouting Basado en Datos — Descubrimiento de Talento Oculto

**El problema:** Los clubes de Tier-2 y Tier-3 no pueden competir en el mercado de transferencias con los gigantes europeos por jugadores conocidos. Su ventaja competitiva está en identificar talento infravalorado antes que la competencia.

**Lo que hace este sistema:** El clustering táctico K-Means asigna a cada uno de los 1,257 jugadores del Mundial un perfil táctico objetivo (`Destructor/Recuperador`, `Carrilero/Extremo de Volumen`, etc.) basado **exclusivamente en estadísticas de juego per-90 minutos**, no en el nombre o el club.

**Caso de uso concreto:** Un director deportivo necesita un "Destructor/Recuperador" con bajo riesgo de lesiones y alto impacto para reforzar el mediocampo. En lugar de buscar manualmente en bases de datos, el sistema filtra los 52 jugadores del perfil, los ordena por `adjusted_score` y los compara por valor de mercado. Un jugador en el percentil 85 de impacto pero en el percentil 40 de valor de mercado es la oportunidad de scouting óptima.

**Valor económico:** El modelo de impacto enriquecido puede identificar jugadores con `impact_score_normalized` alto que aún no han sido "descubiertos" por el mercado (bajo `MarketValue_EUR`). Esta diferencia entre impacto real y precio de mercado es la definición exacta del arbitraje de valor en transferencias.

---

### 11.5 Gestión de Riesgo en Patrocinios y Seguros Deportivos

**El problema:** Una marca global que patrocina a un jugador estrella por €5M/año pierde visibilidad si ese jugador se lesiona en el primer mes del torneo. Las aseguradoras de eventos deportivos necesitan cuantificar la probabilidad de que los jugadores clave estén disponibles para los partidos televisados de mayor audiencia.

**Lo que hace este sistema:** El análisis de supervivencia Cox y el modelo de riesgo de lesión generan no solo una clasificación binaria (lesionado/sano) sino una **probabilidad continua** de riesgo. Esto permite:
- Estructurar primas de seguro diferenciadas por nivel de riesgo del jugador asegurado.
- Calcular el "valor en riesgo" de un acuerdo de patrocinio (expected value ajustado por probabilidad de disponibilidad).
- Diseñar contratos con cláusulas de performance contingente a la salud del atleta.

**Ejemplo numérico:** Si el sistema estima que Messi tiene una probabilidad de lesión del 68% en los próximos 6 meses (consistente con el resultado de la API para jugadores de 38 años con historial médico denso), una aseguradora puede cobrar una prima de protección proporcional a esa probabilidad × el valor asegurado.

---

### 11.6 Optimización de Calendarios y Gestión de Carga de Entrenamiento

**El problema:** Las federaciones y clubes deben coordinar calendarios de partidos de selección con el calendario de liga de los clubes. La acumulación de partidos ("congestion") aumenta el riesgo de lesión muscular documentado en la literatura (Bengtsson et al., 2020).

**Lo que hace este sistema:** La feature `days_since_last_match` en el modelo de resultado de partido captura el efecto de la fatiga acumulada sobre el rendimiento. La feature `training_load` del modelo fisiológico KNN estima la carga de entrenamiento semanal óptima. Combinados, estos outputs permiten:
- Identificar jugadores en zona de "fatiga crítica" antes de un partido importante.
- Recomendar rotación de plantilla basada en scores de riesgo individuales.
- Negociar con los clubes el número máximo de partidos de selección seguros por temporada.

---

### Resumen Ejecutivo

| Aplicación | Usuario | Impacto de Negocio |
|---|---|---|
| Evaluación médica pre-fichaje | Director Deportivo / Médico de club | Reducción de riesgo en inversiones de €M |
| Convocatoria óptima nacional | Seleccionador / Federación | Maximización del potencial competitivo del plantel |
| Predicción de partidos | Medios, plataformas de apuestas | Contenido automatizado para 104 partidos |
| Scouting de talento oculto | Departamento de scouting | Arbitraje de valor en el mercado de transferencias |
| Pricing de seguros deportivos | Aseguradoras / Patrocinadores | Productos financieros ajustados al riesgo real |
| Gestión de carga de entrenamiento | Cuerpo técnico / Fisioterapeutas | Prevención de lesiones y extensión de la carrera del atleta |

> **Conclusión para el ejecutivo:** Este sistema convierte datos deportivos en decisiones de negocio cuantificables. No reemplaza el criterio humano — lo amplifica con el procesamiento simultáneo de cientos de variables que ningún analista podría considerar manualmente en el tiempo disponible antes de una decisión crítica.

---

## 12. Guía de Uso del Dashboard — ¿Para qué sirve cada página?

Esta sección explica, en lenguaje no técnico, **qué decisión permite tomar cada pantalla** del dashboard y cómo usarla.

---

### 12.1 Player Profiling & Scouting

**Pregunta que responde:** *"¿A quién convoco/ficho y por qué?"*

Esta pantalla es una herramienta de decisión de scouting. No es un catálogo de datos — está diseñada para que un director técnico, scout o analista llegue a una conclusión concreta sobre qué jugador elegir.

#### Flujo de uso típico

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Filtrar por perfil táctico, país, edad, y ordenar por métrica relevante | Se reduce el universo de 1,186 jugadores a un grupo manejable |
| 2 | Identificar 3-4 candidatos en el grid | Las cards muestran Impact Score (color semántico), perfil K-Means y xG Overperformance |
| 3 | Click en ✨ (Sparkles) en un jugador | Se abre un panel con 8 alternativas del mismo perfil táctico, ordenadas por similitud |
| 4 | Agregar jugadores al comparador (👤+) | Se acumulan en la barra flotante inferior |
| 5 | Click en "Comparar" | Se abre un modal con radar superpuesto, tabla de métricas y veredicto algorítmico |
| 6 | Leer el veredicto y decidir | El sistema pondera Impact (40%) + xG (20%) + Salud (20%) + Overall (20%) y sugiere al mejor candidato |

#### Escenarios concretos

**"Necesito un reemplazo para mi extremo lesionado"**
→ Filtrar Perfil: Carrilero/Extremo · Edad max: 28 · Ordenar por Impact Score · Usar "Jugadores Similares" sobre el lesionado · Comparar las 3 mejores opciones

**"Quiero descubrir promesas sub-23"**
→ Edad: 17-22 · Ordenar por Impact Score · Cambiar a Vista Analytics → el gráfico Moneyball muestra las joyas ocultas (cuadrante superior izquierdo = jóvenes con alto impacto)

**"¿Quién rinde más de lo que parece?"**
→ Ordenar por xG Overperformance · Filtrar Cluster: Goleador · Los que aparecen arriba con Overall FIFA bajo son jugadores infravalorados que definen partidos

#### Vista Analytics

La pestaña "Visual Analytics" ofrece 6 gráficos interactivos para análisis de patrones:

- **Moneyball (Impacto vs Edad):** Identifica joyas ocultas (jóvenes con alto impacto) y veteranos en declive
- **Trade-Off (Impacto vs Lesiones):** Muestra la tensión riesgo/recompensa que el Squad Optimizer resuelve
- **xG Overperformance:** Encuentra finalizadores clínicos que superan consistentemente sus goles esperados
- **Distribución por Perfil Táctico (Beeswarm):** Compara el rendimiento dentro de cada cluster K-Means
- **Ranking por Cluster:** Top 10 mundial de cada perfil táctico
- **Radar individual:** Atributos FIFA del jugador vs promedio de su cluster

---

### 12.2 Match Prediction

*(Pendiente de documentar)*

---

### 12.3 Squad Optimizer

*(Pendiente de documentar)*

---

### 12.4 Inteligencia Táctica — Desgaste Físico

**Pregunta que responde:** *"¿Cuáles son los puntos débiles físicos de ambos equipos y cómo los exploto?"*

Esta pantalla permite a un director técnico analizar el estado físico de **ambos equipos** antes de un partido para tomar decisiones tácticas: a quién presionar del rival, a quién proteger del propio plantel, y cómo ajustar la intensidad.

#### Flujo de uso típico

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Seleccionar una fecha del fixture | Se muestran los partidos disponibles con estadio y clima |
| 2 | Seleccionar un partido | Se despliega el Mapa de Vulnerabilidades con ambos planteles |
| 3 | Leer el panel "Estado Físico de Ambos Equipos" | Resumen instantáneo: cuántos jugadores de cada equipo están en riesgo |
| 4 | Analizar el listado de jugadores (ordenados por riesgo) | Los más vulnerables están arriba con barra roja y label "Crítico" |
| 5 | Click en un jugador específico (propio o rival) | Se abre su diagnóstico individual: radar fisiológico, gauge de riesgo, contexto geoclimático |
| 6 | Usar el Simulador What-If | Mover los sliders para simular escenarios ("¿qué pasa si juega 3 partidos en 15 días?") |

#### Escenarios concretos

**"El lateral derecho rival viene sobrecargado — lo presiono por esa banda"**
→ Seleccionás el partido → ves que el lateral rival tiene 68% de riesgo (Crítico) → decidís poner a tu extremo más rápido por esa banda para explotarlo en los últimos 30 minutos.

**"¿Mi mediocampista clave puede jugar dos partidos en una semana?"**
→ Seleccionás al jugador → ves que su riesgo actual es 45% → usás el What-If poniendo "3 partidos en 15 días" → el riesgo sube a 62% → decidís descansarlo en el primer partido para que esté fresco en el segundo.

**"El rival juega en altitud y calor — ¿cuánto les afecta?"**
→ El panel geoclimático muestra 2,240m de altitud y 32°C → los jugadores del rival con bajo cardio estimado van a sufrir más → intensificás el ritmo en el segundo tiempo.

**"¿Quién es el eslabón débil del rival para presionar?"**
→ Mirás el plantel rival ordenado por riesgo → los 3-4 primeros (en rojo) son los que probablemente rindan menos → les asignás marca personalizada con tus jugadores más frescos.

#### Componentes de la pantalla

- **Selector de Fixture**: Fechas + partidos con foto de estadio, temperatura, altitud y humedad real (Open-Meteo API)
- **Botón "Predecir equipos"** (partidos de knockout): Usa el simulador de torneo para determinar qué selecciones jugarían ese partido
- **Panel "Estado Físico de Ambos Equipos"**: Resumen táctico neutral sin asumir cuál es tu equipo
- **Mapa de Vulnerabilidades**: Ambos planteles lado a lado, cada jugador con barra de riesgo (0-100%) y badge Crítico/Moderado/Apto
- **Diagnóstico Individual** (al clickear un jugador): Radar fisiológico + gauge circular de riesgo + datos geoclimáticos del estadio
- **Simulador What-If**: Dos sliders reactivos (partidos adicionales en 15 días + días desde última lesión) que recalculan el riesgo en tiempo real

#### Vista "Modelo & Validación" (para científicos de datos)

La pestaña técnica documenta paso a paso:

1. **Fuentes de datos**: Transfermarkt (8,611 lesiones) + FBref (stats de juego)
2. **Feature Engineering**: 123 features, incluyendo rolling por jugador (injury_frequency, days_since_last_injury, is_recurrent, severity_score)
3. **Modelo XGBoost**: Binary Classifier, diagrama de inferencia, feature importance real del modelo cargado, histograma de distribución de riesgo
4. **Perfil Fisiológico**: Fórmulas correlacionales (cardio, endurance, recovery, respiratory) con explicación de por qué NO son datos de sensores
5. **Simulador What-If**: Cómo funciona técnicamente (override de 2 features + re-predicción = análisis de sensibilidad)
6. **Cómo leer el Panel**: Los 3 niveles de diagnóstico, interpretación del radar y datos geoclimáticos

---

### 12.5 Tournament Simulator

*(Pendiente de documentar)*

---

## Referencias

- Carey, D. L., et al. (2018). *Predictive modelling of training loads and injury in Australian football*. International Journal of Computer Science in Sport, 17(1), 52–68.
- Meeuwisse, W. H., et al. (2007). *A dynamic model of etiology in sport injury: the recursive nature of risk and causation*. Clinical Journal of Sport Medicine, 17(3), 215–219.
- Dixon, M. J., & Coles, S. G. (1997). *Modelling association football scores and inefficiencies in the football betting market*. Journal of the Royal Statistical Society, 46(2), 265–280.
- Carpita, M., et al. (2019). *Discovering the drivers of football match outcomes with data mining*. Quality Technology & Quantitative Management, 16(5), 561–577.
- Bengtsson, H., et al. (2020). *Muscle injury rate in professional football is higher in matches played within 6 days of a prior match: a 6-year prospective study*. British Journal of Sports Medicine, 54(24), 1458–1464.
- Herm, S., et al. (2014). *When a prediction champion falters in the field: a comment on "Are FIFA's market value proxy variables accurate?"*. Journal of Sports Economics, 15(4), 422–437.
- Chen, T., & Guestrin, C. (2016). *XGBoost: A Scalable Tree Boosting System*. ACM SIGKDD, 785–794.
- MacQueen, J. (1967). *Some methods for classification and analysis of multivariate observations*. Proceedings of the 5th Berkeley Symposium, 1, 281–297.
- Dantzig, G. B. (1963). *Linear Programming and Extensions*. Princeton University Press.

---

*Documento generado el 18 de junio de 2026 — World Cup 2026 Analytics Pipeline v1.0*
