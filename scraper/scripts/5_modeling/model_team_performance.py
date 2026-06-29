import pandas as pd
import numpy as np
from sklearn.model_selection import KFold, cross_validate
from sklearn.linear_model import LinearRegression
from xgboost import XGBRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib
import os
import shutil

# Define paths
data_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_teams_featured.csv"
models_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models"
model_path = os.path.join(models_dir, "team_points_xgb_model.pkl")
metrics_path = os.path.join(models_dir, "team_points_metrics.txt")

# Additional output directories for the platform
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLATFORM_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'metrics')
BACKEND_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_metrics')
for d in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
    os.makedirs(d, exist_ok=True)

# Load data
df = pd.read_csv(data_path)

# Drop rows where target is missing
df = df.dropna(subset=['group_points'])

# Define leaky columns and non-feature columns
leaky_cols = [
    'group_rank', 'group_matches_played', 'group_wins', 'group_draws', 
    'group_losses', 'group_goals_for', 'group_goals_against', 
    'group_goals_difference', 'group_last_5_form', 'group_notes'
]
non_features = ['Country']

# Prepare features (X) and target (y)
cols_to_drop = leaky_cols + non_features + ['group_points']
# Ensure we only drop columns that actually exist in the df
cols_to_drop = [c for c in cols_to_drop if c in df.columns]

X = df.drop(columns=cols_to_drop)

# Impute missing values in features if any (numeric only)
numeric_cols = X.select_dtypes(include=[np.number]).columns
X[numeric_cols] = X[numeric_cols].fillna(X[numeric_cols].median())

# If there are any non-numeric columns left, try to encode or drop them
non_numeric_cols = X.select_dtypes(exclude=[np.number]).columns
if len(non_numeric_cols) > 0:
    X = pd.get_dummies(X, columns=non_numeric_cols, drop_first=True)

y = df['group_points']

# Define Models
models = {
    'Linear Regression': LinearRegression(),
    'XGBoost Regressor': XGBRegressor(random_state=42)
}

# 5-Fold CV
kf = KFold(n_splits=5, shuffle=True, random_state=42)

results_text = []
results_text.append("Team Performance Prediction Results (5-Fold CV)\n")
results_text.append("-" * 50)

for name, model in models.items():
    cv_results = cross_validate(model, X, y, cv=kf,
                                scoring=('neg_mean_squared_error', 'neg_mean_absolute_error'),
                                return_train_score=False)
    
    rmse = np.sqrt(-cv_results['test_neg_mean_squared_error'].mean())
    mae = -cv_results['test_neg_mean_absolute_error'].mean()
    
    results_text.append(f"Model: {name}")
    results_text.append(f"RMSE: {rmse:.4f}")
    results_text.append(f"MAE:  {mae:.4f}")
    results_text.append("-" * 30)

# Train XGBoost on all data and save
xgb = XGBRegressor(random_state=42)
xgb.fit(X, y)

# Ensure models directory exists
os.makedirs(models_dir, exist_ok=True)

# Save the model
joblib.dump(xgb, model_path)
results_text.append(f"\nXGBoost model saved to: {model_path}")

# Save metrics
with open(metrics_path, "w") as f:
    f.write("\n".join(results_text))
for dest_dir in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
    shutil.copy2(metrics_path, os.path.join(dest_dir, "team_points_metrics.txt"))

print("\n".join(results_text))
