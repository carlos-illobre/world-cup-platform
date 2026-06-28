import pandas as pd
import numpy as np
import os

input_file = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_players.csv'
output_file = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_players_featured.csv'

df = pd.read_csv(input_file)

# Helper to find column
def get_col(df, possible_names):
    for name in possible_names:
        if name in df.columns:
            return name
    return None

# 1. xg_overperformance
gls_col = get_col(df, ['Performance_Gls_allcomps', 'Performance_Gls', 'Gls_total', 'Gls'])
xg_col = get_col(df, ['Performance_xG_allcomps', 'Performance_xG', 'xG_total', 'xG'])

if gls_col and xg_col:
    df['xg_overperformance'] = df[gls_col] - df[xg_col]
else:
    df['xg_overperformance'] = np.nan

# 2. minutes_per_goal
min_col = get_col(df, ['Playing Time_Min_allcomps', 'Playing Time_Min', 'Min_total', 'Min'])

if min_col and gls_col:
    # convert columns to numeric to be safe
    df[min_col] = pd.to_numeric(df[min_col], errors='coerce')
    df[gls_col] = pd.to_numeric(df[gls_col], errors='coerce')
    df['minutes_per_goal'] = np.where(df[gls_col] > 0, df[min_col] / df[gls_col], np.nan)
else:
    df['minutes_per_goal'] = np.nan

# 3. discipline_score
crd_y_col = get_col(df, ['Performance_CrdY_allcomps', 'Performance_CrdY', 'CrdY_total', 'CrdY'])
crd_r_col = get_col(df, ['Performance_CrdR_allcomps', 'Performance_CrdR', 'CrdR_total', 'CrdR'])
fls_col = get_col(df, ['Performance_Fls_allcomps', 'Performance_Fls', 'Fls_total', 'Fls'])

crd_y = pd.to_numeric(df[crd_y_col], errors='coerce').fillna(0) if crd_y_col else 0
crd_r = pd.to_numeric(df[crd_r_col], errors='coerce').fillna(0) if crd_r_col else 0
fls = pd.to_numeric(df[fls_col], errors='coerce').fillna(0) if fls_col else 0

df['discipline_score'] = crd_y * 1 + crd_r * 3 + fls * 0.5

# 4. impact_score_raw
on_off_col = get_col(df, ['Team Success_On-Off_allcomps', 'Team Success_On-Off', 'Team Success_+/-_allcomps', 'Team Success_+/-', '+/-_total', 'On-Off'])
ppm_col = get_col(df, ['Team Success_PPM_allcomps', 'Team Success_PPM', 'PPM'])
g_a_90_col = get_col(df, ['Per 90 Minutes_G+A_allcomps', 'Per 90 Minutes_G+A', 'G+A_total per 90 mins', 'Performance_G+A_allcomps', 'Performance_G+A'])

def standardize(series):
    s = pd.to_numeric(series, errors='coerce').fillna(0)
    if s.std() == 0:
        return s - s.mean()
    return (s - s.mean()) / s.std()

impact = pd.Series(np.zeros(len(df)))
if on_off_col:
    impact += standardize(df[on_off_col])
if ppm_col:
    impact += standardize(df[ppm_col])
if g_a_90_col:
    impact += standardize(df[g_a_90_col])

df['impact_score_raw'] = impact

# 5. position_encoded
pos_col = get_col(df, ['Pos'])
def encode_pos(pos):
    if pd.isna(pos):
        return 0
    p = str(pos).split(',')[0].strip().upper()
    if p == 'GK': return 1
    if p == 'DF': return 2
    if p == 'MF': return 3
    if p == 'FW': return 4
    return 0

if pos_col:
    df['position_encoded'] = df[pos_col].apply(encode_pos)
else:
    df['position_encoded'] = 0

# 6. league_tier
tier_1 = ['1.eng', '1.es', '1.de', '1.it', '1.fr', 'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1']
tier_2 = ['1.pt', '1.nl', '1.be', '1.tr', '2.eng', '1.br', '1.ar', 'eredivisie', 'championship', 'primeira liga']
tier_3 = ['1.mx', '1.us', '1.jp', '1.kr', '1.ru', '1.sa', '2.de', '2.it', '2.es', '2.fr', 'mls']

league_col = get_col(df, ['League', 'Comp', 'Competition'])
def get_tier(league):
    if pd.isna(league):
        return 4
    l = str(league).lower()
    if l in tier_1 or any(t in l for t in tier_1):
        return 1
    if l in tier_2 or any(t in l for t in tier_2):
        return 2
    if l in tier_3 or any(t in l for t in tier_3):
        return 3
    return 4

if league_col:
    df['league_tier'] = df[league_col].apply(get_tier)
else:
    df['league_tier'] = 4

# 7. experience_level
age_col = get_col(df, ['Age'])
mp_col = get_col(df, ['MP_allcomps', 'MP'])

if age_col and mp_col:
    # simple numeric score: standardized age + standardized matches played
    df['experience_level'] = standardize(df[age_col]) + standardize(df[mp_col])
elif age_col:
    df['experience_level'] = standardize(df[age_col])
elif mp_col:
    df['experience_level'] = standardize(df[mp_col])
else:
    df['experience_level'] = 0

df.to_csv(output_file, index=False)
print(f"Feature engineering complete. Saved to {output_file}")
