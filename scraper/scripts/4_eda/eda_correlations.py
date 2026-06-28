import os
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from statsmodels.stats.outliers_influence import variance_inflation_factor

def ensure_dir(dir_path):
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

def calculate_vif(df):
    vif_data = pd.DataFrame()
    # Add a small constant to avoid division by zero or singular matrix issues if possible, but statsmodels VIF handles it.
    # It's better to dropna and ensure numeric
    # Also handle infinite values
    df_clean = df.replace([np.inf, -np.inf], np.nan).dropna()
    # Ensure variance > 0
    df_clean = df_clean.loc[:, df_clean.var() > 0]
    
    # Check if empty
    if df_clean.empty:
        return pd.DataFrame({"Feature": [], "VIF": []})
        
    vif_data["Feature"] = df_clean.columns
    try:
        vif_data["VIF"] = [variance_inflation_factor(df_clean.values, i) for i in range(len(df_clean.columns))]
    except Exception as e:
        print(f"Error calculating VIF: {e}")
        vif_data["VIF"] = np.nan
    return vif_data

def process_dataset(name, encoded_path, featured_path, out_dir):
    print(f"Processing {name}...")
    df = pd.read_csv(encoded_path)
    
    # Use only numeric columns
    df_num = df.select_dtypes(include=[np.number])
    
    if df_num.shape[1] > 50:
        print(f"{name} has {df_num.shape[1]} numeric columns. Selecting top 50 variance features.")
        # Top 50 by variance to avoid OOM or slow computation for large feature sets
        cols_to_keep = df_num.var().nlargest(50).index
        df_num = df_num[cols_to_keep]
    
    # 1. Correlation heatmap
    print(f"Calculating correlations for {name}...")
    corr = df_num.corr()
    
    plt.figure(figsize=(12, 10))
    sns.heatmap(corr, annot=False, cmap='coolwarm', vmin=-1, vmax=1)
    plt.title(f'Correlation Heatmap - {name}')
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, f'{name}_heatmap.png'), dpi=300)
    plt.close()
    
    # 2. VIF scores
    print(f"Calculating VIF for {name}...")
    vif_df = calculate_vif(df_num)
    vif_df.to_csv(os.path.join(out_dir, f'{name}_vif.csv'), index=False)
    
    # 3. High correlations > 0.9
    print(f"Finding high correlations for {name}...")
    # Unstack the correlation matrix
    corr_unstacked = corr.abs().unstack()
    # Filter out self-correlations (1.0) and values below 0.9
    high_corr = corr_unstacked[(corr_unstacked > 0.9) & (corr_unstacked < 1.0)]
    # Drop duplicates (A-B and B-A)
    high_corr_df = pd.DataFrame(high_corr).reset_index()
    if not high_corr_df.empty:
        high_corr_df.columns = ['Feature 1', 'Feature 2', 'Correlation']
        # Sort and drop duplicates
        high_corr_df['sorted_pair'] = high_corr_df.apply(lambda row: tuple(sorted([row['Feature 1'], row['Feature 2']])), axis=1)
        high_corr_df = high_corr_df.drop_duplicates(subset='sorted_pair').drop('sorted_pair', axis=1)
    else:
        high_corr_df = pd.DataFrame(columns=['Feature 1', 'Feature 2', 'Correlation'])
        
    high_corr_df.to_csv(os.path.join(out_dir, f'{name}_high_correlations.csv'), index=False)
    print(f"Done with {name}\n")

if __name__ == "__main__":
    base_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data"
    out_dir = os.path.join(base_dir, "eda_reports")
    ensure_dir(out_dir)
    
    datasets = [
        ("X_matches", "X_matches.csv", "master_matches_featured.csv"),
        ("X_injuries", "X_injuries.csv", "master_injuries_featured.csv"),
        ("X_players", "X_players.csv", "master_players_featured.csv"),
        ("X_teams", "X_teams.csv", "master_teams_featured.csv")
    ]
    
    for name, enc_file, feat_file in datasets:
        enc_path = os.path.join(base_dir, enc_file)
        feat_path = os.path.join(base_dir, feat_file)
        if os.path.exists(enc_path):
            process_dataset(name, enc_path, feat_path, out_dir)
        else:
            print(f"File not found: {enc_path}")
