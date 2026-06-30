"""
Generate Player Impact comparison plots: XGBoost vs Random Forest (regression)
"""
import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import os

OUTPUT_DIR = 'static/model_plots'
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("PLAYER IMPACT — Generating comparison plots")

df = pd.read_csv('data/csv/master_players_enriched.csv', low_memory=False)
features = [
    'Age', 'overall', 'potential', 'value_eur', 'wage_eur',
    'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
    'attacking_crossing', 'attacking_finishing',
    'attacking_heading_accuracy', 'skill_dribbling',
    'skill_fk_accuracy', 'skill_ball_control',
    'movement_acceleration', 'movement_sprint_speed',
    'movement_agility', 'movement_reactions', 'movement_balance',
    'power_shot_power', 'power_jumping', 'power_stamina',
    'power_strength', 'power_long_shots',
    'mentality_aggression', 'mentality_interceptions',
    'mentality_positioning', 'mentality_vision',
    'mentality_composure', 'defending_marking_awareness',
    'defending_standing_tackle', 'defending_sliding_tackle',
    'goalkeeping_diving', 'goalkeeping_handling',
    'goalkeeping_kicking', 'goalkeeping_positioning',
    'goalkeeping_reflexes',
]
target = 'impact_score_raw'

available = [f for f in features if f in df.columns]
df_clean = df.dropna(subset=[target])
for col in available:
    df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
df_clean = df_clean.dropna(subset=available)

X = df_clean[available].values
y = df_clean[target].values

np.random.seed(42)
idx = np.random.permutation(len(X))
split = int(len(X) * 0.8)
X_train, X_test = X[idx[:split]], X[idx[split:]]
y_train, y_test = y[idx[:split]], y[idx[split:]]


# Load models
rf = joblib.load('data/models/player_impact_rf.pkl')
xgb = joblib.load('data/models/player_impact_xgb_enriched.pkl')

# Predictions
rf_pred = rf.predict(X_test)
xgb_pred = xgb.predict(pd.DataFrame(X_test, columns=available))

print(f"  Test: {len(y_test)} players")
print(f"  XGBoost RMSE: {np.sqrt(mean_squared_error(y_test, xgb_pred)):.3f}")
print(f"  RF RMSE: {np.sqrt(mean_squared_error(y_test, rf_pred)):.3f}")

# ─── PLOT 1: Predicted vs Actual (scatter) ───
print("  Generating predicted vs actual scatter...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
fig.patch.set_facecolor('#0a0a0a')

for ax, pred, name, color in [
    (ax1, xgb_pred, 'XGBoost', '#f59e0b'),
    (ax2, rf_pred, 'Random Forest', '#06b6d4')
]:
    ax.set_facecolor('#0a0a0a')
    ax.scatter(y_test, pred, c=color, alpha=0.5, s=20, edgecolors='none')
    # Perfect prediction line
    lims = [min(y_test.min(), pred.min()), max(y_test.max(), pred.max())]
    ax.plot(lims, lims, 'w--', lw=1, alpha=0.4, label='Prediccion perfecta')
    ax.set_xlabel('Impact Score Real', color='white', fontsize=10)
    ax.set_ylabel('Impact Score Predicho', color='white', fontsize=10)
    r2 = r2_score(y_test, pred)
    rmse = np.sqrt(mean_squared_error(y_test, pred))
    ax.set_title(f'{name} (R²={r2:.3f}, RMSE={rmse:.2f})', color=color, fontsize=11)
    ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=9)
    ax.tick_params(colors='#888')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.suptitle('Predicho vs Real — Player Impact Score', color='white', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'impact_predicted_vs_actual_xgb_rf.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: impact_predicted_vs_actual_xgb_rf.png")


# ─── PLOT 2: Residual Distribution ───
print("  Generating residual distributions...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
fig.patch.set_facecolor('#0a0a0a')

for ax, pred, name, color in [
    (ax1, xgb_pred, 'XGBoost', '#f59e0b'),
    (ax2, rf_pred, 'Random Forest', '#06b6d4')
]:
    ax.set_facecolor('#0a0a0a')
    residuals = y_test - pred
    ax.hist(residuals, bins=30, color=color, alpha=0.7, edgecolor=color)
    ax.axvline(0, color='white', ls='--', lw=1, alpha=0.5)
    ax.axvline(residuals.mean(), color='#ef4444', ls='-', lw=1.5,
               label=f'Media: {residuals.mean():.2f}')
    ax.set_xlabel('Residuo (Real - Predicho)', color='white', fontsize=10)
    ax.set_ylabel('Frecuencia', color='white', fontsize=10)
    ax.set_title(f'{name}', color=color, fontsize=11)
    ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=9)
    ax.tick_params(colors='#888')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.suptitle('Distribucion de Residuos (Error de Prediccion)', color='white', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'impact_residuals_xgb_rf.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: impact_residuals_xgb_rf.png")

# ─── PLOT 3: Feature Importance Comparison ───
print("  Generating feature importance comparison...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 8))
fig.patch.set_facecolor('#0a0a0a')

# XGBoost feature importance
xgb_imp = xgb.get_booster().get_score(importance_type='gain')
xgb_sorted = sorted(xgb_imp.items(), key=lambda x: x[1], reverse=True)[:15]
xgb_names = [available[int(k[1:])] if k.startswith('f') and k[1:].isdigit() else k for k, _ in xgb_sorted]
xgb_vals = [v for _, v in xgb_sorted]

ax1.set_facecolor('#0a0a0a')
ax1.barh(range(len(xgb_names)), xgb_vals, color='#f59e0b', alpha=0.8)
ax1.set_yticks(range(len(xgb_names)))
ax1.set_yticklabels(xgb_names, fontsize=8, color='#ccc')
ax1.set_xlabel('Gain', color='white', fontsize=10)
ax1.set_title('XGBoost — Top 15 Features', color='#f59e0b', fontsize=11)
ax1.tick_params(colors='#888')
ax1.invert_yaxis()
for spine in ax1.spines.values():
    spine.set_color('#333')

# RF feature importance
rf_imp = rf.feature_importances_
rf_idx = np.argsort(rf_imp)[::-1][:15]
rf_names = [available[i] for i in rf_idx]
rf_vals = rf_imp[rf_idx]

ax2.set_facecolor('#0a0a0a')
ax2.barh(range(len(rf_names)), rf_vals, color='#06b6d4', alpha=0.8)
ax2.set_yticks(range(len(rf_names)))
ax2.set_yticklabels(rf_names, fontsize=8, color='#ccc')
ax2.set_xlabel('Importancia (Gini)', color='white', fontsize=10)
ax2.set_title('Random Forest — Top 15 Features', color='#06b6d4', fontsize=11)
ax2.tick_params(colors='#888')
ax2.invert_yaxis()
for spine in ax2.spines.values():
    spine.set_color('#333')

plt.suptitle('Feature Importance — XGBoost (Gain) vs RF (Gini)',
             color='white', fontsize=13, y=1.01)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'impact_feature_importance_comparison.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: impact_feature_importance_comparison.png")

print("\nDone!")
