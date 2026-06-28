import os
import pandas as pd
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "unified_data")

def unify_csv_files():
    if not os.path.exists(DATA_DIR):
        print(f"Error: Data directory {DATA_DIR} does not exist.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Dict to group dataframes by (category, filename)
    # e.g., ("world_cup", "roster.csv") -> list of dataframes
    grouped_data = defaultdict(list)
    
    print("Scanning directories...")
    # Walk through the data directory
    for root, dirs, files in os.walk(DATA_DIR):
        for file in files:
            if file.endswith('.csv'):
                file_path = os.path.join(root, file)
                
                # Path structure: DATA_DIR / Country / Category / file.csv
                # We want to extract Country and Category
                relative_path = os.path.relpath(file_path, DATA_DIR)
                parts = relative_path.split(os.sep)
                
                if len(parts) >= 3:
                    country = parts[0]
                    category = parts[1]
                    filename = parts[2]
                else:
                    # Fallback if structure is different
                    country = "Unknown"
                    category = "Unknown"
                    filename = file
                
                # Normalize filename to merge subsets like stats_keeper_1, stats_keeper_2, etc.
                base_name = filename.lower()
                if "stats_keeper" in base_name:
                    norm_filename = "stats_keeper.csv"
                elif "stats_misc" in base_name:
                    norm_filename = "stats_misc.csv"
                elif "stats_playing_time" in base_name:
                    norm_filename = "stats_playing_time.csv"
                elif "stats_shooting" in base_name:
                    norm_filename = "stats_shooting.csv"
                elif "stats_standard" in base_name:
                    norm_filename = "stats_standard.csv"
                elif "results" in base_name:
                    norm_filename = "results_overall.csv"
                elif "roster" in base_name:
                    norm_filename = "roster.csv"
                elif "matchlogs_for" in base_name:
                    norm_filename = "matchlogs_for.csv"
                else:
                    norm_filename = filename

                try:
                    df = pd.read_csv(file_path)
                    
                    # Add metadata columns
                    df['Country'] = country
                    df['Category'] = category
                    
                    # Store
                    key = (category, norm_filename)
                    grouped_data[key].append(df)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    print("\nMerging and saving unified files...")
    for (category, filename), dfs in grouped_data.items():
        if not dfs:
            continue
        
        try:
            # Concatenate all dataframes in this group
            merged_df = pd.concat(dfs, ignore_index=True)
            
            # Move 'Country' and 'Category' to the front for readability
            cols = ['Country', 'Category'] + [col for col in merged_df.columns if col not in ['Country', 'Category']]
            merged_df = merged_df[cols]
            
            # Generate output filename: e.g., world_cup_roster.csv
            output_filename = f"{category}_{filename}"
            output_path = os.path.join(OUTPUT_DIR, output_filename)
            
            merged_df.to_csv(output_path, index=False, encoding='utf-8-sig')
            print(f"Saved: {output_path} (Rows: {len(merged_df)}, Source Files: {len(dfs)})")
        except Exception as e:
            print(f"Error merging {category}/{filename}: {e}")

    print("\nUnification complete!")

if __name__ == "__main__":
    unify_csv_files()
