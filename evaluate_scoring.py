"""
Evaluate different scoring approaches for the scouting page.
Purpose: Moneyball — find players with similar profiles at a better price.
"Better price" = younger, healthier, available, with good impact relative to overall.

We'll compare:
1. Original rule-based system (the one that was there before any change)
2. Percentile rank composite (what was just implemented)
3. A "value ratio" approach (impact / overall) that directly captures Moneyball

Then evaluate which one best serves the purpose.
"""
import pandas as pd
import numpy as np
import os

base = r'c:\Users\carlo\Downloads\world-cup-platform'
df = pd.read_csv(os.path.join(base, 'backend', 'data', 'csv', 'master_players_enriched.csv'), low_memory=False)

df['career_years'] = (df['Age'] - 17).clip(lower=1)
df['injuries_per_year'] = df['total_injuries'] / df['career_years']

print(f"Dataset: {len(df)} players")
print()

# ═══════════════════════════════════════════════════════════
# METHOD 1: Original rule-based system (reconstructed)
# ═══════════════════════════════════════════════════════════
def original_rules(row):
    overall = row.get('overall', 0) or 0
    impact = row.get('impact_score_raw', 0) or 0
    injuries = row.get('total_injuries', 0) or 0
    xg = row.get('xg_overperformance', 0) or 0
    age = row.get('Age', 27) or 27
    
    score = 0
    # Overall
    if overall >= 84: score += 3
    elif overall >= 79: score += 2
    elif overall >= 75: score += 1
    elif overall >= 70: score += 0
    else: score -= 2
    # Impact
    if impact > 3.5: score += 1
    elif impact > 2.0: score += 1
    elif impact < -0.5: score -= 1
    # Injuries (absolute)
    if injuries > 10: score -= 2
    elif injuries > 5: score -= 1
    else: score += 1
    # xG
    if xg > 0.5: score += 1
    elif xg < -0.5: score -= 1
    # Age
    if age >= 34: score -= 1
    elif age <= 23 and overall >= 75: score += 1
    
    if score >= 5: return 5
    if score >= 3: return 4
    if score >= 1: return 3
    if score >= -1: return 2
    return 1

# ═══════════════════════════════════════════════════════════
# METHOD 2: Percentile rank composite (current implementation)
# ═══════════════════════════════════════════════════════════
def percentile_composite(row, ranks_df):
    idx = row.name
    r = ranks_df.loc[idx]
    composite = (0.40 * r['rank_overall'] + 0.30 * r['rank_impact'] +
                 0.15 * r['rank_availability'] + 0.10 * r['rank_xg'] +
                 0.05 * r['rank_age'])
    return composite

# Pre-compute ranks
df['rank_overall'] = df['overall'].rank(pct=True)
df['rank_impact'] = df['impact_score_raw'].rank(pct=True)
df['rank_availability'] = 1 - df['injuries_per_year'].rank(pct=True)
fw_mask = df['Pos'].str.contains('FW', na=False)
df['rank_xg'] = 0.5
df.loc[fw_mask, 'rank_xg'] = df.loc[fw_mask, 'xg_overperformance'].rank(pct=True)
df['rank_age'] = 1 - df['Age'].rank(pct=True)

df['composite'] = (0.40 * df['rank_overall'] + 0.30 * df['rank_impact'] +
                   0.15 * df['rank_availability'] + 0.10 * df['rank_xg'] +
                   0.05 * df['rank_age'])

p95 = df['composite'].quantile(0.95)
p80 = df['composite'].quantile(0.80)
p50 = df['composite'].quantile(0.50)
p20 = df['composite'].quantile(0.20)

def composite_to_stars(c):
    if c >= p95: return 5
    if c >= p80: return 4
    if c >= p50: return 3
    if c >= p20: return 2
    return 1

