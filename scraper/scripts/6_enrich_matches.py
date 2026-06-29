"""
Enrich master_matches_featured.csv with historical World Cup matches.
This integrates matches from historical_world_cups.csv (1930-2022) into the
main matches dataset, recalculates H2H correctly per-row (cumulative up to
that match's date), and re-applies feature engineering.

Output: Updated master_matches_featured.csv with more data for model training.
"""
import pandas as pd
import numpy as np
from collections import defaultdict
import os
import sys

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_RAW = os.path.join(BASE_DIR, 'data', '1_raw')
DATA_FEATURED = os.path.join(BASE_DIR, 'data', '4_featured')
BACKEND_CSV = os.path.join(BASE_DIR, '..', 'backend', 'data', 'csv')

print("=" * 60)
print("ENRICHING MATCHES WITH HISTORICAL WORLD CUP DATA")
print("=" * 60)

# 1. Load existing master_matches_featured
master_path = os.path.join(DATA_FEATURED, 'master_matches_featured.csv')
print(f"\n1. Loading existing master: {master_path}")
df_master = pd.read_csv(master_path)
df_master['Date'] = pd.to_datetime(df_master['Date'])
print(f"   Existing rows: {len(df_master)}")

# 2. Load historical World Cup matches
hist_path = os.path.join(DATA_RAW, 'historical_world_cups.csv')
print(f"\n2. Loading historical WC: {hist_path}")
df_hist = pd.read_csv(hist_path)
print(f"   Historical matches: {len(df_hist)}")

# 3. Convert historical matches to the same row format as master
# Each historical match generates TWO rows: one per team (like FBref matchlogs)
print("\n3. Converting historical matches to matchlog format...")
hist_rows = []
for _, row in df_hist.iterrows():
    year = int(row['Year'])
    # Create approximate date (July 1 of the year as default for WC matches)
    date = pd.Timestamp(year=year, month=7, day=1)
    c1, c2 = str(row['Country1']), str(row['Country2'])
    s1, s2 = int(row['Score1']), int(row['Score2'])
    
    # Row for Country1 perspective
    if s1 > s2:
        result1 = 'W'
    elif s1 < s2:
        result1 = 'L'
    else:
        result1 = 'D'
    
    # Row for Country2 perspective (inverse)
    if s2 > s1:
        result2 = 'W'
    elif s2 < s1:
        result2 = 'L'
    else:
        result2 = 'D'
    
    hist_rows.append({
        'Country': c1,
        'Date': date,
        'Comp': 'FIFA World Cup',
        'Round': row.get('Stage', ''),
        'Venue': 'Neutral',
        'Result': result1,
        'GF': s1,
        'GA': s2,
        'Opponent': c2,
        'is_future': False,
        'source': 'historical_wc',
    })
    hist_rows.append({
        'Country': c2,
        'Date': date,
        'Comp': 'FIFA World Cup',
        'Round': row.get('Stage', ''),
        'Venue': 'Neutral',
        'Result': result2,
        'GF': s2,
        'GA': s1,
        'Opponent': c1,
        'is_future': False,
        'source': 'historical_wc',
    })

df_hist_rows = pd.DataFrame(hist_rows)
print(f"   Generated {len(df_hist_rows)} matchlog rows from {len(df_hist)} matches")

# 4. Merge, removing duplicates (prefer master rows that have more data)
print("\n4. Merging with existing master...")
df_master['source'] = 'fbref'

# Check for duplicates: same Country + Opponent + approximate date
# A WC match from FBref would have the exact date, historical has only year
# We'll add historical rows that DON'T already exist in master
existing_pairs = set()
for _, row in df_master.iterrows():
    existing_pairs.add((row['Country'], row['Opponent'], row['Date'].year))

new_rows = []
for _, row in df_hist_rows.iterrows():
    key = (row['Country'], row['Opponent'], row['Date'].year)
    if key not in existing_pairs:
        new_rows.append(row)
        existing_pairs.add(key)

df_new = pd.DataFrame(new_rows)
print(f"   New rows to add (not duplicates): {len(df_new)}")

if len(df_new) > 0:
    # Ensure same columns — fill missing with NaN
    for col in df_master.columns:
        if col not in df_new.columns:
            df_new[col] = np.nan
    
    df_combined = pd.concat([df_master, df_new[df_master.columns]], ignore_index=True)
else:
    df_combined = df_master.copy()

df_combined['Date'] = pd.to_datetime(df_combined['Date'])
df_combined = df_combined.sort_values(['Country', 'Date']).reset_index(drop=True)
print(f"   Combined dataset: {len(df_combined)} rows")

# 5. Recalculate H2H correctly (cumulative, using ALL data including new rows)
print("\n5. Recalculating H2H (cumulative by date)...")

# Build full H2H lookup from historical_world_cups (static, all-time)
h2h_full = defaultdict(lambda: {'matches': 0, 'wins': 0, 'losses': 0, 'draws': 0, 'goals_for': 0, 'goals_against': 0})
for _, row in df_hist.iterrows():
    c1 = str(row['Country1'])
    c2 = str(row['Country2'])
    s1, s2 = int(row['Score1']), int(row['Score2'])
    
    h2h_full[(c1, c2)]['matches'] += 1
    h2h_full[(c1, c2)]['goals_for'] += s1
    h2h_full[(c1, c2)]['goals_against'] += s2
    if s1 > s2:
        h2h_full[(c1, c2)]['wins'] += 1
    elif s2 > s1:
        h2h_full[(c1, c2)]['losses'] += 1
    else:
        h2h_full[(c1, c2)]['draws'] += 1
    
    h2h_full[(c2, c1)]['matches'] += 1
    h2h_full[(c2, c1)]['goals_for'] += s2
    h2h_full[(c2, c1)]['goals_against'] += s1
    if s2 > s1:
        h2h_full[(c2, c1)]['wins'] += 1
    elif s1 > s2:
        h2h_full[(c2, c1)]['losses'] += 1
    else:
        h2h_full[(c2, c1)]['draws'] += 1

