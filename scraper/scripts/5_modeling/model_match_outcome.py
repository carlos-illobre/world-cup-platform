import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, log_loss, classification_report, confusion_matrix
import shap
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os
import shutil

# Create models directory if it doesn't exist
os.makedirs('unified_data/models', exist_ok=True)

# Additional output directories for the platform
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLATFORM_PLOTS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'shap_plots')
PLATFORM_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'metrics')
BACKEND_PLOTS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_plots')
BACKEND_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_metrics')
for d in [PLATFORM_PLOTS_DIR, PLATFORM_METRICS_DIR, BACKEND_PLOTS_DIR, BACKEND_METRICS_DIR]:
    os.makedirs(d, exist_ok=True)

def save_plot_to_all(filename):
    """Copy a saved plot to platform and backend directories."""
    src = os.path.join('unified_data/models', filename)
    for dest_dir in [PLATFORM_PLOTS_DIR, BACKEND_PLOTS_DIR]:
        shutil.copy2(src, os.path.join(dest_dir, filename))
    print(f"  → Copied to platform + backend: {filename}")

def save_metrics_to_all(text, filename):
    """Save metrics and copy to all directories."""
    primary = os.path.join('unified_data/models', filename)
    with open(primary, 'w') as f:
        f.write(text)
    for dest_dir in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
        shutil.copy2(primary, os.path.join(dest_dir, filename))
    print(f"  → Metrics saved to platform + backend: {filename}")

print("Loading data...")
df = pd.read_csv('unified_data/master_matches_featured.csv')

# Filter out future matches
df = df[df['is_future'] == False].copy()

# Drop rows where Result is missing
df = df.dropna(subset=['Result'])

# Sort by date for time-series split
df['Date'] = pd.to_datetime(df['Date'])
df = df.sort_values('Date').reset_index(drop=True)

# Select features
features = [
    'Country_FIFA_Rank', 'Opponent_FIFA_Rank', 'ranking_diff', 'is_higher_ranked',
    'days_since_last_match', 'form_last_5', 'form_last_10',
    'goals_scored_last_5', 'goals_conceded_last_5',
    'win_rate_home', 'win_rate_away', 'win_rate_neutral',
    'h2h_matches', 'h2h_wins', 'h2h_losses', 'h2h_draws',
    'h2h_goals_for', 'h2h_goals_against'
]

# Add Venue as feature (encode it)
df['Venue_encoded'] = df['Venue'].map({'Home': 1, 'Away': -1, 'Neutral': 0})
features.append('Venue_encoded')

# Fill missing values for features
for col in features:
    if col in df.columns:
        df[col] = df[col].fillna(0) # Simple imputation for missing features

# Encode target
target_map = {'L': 0, 'D': 1, 'W': 2}
df['target'] = df['Result'].map(target_map)

# Drop rows with unmapped targets (if any)
df = df.dropna(subset=['target'])
df['target'] = df['target'].astype(int)

X = df[features]
y = df['target']

# Time-series split (80% train, 20% test)
split_idx = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

print(f"Training set: {len(X_train)} samples")
print(f"Test set: {len(X_test)} samples")

# Baseline Model: Random Forest
print("\nTraining Baseline Random Forest...")
rf = RandomForestClassifier(n_estimators=100, random_state=42)
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)
rf_probs = rf.predict_proba(X_test)

# XGBoost Model
print("Training XGBoost...")
xgb_model = xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42, use_label_encoder=False, eval_metric='mlogloss')
xgb_model.fit(X_train, y_train)
xgb_preds = xgb_model.predict(X_test)
xgb_probs = xgb_model.predict_proba(X_test)

# Evaluate
def evaluate(y_true, y_pred, y_prob, model_name):
    acc = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, average='macro')
    ll = log_loss(y_true, y_prob)
    return acc, f1, ll

rf_acc, rf_f1, rf_ll = evaluate(y_test, rf_preds, rf_probs, "Random Forest")
xgb_acc, xgb_f1, xgb_ll = evaluate(y_test, xgb_preds, xgb_probs, "XGBoost")

report = f"""Match Outcome Prediction Metrics
================================
Baseline (Random Forest):
Accuracy: {rf_acc:.4f}
F1-Macro: {rf_f1:.4f}
Log Loss: {rf_ll:.4f}

XGBoost:
Accuracy: {xgb_acc:.4f}
F1-Macro: {xgb_f1:.4f}
Log Loss: {xgb_ll:.4f}

XGBoost Classification Report:
{classification_report(y_test, xgb_preds, target_names=['L', 'D', 'W'])}
"""

print(report)

save_metrics_to_all(report, 'match_outcome_metrics.txt')

# Confusion Matrix
cm = confusion_matrix(y_test, xgb_preds)
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['L', 'D', 'W'], yticklabels=['L', 'D', 'W'])
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('XGBoost Match Outcome Confusion Matrix')
plt.tight_layout()
plt.savefig('unified_data/models/match_outcome_confusion_matrix.png')
plt.close()
save_plot_to_all('match_outcome_confusion_matrix.png')

# Save Model
joblib.dump(xgb_model, 'unified_data/models/match_outcome_xgb.pkl')
print("Model saved to unified_data/models/match_outcome_xgb.pkl")

# SHAP Analysis
print("Running SHAP Analysis...")
explainer = shap.TreeExplainer(xgb_model)
shap_values = explainer.shap_values(X_test)

# For multiclass, shap_values might be a list of arrays or a 3D array
if isinstance(shap_values, list):
    shap_vals_win = shap_values[2]
elif len(shap_values.shape) == 3:
    shap_vals_win = shap_values[:, :, 2]
else:
    shap_vals_win = shap_values

plt.figure()
shap.summary_plot(shap_vals_win, X_test, show=False)
plt.title("SHAP Summary Plot (Predicting Win)")
plt.tight_layout()
plt.savefig('unified_data/models/match_outcome_shap_summary_win.png')
plt.close()
save_plot_to_all('match_outcome_shap_summary_win.png')

print("Match Outcome prediction complete.")
