import os
import pandas as pd
import numpy as np

def parse_age(age_val):
    if pd.isna(age_val) or age_val == "":
        return np.nan
    age_str = str(age_val).strip()
    if not age_str:
        return np.nan
    
    # Try parsing 'years-days' format like '26-361'
    if '-' in age_str:
        try:
            parts = age_str.split('-')
            if len(parts) == 2:
                years = float(parts[0])
                days = float(parts[1])
                return round(years + (days / 365.25), 4)
        except Exception:
            pass
            
    # Try standard float/int parsing
    try:
        return float(age_str)
    except ValueError:
        return np.nan

def clean_file(filepath, output_dir):
    filename = os.path.basename(filepath)
    print(f"Processing: {filename}")
    
    # Load CSV
    df = pd.read_csv(filepath)
    initial_shape = df.shape
    
    # 1. Remove 'Matches' and 'Category' columns if present
    cols_to_remove = ['Matches', 'Category']
    df = df.drop(columns=[col for col in cols_to_remove if col in df.columns])
    
    # 2. Remove duplicate/empty last column 'Playing Time_MP' if present
    if 'Playing Time_MP' in df.columns:
        df = df.drop(columns=['Playing Time_MP'])
        
    # 3. Parse 'Age' column from 'years-days' format (e.g., '26-361') to numeric decimal
    if 'Age' in df.columns:
        df['Age'] = df['Age'].apply(parse_age)
        
    # 4. Filter out 'Squad Total' and 'Opponent Total' rows
    # We should search across all columns or primarily 'Player' column. Let's look for these values in 'Player' column.
    if 'Player' in df.columns:
        df = df[~df['Player'].astype(str).str.strip().isin(['Squad Total', 'Opponent Total'])]
        
    # 5. Report any completely empty columns
    empty_cols = [col for col in df.columns if df[col].isna().all()]
    if empty_cols:
        print(f"  Empty columns in {filename}: {empty_cols}")
    else:
        print(f"  No completely empty columns in {filename}")
        
    # Save the cleaned file
    output_filename = f"cleaned_all_stats_{filename.replace('all_competitions_stats_', '')}"
    output_path = os.path.join(output_dir, output_filename)
    df.to_csv(output_path, index=False)
    print(f"  Saved to: {output_path} (Shape changed from {initial_shape} to {df.shape})")
    return empty_cols

def main():
    base_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data"
    files = [
        "all_competitions_stats_standard.csv",
        "all_competitions_stats_shooting.csv",
        "all_competitions_stats_misc.csv",
        "all_competitions_stats_playing_time.csv",
        "all_competitions_stats_keeper.csv"
    ]
    
    for filename in files:
        filepath = os.path.join(base_dir, filename)
        if os.path.exists(filepath):
            clean_file(filepath, base_dir)
        else:
            print(f"File not found: {filepath}")

if __name__ == "__main__":
    main()
