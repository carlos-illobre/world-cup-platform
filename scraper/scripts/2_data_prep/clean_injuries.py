import pandas as pd
import numpy as np
import os

def clean_dataframe(df, file_name):
    # Copy to avoid modifying the original in-place
    df = df.copy()
    
    # 1. Strip ' days' suffix from 'Dias_Baja' and cast to integer (handling '-' or empty values as NaN)
    if 'Dias_Baja' in df.columns:
        df['Dias_Baja'] = (
            df['Dias_Baja']
            .astype(str)
            .str.replace(' days', '', case=False, regex=False)
            .str.replace(' day', '', case=False, regex=False)
            .str.strip()
        )
        # Replace empty, whitespace-only, or '-' with NaN
        df['Dias_Baja'] = df['Dias_Baja'].replace(['-', '', 'nan', 'None'], np.nan)
        df['Dias_Baja'] = pd.to_numeric(df['Dias_Baja'], errors='coerce')
        # Use pandas nullable integer type to keep it as integer with <NA>
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
        # Check if the column has only NaNs or empty values
        cleaned_peso = df['Peso'].astype(str).str.strip().replace(['-', '', 'nan', 'None'], np.nan)
        if cleaned_peso.isna().all():
            df.drop(columns=['Peso'], inplace=True)
            print(f"Dropped empty 'Peso' column from {file_name}")

    # 4. Normalize 'Tipo_Lesion' values (strip whitespace and convert to Title Case)
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
            
    # Set default Seleccion to Argentina if it's the argentina_injuries file and missing
    if 'argentina_injuries' in file_name and 'Seleccion' not in df.columns:
        df['Seleccion'] = 'Argentina'
        
    return df

def main():
    files = {
        'argentina_injuries': r"c:\Users\carlo\Downloads\world_cup_scraper\argentina_injuries.csv",
        'all_countries_injuries': r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\all_countries_injuries.csv",
        'selected_countries_injuries': r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\selected_countries_injuries.csv"
    }
    
    dfs = []
    for name, path in files.items():
        if os.path.exists(path):
            print(f"Reading {path}...")
            df = pd.read_csv(path, encoding='utf-8-sig')
            cleaned_df = clean_dataframe(df, name)
            dfs.append(cleaned_df)
        else:
            print(f"Warning: File not found {path}")
            
    if not dfs:
        print("No datasets loaded. Exiting.")
        return
        
    # 6. Merge the datasets into a single unified cleaned DataFrame.
    # Add columns where missing to keep them structurally consistent.
    # pd.concat handles missing columns by introducing NaNs.
    print("Merging datasets...")
    merged_df = pd.concat(dfs, ignore_index=True)
    
    # Check if 'Peso' is in merged_df (in case one file didn't drop it) and drop it if empty
    if 'Peso' in merged_df.columns:
        if merged_df['Peso'].isna().all():
            merged_df.drop(columns=['Peso'], inplace=True)
            print("Dropped 'Peso' from merged DataFrame as it is completely empty.")
            
    # Reorder columns for neatness
    column_order = [
        'Jugador', 'Seleccion', 'Posicion', 'Edad', 'Edad_FBref', 
        'Altura', 'Temporada', 'Tipo_Lesion', 'Desde', 'Hasta', 
        'Dias_Baja', 'Partidos_Perdidos'
    ]
    # Keep only columns that exist in merged_df, in this specified order, followed by any other columns
    existing_order = [col for col in column_order if col in merged_df.columns]
    other_columns = [col for col in merged_df.columns if col not in existing_order]
    merged_df = merged_df[existing_order + other_columns]
    
    # Save the output
    output_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned_injuries.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    merged_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"Saved cleaned and merged dataset to: {output_path}")
    print(f"Shape of merged dataset: {merged_df.shape}")
    print("\nColumns in final dataset:", merged_df.columns.tolist())
    print("\nSample rows:")
    print(merged_df.head(10))

if __name__ == '__main__':
    main()