# ═══════════════════════════════════════════════════════════
# METHOD 3: Value Ratio — directly captures "impact per unit of cost"
# Moneyball core: who gives the most bang for the buck?
# "Cost" proxied by: overall (higher = more expensive/famous),
#                     age (older = less resale/projection),
#                     injuries (more = higher risk)
# "Value" = impact_score_raw (actual measured contribution)
# ═══════════════════════════════════════════════════════════
# Approach: rank_impact - rank_cost, where cost is a composite of "expense signals"
df['rank_cost'] = (
    0.50 * df['overall'].rank(pct=True) +  # higher overall = "more expensive"
    0.30 * df['Age'].rank(pct=True) +       # older = "more expensive" (less future value)
    0.20 * df['injuries_per_year'].rank(pct=True)  # more injuries = "higher risk cost"
)
df['value_ratio'] = df['rank_impact'] - df['rank_cost']
# This is negative for "overpriced" players and positive for "bargains"

# Now for scouting, we want a BALANCED score that rewards both quality AND value:
# A pure value ratio would rank a mediocre player with ok impact above Messi.
# But we need players who can actually play in a World Cup.
# Solution: Minimum quality gate + value bonus
# composite_moneyball = base_quality × (1 + value_bonus)
# where base_quality = rank on ability metrics
# and value_bonus rewards efficiency

df['base_quality'] = (
    0.35 * df['rank_overall'] +
    0.35 * df['rank_impact'] +
    0.15 * df['rank_availability'] +
    0.15 * df.apply(lambda r: r['rank_xg'] if 'FW' in str(r.get('Pos', '')) else 0.5, axis=1)
)

# Value bonus: how much does impact exceed what you'd expect from their overall?
# Positive = "bargain", Negative = "overpaid star"
df['value_bonus'] = df['rank_impact'] - df['rank_overall']

# Final moneyball score: quality + value adjustment (clamped)
# The value_bonus is scaled to max ±20% adjustment
df['moneyball_score'] = df['base_quality'] * (1 + 0.20 * df['value_bonus'].clip(-1, 1))
# Normalize to [0, 1]
mb_min, mb_max = df['moneyball_score'].min(), df['moneyball_score'].max()
df['moneyball_norm'] = (df['moneyball_score'] - mb_min) / (mb_max - mb_min)

mb_p95 = df['moneyball_norm'].quantile(0.95)
mb_p80 = df['moneyball_norm'].quantile(0.80)
mb_p50 = df['moneyball_norm'].quantile(0.50)
mb_p20 = df['moneyball_norm'].quantile(0.20)

def moneyball_to_stars(m):
    if m >= mb_p95: return 5
    if m >= mb_p80: return 4
    if m >= mb_p50: return 3
    if m >= mb_p20: return 2
    return 1

# ═══════════════════════════════════════════════════════════
# EVALUATE ALL THREE METHODS
# ═══════════════════════════════════════════════════════════

df['stars_original'] = df.apply(lambda r: original_rules(r.to_dict()), axis=1)
df['stars_percentile'] = df['composite'].apply(composite_to_stars)
df['stars_moneyball'] = df['moneyball_norm'].apply(moneyball_to_stars)

print("=" * 70)
print("STAR DISTRIBUTION BY METHOD")
print("=" * 70)
for method in ['stars_original', 'stars_percentile', 'stars_moneyball']:
    print(f"\n  {method}:")
    for s in [5, 4, 3, 2, 1]:
        n = (df[method] == s).sum()
        print(f"    {s}★: {n:4d} ({n/len(df)*100:5.1f}%)")

# Check known players
print()
print("=" * 70)
print("KNOWN PLAYERS COMPARISON")
print("=" * 70)
known = ['Messi', 'Mbapp', 'Haaland', 'Vinicius', 'Bellingham', 'De Bruyne', 
         'Salah', 'Neymar', 'Pedri', 'Cristiano', 'Modric', 'Kane', 'Yamal', 'Lukaku']
