import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import shap
import matplotlib.pyplot as plt
import joblib
import os

os.makedirs('unified_data/models', exist_ok=True)

print("Loading players data...")
df = pd.read_csv('unified_data/master_players_featured.csv')

# Use impact_score_raw as the target, or derive a normalized version.
# Let's normalize impact_score_raw to a 0-100 scale for better interpretability
min_score = df['impact_score_raw'].min()
max_score = df['impact_score_raw'].max()
df['impact_score_normalized'] = 100 * (df['impact_score_raw'] - min_score) / (max_score - min_score)

# We want to predict it from basic features
features = ['Age', 'position_encoded', 'league_tier', 'experience_level', 'MarketValue_EUR']

# Fill missing values
for col in features:
    if col in df.columns:
        df[col] = df[col].fillna(df[col].median())

df = df.dropna(subset=['impact_score_normalized'])

X = df[features]
y = df['impact_score_normalized']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"Training Regressor on {len(X_train)} samples...")
model = xgb.XGBRegressor(n_estimators=150, max_depth=5, learning_rate=0.05, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)

# Evaluate
rmse = np.sqrt(mean_squared_error(y_test, preds))
mae = mean_absolute_error(y_test, preds)
r2 = r2_score(y_test, preds)

report = f"""Player Impact Score Prediction Metrics
========================================
RMSE: {rmse:.4f}
MAE: {mae:.4f}
R2 Score: {r2:.4f}
"""
print(report)

with open('unified_data/models/player_impact_metrics.txt', 'w') as f:
    f.write(report)

joblib.dump(model, 'unified_data/models/player_impact_xgb.pkl')

# Top 20 players by true impact score (Validation check)
print("Top 20 Players by Impact Score:")
top_players = df[['Player', 'Country', 'Age', 'Club', 'impact_score_normalized']].sort_values('impact_score_normalized', ascending=False).head(20)
print(top_players.to_string(index=False))

with open('unified_data/models/player_impact_top20.txt', 'w') as f:
    f.write(top_players.to_string(index=False))

# SHAP Analysis
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

plt.figure()
shap.summary_plot(shap_values, X_test, show=False)
plt.title("SHAP Summary Plot - Player Impact Score")
plt.tight_layout()
plt.savefig('unified_data/models/player_impact_shap_summary.png')
plt.close()

print("Player Impact Score modeling complete.")
