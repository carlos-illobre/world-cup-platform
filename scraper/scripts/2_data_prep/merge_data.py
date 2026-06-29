import os
import re
import pandas as pd
import numpy as np
from collections import defaultdict

# Absolute directory paths
BASE_DIR = r"c:\Users\carlo\Downloads\world_cup_scraper"
INPUT_DIR = os.path.join(BASE_DIR, "unified_data")
CLEANED_DIR = os.path.join(INPUT_DIR, "cleaned")
ADDITIONAL_DIR = os.path.join(INPUT_DIR, "additional")

# Output files
MASTER_PLAYERS_PATH = os.path.join(INPUT_DIR, "master_players.csv")
MASTER_MATCHES_PATH = os.path.join(INPUT_DIR, "master_matches.csv")
MASTER_TEAMS_PATH = os.path.join(INPUT_DIR, "master_teams.csv")
MASTER_INJURIES_PATH = os.path.join(INPUT_DIR, "master_injuries.csv")

# -------------------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------------------
def clean_market_value(val):
    if pd.isna(val):
        return np.nan
    val_str = str(val).strip().lower()
    # Strip everything except digits, decimal points, 'm', 'k'
    val_str = re.sub(r'[^\d.mk]', '', val_str)
    if not val_str:
        return np.nan
    try:
        if val_str.endswith('m'):
            return float(val_str[:-1]) * 1_000_000
        elif val_str.endswith('k'):
            return float(val_str[:-1]) * 1_000
        else:
            return float(val_str)
    except ValueError:
        return np.nan

def clean_country_name(name):
    if pd.isna(name):
        return name
    name = str(name).strip()
    # Remove prefix of 2 or 3 lowercase letters followed by space (e.g. 'dz Algeria', 'eng England')
    name = re.sub(r'^[a-z]{2,3}\s+', '', name)
    
    # Map country name synonyms to align with FIFA Rankings
    synonyms = {
        'UAE': 'United Arab Emirates',
        'Cape Verde': 'Cabo Verde',
        'Dominican Rep.': 'Dominican Republic',
        'São Tomé': 'Sao Tome e Principe',
        'S\u00e3o Tom\u00e9': 'Sao Tome e Principe',
        'S\ufffd\ufffdo Tom\ufffd\ufffd': 'Sao Tome e Principe',
        'S\ufffdo Tom\ufffd': 'Sao Tome e Principe',
        'Equ. Guinea': 'Equatorial Guinea',
        'Trin & Tobago': 'Trinidad and Tobago',
        'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
        'Rep. of Ireland': 'Republic of Ireland',
        'N. Macedonia': 'North Macedonia',
        'United States': 'USA',
        'CAR': 'Central African Republic',
    }
    return synonyms.get(name, name)

# -------------------------------------------------------------
# HELPERS FOR STATS AGGREGATION
# -------------------------------------------------------------
def aggregate_player_stats(df, suffix=""):
    df = df.copy()
    # Group by Player and Country to aggregate multiple rows (e.g. from different clubs/competitions)
    # to exactly 1 row per Player+Country
    agg_dict = {}
    for col in df.columns:
        if col in ['Player', 'Country']:
            continue
        if col in ['Pos', 'Age']:
            # Non-numeric or metadata we want to preserve the first occurrence of
            agg_dict[col] = 'first'
            continue
            
        # Try to convert to numeric if it's object type but contains numeric values (possibly with commas)
        if df[col].dtype == 'object':
            s = df[col].astype(str).str.replace(',', '', regex=False).str.strip()
            s = s.replace(['-', '', 'nan', 'None'], np.nan)
            s_num = pd.to_numeric(s, errors='coerce')
            if not s_num.isna().all():
                df[col] = s_num
                
        if pd.api.types.is_numeric_dtype(df[col]):
            # If rate or ratio, take mean, else sum
            col_lower = col.lower()
            if '90' in col_lower or '%' in col_lower or 'ppm' in col_lower or 'ratio' in col_lower or 'on-off' in col_lower or '+/-' in col_lower or 'rate' in col_lower:
                agg_dict[col] = 'mean'
            else:
                agg_dict[col] = 'sum'
        else:
            agg_dict[col] = 'first'
            
    df_agg = df.groupby(['Player', 'Country']).agg(agg_dict).reset_index()
    if suffix:
        # Suffix columns except keys
        rename_dict = {col: f"{col}{suffix}" for col in df_agg.columns if col not in ['Player', 'Country']}
        df_agg = df_agg.rename(columns=rename_dict)
    return df_agg