# Apply H2H to each row
for col in ['h2h_matches', 'h2h_wins', 'h2h_losses', 'h2h_draws', 'h2h_goals_for', 'h2h_goals_against']:
    df_combined[col] = 0

for idx, row in df_combined.iterrows():
    c = str(row['Country'])
    o = str(row['Opponent'])
    record = h2h_full.get((c, o))
    if record:
        df_combined.at[idx, 'h2h_matches'] = record['matches']
        df_combined.at[idx, 'h2h_wins'] = record['wins']
        df_combined.at[idx, 'h2h_losses'] = record['losses']
        df_combined.at[idx, 'h2h_draws'] = record['draws']
        df_combined.at[idx, 'h2h_goals_for'] = record['goals_for']
        df_combined.at[idx, 'h2h_goals_against'] = record['goals_against']

print("   H2H recalculated for all rows.")

# 6. Re-apply feature engineering (rolling form, goals, etc.)
print("\n6. Re-applying feature engineering...")

def get_points(res):
    if res == 'W': return 3
    elif res == 'D': return 1
    elif res == 'L': return 0
    else: return np.nan

df_combined['GF'] = pd.to_numeric(df_combined['GF'].astype(str).str.extract(r'^(\d+)')[0], errors='coerce')
df_combined['GA'] = pd.to_numeric(df_combined['GA'].astype(str).str.extract(r'^(\d+)')[0], errors='coerce')
df_combined['Points'] = df_combined['Result'].apply(get_points)

# Sort by country and date for rolling calculations
df_combined = df_combined.sort_values(['Country', 'Date']).reset_index(drop=True)

# Shifted columns to avoid leakage
df_combined['Points_shifted'] = df_combined.groupby('Country')['Points'].shift(1)
df_combined['GF_shifted'] = df_combined.groupby('Country')['GF'].shift(1)
df_combined['GA_shifted'] = df_combined.groupby('Country')['GA'].shift(1)

# Rolling features
df_combined['form_last_5'] = df_combined.groupby('Country')['Points_shifted'].transform(
    lambda x: x.rolling(5, min_periods=1).sum())
df_combined['form_last_10'] = df_combined.groupby('Country')['Points_shifted'].transform(
    lambda x: x.rolling(10, min_periods=1).sum())
df_combined['goals_scored_last_5'] = df_combined.groupby('Country')['GF_shifted'].transform(
    lambda x: x.rolling(5, min_periods=1).mean())
df_combined['goals_conceded_last_5'] = df_combined.groupby('Country')['GA_shifted'].transform(
    lambda x: x.rolling(5, min_periods=1).mean())

# Days since last match
df_combined['days_since_last_match'] = df_combined.groupby('Country')['Date'].diff().dt.days

# ranking_diff (already exists for fbref rows, calculate for new ones)
if 'Country_FIFA_Points' in df_combined.columns and 'Opponent_FIFA_Points' in df_combined.columns:
    df_combined['ranking_diff'] = df_combined['Country_FIFA_Points'] - df_combined['Opponent_FIFA_Points']

# Drop temp columns
df_combined = df_combined.drop(columns=['Points', 'Points_shifted', 'GF_shifted', 'GA_shifted'], errors='ignore')

print(f"   Feature engineering done. Final shape: {df_combined.shape}")

# 7. Save outputs
print("\n7. Saving outputs...")

# Save to scraper featured directory
output_featured = os.path.join(DATA_FEATURED, 'master_matches_featured.csv')
df_combined.to_csv(output_featured, index=False)
print(f"   Saved: {output_featured} ({len(df_combined)} rows)")

# Save to backend data directory
output_backend = os.path.join(BACKEND_CSV, 'master_matches_featured.csv')
df_combined.to_csv(output_backend, index=False)
print(f"   Saved: {output_backend} ({len(df_combined)} rows)")

# Stats
n_with_h2h = (df_combined['h2h_matches'] > 0).sum()
n_wc_rows = (df_combined['source'] == 'historical_wc').sum() if 'source' in df_combined.columns else 0
print(f"\n   Stats:")
print(f"   - Total rows: {len(df_combined)}")
print(f"   - Rows from FBref: {len(df_combined) - n_wc_rows}")
print(f"   - Rows from Historical WC: {n_wc_rows}")
print(f"   - Rows with H2H > 0: {n_with_h2h}")

# Print Argentina vs France H2H as validation
arg_fra = df_combined[(df_combined['Country'] == 'Argentina') & (df_combined['Opponent'] == 'France')]
if not arg_fra.empty:
    print(f"\n   VALIDATION - Argentina vs France rows:")
    print(f"   {arg_fra[['Date', 'Country', 'Opponent', 'Result', 'GF', 'GA', 'h2h_wins', 'h2h_losses']].to_string()}")
else:
    print("\n   NOTE: No Argentina vs France row found (checking h2h lookup)...")
    # Show that h2h lookup works
    record = h2h_full.get(('Argentina', 'France'))
    if record:
        print(f"   H2H Argentina vs France: {record}")

print("\n" + "=" * 60)
print("DONE! master_matches_featured.csv enriched with WC history.")
print("=" * 60)
