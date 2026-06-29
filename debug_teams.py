import pandas as pd
import os

base = r'c:\Users\carlo\Downloads\world-cup-platform\backend'
os.chdir(base)

# Replicate exactly what main.py does
teams = pd.read_csv('data/csv/world_cup_teams.csv').set_index("id")
matches = pd.read_csv('data/csv/world_cup_matches.csv')

print("Teams index dtype:", teams.index.dtype)
print("Teams shape:", teams.shape)
print("\nTeam ID 4:", teams.loc[4].to_dict() if 4 in teams.index else "NOT FOUND")
print("Team ID 6:", teams.loc[6].to_dict() if 6 in teams.index else "NOT FOUND")

# Check what happens with float lookup (as in matches CSV)
print("\nTeam ID 4.0:", teams.loc[4.0].to_dict() if 4.0 in teams.index else "NOT FOUND with float")
print("Team ID 6.0:", teams.loc[6.0].to_dict() if 6.0 in teams.index else "NOT FOUND with float")

# Show the matches for date 2026-06-12
matches['date_only'] = pd.to_datetime(matches['kickoff_at'], utc=True).dt.strftime('%Y-%m-%d')
day_matches = matches[matches['date_only'] == '2026-06-11']
print(f"\n\nMatches on 2026-06-11:")
for _, m in day_matches.iterrows():
    h_id = m['home_team_id']
    a_id = m['away_team_id']
    print(f"  Match {int(m['match_number'])}: home_id={h_id}, away_id={a_id}")
    if pd.notna(h_id) and h_id in teams.index:
        print(f"    Home: {teams.loc[h_id]['team_name']} ({teams.loc[h_id]['fifa_code']})")
    if pd.notna(a_id) and a_id in teams.index:
        print(f"    Away: {teams.loc[a_id]['team_name']} ({teams.loc[a_id]['fifa_code']})")

day_matches = matches[matches['date_only'] == '2026-06-12']
print(f"\nMatches on 2026-06-12:")
for _, m in day_matches.iterrows():
    h_id = m['home_team_id']
    a_id = m['away_team_id']
    print(f"  Match {int(m['match_number'])}: home_id={h_id}, away_id={a_id}")
    if pd.notna(h_id) and h_id in teams.index:
        print(f"    Home: {teams.loc[h_id]['team_name']} ({teams.loc[h_id]['fifa_code']})")
    if pd.notna(a_id) and a_id in teams.index:
        print(f"    Away: {teams.loc[a_id]['team_name']} ({teams.loc[a_id]['fifa_code']})")
