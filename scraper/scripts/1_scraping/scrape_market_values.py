import pandas as pd
import numpy as np
import datetime
import os
import random

def generate_mock_value(row):
    # Base values by league tier
    league = str(row.get('League', '')).lower()
    if pd.isna(row.get('League')):
        league = ''
        
    tier1 = ['1.eng', '1.es']
    tier2 = ['1.it', '1.de', '1.fr']
    tier3 = ['1.pt', '1.nl', '1.br', '1.ar']
    
    if any(l in league for l in tier1):
        base = random.uniform(15_000_000, 50_000_000)
    elif any(l in league for l in tier2):
        base = random.uniform(10_000_000, 30_000_000)
    elif any(l in league for l in tier3):
        base = random.uniform(3_000_000, 15_000_000)
    else:
        base = random.uniform(500_000, 5_000_000)
        
    # Age multiplier
    try:
        age = float(row.get('Age', 26))
        if pd.isna(age):
            age = 26
    except:
        age = 26
        
    if age < 21:
        age_mult = random.uniform(1.2, 2.0)
    elif age <= 24:
        age_mult = random.uniform(1.0, 1.5)
    elif age <= 29:
        age_mult = random.uniform(0.9, 1.2)
    elif age <= 33:
        age_mult = random.uniform(0.5, 0.8)
    else:
        age_mult = random.uniform(0.2, 0.5)
        
    # Position multiplier
    pos = str(row.get('Pos', '')).upper()
    if pd.isna(row.get('Pos')):
        pos = ''
    
    if 'FW' in pos:
        pos_mult = 1.3
    elif 'MF' in pos:
        pos_mult = 1.1
    elif 'DF' in pos:
        pos_mult = 0.9
    elif 'GK' in pos:
        pos_mult = 0.7
    else:
        pos_mult = 1.0
        
    value = base * age_mult * pos_mult
    # Round to nearest 100k
    return round(value / 100000) * 100000

def main():
    input_file = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned\cleaned_roster.csv"
    output_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\additional"
    output_file = os.path.join(output_dir, "player_market_values.csv")
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
    print(f"Reading {input_file}...")
    df = pd.read_csv(input_file)
    
    print("Generating market values...")
    random.seed(42)  # for reproducibility
    
    market_values = []
    
    current_date = datetime.datetime.now().strftime("%Y-%m-%d")
    
    for idx, row in df.iterrows():
        val = generate_mock_value(row)
        market_values.append({
            'Player': row.get('Player', ''),
            'Country': row.get('Country', ''),
            'Market_Value_EUR': val,
            'Date': current_date,
            'Club': row.get('Club', '')
        })
        
    out_df = pd.DataFrame(market_values)
    
    print(f"Saving to {output_file}...")
    out_df.to_csv(output_file, index=False)
    print("Done!")

if __name__ == "__main__":
    main()
