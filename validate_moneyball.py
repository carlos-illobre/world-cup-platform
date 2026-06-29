"""
Validate Moneyball scoring against REAL performance data.
"""
import pandas as pd
import numpy as np
import os
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression

base = r'c:\Users\carlo\Downloads\world-cup-platform'

# Load main dataset
players = pd.read_csv(os.path.join(base, 'backend', 'data', 'csv', 'master_players_enriched.csv'), low_memory=False)
players['Player'] = players['Player'].str.strip()
players['career_years'] = (players['Age'] - 17).clip(lower=1)
players['injuries_per_year'] = players['total_injuries'] / players['career_years']

# Load all_competitions_stats - aggregate per player
ac = pd.read_csv(os.path.join(base, 'scraper', 'data', '1_raw', 'all_competitions_stats_standard.csv'))
ac['Player'] = ac['Player'].str.strip()
ac['minutes'] = pd.to_numeric(ac['Playing Time_Min'], errors='coerce').fillna(0)
ac['goals'] = pd.to_numeric(ac['Performance_Gls'], errors='coerce').fillna(0)
ac['assists'] = pd.to_numeric(ac['Performance_Ast'], errors='coerce').fillna(0)
ac['mp'] = pd.to_numeric(ac['MP'], errors='coerce').fillna(0)

# AGGREGATE per player (sum all competitions)
ac_agg = ac.groupby('Player').agg({
    'minutes': 'sum', 'goals': 'sum', 'assists': 'sum', 'mp': 'sum'
}).reset_index()
ac_agg['ga'] = ac_agg['goals'] + ac_agg['assists']
ac_agg['ga_per_90'] = np.where(ac_agg['minutes'] > 0, ac_agg['ga'] / (ac_agg['minutes']/90), 0)

print(f"Players dataset: {len(players)}")
print(f"All competitions (aggregated per player): {len(ac_agg)}")
print(f"  Minutes range: {ac_agg['minutes'].min():.0f} - {ac_agg['minutes'].max():.0f}")
print(f"  Median minutes: {ac_agg['minutes'].median():.0f}")
print(f"  Players with >=1500 min: {(ac_agg['minutes'] >= 1500).sum()}")
print()

# Merge
merged = players.merge(ac_agg, on='Player', how='inner')
print(f"Merged: {len(merged)} players")
print(f"  Minutes: min={merged['minutes'].min():.0f}, max={merged['minutes'].max():.0f}, median={merged['minutes'].median():.0f}")
print(f"  G+A: min={merged['ga'].min():.0f}, max={merged['ga'].max():.0f}, median={merged['ga'].median():.0f}")
print()

# ═══════════════════════════════════════════════════════════
# DEFINE GROUND TRUTH
# ═══════════════════════════════════════════════════════════
# Target: "Valuable player" = top 25% in minutes AND top 50% in G+A/90
# This captures players who BOTH play regularly AND contribute
min_threshold = merged['minutes'].quantile(0.75)
ga90_threshold = merged['ga_per_90'].quantile(0.50)
merged['is_valuable'] = ((merged['minutes'] >= min_threshold) & (merged['ga_per_90'] >= ga90_threshold)).astype(int)

# Simpler target: top 25% of minutes (coach trusts them enough to play them)
merged['is_starter'] = (merged['minutes'] >= min_threshold).astype(int)

# Top 25% G+A per 90 (efficient contributors)
merged['is_efficient'] = (merged['ga_per_90'] >= merged['ga_per_90'].quantile(0.75)).astype(int)

print(f"Targets:")
print(f"  is_starter (minutes >= {min_threshold:.0f}): {merged['is_starter'].sum()} / {len(merged)} ({merged['is_starter'].mean()*100:.1f}%)")
print(f"  is_efficient (G+A/90 >= P75): {merged['is_efficient'].sum()} / {len(merged)} ({merged['is_efficient'].mean()*100:.1f}%)")
print(f"  is_valuable (starter AND efficient): {merged['is_valuable'].sum()} / {len(merged)} ({merged['is_valuable'].mean()*100:.1f}%)")
print()

# ═══════════════════════════════════════════════════════════
# COMPUTE PERCENTILE RANKS
# ═══════════════════════════════════════════════════════════
merged['rank_overall'] = merged['overall'].rank(pct=True)
merged['rank_impact'] = merged['impact_score_raw'].rank(pct=True)
merged['rank_availability'] = 1 - merged['injuries_per_year'].rank(pct=True)
fw_mask = merged['Pos'].str.contains('FW', na=False)
merged['rank_xg'] = 0.5
merged.loc[fw_mask, 'rank_xg'] = merged.loc[fw_mask, 'xg_overperformance'].rank(pct=True)
merged['rank_age'] = 1 - merged['Age'].rank(pct=True)

