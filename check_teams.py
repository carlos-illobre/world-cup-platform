import pandas as pd
import os

base = r'c:\Users\carlo\Downloads\world-cup-platform'
df = pd.read_csv(os.path.join(base, 'backend/data/csv/world_cup_matches.csv'))
teams = pd.read_csv(os.path.join(base, 'backend/data/csv/world_cup_teams.csv'))

all_home = set(df['home_team_id'].dropna().astype(int))
all_away = set(df['away_team_id'].dropna().astype(int))
all_ids = all_home | all_away
team_ids = set(teams['id'])
missing = all_ids - team_ids

print(f"Team IDs in matches but NOT in teams CSV: {sorted(missing)}")

# Show which matches have these missing IDs
for mid in sorted(missing):
    rows = df[(df['home_team_id'] == mid) | (df['away_team_id'] == mid)]
    for _, r in rows.iterrows():
        print(f"  Match {int(r['match_number'])}: home={r['home_team_id']}, away={r['away_team_id']}, date={r['kickoff_at']}, label={r['match_label']}")
