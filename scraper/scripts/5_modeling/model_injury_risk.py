"""
Injury Risk Prediction Model
=============================
Three models:
  1. Cox Proportional Hazards (survival analysis)
  2. XGBoost Classifier (primary)
  3. Logistic Regression (baseline)

Temporal split: earliest 80% train, latest 20% test.
SHAP interpretability for XGBoost.
"""

import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

from sklearn.model_selection import StratifiedKFold, GridSearchCV
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    confusion_matrix, roc_curve, classification_report, accuracy_score
)
from sklearn.impute import SimpleImputer

import xgboost as xgb
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.utils import concordance_index
import shap

warnings.filterwarnings('ignore')

# =====================================================================
# CONFIGURATION
# =====================================================================
DATA_PATH = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_injuries_featured.csv'
OUTPUT_DIR = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models'
os.makedirs(OUTPUT_DIR, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

# Columns to drop
DROP_COLS = [
    'Jugador', '#',                          # ID / name
    'Hasta', 'Temporada',                    # leak future info
    'Seleccion',                             # redundant with Country
    'Edad',                                  # 100% NaN
    'Desde',                                 # date used only for sorting
    'will_be_injured_next_6months',          # target
    'Edad_FBref',                            # messy age string, we have Age
    'Club',                                  # high-cardinality free text
    'Birth Place',                           # high-cardinality free text
    'Birth Date',                            # raw date, we have Age
    'Birth Country',                         # redundant with Country
    'Posicion',                              # redundant with Pos
    'GK_Penalty Kicks_Save%',               # 100% NaN
]

# Columns with extremely high NaN (>90%) — GK-specific stats
GK_COLS = [c for c in [
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
]]

TARGET = 'will_be_injured_next_6months'

# =====================================================================
# LOAD DATA
# =====================================================================
print("=" * 70)
print("LOADING DATA")
print("=" * 70)
df = pd.read_csv(DATA_PATH, low_memory=False)
print(f"Shape: {df.shape}")
print(f"Target distribution:\n{df[TARGET].value_counts()}\n")

# Convert Playing Time_Min_allcomps to numeric (it's object type with mixed values)
df['Playing Time_Min_allcomps'] = pd.to_numeric(df['Playing Time_Min_allcomps'], errors='coerce')

# =====================================================================
# TEMPORAL SORT & SPLIT
# =====================================================================
print("=" * 70)
print("TEMPORAL TRAIN/TEST SPLIT")
print("=" * 70)

df['Desde_dt'] = pd.to_datetime(df['Desde'], errors='coerce')
df = df.sort_values('Desde_dt').reset_index(drop=True)

split_idx = int(len(df) * 0.8)
train_df = df.iloc[:split_idx].copy()
test_df = df.iloc[split_idx:].copy()

print(f"Train: {len(train_df)} rows  ({train_df['Desde_dt'].min().date()} to {train_df['Desde_dt'].max().date()})")
print(f"Test:  {len(test_df)} rows  ({test_df['Desde_dt'].min().date()} to {test_df['Desde_dt'].max().date()})")
print(f"Train target dist: {dict(train_df[TARGET].value_counts())}")
print(f"Test  target dist: {dict(test_df[TARGET].value_counts())}\n")

# =====================================================================
# FEATURE ENGINEERING
# =====================================================================
print("=" * 70)
print("FEATURE ENGINEERING")
print("=" * 70)

# Identify categorical columns to encode
CAT_COLS = ['Pos', 'Country', 'Tipo_Lesion', 'League']

# Build full drop list
all_drop = DROP_COLS + GK_COLS + ['Desde_dt']
all_drop = [c for c in all_drop if c in df.columns]

# Separate features
y_train = train_df[TARGET].values
y_test = test_df[TARGET].values

X_train_raw = train_df.drop(columns=all_drop, errors='ignore')
X_test_raw = test_df.drop(columns=all_drop, errors='ignore')

print(f"Features after drop: {X_train_raw.shape[1]}")

# Convert boolean columns
for c in X_train_raw.columns:
    if X_train_raw[c].dtype == 'bool':
        X_train_raw[c] = X_train_raw[c].astype(int)
        X_test_raw[c] = X_test_raw[c].astype(int)

# Label-encode categorical columns
label_encoders = {}
for col in CAT_COLS:
    if col in X_train_raw.columns:
        le = LabelEncoder()
        # Fit on all data to avoid unseen labels in test
        all_vals = pd.concat([X_train_raw[col], X_test_raw[col]]).fillna('MISSING').astype(str)
        le.fit(all_vals)
        X_train_raw[col] = le.transform(X_train_raw[col].fillna('MISSING').astype(str))
        X_test_raw[col] = le.transform(X_test_raw[col].fillna('MISSING').astype(str))
        label_encoders[col] = le

# Ensure all columns are numeric
for c in X_train_raw.columns:
    if X_train_raw[c].dtype == 'object' or str(X_train_raw[c].dtype) == 'str':
        print(f"  WARNING: Dropping non-numeric column '{c}'")
        X_train_raw.drop(columns=[c], inplace=True)
        X_test_raw.drop(columns=[c], inplace=True)

feature_names = list(X_train_raw.columns)
print(f"Final feature count: {len(feature_names)}")
print(f"Features: {feature_names[:20]}{'...' if len(feature_names) > 20 else ''}\n")

# =====================================================================
# PREPARE DATA FOR EACH MODEL
# =====================================================================

# --- XGBoost: can handle NaN natively ---
X_train_xgb = X_train_raw.copy()
X_test_xgb = X_test_raw.copy()

# --- Logistic Regression: needs imputation + scaling ---
num_imputer = SimpleImputer(strategy='median')
X_train_lr = pd.DataFrame(
    num_imputer.fit_transform(X_train_raw),
    columns=feature_names
)
X_test_lr = pd.DataFrame(
    num_imputer.transform(X_test_raw),
    columns=feature_names
)

scaler = StandardScaler()
X_train_lr_scaled = scaler.fit_transform(X_train_lr)
X_test_lr_scaled = scaler.transform(X_test_lr)

# =====================================================================
# MODEL 1: SURVIVAL ANALYSIS (Cox PH)
# =====================================================================
print("=" * 70)
print("MODEL 1: SURVIVAL ANALYSIS (Cox Proportional Hazards)")
print("=" * 70)

# Prepare survival data
surv_features = [
    'Age', 'injury_count_last_12m', 'total_days_out_last_12m',
    'avg_recovery_time', 'is_recurrent', 'injury_frequency',
    'injury_severity_score', 'prior_injuries', 'prior_days_out',
    'MarketValue_EUR', 'Pos'
]
surv_features = [f for f in surv_features if f in train_df.columns]

surv_df = train_df[surv_features + ['Dias_Baja', TARGET]].copy()

# Convert bool
if 'is_recurrent' in surv_df.columns:
    surv_df['is_recurrent'] = surv_df['is_recurrent'].astype(int)

# Encode Pos for survival
if 'Pos' in surv_df.columns:
    surv_df['Pos'] = label_encoders['Pos'].transform(surv_df['Pos'].fillna('MISSING').astype(str))

# Drop NaN rows for Cox PH (it cannot handle NaN)
surv_df = surv_df.dropna()

# Censoring: use the target as an "event observed" indicator
# If injured next 6 months -> event = 1; else censored = 0
surv_df = surv_df.rename(columns={TARGET: 'event'})

print(f"Survival dataset: {surv_df.shape}")

# Fit Cox PH
cph = CoxPHFitter(penalizer=0.1)
cph.fit(surv_df, duration_col='Dias_Baja', event_col='event')
cph.print_summary()

# C-Index
c_index = concordance_index(
    surv_df['Dias_Baja'],
    -cph.predict_partial_hazard(surv_df),
    surv_df['event']
)
print(f"\nCox PH C-Index (train): {c_index:.4f}")

# --- Survival curves by position group ---
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Kaplan-Meier by position
kmf = KaplanMeierFitter()
pos_col_orig = train_df['Pos'].fillna('Unknown')
# Simplify positions to main group
pos_map = {
    'MF': 'MF', 'DF': 'DF', 'FW': 'FW', 'GK': 'GK',
    'FW,MF': 'FW/MF', 'DF,MF': 'DF/MF', 'DF,FW': 'DF/FW'
}
pos_groups = pos_col_orig.map(lambda x: pos_map.get(x, 'Other'))

ax = axes[0]
for group in sorted(pos_groups.unique()):
    mask = (pos_groups == group).values[:split_idx]
    if mask.sum() > 10:
        kmf.fit(
            train_df.loc[mask, 'Dias_Baja'],
            event_observed=train_df.loc[mask, TARGET],
            label=group
        )
        kmf.plot_survival_function(ax=ax)
ax.set_title('Survival Curves by Position Group', fontsize=14, fontweight='bold')
ax.set_xlabel('Days Out (Dias_Baja)')
ax.set_ylabel('Survival Probability')
ax.legend(loc='lower left')
ax.grid(True, alpha=0.3)

# Kaplan-Meier by age group
ax = axes[1]
age_bins = pd.cut(train_df['Age'], bins=[17, 23, 27, 31, 35, 44],
                  labels=['17-23', '24-27', '28-31', '32-35', '36+'])
for group in age_bins.dropna().unique():
    mask = (age_bins == group).values
    if mask.sum() > 10:
        kmf.fit(
            train_df.loc[mask, 'Dias_Baja'],
            event_observed=train_df.loc[mask, TARGET],
            label=group
        )
        kmf.plot_survival_function(ax=ax)
ax.set_title('Survival Curves by Age Group', fontsize=14, fontweight='bold')
ax.set_xlabel('Days Out (Dias_Baja)')
ax.set_ylabel('Survival Probability')
ax.legend(loc='lower left')
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_survival_curves.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Saved: injury_survival_curves.png")

# =====================================================================
# MODEL 2: XGBoost Classifier (Primary)
# =====================================================================
print("\n" + "=" * 70)
print("MODEL 2: XGBoost Classifier")
print("=" * 70)

# Stratified 5-Fold CV with Grid Search on training data
param_grid = {
    'max_depth': [4, 6, 8],
    'n_estimators': [100, 200, 300],
    'learning_rate': [0.01, 0.05, 0.1],
}

xgb_base = xgb.XGBClassifier(
    objective='binary:logistic',
    eval_metric='logloss',
    use_label_encoder=False,
    random_state=RANDOM_STATE,
    tree_method='hist',
    n_jobs=-1
)

skf = StratifiedKFold(n_splits=5, shuffle=False)

print("Running GridSearchCV (5-fold stratified)...")
grid_search = GridSearchCV(
    xgb_base,
    param_grid,
    cv=skf,
    scoring='roc_auc',
    n_jobs=-1,
    verbose=1,
    refit=True
)
grid_search.fit(X_train_xgb, y_train)

best_xgb = grid_search.best_estimator_
print(f"\nBest params: {grid_search.best_params_}")
print(f"Best CV AUC-ROC: {grid_search.best_score_:.4f}")

# Evaluate on temporal test set
y_pred_xgb = best_xgb.predict(X_test_xgb)
y_proba_xgb = best_xgb.predict_proba(X_test_xgb)[:, 1]

xgb_auc = roc_auc_score(y_test, y_proba_xgb)
xgb_f1 = f1_score(y_test, y_pred_xgb)
xgb_prec = precision_score(y_test, y_pred_xgb)
xgb_rec = recall_score(y_test, y_pred_xgb)
xgb_acc = accuracy_score(y_test, y_pred_xgb)

print(f"\n--- XGBoost Test Set Metrics ---")
print(f"AUC-ROC:   {xgb_auc:.4f}")
print(f"F1-Score:  {xgb_f1:.4f}")
print(f"Precision: {xgb_prec:.4f}")
print(f"Recall:    {xgb_rec:.4f}")
print(f"Accuracy:  {xgb_acc:.4f}")
print(f"\nClassification Report:\n{classification_report(y_test, y_pred_xgb)}")

# Save model
joblib.dump(best_xgb, os.path.join(OUTPUT_DIR, 'injury_xgboost_model.pkl'))
print("Saved: injury_xgboost_model.pkl")

# --- Cross-validation detail on training set ---
cv_results_xgb = {'auc': [], 'f1': [], 'precision': [], 'recall': []}
for fold_idx, (tr_idx, val_idx) in enumerate(skf.split(X_train_xgb, y_train)):
    Xtr, Xvl = X_train_xgb.iloc[tr_idx], X_train_xgb.iloc[val_idx]
    ytr, yvl = y_train[tr_idx], y_train[val_idx]
    fold_model = xgb.XGBClassifier(**grid_search.best_params_,
                                    objective='binary:logistic',
                                    eval_metric='logloss',
                                    use_label_encoder=False,
                                    random_state=RANDOM_STATE,
                                    tree_method='hist')
    fold_model.fit(Xtr, ytr)
    yp = fold_model.predict(Xvl)
    ypp = fold_model.predict_proba(Xvl)[:, 1]
    cv_results_xgb['auc'].append(roc_auc_score(yvl, ypp))
    cv_results_xgb['f1'].append(f1_score(yvl, yp))
    cv_results_xgb['precision'].append(precision_score(yvl, yp))
    cv_results_xgb['recall'].append(recall_score(yvl, yp))

print(f"\nXGBoost 5-Fold CV Results (Training Set):")
for metric in cv_results_xgb:
    vals = cv_results_xgb[metric]
    print(f"  {metric:>10s}: {np.mean(vals):.4f} ± {np.std(vals):.4f}")

# =====================================================================
# MODEL 3: Logistic Regression (Baseline)
# =====================================================================
print("\n" + "=" * 70)
print("MODEL 3: Logistic Regression (Baseline)")
print("=" * 70)

lr = LogisticRegression(
    max_iter=1000,
    random_state=RANDOM_STATE,
    solver='lbfgs',
    C=1.0
)

# CV on training set
cv_results_lr = {'auc': [], 'f1': [], 'precision': [], 'recall': []}
for fold_idx, (tr_idx, val_idx) in enumerate(skf.split(X_train_lr_scaled, y_train)):
    Xtr, Xvl = X_train_lr_scaled[tr_idx], X_train_lr_scaled[val_idx]
    ytr, yvl = y_train[tr_idx], y_train[val_idx]
    lr_fold = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE, solver='lbfgs')
    lr_fold.fit(Xtr, ytr)
    yp = lr_fold.predict(Xvl)
    ypp = lr_fold.predict_proba(Xvl)[:, 1]
    cv_results_lr['auc'].append(roc_auc_score(yvl, ypp))
    cv_results_lr['f1'].append(f1_score(yvl, yp))
    cv_results_lr['precision'].append(precision_score(yvl, yp))
    cv_results_lr['recall'].append(recall_score(yvl, yp))