def merge_dataframes_clean(dfs):
    merged = None
    for item in dfs:
        if isinstance(item, tuple):
            df = item[1]
        else:
            df = item
            
        if merged is None:
            merged = df.copy()
        else:
            # Drop columns in df that are already in merged (except keys)
            cols_to_drop = [col for col in df.columns if col in merged.columns and col not in ['Player', 'Country']]
            if cols_to_drop:
                df = df.drop(columns=cols_to_drop)
            merged = pd.merge(merged, df, on=['Player', 'Country'], how='outer')
    return merged

# -------------------------------------------------------------
# TASK 2.1: master_players.csv
# -------------------------------------------------------------
def build_master_players():
    print("\n==================================================")
    print("TASK 2.1: Creating master_players.csv...")
    print("==================================================")
    
    # Load roster
    roster_path = os.path.join(CLEANED_DIR, "cleaned_roster.csv")
    print(f"Loading roster: {roster_path}")
    roster = pd.read_csv(roster_path)
    
    # Load market values (same size and order)
    mv_path = os.path.join(ADDITIONAL_DIR, "player_market_values.csv")
    print(f"Loading market values: {mv_path}")
    mv = pd.read_csv(mv_path)
    
    # Align and clean market values
    roster['MarketValue_EUR'] = mv['MarketValue_EUR'].apply(clean_market_value)
    
    # Load World Cup player stats
    wc_stats_types = ['standard', 'shooting', 'misc', 'playing_time', 'keeper']
    wc_dfs = []
    
    for st_type in wc_stats_types:
        fpath = os.path.join(CLEANED_DIR, f"cleaned_wc_stats_{st_type}.csv")
        if os.path.exists(fpath):
            print(f"Loading and aggregating WC stats ({st_type}): {fpath}")
            df = pd.read_csv(fpath)
            
            # Exclude Pos and Age from stats files (except keys)
            cols_to_drop = [c for c in ['Pos', 'Age'] if c in df.columns]
            df = df.drop(columns=cols_to_drop)
            
            df_agg = aggregate_player_stats(df)
            
            # Suffix keeper columns to be clear
            if st_type == 'keeper':
                rename_dict = {col: f"GK_{col}" for col in df_agg.columns if col not in ['Player', 'Country']}
                df_agg = df_agg.rename(columns=rename_dict)
                
            wc_dfs.append((st_type, df_agg))
            
    # Load All Competitions player stats
    all_dfs = []
    for st_type in wc_stats_types:
        fpath = os.path.join(CLEANED_DIR, f"cleaned_all_stats_{st_type}.csv")
        if os.path.exists(fpath):
            print(f"Loading and aggregating All Competitions stats ({st_type}): {fpath}")
            df = pd.read_csv(fpath)
            
            # Exclude Pos and Age
            cols_to_drop = [c for c in ['Pos', 'Age'] if c in df.columns]
            df = df.drop(columns=cols_to_drop)
            
            df_agg = aggregate_player_stats(df, suffix="_allcomps")
            all_dfs.append(df_agg)

    # Sequentially merge World Cup stats
    merged_wc = merge_dataframes_clean(wc_dfs)
            
    # Sequentially merge All Competitions stats
    merged_all = merge_dataframes_clean(all_dfs)

    # Aggregate injuries per player
    injuries_path = os.path.join(CLEANED_DIR, "cleaned_injuries.csv")
    print(f"Loading injuries: {injuries_path}")
    inj = pd.read_csv(injuries_path)
    
    # Convert fields to numeric to avoid string concatenation during sum
    inj['Dias_Baja'] = pd.to_numeric(inj['Dias_Baja'], errors='coerce')
    inj['Partidos_Perdidos'] = pd.to_numeric(inj['Partidos_Perdidos'], errors='coerce')
    
    # Map Jugador/Seleccion to Player/Country
    inj['Player_clean'] = inj['Jugador'].apply(clean_country_name)
    inj['Country_clean'] = inj['Seleccion'].apply(clean_country_name)
    
    inj_agg = inj.groupby(['Player_clean', 'Country_clean']).agg(
        total_injuries=('Jugador', 'count'),
        total_days_out=('Dias_Baja', 'sum'),
        avg_days_out=('Dias_Baja', 'mean'),
        total_matches_missed=('Partidos_Perdidos', 'sum')
    ).reset_index()
    
    # Normalise roster names for joining
    roster['Player_clean'] = roster['Player'].apply(clean_country_name)
    roster['Country_clean'] = roster['Country'].apply(clean_country_name)
    
    # Merge Roster with WC Stats (LEFT JOIN from roster)
    master_players = roster.copy()
    if merged_wc is not None:
        merged_wc['Player_clean'] = merged_wc['Player'].apply(clean_country_name)
        merged_wc['Country_clean'] = merged_wc['Country'].apply(clean_country_name)
        # Drop raw keys to avoid duplication
        merged_wc = merged_wc.drop(columns=['Player', 'Country'])
        master_players = pd.merge(master_players, merged_wc, on=['Player_clean', 'Country_clean'], how='left')
        
    # Merge with All Competitions Stats (LEFT JOIN)
    if merged_all is not None:
        merged_all['Player_clean'] = merged_all['Player'].apply(clean_country_name)
        merged_all['Country_clean'] = merged_all['Country'].apply(clean_country_name)
        merged_all = merged_all.drop(columns=['Player', 'Country'])
        master_players = pd.merge(master_players, merged_all, on=['Player_clean', 'Country_clean'], how='left')
        
    # Merge with Injuries (LEFT JOIN)
    master_players = pd.merge(master_players, inj_agg, on=['Player_clean', 'Country_clean'], how='left')
    
    # Fill injury NaNs with 0 (since no record means 0 injuries/days out)
    master_players['total_injuries'] = master_players['total_injuries'].fillna(0).astype(int)
    master_players['total_days_out'] = master_players['total_days_out'].fillna(0).astype(int)
    master_players['avg_days_out'] = master_players['avg_days_out'].fillna(0)
    master_players['total_matches_missed'] = master_players['total_matches_missed'].fillna(0).astype(int)
    
    # Drop cleaning helper columns and restore columns order
    master_players = master_players.drop(columns=['Player_clean', 'Country_clean'])
    
    master_players.to_csv(MASTER_PLAYERS_PATH, index=False, encoding='utf-8-sig')
    print(f"Saved Master Players: {MASTER_PLAYERS_PATH} (Shape: {master_players.shape})")
    return master_players

