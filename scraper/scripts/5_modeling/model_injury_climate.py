"""
Injury Risk Prediction — Climate-Enhanced Model
=================================================
Retrains the injury XGBoost model with 12 additional climate interaction features.
Compares performance (AUC-ROC, F1) vs the baseline model (without climate).

Output:
  - injury_xgboost_climate_model.pkl (new model with 135 features)
  - injury_climate_comparison.txt (metrics comparison report)

Uses the same temporal split and hyperparameter strategy as the original model.
"""

import os
import sys
import warnings
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    classification_report, accuracy_score
)
import joblib

warnings.filterwarnings('ignore')
np.random.seed(42)

# =====================================================================
# PATHS
# =====================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..', '..', '..'))
DATA_PATH = os.path.join(PROJECT_ROOT, 'backend', 'data', 'csv', 'master_injuries_featured.csv')
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'backend', 'data', 'models')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Add the feature engineering script to path
sys.path.insert(0, os.path.join(BASE_DIR, '..', '3_feature_eng'))
from feature_eng_injury_climate import (
    compute_climate_injury_features, CLIMATE_FEATURE_NAMES, WC2026_VENUES
)

RANDOM_STATE = 42
TARGET = 'will_be_injured_next_6months'

# Columns to drop (same as original model)
DROP_COLS = [
    'Jugador', '#',
    'Hasta', 'Temporada',
    'Seleccion',
    'Edad',
    'Desde',
    'will_be_injured_next_6months',
    'Edad_FBref',
    'Club',
    'Birth Place',
    'Birth Date',
    'Birth Country',
    'Posicion',
    'GK_Penalty Kicks_Save%',
]

GK_COLS = [
    'GK_Performance_Saves', 'GK_Penalty Kicks_PKsv', 'GK_Performance_W',
    'GK_Performance_D', 'GK_Penalty Kicks_PKm', 'GK_Performance_SoTA',
    'GK_Performance_GA', 'GK_Playing Time_Starts', 'GK_Playing Time_Min',
    'GK_Penalty Kicks_PKA', 'GK_Performance_GA90', 'GK_Performance_Save%',
    'GK_Performance_CS%', 'GK_Performance_CS', 'GK_Performance_L',
    'GK_Penalty Kicks_PKatt', 'GK_Playing Time_90s',
    'Penalty Kicks_Save%_allcomps', 'Performance_Save%_allcomps',
    'Performance_CS%_allcomps', 'Penalty Kicks_PKatt_allcomps',
    'Performance_L_allcomps', 'Performance_Saves_allcomps',
    'Performance_GA_allcomps', 'Performance_CS_allcomps',
    'Performance_W_allcomps', 'Performance_SoTA_allcomps',
    'Performance_D_allcomps', 'Performance_GA90_allcomps',
    'Penalty Kicks_PKA_allcomps', 'Penalty Kicks_PKsv_allcomps',
    'Penalty Kicks_PKm_allcomps',
]

CAT_COLS = ['Pos', 'Country', 'Tipo_Lesion', 'League']

# =====================================================================
# LOAD DATA
# =====================================================================
print("=" * 70)
print("INJURY RISK — CLIMATE-ENHANCED MODEL TRAINING")
print("=" * 70)
print(f"\nData path: {DATA_PATH}")

df = pd.read_csv(DATA_PATH, low_memory=False)
print(f"Loaded: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Target distribution:\n{df[TARGET].value_counts()}\n")

# Convert Playing Time_Min_allcomps to numeric
df['Playing Time_Min_allcomps'] = pd.to_numeric(
    df['Playing Time_Min_allcomps'], errors='coerce'
)

# =====================================================================
# ADD CLIMATE INTERACTION FEATURES
# =====================================================================
print("=" * 70)
print("AUGMENTING WITH CLIMATE FEATURES")
print("=" * 70)

venue_list = list(WC2026_VENUES.values())
np.random.seed(RANDOM_STATE)
venue_indices = np.random.randint(0, len(venue_list), size=len(df))

