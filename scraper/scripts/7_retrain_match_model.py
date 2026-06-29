"""
Retrain match outcome prediction models using the enriched dataset
that now includes historical World Cup matches (1930-2022).

Produces:
- match_outcome_xgb.pkl (3-class: W/D/L)
- match_outcome_weather_xgb.pkl (binary with weather features)
- Updated metrics and plots
"""
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, f1_score, log_loss,
                             classification_report, confusion_matrix)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os
import shutil

# Directories
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_FEATURED = os.path.join(BASE_DIR, 'data', '4_featured')
BACKEND_DIR = os.path.join(BASE_DIR, '..', 'backend')
BACKEND_MODELS = os.path.join(BACKEND_DIR, 'data', 'models')
BACKEND_PLOTS = os.path.join(BACKEND_DIR, 'static', 'model_plots')
BACKEND_METRICS = os.path.join(BACKEND_DIR, 'static', 'model_metrics')

for d in [BACKEND_MODELS, BACKEND_PLOTS, BACKEND_METRICS]:
    os.makedirs(d, exist_ok=True)

print("=" * 60)
print("RETRAINING MATCH OUTCOME MODELS (enriched dataset)")
print("=" * 60)

# 1. Load enriched data
print("\n1. Loading enriched master_matches_featured.csv...")
df = pd.read_csv(os.path.join(DATA_FEATURED, 'master_matches_featured.csv'))
df['Date'] = pd.to_datetime(df['Date'])

# Filter out future matches and rows without result
df = df[df['is_future'] == False].copy()
df = df.dropna(subset=['Result'])
df = df.sort_values('Date').reset_index(drop=True)
print(f"   Total matches with results: {len(df)}")

# 2. Prepare features for 3-class model
print("\n2. Preparing features...")
features_3class = [
    'ranking_diff', 'h2h_wins', 'h2h_losses', 'h2h_draws', 'h2h_matches',
    'h2h_goals_for', 'h2h_goals_against',
    'days_since_last_match', 'form_last_5', 'form_last_10',
    'goals_scored_last_5', 'goals_conceded_last_5',
]

# Only use features that exist
features_3class = [f for f in features_3class if f in df.columns]

# Add FIFA features if available
for col in ['Country_FIFA_Points', 'Opponent_FIFA_Points', 'Country_FIFA_Rank', 'Opponent_FIFA_Rank']:
    if col in df.columns:
        features_3class.append(col)

print(f"   Features for 3-class model: {features_3class}")

# Fill NaN
for col in features_3class:
    df[col] = df[col].fillna(0)

# Encode target
target_map = {'L': 0, 'D': 1, 'W': 2}
df['target'] = df['Result'].map(target_map)
df = df.dropna(subset=['target'])
df['target'] = df['target'].astype(int)

X = df[features_3class]
y = df['target']

# Time-series split (80/20)
split_idx = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
print(f"   Train: {len(X_train)}, Test: {len(X_test)}")
print(f"   Class distribution (test): {dict(y_test.value_counts().sort_index())}")

# 3. Train 3-class model
print("\n3. Training 3-class XGBoost...")
xgb_3class = xgb.XGBClassifier(
    n_estimators=200, max_depth=4, learning_rate=0.05,
    random_state=42, eval_metric='mlogloss',
    min_child_weight=3, subsample=0.8, colsample_bytree=0.8
)
xgb_3class.fit(X_train, y_train)
preds_3class = xgb_3class.predict(X_test)
probs_3class = xgb_3class.predict_proba(X_test)

acc_3class = accuracy_score(y_test, preds_3class)
f1_3class = f1_score(y_test, preds_3class, average='macro')
ll_3class = log_loss(y_test, probs_3class)
print(f"   Accuracy: {acc_3class:.4f}")
print(f"   F1-Macro: {f1_3class:.4f}")
print(f"   Log Loss: {ll_3class:.4f}")

# 4. Train baseline
print("\n4. Training Random Forest baseline...")
rf = RandomForestClassifier(n_estimators=100, random_state=42)
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)
rf_probs = rf.predict_proba(X_test)
acc_rf = accuracy_score(y_test, rf_preds)
f1_rf = f1_score(y_test, rf_preds, average='macro')
ll_rf = log_loss(y_test, rf_probs)
print(f"   RF Accuracy: {acc_rf:.4f}, F1: {f1_rf:.4f}")

# 5. Train weather model (binary: win A vs not)
print("\n5. Training weather model (binary, 14 features)...")
weather_features = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot'
]

