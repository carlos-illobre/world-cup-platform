"""
Generate comparison plots: XGBoost vs Random Forest
For: Injury Prediction and Match Outcome
Produces didactic visualizations showing how each model behaves on the same data.
"""
import pandas as pd
import numpy as np
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_curve, auc, confusion_matrix, ConfusionMatrixDisplay,
)
from sklearn.calibration import calibration_curve
from sklearn.preprocessing import StandardScaler
import os

OUTPUT_DIR = 'static/model_plots'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ══════════════════════════════════════════════════════════════
# INJURY PREDICTION: XGBoost vs Random Forest
# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("INJURY PREDICTION — Generating comparison plots")
print("=" * 60)

df_inj = pd.read_csv('data/csv/master_injuries_featured.csv', low_memory=False)
target = 'will_be_injured_next_6months'

key_features = [
    'Age', 'Dias_Baja', 'Partidos_Perdidos', 'prior_injuries',
    'prior_days_out', 'days_since_last_injury', 'injury_count_last_12m',
    'total_days_out_last_12m', 'avg_recovery_time', 'is_recurrent',
    'months_since_last_injury', 'injury_frequency', 'injury_severity_score',
    'MarketValue_EUR', 'MP', 'Playing Time_Min', 'Playing Time_90s',
]

available = [f for f in key_features if f in df_inj.columns]
df_clean = df_inj.dropna(subset=[target])
for col in available:
    df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce').fillna(0)

X = df_clean[available].values
y = df_clean[target].values.astype(int)
split_idx = int(len(X) * 0.8)
X_train, X_test = X[:split_idx], X[split_idx:]
y_train, y_test = y[:split_idx], y[split_idx:]


# Load both models
rf_inj = joblib.load('data/models/injury_rf_model.pkl')
xgb_inj = joblib.load('data/models/injury_xgboost_model.pkl')

# Get predictions from both
# RF uses only the key features it was trained on
rf_proba = rf_inj.predict_proba(X_test[:, :rf_inj.n_features_in_])[:, 1]
rf_pred = rf_inj.predict(X_test[:, :rf_inj.n_features_in_])

# XGBoost uses the full 123-feature pipeline - we'll use the same subset for fair comparison
# Build a simple version using only the key features
from sklearn.ensemble import GradientBoostingClassifier
# Actually let's just use the RF test data for both to keep it comparable
# For XGBoost, we retrain quickly on same features for fair comparison
from xgboost import XGBClassifier
xgb_simple = XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.01,
                            random_state=42, eval_metric='logloss')
xgb_simple.fit(X_train, y_train)
xgb_proba = xgb_simple.predict_proba(X_test)[:, 1]
xgb_pred = xgb_simple.predict(X_test)

print(f"  Test set: {len(y_test)} samples")
print(f"  XGBoost proba range: [{xgb_proba.min():.3f}, {xgb_proba.max():.3f}]")
print(f"  RF proba range: [{rf_proba.min():.3f}, {rf_proba.max():.3f}]")


# ─── PLOT 1: ROC Curve Comparison ───
print("  Generating ROC curves...")
fig, ax = plt.subplots(1, 1, figsize=(8, 7))
fig.patch.set_facecolor('#0a0a0a')
ax.set_facecolor('#0a0a0a')

fpr_xgb, tpr_xgb, _ = roc_curve(y_test, xgb_proba)
fpr_rf, tpr_rf, _ = roc_curve(y_test, rf_proba)
auc_xgb = auc(fpr_xgb, tpr_xgb)
auc_rf = auc(fpr_rf, tpr_rf)

ax.plot(fpr_xgb, tpr_xgb, color='#f59e0b', lw=2.5,
        label=f'XGBoost (AUC = {auc_xgb:.3f})')
ax.plot(fpr_rf, tpr_rf, color='#06b6d4', lw=2.5,
        label=f'Random Forest (AUC = {auc_rf:.3f})')
ax.plot([0, 1], [0, 1], 'w--', lw=1, alpha=0.3, label='Random (AUC = 0.500)')
ax.set_xlabel('False Positive Rate (1 - Especificidad)', color='white', fontsize=11)
ax.set_ylabel('True Positive Rate (Sensibilidad)', color='white', fontsize=11)
ax.set_title('Curva ROC — XGBoost vs Random Forest\n(Prediccion de Lesiones)',
             color='white', fontsize=13)
ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=10)
ax.tick_params(colors='#888')
ax.grid(True, alpha=0.1)
for spine in ax.spines.values():
    spine.set_color('#333')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_roc_comparison_xgb_rf.png'),
            dpi=150, facecolor='#0a0a0a')