climate_features_list = []
for i, (idx, row) in enumerate(df.iterrows()):
    venue = venue_list[venue_indices[i]]
    player_data = row.to_dict()
    feats = compute_climate_injury_features(
        player_row=player_data,
        venue_temp=venue['avg_temp_jun_jul'],
        venue_humidity=venue['avg_humidity'],
        venue_elevation_m=venue['elevation_m'],
    )
    climate_features_list.append(feats)

climate_df = pd.DataFrame(climate_features_list)
df = pd.concat([df.reset_index(drop=True), climate_df], axis=1)
print(f"Added {len(CLIMATE_FEATURE_NAMES)} climate features. New shape: {df.shape}")
print(f"\nClimate feature stats:")
print(df[CLIMATE_FEATURE_NAMES].describe().round(3).to_string())

# =====================================================================
# TEMPORAL SPLIT
# =====================================================================
print("\n" + "=" * 70)
print("TEMPORAL TRAIN/TEST SPLIT")
print("=" * 70)

df['Desde_dt'] = pd.to_datetime(df['Desde'], errors='coerce')
df = df.sort_values('Desde_dt').reset_index(drop=True)

split_idx = int(len(df) * 0.8)
train_df = df.iloc[:split_idx].copy()
test_df = df.iloc[split_idx:].copy()

print(f"Train: {len(train_df)} rows")
print(f"Test:  {len(test_df)} rows")

# =====================================================================
# FEATURE PREPARATION
# =====================================================================
print("\n" + "=" * 70)
print("FEATURE PREPARATION")
print("=" * 70)

all_drop = DROP_COLS + GK_COLS + ['Desde_dt']
all_drop = [c for c in all_drop if c in df.columns]

y_train = train_df[TARGET].values
y_test = test_df[TARGET].values

X_train_raw = train_df.drop(columns=all_drop, errors='ignore')
X_test_raw = test_df.drop(columns=all_drop, errors='ignore')

# Convert booleans
for c in X_train_raw.columns:
    if X_train_raw[c].dtype == 'bool':
        X_train_raw[c] = X_train_raw[c].astype(int)
        X_test_raw[c] = X_test_raw[c].astype(int)

# Label-encode categoricals
label_encoders = {}
for col in CAT_COLS:
    if col in X_train_raw.columns:
        le = LabelEncoder()
        all_vals = pd.concat([X_train_raw[col], X_test_raw[col]]).fillna('MISSING').astype(str)
        le.fit(all_vals)
        X_train_raw[col] = le.transform(X_train_raw[col].fillna('MISSING').astype(str))
        X_test_raw[col] = le.transform(X_test_raw[col].fillna('MISSING').astype(str))
        label_encoders[col] = le

# Drop remaining non-numeric
for c in list(X_train_raw.columns):
    if X_train_raw[c].dtype == 'object' or str(X_train_raw[c].dtype) == 'str':
        X_train_raw.drop(columns=[c], inplace=True)
        X_test_raw.drop(columns=[c], inplace=True)

feature_names = list(X_train_raw.columns)
print(f"Total features: {len(feature_names)}")

# Identify which are climate features
climate_in_features = [f for f in CLIMATE_FEATURE_NAMES if f in feature_names]
base_features = [f for f in feature_names if f not in CLIMATE_FEATURE_NAMES]
print(f"Base features: {len(base_features)}")
print(f"Climate features: {len(climate_in_features)}")

# =====================================================================
# MODEL A: BASELINE (without climate) — same as original
# =====================================================================
print("\n" + "=" * 70)
print("MODEL A: BASELINE XGBoost (WITHOUT climate)")
print("=" * 70)

X_train_base = X_train_raw[base_features].copy()
X_test_base = X_test_raw[base_features].copy()

skf = StratifiedKFold(n_splits=5, shuffle=False)

param_grid = {
    'max_depth': [4, 6],
    'n_estimators': [100, 200],
    'learning_rate': [0.05, 0.1],
}

xgb_base_model = xgb.XGBClassifier(
    objective='binary:logistic',
    eval_metric='logloss',
    use_label_encoder=False,
    random_state=RANDOM_STATE,
    tree_method='hist',
    n_jobs=-1,
)

