import os
import re
import pandas as pd
import numpy as np

# Absolute directory paths
BASE_DIR = r"c:\Users\carlo\Downloads\world_cup_scraper"
INPUT_DIR = os.path.join(BASE_DIR, "unified_data")
OUTPUT_DIR = os.path.join(INPUT_DIR, "cleaned")

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Helper function to parse age in "years-days" format (e.g., '26-361') to numeric decimal
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

# Helper function to clean opponent names and squad names
def clean_prefix(val):
    if not isinstance(val, str):
        return val
    return re.sub(r'^[a-z]{2}\s+', '', val)

def clean_injuries():
    print("--- Cleaning Injuries Data ---")
    files = {
        'argentina_injuries': os.path.join(BASE_DIR, "argentina_injuries.csv"),
        'all_countries_injuries': os.path.join(INPUT_DIR, "all_countries_injuries.csv"),
        'selected_countries_injuries': os.path.join(INPUT_DIR, "selected_countries_injuries.csv")
    }
    
    dfs = []
    for name, path in files.items():
        if os.path.exists(path):
            print(f"Reading {path}...")
            df = pd.read_csv(path, encoding='utf-8-sig')
            df = df.copy()
            
            # 1. Strip ' days' suffix from 'Dias_Baja' and cast to integer
            if 'Dias_Baja' in df.columns:
                df['Dias_Baja'] = (
                    df['Dias_Baja']
                    .astype(str)
                    .str.replace(' days', '', case=False, regex=False)
                    .str.replace(' day', '', case=False, regex=False)
                    .str.strip()
                )
                df['Dias_Baja'] = df['Dias_Baja'].replace(['-', '', 'nan', 'None'], np.nan)
                df['Dias_Baja'] = pd.to_numeric(df['Dias_Baja'], errors='coerce')
                df['Dias_Baja'] = df['Dias_Baja'].astype('Int64')
                
            # 2. Strip ' m' from 'Altura' and cast to float
            if 'Altura' in df.columns:
                df['Altura'] = (
                    df['Altura']
                    .astype(str)
                    .str.replace(' m', '', case=False, regex=False)
                    .str.replace('m', '', case=False, regex=False)
                    .str.replace(',', '.', regex=False)
                    .str.strip()
                )
                df['Altura'] = df['Altura'].replace(['-', '', 'nan', 'None'], np.nan)
                df['Altura'] = pd.to_numeric(df['Altura'], errors='coerce')

            # 3. Remove 'Peso' column if empty (entirely NaN)
            if 'Peso' in df.columns:
                cleaned_peso = df['Peso'].astype(str).str.strip().replace(['-', '', 'nan', 'None'], np.nan)
                if cleaned_peso.isna().all():
                    df.drop(columns=['Peso'], inplace=True)
                    print(f"  Dropped empty 'Peso' column from {name}")

            # 4. Normalize 'Tipo_Lesion' values
            if 'Tipo_Lesion' in df.columns:
                df['Tipo_Lesion'] = (
                    df['Tipo_Lesion']
                    .astype(str)
                    .str.strip()
                    .str.title()
                    .replace(['Nan', 'None', ''], np.nan)
                )

            # 5. Clean dates to YYYY-MM-DD
            for date_col in ['Desde', 'Hasta']:
                if date_col in df.columns:
                    s = df[date_col].astype(str).str.strip().replace(['-', '', 'nan', 'None'], np.nan)
                    dt = pd.to_datetime(s, format='%d/%m/%Y', errors='coerce')
                    df[date_col] = dt.dt.strftime('%Y-%m-%d')
                    
            if 'argentina_injuries' in name and 'Seleccion' not in df.columns:
                df['Seleccion'] = 'Argentina'
                
            dfs.append(df)
        else:
            print(f"Warning: File not found {path}")
            
    if not dfs:
        print("No injuries datasets loaded.")
        return
        
    merged_df = pd.concat(dfs, ignore_index=True)
    if 'Peso' in merged_df.columns:
        if merged_df['Peso'].isna().all():
            merged_df.drop(columns=['Peso'], inplace=True)
            print("  Dropped 'Peso' from merged injuries DataFrame as it is completely empty.")
            
    column_order = [
        'Jugador', 'Seleccion', 'Posicion', 'Edad', 'Edad_FBref', 
        'Altura', 'Temporada', 'Tipo_Lesion', 'Desde', 'Hasta', 
        'Dias_Baja', 'Partidos_Perdidos'
    ]
    existing_order = [col for col in column_order if col in merged_df.columns]
    other_columns = [col for col in merged_df.columns if col not in existing_order]
    merged_df = merged_df[existing_order + other_columns]
    
    output_path = os.path.join(OUTPUT_DIR, "cleaned_injuries.csv")
    merged_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"Saved: {output_path} (Shape: {merged_df.shape})")