# Only rows that have weather data
weather_cols_available = all(c in df.columns for c in ['temp_max', 'precipitation', 'wind_speed'])
if weather_cols_available:
    df_w = df.dropna(subset=['temp_max', 'precipitation', 'wind_speed']).copy()
    # Create binary features if not exist
    if 'is_raining' not in df_w.columns:
        df_w['is_raining'] = (df_w['precipitation'] > 2.0).astype(int)
    if 'is_hot' not in df_w.columns:
        df_w['is_hot'] = (df_w['temp_max'] > 30.0).astype(int)
    
    for col in weather_features:
        if col in df_w.columns:
            df_w[col] = df_w[col].fillna(0)
    
    # Binary target: 1 = win, 0 = not win
    df_w['target_binary'] = (df_w['Result'] == 'W').astype(int)
    
    avail_features = [f for f in weather_features if f in df_w.columns]
    X_w = df_w[avail_features]
    y_w = df_w['target_binary']
    
    split_w = int(len(df_w) * 0.8)
    X_train_w, X_test_w = X_w.iloc[:split_w], X_w.iloc[split_w:]
    y_train_w, y_test_w = y_w.iloc[:split_w], y_w.iloc[split_w:]
    
    xgb_weather = xgb.XGBClassifier(
        n_estimators=150, max_depth=4, learning_rate=0.05,
        random_state=42, eval_metric='logloss',
        min_child_weight=3, subsample=0.8, colsample_bytree=0.8
    )
    xgb_weather.fit(X_train_w, y_train_w)
    preds_w = xgb_weather.predict(X_test_w)
    acc_w = accuracy_score(y_test_w, preds_w)
    print(f"   Weather model trained on {len(X_train_w)} rows, Accuracy: {acc_w:.4f}")
else:
    print("   WARNING: Weather columns not found, skipping weather model retrain")
    xgb_weather = None

# 6. Save models
print("\n6. Saving models...")
joblib.dump(xgb_3class, os.path.join(BACKEND_MODELS, 'match_outcome_xgb.pkl'))
print(f"   Saved: match_outcome_xgb.pkl")

if xgb_weather is not None:
    joblib.dump(xgb_weather, os.path.join(BACKEND_MODELS, 'match_outcome_weather_xgb.pkl'))
    print(f"   Saved: match_outcome_weather_xgb.pkl")

# 7. Generate plots
print("\n7. Generating plots...")

# Confusion Matrix
cm = confusion_matrix(y_test, preds_3class)
fig, ax = plt.subplots(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
            xticklabels=['L', 'D', 'W'], yticklabels=['L', 'D', 'W'])
ax.set_xlabel('Predicted')
ax.set_ylabel('Actual')
ax.set_title(f'Match Outcome - Confusion Matrix\n(Accuracy: {acc_3class:.3f}, F1-Macro: {f1_3class:.3f})')
plt.tight_layout()
cm_path = os.path.join(BACKEND_PLOTS, 'match_outcome_confusion_matrix.png')
plt.savefig(cm_path, dpi=150, bbox_inches='tight')
plt.close()
print(f"   Saved: match_outcome_confusion_matrix.png")

# SHAP Summary for Win class
try:
    import shap
    explainer = shap.TreeExplainer(xgb_3class)
    shap_values = explainer.shap_values(X_test.iloc[:200])
    
    # For multiclass, shap_values is a list of arrays (one per class)
    # Class 2 = Win
    fig, ax = plt.subplots(figsize=(10, 6))
    shap.summary_plot(shap_values[2] if isinstance(shap_values, list) else shap_values[:, :, 2],
                      X_test.iloc[:200], show=False, max_display=12)
    plt.title('SHAP Summary - Win Prediction (Class W=2)')
    plt.tight_layout()
    shap_path = os.path.join(BACKEND_PLOTS, 'match_outcome_shap_summary_win.png')
    plt.savefig(shap_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   Saved: match_outcome_shap_summary_win.png")
except Exception as e:
    print(f"   SHAP plot failed (non-critical): {e}")

# 8. Save metrics
print("\n8. Saving metrics...")
report_text = f"""Match Outcome Prediction Metrics (Enriched Dataset)
====================================================
Dataset: {len(df)} matches ({len(df)-len(df[df.get('source','')=='historical_wc'])} FBref + historical WC)
Train/Test Split: 80/20 temporal

Baseline (Random Forest):
Accuracy: {acc_rf:.4f}
F1-Macro: {f1_rf:.4f}
Log Loss: {ll_rf:.4f}

XGBoost 3-Class:
Accuracy: {acc_3class:.4f}
F1-Macro: {f1_3class:.4f}
Log Loss: {ll_3class:.4f}

XGBoost Classification Report:
{classification_report(y_test, preds_3class, target_names=['L', 'D', 'W'])}
"""

if xgb_weather is not None:
    report_text += f"""
Weather Model (Binary - Win/Not Win):
Train samples: {len(X_train_w)}
Test samples: {len(X_test_w)}
Accuracy: {acc_w:.4f}
"""

metrics_path = os.path.join(BACKEND_METRICS, 'match_outcome_metrics.txt')
with open(metrics_path, 'w') as f:
    f.write(report_text)
print(f"   Saved: {metrics_path}")
print(report_text)

print("\n" + "=" * 60)
print("MODEL RETRAINING COMPLETE!")
print("=" * 60)
