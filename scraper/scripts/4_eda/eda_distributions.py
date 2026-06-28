import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Set base path
base_path = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data'
output_dir = os.path.join(base_path, 'eda_reports')
os.makedirs(output_dir, exist_ok=True)

# Define target files
datasets = {
    'matches': 'master_matches_featured.csv',
    'injuries': 'master_injuries_featured.csv',
    'players': 'master_players_featured.csv',
    'teams': 'master_teams_featured.csv'
}

def analyze_dataset(name, filename):
    filepath = os.path.join(base_path, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    print(f"\nProcessing {name}...")
    df = pd.read_csv(filepath)
    
    # Identify numerical columns
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not num_cols:
        print(f"No numerical columns found in {name}.")
        return
        
    print(f"Numerical columns in {name}: {len(num_cols)}")
    
    # 1. Descriptive statistics
    desc_stats = df[num_cols].describe().T
    desc_stats.to_csv(os.path.join(output_dir, f'{name}_desc_stats.csv'))
    print(f"Saved descriptive statistics for {name}.")
    
    # 2. Outlier detection (IQR)
    outlier_summary = []
    for col in num_cols:
        # Handle NaNs by dropping them for quantile calculation
        col_data = df[col].dropna()
        if len(col_data) == 0:
            continue
            
        Q1 = col_data.quantile(0.25)
        Q3 = col_data.quantile(0.75)
        IQR = Q3 - Q1
        
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        # Count outliers
        outliers = col_data[(col_data < lower_bound) | (col_data > upper_bound)]
        outlier_count = len(outliers)
        outlier_percent = (outlier_count / len(col_data)) * 100
        
        outlier_summary.append({
            'column': col,
            'q1': Q1,
            'q3': Q3,
            'iqr': IQR,
            'lower_bound': lower_bound,
            'upper_bound': upper_bound,
            'outlier_count': outlier_count,
            'outlier_percentage': outlier_percent
        })
        
    outliers_df = pd.DataFrame(outlier_summary)
    if not outliers_df.empty:
        outliers_df.to_csv(os.path.join(output_dir, f'{name}_outliers_summary.csv'), index=False)
        print(f"Saved outlier summary for {name}.")
        
    # 3. Distribution plots (histograms and boxplots)
    # To avoid creating too many separate files, we group them into figures with subplots,
    # or create a separate folder for each dataset's plots.
    plot_dir = os.path.join(output_dir, f'{name}_plots')
    os.makedirs(plot_dir, exist_ok=True)
    
    for col in num_cols:
        # Avoid plotting columns with all NaNs
        if df[col].isna().all():
            continue
            
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        
        # Histogram
        sns.histplot(df[col].dropna(), kde=True, ax=axes[0])
        axes[0].set_title(f'{col} - Histogram')
        
        # Boxplot
        sns.boxplot(x=df[col].dropna(), ax=axes[1])
        axes[1].set_title(f'{col} - Boxplot')
        
        plt.tight_layout()
        safe_col_name = str(col).replace('/', '_').replace('\\', '_').replace(':', '_')
        plt.savefig(os.path.join(plot_dir, f'{safe_col_name}_dist.png'))
        plt.close()
        
    print(f"Saved distribution plots for {name}.")

if __name__ == "__main__":
    for name, file in datasets.items():
        analyze_dataset(name, file)
    print("\nEDA completed. All results saved to", output_dir)