# -------------------------------------------------------------
# TASK 2.2: master_matches.csv
# -------------------------------------------------------------
def build_master_matches():
    print("\n==================================================")
    print("TASK 2.2: Creating master_matches.csv...")
    print("==================================================")
    
    wc_matches_path = os.path.join(CLEANED_DIR, "cleaned_wc_matchlogs.csv")
    all_matches_path = os.path.join(CLEANED_DIR, "cleaned_all_matchlogs.csv")
    
    print(f"Loading WC matchlogs: {wc_matches_path}")
    wc_matches = pd.read_csv(wc_matches_path)
    print(f"Loading All matchlogs: {all_matches_path}")
    all_matches = pd.read_csv(all_matches_path)
    
    # Concatenate matches and drop duplicates
    matches = pd.concat([wc_matches, all_matches], ignore_index=True)
    matches = matches.drop_duplicates(subset=['Country', 'Date', 'Opponent'])
    
    # Parse Date
    matches['Date'] = pd.to_datetime(matches['Date'])
    
    # Normalize country/opponent names
    matches['Country_clean'] = matches['Country'].apply(clean_country_name)
    matches['Opponent_clean'] = matches['Opponent'].apply(clean_country_name)
    
    # Load and clean FIFA rankings
    fifa_path = os.path.join(ADDITIONAL_DIR, "fifa_rankings_historical.csv")
    print(f"Loading FIFA rankings: {fifa_path}")
    fifa = pd.read_csv(fifa_path)
    fifa['date'] = pd.to_datetime(fifa['date'])
    
    # Drop rows with null points and calculate rankings
    fifa = fifa.dropna(subset=['total_points'])
    fifa = fifa.sort_values(['date', 'total_points'], ascending=[True, False])
    fifa['rank'] = fifa.groupby('date')['total_points'].rank(ascending=False, method='min').astype(int)
    fifa['team_clean'] = fifa['team'].apply(clean_country_name)
    
    # Sort for merge_asof
    matches = matches.sort_values('Date')
    fifa = fifa.sort_values('date')
    
    # Merge FIFA Rankings for Country
    matches_merged = pd.merge_asof(
        matches,
        fifa[['date', 'team_clean', 'rank', 'total_points']],
        left_on='Date',
        right_on='date',
        left_by='Country_clean',
        right_by='team_clean',
        direction='backward'
    )
    matches_merged = matches_merged.rename(columns={'rank': 'Country_FIFA_Rank', 'total_points': 'Country_FIFA_Points'}).drop(columns=['date', 'team_clean'])
    
    # Merge FIFA Rankings for Opponent
    matches_merged = matches_merged.sort_values('Date')
    matches_merged = pd.merge_asof(
        matches_merged,
        fifa[['date', 'team_clean', 'rank', 'total_points']],
        left_on='Date',
        right_on='date',
        left_by='Opponent_clean',
        right_by='team_clean',
        direction='backward'
    )
    matches_merged = matches_merged.rename(columns={'rank': 'Opponent_FIFA_Rank', 'total_points': 'Opponent_FIFA_Points'}).drop(columns=['date', 'team_clean'])
    
    # Pre-compute H2H stats from historical WC matches
    hist_wc_path = os.path.join(ADDITIONAL_DIR, "historical_world_cups.csv")
    print(f"Loading historical World Cups: {hist_wc_path}")
    hist = pd.read_csv(hist_wc_path)
    
    h2h = defaultdict(lambda: {'matches': 0, 'wins': 0, 'losses': 0, 'draws': 0, 'goals_for': 0, 'goals_against': 0})
    for idx, row in hist.iterrows():
        c1 = clean_country_name(row['Country1'])
        c2 = clean_country_name(row['Country2'])
        s1, s2 = row['Score1'], row['Score2']
        if pd.isna(s1) or pd.isna(s2):
            continue
        s1, s2 = int(s1), int(s2)
        
        # c1 vs c2
        h2h[(c1, c2)]['matches'] += 1
        h2h[(c1, c2)]['goals_for'] += s1
        h2h[(c1, c2)]['goals_against'] += s2
        if s1 > s2:
            h2h[(c1, c2)]['wins'] += 1
        elif s2 > s1:
            h2h[(c1, c2)]['losses'] += 1
        else:
            h2h[(c1, c2)]['draws'] += 1
            
        # c2 vs c1
        h2h[(c2, c1)]['matches'] += 1
        h2h[(c2, c1)]['goals_for'] += s2
        h2h[(c2, c1)]['goals_against'] += s1
        if s2 > s1:
            h2h[(c2, c1)]['wins'] += 1
        elif s1 > s2:
            h2h[(c2, c1)]['losses'] += 1
        else:
            h2h[(c2, c1)]['draws'] += 1
            
    # Add H2H features into the merged matches
    h2h_matches = []
    h2h_wins = []
    h2h_losses = []
    h2h_draws = []
    h2h_gf = []
    h2h_ga = []
    
    for idx, row in matches_merged.iterrows():
        teamA = row['Country_clean']
        teamB = row['Opponent_clean']
        record = h2h.get((teamA, teamB))
        if record:
            h2h_matches.append(record['matches'])
            h2h_wins.append(record['wins'])
            h2h_losses.append(record['losses'])
            h2h_draws.append(record['draws'])
            h2h_gf.append(record['goals_for'])
            h2h_ga.append(record['goals_against'])
        else:
            h2h_matches.append(0)
            h2h_wins.append(0)
            h2h_losses.append(0)
            h2h_draws.append(0)
            h2h_gf.append(0)
            h2h_ga.append(0)
            
    matches_merged['h2h_matches'] = h2h_matches
    matches_merged['h2h_wins'] = h2h_wins
    matches_merged['h2h_losses'] = h2h_losses
    matches_merged['h2h_draws'] = h2h_draws
    matches_merged['h2h_goals_for'] = h2h_gf
    matches_merged['h2h_goals_against'] = h2h_ga
    
    # Load and join stadiums
    stadiums_path = os.path.join(CLEANED_DIR, "cleaned_stadiums.csv")
    print(f"Loading stadiums: {stadiums_path}")
    stadiums = pd.read_csv(stadiums_path)
    
    # Create empty Stadium column in matchlogs to allow left-joining
    # (keeps columns consistent and leaves them as NaN for historical where not matched)
    matches_merged['Stadium'] = None
    matches_merged = pd.merge(matches_merged, stadiums.drop(columns=['Country']), on='Stadium', how='left')
    
    # Calculate difference columns
    # ranking_diff: team points minus opponent points. 
    # (positive means team has more points/better ranked)
    matches_merged['ranking_diff'] = matches_merged['Country_FIFA_Points'] - matches_merged['Opponent_FIFA_Points']
    matches_merged['is_higher_ranked'] = (matches_merged['Country_FIFA_Rank'] < matches_merged['Opponent_FIFA_Rank']).astype(int)
    
    # Calculate days since last match per country
    matches_merged = matches_merged.sort_values(['Country_clean', 'Date'])
    matches_merged['days_since_last_match'] = matches_merged.groupby('Country_clean')['Date'].diff().dt.days
    
    # Drop cleaning helpers
    matches_merged = matches_merged.drop(columns=['Country_clean', 'Opponent_clean'])
    
    # Save master matches
    matches_merged.to_csv(MASTER_MATCHES_PATH, index=False, encoding='utf-8-sig')
    print(f"Saved Master Matches: {MASTER_MATCHES_PATH} (Shape: {matches_merged.shape})")
    return matches_merged

