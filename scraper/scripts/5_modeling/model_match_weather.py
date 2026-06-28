import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("Loading match weather dataset...")
df = pd.read_csv('data/4_featured/X_match_weather.csv')

features_to_use = [
    'Country_FIFA_Points', 'Opponent_FIFA_Points', 'ranking_diff',
    'h2h_wins', 'h2h_losses', 'days_since_last_match',
    'form_last_5', 'goals_scored_last_5', 'goals_conceded_last_5',
    'temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot'
]

# We need to drop NaNs in these specific columns to train
df = df.dropna(subset=features_to_use + ['Target_Win'])

X = df[features_to_use]
y = df['Target_Win']

print("Class distribution (1=Win, 0=Draw/Loss):")
print(y.value_counts(normalize=True))

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print(f"Training XGBoost Match Predictor with Weather on {len(X_train)} matches...")

# Compute class weights for imbalance
scale_pos_weight = sum(y_train == 0) / sum(y_train == 1) if sum(y_train == 1) > 0 else 1

model = xgb.XGBClassifier(
    n_estimators=100,
    learning_rate=0.05,
    max_depth=5,
    scale_pos_weight=scale_pos_weight,
    random_state=42
)

model.fit(X_train, y_train)

preds = model.predict(X_test)
acc = accuracy_score(y_test, preds)

print("Classification Report:")
print(classification_report(y_test, preds))

# Feature importances
importances = model.feature_importances_
feat_imp = pd.DataFrame({'Feature': features_to_use, 'Importance': importances}).sort_values(by='Importance', ascending=False)
print("\nTop 10 Drivers of Match Outcome (Including Weather):")
print(feat_imp.head(10))

# The hypothesis is that weather features (temp, rain) will appear in the top 10
weather_imp = feat_imp[feat_imp['Feature'].isin(['temp_max', 'precipitation', 'wind_speed', 'is_raining', 'is_hot'])]
print("\nWeather Importance:")
print(weather_imp)

output_model = 'models/pkl/match_outcome_weather_xgb.pkl'
joblib.dump(model, output_model)
print(f"Saved weather-aware match predictor to {output_model}")
