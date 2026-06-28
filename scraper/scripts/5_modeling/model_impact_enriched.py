import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib

print("Loading enriched features...")
# Load the enriched X_players
X_df = pd.read_csv('data/4_featured/X_players_enriched.csv')

# The target is impact_score_raw
if 'impact_score_raw' not in X_df.columns:
    print("impact_score_raw not found! Exiting.")
    exit(1)

# Drop identifying and non-numerical columns
features = X_df.drop(columns=['Player', 'Pos', 'Country', 'impact_score_raw'], errors='ignore')
target = X_df['impact_score_raw']

# Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)

print(f"Training XGBoost with {X_train.shape[1]} features (including FIFA attributes)...")

model = xgb.XGBRegressor(
    n_estimators=150,
    learning_rate=0.05,
    max_depth=4,
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
preds = model.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, preds))
r2 = r2_score(y_test, preds)

print(f"Enriched Model RMSE: {rmse:.2f}")
print(f"Enriched Model R2 Score: {r2:.2f}")

# Feature Importance
importances = model.feature_importances_
feature_names = features.columns
feat_imp = pd.DataFrame({'Feature': feature_names, 'Importance': importances}).sort_values(by='Importance', ascending=False)
print("\nTop 10 Most Important Features (Enriched):")
print(feat_imp.head(10))

# Save the new model
output_model = 'models/pkl/player_impact_xgb_enriched.pkl'
joblib.dump(model, output_model)
print(f"\nSaved enriched model to {output_model}")