plt.close()
print(f"    Saved: injury_roc_comparison_xgb_rf.png")


# ─── PLOT 2: Probability Distribution ───
print("  Generating probability distributions...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
fig.patch.set_facecolor('#0a0a0a')

for ax, proba, name, color in [
    (ax1, xgb_proba, 'XGBoost', '#f59e0b'),
    (ax2, rf_proba, 'Random Forest', '#06b6d4')
]:
    ax.set_facecolor('#0a0a0a')
    ax.hist(proba[y_test == 0], bins=30, alpha=0.6, color='#10b981',
            label='No lesionado (real)', density=True)
    ax.hist(proba[y_test == 1], bins=30, alpha=0.6, color='#ef4444',
            label='Lesionado (real)', density=True)
    ax.axvline(0.5, color='white', ls='--', lw=1, alpha=0.5, label='Umbral 0.5')
    ax.set_xlabel('Probabilidad predicha', color='white', fontsize=10)
    ax.set_ylabel('Densidad', color='white', fontsize=10)
    ax.set_title(f'{name}', color=color, fontsize=12)
    ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=8)
    ax.tick_params(colors='#888')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.suptitle('Distribucion de Probabilidades Predichas por Clase Real',
             color='white', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_proba_distribution_xgb_rf.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: injury_proba_distribution_xgb_rf.png")


# ─── PLOT 3: Confusion Matrix Side by Side ───
print("  Generating confusion matrices...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
fig.patch.set_facecolor('#0a0a0a')

for ax, pred, name, color in [
    (ax1, xgb_pred, 'XGBoost', '#f59e0b'),
    (ax2, rf_pred, 'Random Forest', '#06b6d4')
]:
    ax.set_facecolor('#0a0a0a')
    cm = confusion_matrix(y_test, pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=['No Lesion', 'Lesion'])
    disp.plot(ax=ax, cmap='Blues', colorbar=False)
    ax.set_title(f'{name}', color=color, fontsize=12)
    ax.set_xlabel('Prediccion', color='white', fontsize=10)
    ax.set_ylabel('Real', color='white', fontsize=10)
    ax.tick_params(colors='#888')

plt.suptitle('Confusion Matrix — XGBoost vs Random Forest',
             color='white', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_confusion_matrix_comparison.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: injury_confusion_matrix_comparison.png")


# ─── PLOT 4: Calibration Curve ───
print("  Generating calibration curves...")
fig, ax = plt.subplots(1, 1, figsize=(8, 7))
fig.patch.set_facecolor('#0a0a0a')
ax.set_facecolor('#0a0a0a')

for proba, name, color in [
    (xgb_proba, 'XGBoost', '#f59e0b'),
    (rf_proba, 'Random Forest', '#06b6d4')
]:
    fraction_pos, mean_predicted = calibration_curve(y_test, proba, n_bins=10)
    ax.plot(mean_predicted, fraction_pos, 's-', color=color, lw=2, label=name)

ax.plot([0, 1], [0, 1], 'w--', lw=1, alpha=0.4, label='Calibracion perfecta')
ax.set_xlabel('Probabilidad predicha (media por bin)', color='white', fontsize=11)
ax.set_ylabel('Fraccion real de positivos', color='white', fontsize=11)
ax.set_title('Curva de Calibracion — XGBoost vs Random Forest\n(Lesiones)',
             color='white', fontsize=13)
ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=10)
ax.tick_params(colors='#888')
ax.grid(True, alpha=0.1)
for spine in ax.spines.values():
    spine.set_color('#333')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_calibration_xgb_rf.png'),
            dpi=150, facecolor='#0a0a0a')
plt.close()
print(f"    Saved: injury_calibration_xgb_rf.png")

# ══════════════════════════════════════════════════════════════
# MATCH OUTCOME: XGBoost vs Random Forest
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("MATCH OUTCOME — Generating comparison plots")
print("=" * 60)

df_match = pd.read_csv('data/csv/master_matches_featured.csv', low_memory=False)
match_target = 'Result'
match_features = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'win_rate_neutral',
]
available_mf = [f for f in match_features if f in df_match.columns]
df_m = df_match.dropna(subset=[match_target])
df_m = df_m[df_m[match_target].isin(['W', 'D', 'L'])]
for col in available_mf:
    df_m[col] = pd.to_numeric(df_m[col], errors='coerce').fillna(0)

X_m = df_m[available_mf].values
y_m = df_m[match_target].values
split_m = int(len(X_m) * 0.8)
X_m_train, X_m_test = X_m[:split_m], X_m[split_m:]
y_m_train, y_m_test = y_m[:split_m], y_m[split_m:]