print(f"Logistic Regression 5-Fold CV Results (Training Set):")
for metric in cv_results_lr:
    vals = cv_results_lr[metric]
    print(f"  {metric:>10s}: {np.mean(vals):.4f} ± {np.std(vals):.4f}")

# Fit on full training set
lr.fit(X_train_lr_scaled, y_train)

y_pred_lr = lr.predict(X_test_lr_scaled)
y_proba_lr = lr.predict_proba(X_test_lr_scaled)[:, 1]

lr_auc = roc_auc_score(y_test, y_proba_lr)
lr_f1 = f1_score(y_test, y_pred_lr)
lr_prec = precision_score(y_test, y_pred_lr)
lr_rec = recall_score(y_test, y_pred_lr)
lr_acc = accuracy_score(y_test, y_pred_lr)

print(f"\n--- Logistic Regression Test Set Metrics ---")
print(f"AUC-ROC:   {lr_auc:.4f}")
print(f"F1-Score:  {lr_f1:.4f}")
print(f"Precision: {lr_prec:.4f}")
print(f"Recall:    {lr_rec:.4f}")
print(f"Accuracy:  {lr_acc:.4f}")
print(f"\nClassification Report:\n{classification_report(y_test, y_pred_lr)}")

# Save model
joblib.dump(lr, os.path.join(OUTPUT_DIR, 'injury_logistic_model.pkl'))
print("Saved: injury_logistic_model.pkl")