print("Running GridSearchCV for baseline model...")
grid_base = GridSearchCV(
    xgb_base_model, param_grid, cv=skf, scoring='roc_auc',
    n_jobs=-1, verbose=0, refit=True
)
grid_base.fit(X_train_base, y_train)

best_base = grid_base.best_estimator_
print(f"Best params (baseline): {grid_base.best_params_}")
print(f"Best CV AUC (baseline): {grid_base.best_score_:.4f}")

# Evaluate baseline
y_pred_base = best_base.predict(X_test_base)
y_proba_base = best_base.predict_proba(X_test_base)[:, 1]

base_auc = roc_auc_score(y_test, y_proba_base)
base_f1 = f1_score(y_test, y_pred_base)
base_prec = precision_score(y_test, y_pred_base)
base_rec = recall_score(y_test, y_pred_base)
base_acc = accuracy_score(y_test, y_pred_base)

print(f"\n--- Baseline Test Metrics ---")
print(f"AUC-ROC:   {base_auc:.4f}")
print(f"F1-Score:  {base_f1:.4f}")
print(f"Precision: {base_prec:.4f}")
print(f"Recall:    {base_rec:.4f}")
print(f"Accuracy:  {base_acc:.4f}")

# =====================================================================
# MODEL B: CLIMATE-ENHANCED (with 12 extra features)
# =====================================================================
print("\n" + "=" * 70)
print("MODEL B: CLIMATE-ENHANCED XGBoost (+12 features)")
print("=" * 70)

X_train_climate = X_train_raw[feature_names].copy()
X_test_climate = X_test_raw[feature_names].copy()

xgb_climate_model = xgb.XGBClassifier(
    objective='binary:logistic',
    eval_metric='logloss',
    use_label_encoder=False,
    random_state=RANDOM_STATE,
    tree_method='hist',
    n_jobs=-1,
)

print("Running GridSearchCV for climate model...")
grid_climate = GridSearchCV(
    xgb_climate_model, param_grid, cv=skf, scoring='roc_auc',
    n_jobs=-1, verbose=0, refit=True
)
grid_climate.fit(X_train_climate, y_train)

best_climate = grid_climate.best_estimator_
print(f"Best params (climate): {grid_climate.best_params_}")
print(f"Best CV AUC (climate): {grid_climate.best_score_:.4f}")

# Evaluate climate model
y_pred_climate = best_climate.predict(X_test_climate)
y_proba_climate = best_climate.predict_proba(X_test_climate)[:, 1]

climate_auc = roc_auc_score(y_test, y_proba_climate)
climate_f1 = f1_score(y_test, y_pred_climate)
climate_prec = precision_score(y_test, y_pred_climate)
climate_rec = recall_score(y_test, y_pred_climate)
climate_acc = accuracy_score(y_test, y_pred_climate)

print(f"\n--- Climate-Enhanced Test Metrics ---")
print(f"AUC-ROC:   {climate_auc:.4f}")
print(f"F1-Score:  {climate_f1:.4f}")
print(f"Precision: {climate_prec:.4f}")
print(f"Recall:    {climate_rec:.4f}")
print(f"Accuracy:  {climate_acc:.4f}")

# =====================================================================
# COMPARISON & FEATURE IMPORTANCE
# =====================================================================
print("\n" + "=" * 70)
print("MODEL COMPARISON")
print("=" * 70)

auc_diff = climate_auc - base_auc
f1_diff = climate_f1 - base_f1

print(f"\n{'Metric':<15} {'Baseline':>10} {'Climate':>10} {'Diff':>10} {'Winner':>10}")
print("-" * 55)
for name, bv, cv in [
    ('AUC-ROC', base_auc, climate_auc),
    ('F1-Score', base_f1, climate_f1),
    ('Precision', base_prec, climate_prec),
    ('Recall', base_rec, climate_rec),
    ('Accuracy', base_acc, climate_acc),
]:
    diff = cv - bv
    winner = 'Climate' if cv > bv else ('Baseline' if bv > cv else 'Tie')
    print(f"{name:<15} {bv:>10.4f} {cv:>10.4f} {diff:>+10.4f} {winner:>10}")

