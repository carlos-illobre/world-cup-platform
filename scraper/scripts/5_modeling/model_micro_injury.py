import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("Loading multimodal sports injury dataset...")
df = pd.read_csv('data/1_raw/multimodal_sports_injury_dataset.csv')

# Only keep soccer if available, otherwise use all
if 'Soccer' in df['sport_type'].unique():
    df = df[df['sport_type'] == 'Soccer']

features_to_use = [
    'heart_rate', 'body_temperature', 'hydration_level', 'sleep_quality',
    'recovery_score', 'stress_level', 'muscle_activity', 'training_load',
    'fatigue_index', 'age', 'bmi'
]

# Drop NaNs
df = df.dropna(subset=features_to_use + ['injury_occurred'])

X = df[features_to_use]
y = df['injury_occurred']

print("Class distribution:")
print(y.value_counts(normalize=True))

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print(f"Training micro-injury model on {len(X_train)} sessions...")

# Use scale_pos_weight for imbalance
scale_pos_weight = sum(y_train == 0) / sum(y_train == 1) if sum(y_train == 1) > 0 else 1

model = xgb.XGBClassifier(
    n_estimators=100,
    learning_rate=0.05,
    max_depth=4,
    scale_pos_weight=scale_pos_weight,
    random_state=42
)

model.fit(X_train, y_train)

preds = model.predict(X_test)
print("Classification Report:")
print(classification_report(y_test, preds))

# Feature importances
importances = model.feature_importances_
feat_imp = pd.DataFrame({'Feature': features_to_use, 'Importance': importances}).sort_values(by='Importance', ascending=False)
print("\nTop 5 Drivers of Micro-Injuries (Session-level):")
print(feat_imp.head(5))

output_model = 'models/pkl/micro_injury_xgb.pkl'
joblib.dump(model, output_model)
print(f"Saved micro-injury model to {output_model}")