feature_cols = ['rank_overall', 'rank_impact', 'rank_availability', 'rank_xg', 'rank_age']
X = merged[feature_cols].values

# ═══════════════════════════════════════════════════════════
# OPTIMIZE WEIGHTS PER TARGET
# ═══════════════════════════════════════════════════════════
targets = {
    'is_starter': merged['is_starter'].values,
    'is_efficient': merged['is_efficient'].values,
    'is_valuable': merged['is_valuable'].values,
}

all_optimal_weights = {}

for target_name, y in targets.items():
    if y.sum() < 5 or (len(y) - y.sum()) < 5:
        print(f"Skipping {target_name}: not enough samples")
        continue
        
    print("=" * 60)
    print(f"LOGISTIC REGRESSION — Target: '{target_name}'")
    print("=" * 60)
    
    lr = LogisticRegression(max_iter=1000, random_state=42)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(lr, X, y, cv=cv, scoring='roc_auc')
    
    lr.fit(X, y)
    print(f"  Coefficients:")
    for name, coef in zip(feature_cols, lr.coef_[0]):
        print(f"    {name:>20}: {coef:+.4f}")
    
    pos_coefs = np.maximum(lr.coef_[0], 0)
    opt_weights = pos_coefs / pos_coefs.sum() if pos_coefs.sum() > 0 else np.ones(5)/5
    all_optimal_weights[target_name] = opt_weights
    
    print(f"\n  Optimal weights (positive coefs normalized):")
    for name, w in zip(feature_cols, opt_weights):
        print(f"    {name:>20}: {w:.4f} ({w*100:.1f}%)")
    
    auc_train = roc_auc_score(y, lr.predict_proba(X)[:, 1])
    print(f"\n  AUC (train): {auc_train:.4f}")
    print(f"  AUC (5-fold CV): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    
    # Our weights comparison
    our_weights = np.array([0.35, 0.35, 0.15, 0.15, 0.0])
    print(f"\n  AUC comparison:")
    print(f"    Our heuristic:  {roc_auc_score(y, X @ our_weights):.4f}")
    print(f"    Optimal linear: {roc_auc_score(y, X @ opt_weights):.4f}")
    
    # Value bonus test
    vb = merged['rank_impact'].values - merged['rank_overall'].values
    for factor in [0.0, 0.10, 0.20, 0.30]:
        score = (X @ our_weights) * (1 + factor * np.clip(vb, -1, 1))
        a = roc_auc_score(y, score)
        marker = " ← current" if factor == 0.20 else ""
        print(f"    Heuristic + vb@{factor:.2f}: {a:.4f}{marker}")
    print()

# ═══════════════════════════════════════════════════════════
# FINAL RECOMMENDATION
# ═══════════════════════════════════════════════════════════
if all_optimal_weights:
    print("=" * 60)
    print("FINAL: AVERAGED OPTIMAL WEIGHTS")
    print("=" * 60)
    avg_weights = np.mean(list(all_optimal_weights.values()), axis=0)
    avg_weights = avg_weights / avg_weights.sum()
    for name, w in zip(feature_cols, avg_weights):
        print(f"  {name:>20}: {w:.4f} ({w*100:.1f}%)")
    
    # Best value_bonus factor
    print(f"\n  Value bonus factor optimization:")
    best_factor = 0.0
    best_auc = 0.0
    vb = merged['rank_impact'].values - merged['rank_overall'].values
    for factor in np.arange(0, 0.51, 0.05):
        aucs = []
        score = (X @ avg_weights) * (1 + factor * np.clip(vb, -1, 1))
        for tn, y in targets.items():
            if y.sum() >= 5:
                aucs.append(roc_auc_score(y, score))
        avg_auc = np.mean(aucs) if aucs else 0
        marker = ""
        if avg_auc > best_auc:
            best_auc = avg_auc
            best_factor = factor
            marker = " ← best"
        print(f"    factor={factor:.2f}: avg_AUC={avg_auc:.4f}{marker}")
    
    print(f"\n  ═══ RECOMMENDED CONFIGURATION ═══")
    print(f"  Weights: {dict(zip(feature_cols, avg_weights.round(4)))}")
    print(f"  Value bonus factor: {best_factor:.2f}")
    print(f"  Expected avg AUC: {best_auc:.4f}")
