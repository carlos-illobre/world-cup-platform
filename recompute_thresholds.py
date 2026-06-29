"""Recompute star thresholds with validated weights."""
import pandas as pd
import numpy as np
import os

base = r'c:\Users\carlo\Downloads\world-cup-platform'
df = pd.read_csv(os.path.join(base, 'backend', 'data', 'csv', 'master_players_enriched.csv'), low_memory=False)

df['career_years'] = (df['Age'] - 17).clip(lower=1)
df['injuries_per_year'] = df['total_injuries'] / df['career_years']
df['rank_overall'] = df['overall'].rank(pct=True)
df['rank_impact'] = df['impact_score_raw'].rank(pct=True)
df['rank_availability'] = 1 - df['injuries_per_year'].rank(pct=True)
fw_mask = df['Pos'].str.contains('FW', na=False)
df['rank_xg'] = 0.5
df.loc[fw_mask, 'rank_xg'] = df.loc[fw_mask, 'xg_overperformance'].rank(pct=True)

# New validated weights
W = {'overall': 0.30, 'impact': 0.30, 'availability': 0.05, 'xg': 0.35}

df['base_quality'] = (
    W['overall'] * df['rank_overall'] +
    W['impact'] * df['rank_impact'] +
    W['availability'] * df['rank_availability'] +
    W['xg'] * df['rank_xg']
)
df['value_bonus'] = (df['rank_impact'] - df['rank_overall']).clip(-1, 1)
df['moneyball_score'] = df['base_quality'] * (1 + 0.15 * df['value_bonus'])

print(f"moneyball_score: min={df['moneyball_score'].min():.6f}, max={df['moneyball_score'].max():.6f}")
print(f"  mean={df['moneyball_score'].mean():.6f}, std={df['moneyball_score'].std():.6f}")

# Normalized
mb_min = df['moneyball_score'].min()
mb_max = df['moneyball_score'].max()
df['norm'] = (df['moneyball_score'] - mb_min) / (mb_max - mb_min)

print(f"\nStar thresholds:")
print(f"  P95 (5★): {df['norm'].quantile(0.95):.4f}")
print(f"  P80 (4★): {df['norm'].quantile(0.80):.4f}")
print(f"  P50 (3★): {df['norm'].quantile(0.50):.4f}")
print(f"  P20 (2★): {df['norm'].quantile(0.20):.4f}")
print(f"\n  SCORE_MIN = {mb_min:.4f}")
print(f"  SCORE_MAX = {mb_max:.4f}")

# Verify known players
known = ['Messi', 'Mbapp', 'Haaland', 'Vinicius', 'Bellingham', 'De Bruyne', 'Salah', 'Kane', 'Yamal']
for name in known:
    row = df[df['Player'].str.contains(name, case=False, na=False)]
    if not row.empty:
        r = row.iloc[0]
        stars = 5 if r['norm'] >= df['norm'].quantile(0.95) else 4 if r['norm'] >= df['norm'].quantile(0.80) else 3 if r['norm'] >= df['norm'].quantile(0.50) else 2 if r['norm'] >= df['norm'].quantile(0.20) else 1
        print(f"  {r['Player']:<25}: norm={r['norm']:.4f} → {stars}★")