print(f"\n  {'Player':<25} {'Original':>8} {'Percentile':>10} {'Moneyball':>10}  {'value_bonus':>12}")
print(f"  {'-'*25} {'-'*8} {'-'*10} {'-'*10}  {'-'*12}")
for name in known:
    row = df[df['Player'].str.contains(name, case=False, na=False)]
    if not row.empty:
        r = row.iloc[0]
        print(f"  {r['Player']:<25} {int(r['stars_original']):>5}★   {int(r['stars_percentile']):>7}★   {int(r['stars_moneyball']):>7}★   {r['value_bonus']:>+10.3f}")

# Find "bargains" — high moneyball score with low overall (the whole point)
print()
print("=" * 70)
print("TOP 15 'BARGAINS': High Moneyball stars with overall < P75 (76)")
print("(Players who contribute above their 'price level')")
print("=" * 70)
bargains = df[(df['stars_moneyball'] >= 4) & (df['overall'] < 76)].sort_values('moneyball_norm', ascending=False)
print(f"\n  {'Player':<25} {'Country':<15} {'Overall':>7} {'Impact':>7} {'Age':>5} {'Inj/yr':>7} {'MB★':>4} {'value_bonus':>12}")
for _, r in bargains.head(15).iterrows():
    print(f"  {r['Player']:<25} {r['Country']:<15} {r['overall']:>7.0f} {r['impact_score_raw']:>+7.2f} {r['Age']:>5.1f} {r['injuries_per_year']:>7.2f} {int(r['stars_moneyball']):>3}★ {r['value_bonus']:>+10.3f}")

# Find "overpriced" — high overall but low moneyball
print()
print("=" * 70)
print("TOP 10 'OVERPRICED': Low Moneyball stars despite high overall (>=83)")
print("(Players who underperform relative to their reputation)")
print("=" * 70)
overpriced = df[(df['stars_moneyball'] <= 2) & (df['overall'] >= 83)].sort_values('moneyball_norm')
print(f"\n  {'Player':<25} {'Country':<15} {'Overall':>7} {'Impact':>7} {'Age':>5} {'Inj/yr':>7} {'MB★':>4} {'value_bonus':>12}")
for _, r in overpriced.head(10).iterrows():
    print(f"  {r['Player']:<25} {r['Country']:<15} {r['overall']:>7.0f} {r['impact_score_raw']:>+7.2f} {r['Age']:>5.1f} {r['injuries_per_year']:>7.2f} {int(r['stars_moneyball']):>3}★ {r['value_bonus']:>+10.3f}")

# Correlation between methods
print()
print("=" * 70)
print("CORRELATION BETWEEN METHODS")
print("=" * 70)
print(f"  Original vs Percentile: {df['stars_original'].corr(df['stars_percentile']):.4f}")
print(f"  Original vs Moneyball:  {df['stars_original'].corr(df['stars_moneyball']):.4f}")
print(f"  Percentile vs Moneyball: {df['stars_percentile'].corr(df['stars_moneyball']):.4f}")

# Key insight: does moneyball capture "similar profile, cheaper" better?
print()
print("=" * 70)
print("MONEYBALL SCORE COMPONENTS (for reference)")
print("=" * 70)
print(f"  base_quality = 0.35×rank_overall + 0.35×rank_impact + 0.15×rank_availability + 0.15×rank_xg")
print(f"  value_bonus = rank_impact - rank_overall  (positive = 'punches above weight')")
print(f"  moneyball_score = base_quality × (1 + 0.20 × clip(value_bonus, -1, 1))")
print(f"\n  Star thresholds (from moneyball_norm quantiles):")
print(f"    5★: >= {mb_p95:.4f} (P95)")
print(f"    4★: >= {mb_p80:.4f} (P80)")
print(f"    3★: >= {mb_p50:.4f} (P50)")
print(f"    2★: >= {mb_p20:.4f} (P20)")
