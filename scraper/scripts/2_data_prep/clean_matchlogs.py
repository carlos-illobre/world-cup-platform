import pandas as pd
import re
import os

def clean_matchlogs(input_path, output_path):
    print(f"Cleaning: {input_path}")
    if not os.path.exists(input_path):
        print(f"Error: {input_path} does not exist!")
        return
    
    # Read CSV
    df = pd.read_csv(input_path)
    
    # 1. Strip country code prefix (e.g. "so Somalia" or "mz Mozambique" -> "Somalia"/"Mozambique") from the 'Opponent' column.
    def clean_opponent(val):
        if not isinstance(val, str):
            return val
        return re.sub(r'^[a-z]{2}\s+', '', val)
    
    if 'Opponent' in df.columns:
        df['Opponent'] = df['Opponent'].apply(clean_opponent)
        
    # 2. Parse 'Attendance' by removing commas and casting to float/integer.
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
            
    if 'Attendance' in df.columns:
        df['Attendance'] = df['Attendance'].apply(clean_attendance)
        
    # 3. Identify future/unplayed matches where 'Result' is empty and mark them with a new boolean column 'is_future'.
    if 'Result' in df.columns:
        df['is_future'] = df['Result'].isna() | (df['Result'].astype(str).str.strip() == '')
    else:
        df['is_future'] = False
        
    # 4. Drop 'Match Report' and 'Category' columns.
    cols_to_drop = [col for col in ['Match Report', 'Category'] if col in df.columns]
    df = df.drop(columns=cols_to_drop)
    
    # Save the results
    df.to_csv(output_path, index=False)
    print(f"Saved cleaned file to: {output_path}")

if __name__ == "__main__":
    wc_input = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\world_cup_matchlogs_for.csv"
    wc_output = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned_wc_matchlogs.csv"
    
    all_input = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\all_competitions_matchlogs_for.csv"
    all_output = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned_all_matchlogs.csv"
    
    clean_matchlogs(wc_input, wc_output)
    clean_matchlogs(all_input, all_output)
