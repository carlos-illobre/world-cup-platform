import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import warnings

warnings.filterwarnings('ignore')

file_path = r'c:\Users\carlo\Downloads\world-cup-platform\backend\data\csv\master_players_enriched.csv'
scraper_path = r'c:\Users\carlo\Downloads\world-cup-platform\scraper\data\3_master\master_players_enriched.csv'

print(f"Loading data from {file_path}...")
df = pd.read_csv(file_path)

# Columns to impute
targets = [
    'overall', 'potential', 'pace', 'shooting', 'passing', 
    'dribbling', 'defending', 'physic'
]

# Predictor features (FBref stats)
predictors = [
    'Age', 'Playing Time_Min_allcomps', 'Performance_Gls_allcomps',
    'Performance_Ast_allcomps', 'Standard_Sh_allcomps', 'Standard_SoT_allcomps',
    'Performance_Crs_allcomps', 'Performance_Int_allcomps', 'Performance_TklW_allcomps',
    'goals_per_90', 'assists_per_90', 'shots_per_90', 'sot_per_90',
    'tackles_won_per_90', 'interceptions_per_90', 'crosses_per_90'
]

# Ensure predictors are numeric
for col in predictors:
    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

# Check missing
missing_mask = df['overall'].isna()
missing_count = missing_mask.sum()
print(f"Found {missing_count} players with missing FIFA attributes.")

if missing_count > 0:
    train_df = df[~missing_mask]
    impute_df = df[missing_mask]
    
    X_train = train_df[predictors]
    X_impute = impute_df[predictors]
    
    print("Training RandomForestRegressors for imputation...")
    for target in targets:
        # Fill missing targets in train set just in case (should not happen for valid rows, but some might be NaN for GKs)
        y_train = train_df[target].fillna(train_df[target].median())
        
        model = Pipeline([
            ('scaler', StandardScaler()),
            ('rf', RandomForestRegressor(n_estimators=100, random_state=42))
        ])
        
        model.fit(X_train, y_train)
        preds = model.predict(X_impute)
        
        # Round and update
        df.loc[missing_mask, target] = np.round(preds)
        print(f"Imputed {target}.")

    print("Saving updated dataset...")
    df.to_csv(file_path, index=False)
    
    # Try copying to scraper path too
    try:
        df.to_csv(scraper_path, index=False)
        print("Updated scraper dataset as well.")
    except Exception as e:
        print(f"Could not update scraper dataset: {e}")
        
    print("FIFA Attributes Imputation Complete!")
else:
    print("No missing attributes found.")