def clean_stats():
    print("\n--- Cleaning World Cup & All Competitions Stats ---")
    
    prefixes = ['world_cup_stats_', 'all_competitions_stats_']
    stats_types = ['standard', 'shooting', 'misc', 'playing_time', 'keeper']
    
    for prefix in prefixes:
        for st_type in stats_types:
            filename = f"{prefix}{st_type}.csv"
            filepath = os.path.join(INPUT_DIR, filename)
            
            if os.path.exists(filepath):
                print(f"Processing: {filename}")
                df = pd.read_csv(filepath)
                initial_shape = df.shape
                
                # 1. Remove 'Matches' and 'Category' columns if present
                cols_to_remove = ['Matches', 'Category']
                df = df.drop(columns=[col for col in cols_to_remove if col in df.columns])
                
                # 2. Remove duplicate/empty last column 'Playing Time_MP' if present
                if 'Playing Time_MP' in df.columns:
                    df = df.drop(columns=['Playing Time_MP'])
                    
                # 3. Parse 'Age' column
                if 'Age' in df.columns:
                    df['Age'] = df['Age'].apply(parse_age)
                    
                # 4. Filter out 'Squad Total' and 'Opponent Total' rows
                if 'Player' in df.columns:
                    df = df[~df['Player'].astype(str).str.strip().isin(['Squad Total', 'Opponent Total'])]
                    
                # Save the cleaned file
                if prefix == 'world_cup_stats_':
                    out_filename = f"cleaned_wc_stats_{st_type}.csv"
                else:
                    out_filename = f"cleaned_all_stats_{st_type}.csv"
                    
                output_path = os.path.join(OUTPUT_DIR, out_filename)
                df.to_csv(output_path, index=False, encoding='utf-8-sig')
                print(f"  Saved to: {output_path} (Shape change: {initial_shape} -> {df.shape})")
            else:
                print(f"Warning: File not found {filepath}")

def clean_matchlogs():
    print("\n--- Cleaning Matchlogs ---")
    matchlog_files = {
        'world_cup_matchlogs_for.csv': 'cleaned_wc_matchlogs.csv',
        'all_competitions_matchlogs_for.csv': 'cleaned_all_matchlogs.csv'
    }
    
    for input_file, output_file in matchlog_files.items():
        input_path = os.path.join(INPUT_DIR, input_file)
        output_path = os.path.join(OUTPUT_DIR, output_file)
        
        if os.path.exists(input_path):
            print(f"Processing: {input_file}")
            df = pd.read_csv(input_path)
            
            # 1. Strip country code prefix from 'Opponent'
            if 'Opponent' in df.columns:
                df['Opponent'] = df['Opponent'].apply(clean_prefix)
                
            # 2. Parse 'Attendance' by removing commas
            if 'Attendance' in df.columns:
                def clean_attendance(val):
                    if pd.isna(val):
                        return val
                    if isinstance(val, (int, float)):
                        return val
                    val_str = str(val).replace(',', '').strip()
                    if not val_str:
                        return None
                    try:
                        f_val = float(val_str)
                        if f_val.is_integer():
                            return int(f_val)
                        return f_val
                    except ValueError:
                        return val
                df['Attendance'] = df['Attendance'].apply(clean_attendance)
                
            # 3. Identify future/unplayed matches
            if 'Result' in df.columns:
                df['is_future'] = df['Result'].isna() | (df['Result'].astype(str).str.strip() == '')
            else:
                df['is_future'] = False
                
            # 4. Drop 'Match Report' and 'Category'
            cols_to_drop = [col for col in ['Match Report', 'Category'] if col in df.columns]
            df = df.drop(columns=cols_to_drop)
            
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
            print(f"  Saved to: {output_path} (Shape: {df.shape})")
        else:
            print(f"Warning: File not found {input_path}")