# Feature importance for climate features
print("\n--- Climate Feature Importance in Enhanced Model ---")
importances = best_climate.feature_importances_
feat_imp = pd.DataFrame({
    'Feature': feature_names,
    'Importance': importances
}).sort_values(by='Importance', ascending=False)

# Show climate features specifically
climate_imp = feat_imp[feat_imp['Feature'].isin(CLIMATE_FEATURE_NAMES)]
print(climate_imp.to_string(index=False))

total_imp = importances.sum()
climate_total_imp = climate_imp['Importance'].sum()
climate_pct = (climate_total_imp / total_imp * 100) if total_imp > 0 else 0
print(f"\nClimate features total importance: {climate_pct:.2f}% of model")

# Top 15 overall features
print("\n--- Top 15 Features (Overall) ---")
print(feat_imp.head(15).to_string(index=False))

# =====================================================================
# SAVE MODEL & REPORT
# =====================================================================
print("\n" + "=" * 70)
print("SAVING OUTPUTS")
print("=" * 70)

# Save the climate-enhanced model
model_path = os.path.join(OUTPUT_DIR, 'injury_xgboost_climate_model.pkl')
joblib.dump(best_climate, model_path)
print(f"Saved climate model to: {model_path}")

# Save the feature names list (needed for inference)
feature_list_path = os.path.join(OUTPUT_DIR, 'injury_climate_features.pkl')
joblib.dump({
    'all_features': feature_names,
    'base_features': base_features,
    'climate_features': climate_in_features,
    'label_encoders': label_encoders,
}, feature_list_path)
print(f"Saved feature list to: {feature_list_path}")

# Write comparison report
report = f"""{'=' * 70}
INJURY RISK MODEL — CLIMATE ENHANCEMENT REPORT
{'=' * 70}

Dataset: {DATA_PATH}
Total samples: {len(df)}
Train: {len(train_df)} | Test: {len(test_df)} (temporal 80/20 split)
Base features: {len(base_features)}
Climate features added: {len(climate_in_features)}
Total features (enhanced): {len(feature_names)}

{'─' * 70}
MODEL COMPARISON (Temporal Test Set)
{'─' * 70}
{'Metric':<15} {'Baseline':>10} {'Climate':>10} {'Improvement':>12}
{'─' * 47}
{'AUC-ROC':<15} {base_auc:>10.4f} {climate_auc:>10.4f} {auc_diff:>+12.4f}
{'F1-Score':<15} {base_f1:>10.4f} {climate_f1:>10.4f} {f1_diff:>+12.4f}
{'Precision':<15} {base_prec:>10.4f} {climate_prec:>10.4f} {climate_prec - base_prec:>+12.4f}
{'Recall':<15} {base_rec:>10.4f} {climate_rec:>10.4f} {climate_rec - base_rec:>+12.4f}
{'Accuracy':<15} {base_acc:>10.4f} {climate_acc:>10.4f} {climate_acc - base_acc:>+12.4f}

{'─' * 70}
CLIMATE FEATURE IMPORTANCE (% of total model gain)
{'─' * 70}
{climate_imp.to_string(index=False)}

Total climate contribution: {climate_pct:.2f}% of model importance

{'─' * 70}
VERDICT
{'─' * 70}
"""

if auc_diff > 0.005:
    verdict = (
        f"✅ Climate features IMPROVE the model (AUC +{auc_diff:.4f}).\n"
        f"   The climate-enhanced model should be used in production.\n"
        f"   Climate contributes {climate_pct:.1f}% of total model importance."
    )
elif auc_diff > -0.005:
    verdict = (
        f"⚠️  Climate features have MARGINAL impact (AUC {auc_diff:+.4f}).\n"
        f"   The modulation approach in the predictor is appropriate:\n"
        f"   use the base model + climate adjustment weights."
    )
else:
    verdict = (
        f"❌ Climate features HURT the model (AUC {auc_diff:+.4f}).\n"
        f"   Keep using the base model. Climate modulation via weights\n"
        f"   (as currently implemented) is the safer approach."
    )

report += verdict + "\n"

report_path = os.path.join(OUTPUT_DIR, 'injury_climate_comparison.txt')
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report)
print(f"Saved comparison report to: {report_path}")

print("\n" + verdict)
print("\n✅ DONE!")