rf_match = joblib.load('data/models/match_outcome_rf.pkl')
rf_m_pred = rf_match.predict(X_m_test[:, :rf_match.n_features_in_])
rf_m_proba = rf_match.predict_proba(X_m_test[:, :rf_match.n_features_in_])

from xgboost import XGBClassifier as XGBCls
from sklearn.preprocessing import LabelEncoder
le = LabelEncoder()
y_m_train_enc = le.fit_transform(y_m_train)
y_m_test_enc = le.transform(y_m_test)

xgb_m = XGBCls(n_estimators=300, max_depth=6, learning_rate=0.05,
               random_state=42, eval_metric='mlogloss')
xgb_m.fit(X_m_train, y_m_train_enc)
xgb_m_pred_enc = xgb_m.predict(X_m_test)
xgb_m_pred = le.inverse_transform(xgb_m_pred_enc)
xgb_m_proba = xgb_m.predict_proba(X_m_test)

print(f"  Test set: {len(y_m_test)} matches")


# ─── PLOT 5: Match Confusion Matrix Side by Side ───
print("  Generating match confusion matrices...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
fig.patch.set_facecolor('#0a0a0a')

for ax, pred, name, color in [
    (ax1, xgb_m_pred, 'XGBoost', '#f59e0b'),
    (ax2, rf_m_pred, 'Random Forest', '#06b6d4')
]:
    ax.set_facecolor('#0a0a0a')
    labels_order = ['L', 'D', 'W']
    cm = confusion_matrix(y_m_test, pred, labels=labels_order)
    disp = ConfusionMatrixDisplay(cm, display_labels=['Derrota', 'Empate', 'Victoria'])
    disp.plot(ax=ax, cmap='Blues', colorbar=False)
    ax.set_title(f'{name}', color=color, fontsize=12)
    ax.set_xlabel('Prediccion', color='white', fontsize=10)
    ax.set_ylabel('Real', color='white', fontsize=10)
    ax.tick_params(colors='#888')

plt.suptitle('Confusion Matrix — Prediccion de Partidos (3 clases)',
             color='white', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'match_confusion_matrix_comparison.png'),
            dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
plt.close()
print(f"    Saved: match_confusion_matrix_comparison.png")

# ─── PLOT 6: Match Probability Distribution (Win class) ───
print("  Generating match probability distributions...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
fig.patch.set_facecolor('#0a0a0a')

# Get index of 'W' class
xgb_classes = le.classes_.tolist()
rf_classes = rf_match.classes_.tolist()
win_idx_xgb = xgb_classes.index('W') if 'W' in xgb_classes else -1
win_idx_rf = rf_classes.index('W') if 'W' in rf_classes else -1

if win_idx_xgb >= 0 and win_idx_rf >= 0:
    xgb_win_proba = xgb_m_proba[:, win_idx_xgb]
    rf_win_proba = rf_m_proba[:, win_idx_rf]

    for ax, proba, name, color in [
        (ax1, xgb_win_proba, 'XGBoost', '#f59e0b'),
        (ax2, rf_win_proba, 'Random Forest', '#06b6d4')
    ]:
        ax.set_facecolor('#0a0a0a')
        mask_w = y_m_test == 'W'
        mask_d = y_m_test == 'D'
        mask_l = y_m_test == 'L'
        ax.hist(proba[mask_w], bins=20, alpha=0.6, color='#10b981',
                label='Victoria (real)', density=True)
        ax.hist(proba[mask_d], bins=20, alpha=0.6, color='#eab308',
                label='Empate (real)', density=True)
        ax.hist(proba[mask_l], bins=20, alpha=0.6, color='#ef4444',
                label='Derrota (real)', density=True)
        ax.set_xlabel('P(Victoria) predicha', color='white', fontsize=10)
        ax.set_ylabel('Densidad', color='white', fontsize=10)
        ax.set_title(f'{name}', color=color, fontsize=12)
        ax.legend(facecolor='#1a1a1a', edgecolor='#333', labelcolor='white', fontsize=8)
        ax.tick_params(colors='#888')
        for spine in ax.spines.values():
            spine.set_color('#333')

    plt.suptitle('Distribucion de P(Victoria) por resultado real',
                 color='white', fontsize=13, y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'match_proba_distribution_xgb_rf.png'),
                dpi=150, facecolor='#0a0a0a', bbox_inches='tight')
    plt.close()
    print(f"    Saved: match_proba_distribution_xgb_rf.png")

print("\nDone! All comparison plots generated.")