def clean_roster():
    print("\n--- Cleaning Roster ---")
    input_path = os.path.join(INPUT_DIR, "world_cup_roster.csv")
    output_path = os.path.join(OUTPUT_DIR, "cleaned_roster.csv")
    
    if os.path.exists(input_path):
        print(f"Processing world_cup_roster.csv")
        df = pd.read_csv(input_path)
        
        # 1. Parse 'Club' into 'League' and 'Club'
        def parse_club(club_val):
            if pd.isna(club_val):
                return None, None
            club_str = str(club_val).strip()
            parts = club_str.split(' ', 1)
            if len(parts) == 2:
                return parts[0], parts[1]
            else:
                return None, club_str
        df['League'], df['Club'] = zip(*df['Club'].apply(parse_club))
        
        # 2. Parse 'Age'
        df['Age'] = df['Age'].apply(parse_age)
        
        # 3. Convert 'Birth Date' to YYYY-MM-DD
        df['Birth Date'] = pd.to_datetime(df['Birth Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        
        # 4. Extract 'Birth Country' from 'Birth Place'
        def extract_birth_country(place_val):
            if pd.isna(place_val):
                return None
            place_str = str(place_val).strip()
            if ',' in place_str:
                return place_str.split(',')[-1].strip()
            return place_str
        df['Birth Country'] = df['Birth Place'].apply(extract_birth_country)
        
        # 5. Drop 'Category', 'MP', 'Min', 'Gls'
        cols_to_drop = ['Category', 'MP', 'Min', 'Gls']
        df = df.drop(columns=[col for col in cols_to_drop if col in df.columns])
        
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"  Saved to: {output_path} (Shape: {df.shape})")
    else:
        print(f"Warning: world_cup_roster.csv not found!")

def clean_results_and_stadiums():
    print("\n--- Cleaning Results and Stadiums ---")
    results_path = os.path.join(INPUT_DIR, "world_cup_results_overall.csv")
    stadiums_path = os.path.join(INPUT_DIR, "world_cup_stadiums.csv")
    
    if os.path.exists(results_path):
        print("Processing world_cup_results_overall.csv")
        df = pd.read_csv(results_path)
        
        # Clean Squad names (strip prefix)
        if 'Squad' in df.columns:
            df['Squad'] = df['Squad'].apply(clean_prefix)
            
        # Drop Category
        if 'Category' in df.columns:
            df.drop(columns=['Category'], inplace=True)
            
        # Filter rows with MP > 0 (or not null)
        if 'MP' in df.columns:
            df = df[df['MP'] > 0]
            
        out_results = os.path.join(OUTPUT_DIR, "cleaned_results.csv")
        df.to_csv(out_results, index=False, encoding='utf-8-sig')
        print(f"  Saved to: {out_results} (Shape: {df.shape})")
    else:
        print(f"Warning: world_cup_results_overall.csv not found!")
        
    if os.path.exists(stadiums_path):
        print("Processing world_cup_stadiums.csv")
        df = pd.read_csv(stadiums_path)
        
        # Stadiums is already clean; verify types and copy to output folder
        out_stadiums = os.path.join(OUTPUT_DIR, "cleaned_stadiums.csv")
        df.to_csv(out_stadiums, index=False, encoding='utf-8-sig')
        print(f"  Saved to: {out_stadiums} (Shape: {df.shape})")
    else:
        print(f"Warning: world_cup_stadiums.csv not found!")

def print_summary():
    print("\n==================================================")
    print("             DATA CLEANING SUMMARY")
    print("==================================================")
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for file in files:
            if file.endswith('.csv'):
                path = os.path.join(root, file)
                df = pd.read_csv(path)
                print(f"- {file:<35} Rows: {df.shape[0]:<6} Columns: {df.shape[1]}")
    print("==================================================")

if __name__ == "__main__":
    clean_injuries()
    clean_stats()
    clean_matchlogs()
    clean_roster()
    clean_results_and_stadiums()
    print_summary()