# -------------------------------------------------------------
# TASK 2.3: master_teams.csv
# -------------------------------------------------------------
def build_master_teams(master_players):
    print("\n==================================================")
    print("TASK 2.3: Creating master_teams.csv...")
    print("==================================================")
    
    # Clean Country names in players for aggregation
    players = master_players.copy()
    players['Country_clean'] = players['Country'].apply(clean_country_name)
    
    # Create indicators for positions
    players['is_GK'] = players['Pos'].astype(str).str.contains('GK', case=False, na=False).astype(int)
    players['is_DF'] = players['Pos'].astype(str).str.contains('DF', case=False, na=False).astype(int)
    players['is_MF'] = players['Pos'].astype(str).str.contains('MF', case=False, na=False).astype(int)
    players['is_FW'] = players['Pos'].astype(str).str.contains('FW', case=False, na=False).astype(int)
    
    # Aggregate stats at Country level
    team_agg = players.groupby('Country_clean').agg(
        squad_avg_age=('Age', 'mean'),
        squad_median_age=('Age', 'median'),
        squad_total_market_value=('MarketValue_EUR', 'sum'),
        squad_avg_market_value=('MarketValue_EUR', 'mean'),
        squad_injury_burden=('total_days_out', 'sum'),
        squad_total_injuries=('total_injuries', 'sum'),
        squad_depth_GK=('is_GK', 'sum'),
        squad_depth_DF=('is_DF', 'sum'),
        squad_depth_MF=('is_MF', 'sum'),
        squad_depth_FW=('is_FW', 'sum'),
        squad_total_wc_goals=('Performance_Gls', 'sum'),
        squad_avg_wc_goals=('Performance_Gls', 'mean'),
        squad_total_wc_assists=('Performance_Ast', 'sum'),
        squad_total_allcomps_goals=('Performance_Gls_allcomps', 'sum'),
        squad_total_allcomps_assists=('Performance_Ast_allcomps', 'sum')
    ).reset_index()
    
    # Load and merge cleaned_results
    results_path = os.path.join(CLEANED_DIR, "cleaned_results.csv")
    print(f"Loading results: {results_path}")
    results = pd.read_csv(results_path)
    
    # Clean names
    results['Country_clean'] = results['Country'].apply(clean_country_name)
    results['Squad_clean'] = results['Squad'].apply(clean_country_name)
    
    # Keep row where Country == Squad to represent standings for that country
    self_results = results[results['Country_clean'] == results['Squad_clean']].copy()
    self_results = self_results.drop(columns=['Country', 'Squad', 'Squad_clean'])
    self_results = self_results.rename(columns={
        'Rk': 'group_rank',
        'MP': 'group_matches_played',
        'W': 'group_wins',
        'D': 'group_draws',
        'L': 'group_losses',
        'GF': 'group_goals_for',
        'GA': 'group_goals_against',
        'GD': 'group_goals_difference',
        'Pts': 'group_points',
        'Last 5': 'group_last_5_form',
        'Notes': 'group_notes'
    })
    
    # Merge with team aggregations (LEFT JOIN from team aggregations)
    master_teams = pd.merge(team_agg, self_results, on='Country_clean', how='left')
    master_teams = master_teams.rename(columns={'Country_clean': 'Country'})
    
    # Save master teams
    master_teams.to_csv(MASTER_TEAMS_PATH, index=False, encoding='utf-8-sig')
    print(f"Saved Master Teams: {MASTER_TEAMS_PATH} (Shape: {master_teams.shape})")
    return master_teams

