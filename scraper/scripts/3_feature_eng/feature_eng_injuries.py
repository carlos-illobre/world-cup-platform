import pandas as pd
import numpy as np
import os

input_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_injuries.csv"
output_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_injuries_featured.csv"

def map_severity(injury):
    if pd.isnull(injury):
        return 2
    injury = str(injury).lower()
    
    if any(x in injury for x in ['cruciate', 'acl', 'fracture', 'broken', 'surgery', 'rupture', 'heart']):
        return 5
    if any(x in injury for x in ['torn', 'tear', 'dislocation', 'concussion', 'cartilage', 'ligament stretch', 'meniscus']):
        return 4
    if any(x in injury for x in ['muscle', 'hamstring', 'strain', 'calf', 'thigh', 'groin', 'adductor', 'tendon', 'ligament', 'sprain', 'joint', 'knee', 'ankle', 'shoulder']):
        return 3
    if any(x in injury for x in ['knock', 'bruise', 'dead leg', 'cut', 'laceration', 'cramp', 'contusion', 'rest', 'fitness', 'fatigue']):
        return 1
    if any(x in injury for x in ['ill', 'virus', 'corona', 'cold', 'flu', 'infection', 'sick', 'fever', 'tonsillitis']):
        return 1
    
    return 2

print("Loading data...")
df = pd.read_csv(input_path)

df['Desde'] = pd.to_datetime(df['Desde'], errors='coerce')
df['Hasta'] = pd.to_datetime(df['Hasta'], errors='coerce')

df['Tipo_Lesion_Severity'] = df['Tipo_Lesion'].apply(map_severity)

def calc_features(group):
    group = group.sort_values('Desde').reset_index(drop=True)
    n = len(group)
    
    count_12m = np.zeros(n)
    days_out_12m = np.zeros(n)
    avg_recov = np.zeros(n)
    recurrent = np.zeros(n, dtype=bool)
    months_since = np.zeros(n)
    frequency = np.zeros(n)
    
    seen_types = set()
    
    for i in range(n):
        curr_date = group.loc[i, 'Desde']
        curr_type = group.loc[i, 'Tipo_Lesion']
        
        # 4. is_recurrent
        if pd.notnull(curr_type):
            if curr_type in seen_types:
                recurrent[i] = True
            seen_types.add(curr_type)
        else:
            recurrent[i] = False
            
        if pd.isnull(curr_date):
            months_since[i] = np.nan
            count_12m[i] = 1
            days_out_12m[i] = group.loc[i, 'Dias_Baja'] if pd.notnull(group.loc[i, 'Dias_Baja']) else 0
            avg_recov[i] = np.nan
            frequency[i] = 0
            continue
            
        past_slice = group.iloc[:i]
        
        # 3. avg_recovery_time
        if len(past_slice) > 0:
            past_dias = past_slice['Dias_Baja'].dropna()
            if len(past_dias) > 0:
                avg_recov[i] = past_dias.mean()
            else:
                avg_recov[i] = 0.0
                
            # 6. months_since_last_injury
            past_hastas = past_slice['Hasta'].dropna()
            if len(past_hastas) > 0:
                last_end_date = past_hastas.max()
                days_diff = (curr_date - last_end_date).days
                months_since[i] = max(0, days_diff / 30.44) # prevent negative months
            else:
                months_since[i] = np.nan
                
            # 7. injury_frequency
            valid_desdes = past_slice['Desde'].dropna()
            if len(valid_desdes) > 0:
                first_date = valid_desdes.min()
                days_since_first = (curr_date - first_date).days
                if days_since_first > 0:
                    frequency[i] = (i / days_since_first) * 365.25
                else:
                    frequency[i] = 0.0
            else:
                frequency[i] = 0.0
        else:
            avg_recov[i] = 0.0
            months_since[i] = np.nan
            frequency[i] = 0.0
            
        # 1 & 2. rolling 12m
        one_year_ago = curr_date - pd.Timedelta(days=365)
        last_12m = group.iloc[:i+1]
        last_12m = last_12m[last_12m['Desde'] >= one_year_ago]
        
        count_12m[i] = len(last_12m)
        days_out_12m[i] = last_12m['Dias_Baja'].sum(skipna=True)
        
    group['injury_count_last_12m'] = count_12m
    group['total_days_out_last_12m'] = days_out_12m
    group['avg_recovery_time'] = avg_recov
    group['is_recurrent'] = recurrent
    group['months_since_last_injury'] = months_since
    group['injury_frequency'] = frequency
    group['injury_severity_score'] = group['Tipo_Lesion_Severity']
    
    return group

print("Calculating features...")
df_featured = df.groupby('Player', group_keys=False).apply(calc_features)

if 'Tipo_Lesion_Severity' in df_featured.columns:
    df_featured = df_featured.drop(columns=['Tipo_Lesion_Severity'])

print("Saving output...")
df_featured.to_csv(output_path, index=False)
print(f"File saved to {output_path}")
