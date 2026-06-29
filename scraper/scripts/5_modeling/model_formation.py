import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from xgboost import XGBClassifier
import joblib
import os
import shutil

# Paths
DATA_PATH = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_matches_featured.csv"
MODEL_DIR = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\models"
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, "formation_xgb_model.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "formation_metrics.txt")

# Additional output directories for the platform
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLATFORM_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'models', 'metrics')
BACKEND_METRICS_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', 'backend', 'static', 'model_metrics')
for d in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
    os.makedirs(d, exist_ok=True)

def main():
    # Load data
    df = pd.read_csv(DATA_PATH)

    # We need Result and Formation
    df = df.dropna(subset=['Result', 'Formation', 'win_rate_home', 'win_rate_away', 'days_since_last_match'])

    # Filter out unknown results just in case
    df = df[df['Result'].isin(['W', 'D', 'L'])]

    # Encode Target
    target_map = {'L': 0, 'D': 1, 'W': 2}
    y = df['Result'].map(target_map)

    # Features to use
    feature_cols = ['win_rate_home', 'win_rate_away', 'days_since_last_match']

    # One-hot encode formation
    formation_dummies = pd.get_dummies(df['Formation'], prefix='form', dtype=int)
    X = pd.concat([df[feature_cols], formation_dummies], axis=1)

    # Impute any missing values in numeric features just in case
    X = X.fillna(X.mean())

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Scale numeric features
    scaler = StandardScaler()
    numeric_cols = feature_cols
    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()
    X_train_scaled[numeric_cols] = scaler.fit_transform(X_train[numeric_cols])
    X_test_scaled[numeric_cols] = scaler.transform(X_test[numeric_cols])

    # Baseline: Logistic Regression
    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train_scaled, y_train)
    lr_preds = lr.predict(X_test_scaled)
    lr_acc = accuracy_score(y_test, lr_preds)
    lr_f1 = f1_score(y_test, lr_preds, average='weighted')

    # XGBoost
    xgb = XGBClassifier(use_label_encoder=False, eval_metric='mlogloss', random_state=42)
    xgb.fit(X_train_scaled, y_train)
    xgb_preds = xgb.predict(X_test_scaled)
    xgb_acc = accuracy_score(y_test, xgb_preds)
    xgb_f1 = f1_score(y_test, xgb_preds, average='weighted')

    # Save model
    joblib.dump(xgb, MODEL_PATH)

    # To find optimal formation, we simulate:
    mean_features = X_train_scaled[numeric_cols].mean().to_dict()
    formations = formation_dummies.columns

    best_formation = None
    best_prob_w = -1

    for form in formations:
        sim_data = {col: [0] for col in X.columns}
        for col, val in mean_features.items():
            sim_data[col] = [val]
        sim_data[form] = [1]
        
        sim_df = pd.DataFrame(sim_data)
        # Ensure column order is the same as training
        sim_df = sim_df[X_train_scaled.columns]
        
        probs = xgb.predict_proba(sim_df)[0]
        prob_w = probs[2]
        
        if prob_w > best_prob_w:
            best_prob_w = prob_w
            best_formation = form

    best_formation_name = best_formation.replace('form_', '')

    with open(METRICS_PATH, "w") as f:
        f.write("Model: Logistic Regression (Baseline)\n")
        f.write(f"Accuracy: {lr_acc:.4f}\n")
        f.write(f"F1 Score: {lr_f1:.4f}\n\n")
        f.write("Model: XGBoost\n")
        f.write(f"Accuracy: {xgb_acc:.4f}\n")
        f.write(f"F1 Score: {xgb_f1:.4f}\n\n")
        f.write(f"Most Optimal Formation: {best_formation_name} (Prob W: {best_prob_w:.4f})\n")

    for dest_dir in [PLATFORM_METRICS_DIR, BACKEND_METRICS_DIR]:
        shutil.copy2(METRICS_PATH, os.path.join(dest_dir, "formation_metrics.txt"))

    print(f"Generated {MODEL_PATH}")
    print(f"Generated {METRICS_PATH}")
    print(f"Optimal formation: {best_formation_name} ({best_prob_w:.4f})")

if __name__ == "__main__":
    main()