# -------------------------------------------------------------
# TASK 2.4: master_injuries.csv
# -------------------------------------------------------------
def build_master_injuries(master_players):
    print("\n==================================================")
    print("TASK 2.4: Creating master_injuries.csv...")
    print("==================================================")
    
    injuries_path = os.path.join(CLEANED_DIR, "cleaned_injuries.csv")
    print(f"Loading injuries: {injuries_path}")
    inj = pd.read_csv(injuries_path)
    
    # Convert fields to numeric to avoid string concatenation during rolling features
    inj['Dias_Baja'] = pd.to_numeric(inj['Dias_Baja'], errors='coerce')
    inj['Partidos_Perdidos'] = pd.to_numeric(inj['Partidos_Perdidos'], errors='coerce')
    
    # Drop rows without Player name or Start Date
    inj = inj.dropna(subset=['Jugador', 'Desde']).copy()
    inj['Desde'] = pd.to_datetime(inj['Desde'])
    inj['Hasta'] = pd.to_datetime(inj['Hasta'])
    
    # Sort chronologically by player and date
    inj = inj.sort_values(['Jugador', 'Desde'])
    
    prior_counts = []
    prior_days = []
    days_since_last = []
    target = []
    
    print("Computing rolling injury histories and targets...")
    for player, group in inj.groupby('Jugador'):
        group = group.sort_values('Desde')
        history = [] # list of (desde, hasta, dias_baja)
        for idx, row in group.iterrows():
            d_start = row['Desde']
            
            # 1. Count prior injuries
            prior_cnt = len(history)
            prior_counts.append((idx, prior_cnt))
            
            # 2. Sum prior days out
            prior_d = sum([h[2] for h in history if not pd.isna(h[2])])
            prior_days.append((idx, prior_d))
            
            # 3. Days since last injury
            if prior_cnt == 0:
                days_since = np.nan
            else:
                last_hasta = history[-1][1]
                if pd.isna(last_hasta):
                    # Fallback to start date of last injury if end date is missing
                    days_since = (d_start - history[-1][0]).days
                else:
                    days_since = (d_start - last_hasta).days
            days_since_last.append((idx, days_since))
            
            # 4. Target: will be injured next 6 months (180 days)
            future_injuries = group[group['Desde'] > d_start]
            will_be_injured = 0
            for _, fut_row in future_injuries.iterrows():
                diff_days = (fut_row['Desde'] - d_start).days
                if 0 < diff_days <= 180:
                    will_be_injured = 1
                    break
            target.append((idx, will_be_injured))
            
            # Append current injury to history
            history.append((row['Desde'], row['Hasta'], row['Dias_Baja']))
            
    # Map computed columns back to dataframe
    inj['prior_injuries'] = inj.index.map(dict(prior_counts))
    inj['prior_days_out'] = inj.index.map(dict(prior_days))
    inj['days_since_last_injury'] = inj.index.map(dict(days_since_last))
    inj['will_be_injured_next_6months'] = inj.index.map(dict(target))
    
    # Load player-level static features from master_players
    print("Enriching injuries with player features from master_players...")
    players_feat = master_players.copy()
    players_feat['Player_clean'] = players_feat['Player'].apply(clean_country_name)
    players_feat['Country_clean'] = players_feat['Country'].apply(clean_country_name)
    
    # Keep only player features (biographical + performance aggregates)
    # Exclude columns that are injury specific (since we calculate them rolling above)
    cols_to_exclude = ['total_injuries', 'total_days_out', 'avg_days_out', 'total_matches_missed', 'Edad', 'Posicion']
    players_feat = players_feat.drop(columns=[col for col in cols_to_exclude if col in players_feat.columns])
    
    # Normalise injuries columns for merge
    inj['Player_clean'] = inj['Jugador'].apply(clean_country_name)
    inj['Country_clean'] = inj['Seleccion'].apply(clean_country_name)
    
    # Merge (LEFT JOIN from injuries)
    master_injuries = pd.merge(inj, players_feat, on=['Player_clean', 'Country_clean'], how='left')
    
    # Drop cleaning helper columns
    master_injuries = master_injuries.drop(columns=['Player_clean', 'Country_clean'])
    
    # Save master injuries
    master_injuries.to_csv(MASTER_INJURIES_PATH, index=False, encoding='utf-8-sig')
    print(f"Saved Master Injuries: {MASTER_INJURIES_PATH} (Shape: {master_injuries.shape})")
    return master_injuries

# -------------------------------------------------------------
# MAIN PIPELINE
# -------------------------------------------------------------
def run_pipeline():
    print("==================================================")
    print("         WORLD CUP 2026 DATA MERGE PIPELINE")
    print("==================================================")
    
    master_players = build_master_players()
    build_master_matches()
    build_master_teams(master_players)
    build_master_injuries(master_players)
    
    print("\n==================================================")
    print("             PIPELINE COMPLETE SUMMARY")
    print("==================================================")
    for path in [MASTER_PLAYERS_PATH, MASTER_MATCHES_PATH, MASTER_TEAMS_PATH, MASTER_INJURIES_PATH]:
        df = pd.read_csv(path, low_memory=False)
        filename = os.path.basename(path)
        print(f"- {filename:<20} Rows: {df.shape[0]:<6} Columns: {df.shape[1]}")
    print("==================================================")

if __name__ == "__main__":
    run_pipeline()