# =====================================================================
# PLOTS
# =====================================================================
print("\n" + "=" * 70)
print("GENERATING PLOTS")
print("=" * 70)

# --- Confusion Matrix (XGBoost) ---
fig, ax = plt.subplots(figsize=(8, 6))
cm = confusion_matrix(y_test, y_pred_xgb)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
            xticklabels=['No Injury', 'Injury'],
            yticklabels=['No Injury', 'Injury'])
ax.set_xlabel('Predicted', fontsize=12)
ax.set_ylabel('Actual', fontsize=12)
ax.set_title('XGBoost - Confusion Matrix (Temporal Test Set)', fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_confusion_matrix.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Saved: injury_confusion_matrix.png")

# --- ROC Curve Comparison ---
fig, ax = plt.subplots(figsize=(8, 6))
fpr_xgb, tpr_xgb, _ = roc_curve(y_test, y_proba_xgb)
fpr_lr, tpr_lr, _ = roc_curve(y_test, y_proba_lr)
ax.plot(fpr_xgb, tpr_xgb, label=f'XGBoost (AUC={xgb_auc:.3f})', linewidth=2, color='#2196F3')
ax.plot(fpr_lr, tpr_lr, label=f'Logistic Regression (AUC={lr_auc:.3f})', linewidth=2, color='#FF9800')
ax.plot([0, 1], [0, 1], 'k--', alpha=0.5, label='Random (AUC=0.500)')
ax.set_xlabel('False Positive Rate', fontsize=12)
ax.set_ylabel('True Positive Rate', fontsize=12)
ax.set_title('ROC Curve Comparison — Temporal Test Set', fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_roc_curve.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Saved: injury_roc_curve.png")

# --- Feature Importance (XGBoost built-in) ---
fig, ax = plt.subplots(figsize=(10, 10))
importances = best_xgb.feature_importances_
feat_imp = pd.Series(importances, index=feature_names).sort_values(ascending=True)
top_n = 25
feat_imp.tail(top_n).plot(kind='barh', ax=ax, color='#2196F3')
ax.set_title(f'Top {top_n} XGBoost Feature Importances', fontsize=14, fontweight='bold')
ax.set_xlabel('Importance (Gain)')
ax.grid(True, alpha=0.3, axis='x')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_feature_importance.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Saved: injury_feature_importance.png")

# =====================================================================
# SHAP INTERPRETABILITY
# =====================================================================
print("\n" + "=" * 70)
print("SHAP ANALYSIS")
print("=" * 70)

# Use a sample for SHAP (faster computation)
shap_sample_size = min(1000, len(X_test_xgb))
X_shap = X_test_xgb.iloc[:shap_sample_size]

explainer = shap.TreeExplainer(best_xgb)
shap_values = explainer.shap_values(X_shap)

# --- SHAP Summary Plot (Beeswarm) ---
fig, ax = plt.subplots(figsize=(12, 10))
shap.summary_plot(shap_values, X_shap, feature_names=feature_names,
                  show=False, max_display=25)
plt.title('SHAP Summary — XGBoost Injury Risk Model', fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'injury_shap_summary.png'), dpi=150, bbox_inches='tight')
plt.close()
print("Saved: injury_shap_summary.png")

# --- SHAP Dependence Plots for Top 3 Features ---
mean_abs_shap = np.abs(shap_values).mean(axis=0)
top3_idx = np.argsort(mean_abs_shap)[-3:][::-1]
top3_features = [feature_names[i] for i in top3_idx]
print(f"Top 3 SHAP features: {top3_features}")

for i, feat in enumerate(top3_features):
    fig, ax = plt.subplots(figsize=(8, 6))
    shap.dependence_plot(feat, shap_values, X_shap,
                         feature_names=feature_names, show=False, ax=ax)
    ax.set_title(f'SHAP Dependence — {feat}', fontsize=14, fontweight='bold')
    plt.tight_layout()
    fname = f'injury_shap_dep_{i+1}_{feat.replace("/", "_").replace(" ", "_")}.png'
    plt.savefig(os.path.join(OUTPUT_DIR, fname), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {fname}")

# =====================================================================
# METRICS REPORT
# =====================================================================
print("\n" + "=" * 70)
print("WRITING METRICS REPORT")
print("=" * 70)

report_lines = []
report_lines.append("=" * 70)
report_lines.append("INJURY RISK PREDICTION — MODEL METRICS REPORT")
report_lines.append("=" * 70)
report_lines.append("")
report_lines.append(f"Dataset: {DATA_PATH}")
report_lines.append(f"Total samples: {len(df)}")
report_lines.append(f"Train samples: {len(train_df)} (temporal: {train_df['Desde_dt'].min().date()} to {train_df['Desde_dt'].max().date()})")
report_lines.append(f"Test  samples: {len(test_df)} (temporal: {test_df['Desde_dt'].min().date()} to {test_df['Desde_dt'].max().date()})")
report_lines.append(f"Features used: {len(feature_names)}")
report_lines.append(f"Target: {TARGET}")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("1. SURVIVAL ANALYSIS (Cox Proportional Hazards)")
report_lines.append("-" * 70)
report_lines.append(f"C-Index (concordance): {c_index:.4f}")
report_lines.append(f"Penalizer: 0.1")
report_lines.append(f"Training samples (after NaN drop): {len(surv_df)}")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("2. XGBoost Classifier (Primary)")
report_lines.append("-" * 70)
report_lines.append(f"Best Hyperparameters: {grid_search.best_params_}")
report_lines.append("")
report_lines.append("  5-Fold Stratified CV (Training Set):")
for metric in cv_results_xgb:
    vals = cv_results_xgb[metric]
    report_lines.append(f"    {metric:>10s}: {np.mean(vals):.4f} ± {np.std(vals):.4f}")
report_lines.append("")
report_lines.append("  Temporal Test Set:")
report_lines.append(f"    AUC-ROC:   {xgb_auc:.4f}")
report_lines.append(f"    F1-Score:  {xgb_f1:.4f}")
report_lines.append(f"    Precision: {xgb_prec:.4f}")
report_lines.append(f"    Recall:    {xgb_rec:.4f}")
report_lines.append(f"    Accuracy:  {xgb_acc:.4f}")
report_lines.append("")
report_lines.append(f"  Classification Report:\n{classification_report(y_test, y_pred_xgb)}")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("3. Logistic Regression (Baseline)")
report_lines.append("-" * 70)
report_lines.append("  5-Fold Stratified CV (Training Set):")
for metric in cv_results_lr:
    vals = cv_results_lr[metric]
    report_lines.append(f"    {metric:>10s}: {np.mean(vals):.4f} ± {np.std(vals):.4f}")
report_lines.append("")
report_lines.append("  Temporal Test Set:")
report_lines.append(f"    AUC-ROC:   {lr_auc:.4f}")
report_lines.append(f"    F1-Score:  {lr_f1:.4f}")
report_lines.append(f"    Precision: {lr_prec:.4f}")
report_lines.append(f"    Recall:    {lr_rec:.4f}")
report_lines.append(f"    Accuracy:  {lr_acc:.4f}")
report_lines.append("")
report_lines.append(f"  Classification Report:\n{classification_report(y_test, y_pred_lr)}")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("MODEL COMPARISON (Temporal Test Set)")
report_lines.append("-" * 70)
report_lines.append(f"{'Metric':<15} {'XGBoost':>10} {'LogReg':>10} {'Winner':>10}")
report_lines.append("-" * 45)
for name, xv, lv in [
    ('AUC-ROC', xgb_auc, lr_auc),
    ('F1-Score', xgb_f1, lr_f1),
    ('Precision', xgb_prec, lr_prec),
    ('Recall', xgb_rec, lr_rec),
    ('Accuracy', xgb_acc, lr_acc),
]:
    winner = 'XGBoost' if xv >= lv else 'LogReg'
    report_lines.append(f"{name:<15} {xv:>10.4f} {lv:>10.4f} {winner:>10}")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("TOP SHAP FEATURES")
report_lines.append("-" * 70)
for i, feat in enumerate(top3_features):
    report_lines.append(f"  {i+1}. {feat} (mean |SHAP| = {mean_abs_shap[top3_idx[i]]:.4f})")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("OUTPUT FILES")
report_lines.append("-" * 70)
report_lines.append(f"  Model script:         model_injury_risk.py")
report_lines.append(f"  XGBoost model:        injury_xgboost_model.pkl")
report_lines.append(f"  LogReg model:         injury_logistic_model.pkl")
report_lines.append(f"  SHAP summary:         injury_shap_summary.png")
report_lines.append(f"  SHAP dependence:      injury_shap_dep_*.png")
report_lines.append(f"  Survival curves:      injury_survival_curves.png")
report_lines.append(f"  Confusion matrix:     injury_confusion_matrix.png")
report_lines.append(f"  ROC curve:            injury_roc_curve.png")
report_lines.append(f"  Feature importance:   injury_feature_importance.png")
report_lines.append(f"  This report:          injury_model_metrics.txt")

report_text = '\n'.join(report_lines)
with open(os.path.join(OUTPUT_DIR, 'injury_model_metrics.txt'), 'w', encoding='utf-8') as f:
    f.write(report_text)

print(report_text)
print("\n✅ ALL DONE! All outputs saved to:", OUTPUT_DIR)
