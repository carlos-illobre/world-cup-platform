import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
import random

# File paths
INPUT_FILE = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned\cleaned_results.csv"
OUTPUT_DIR = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\additional"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "fifa_rankings_historical.csv")

def get_countries(file_path):
    try:
        df = pd.read_csv(file_path)
        countries = set()
        if 'Country' in df.columns:
            countries.update(df['Country'].dropna().unique())
        if 'Squad' in df.columns:
            countries.update(df['Squad'].dropna().unique())
        return list(countries)
    except Exception as e:
        print(f"Error reading dataset: {e}")
        return ["Argentina", "Brazil", "France", "England", "Spain", "Germany", "Italy", "United States", "Mexico", "Japan"]

def generate_mock_rankings(countries):
    # Base rankings and confederations
    confederations = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']
    
    # Assign a random base ranking and confederation
    countries_sorted = sorted(countries)
    random.seed(42)
    np.random.seed(42)
    
    country_info = {}
    for i, country in enumerate(countries_sorted):
        # Base rank points
        country_info[country] = {
            'base_points': 2000 - i * (1000 / max(1, len(countries))),
            'confederation': random.choice(confederations)
        }

    # Generate dates: last 4 years, end of each month
    end_date = datetime.now()
    start_date = end_date - timedelta(days=4*365)
    
    dates = pd.date_range(start=start_date, end=end_date, freq='ME')
    
    records = []
    for date in dates:
        # Generate points for this month
        month_scores = []
        for country in countries_sorted:
            # Random fluctuation
            points = country_info[country]['base_points'] + np.random.normal(0, 20)
            month_scores.append({
                'Country': country,
                'Points': max(0, points), # Ensure non-negative
                'Date': date.strftime('%Y-%m-%d'),
                'Confederation': country_info[country]['confederation']
            })
            
        # Sort by points to assign ranking
        month_scores.sort(key=lambda x: x['Points'], reverse=True)
        for rank, record in enumerate(month_scores, 1):
            record['Ranking'] = rank
            # Round points
            record['Points'] = round(record['Points'], 2)
            records.append(record)
            
    return pd.DataFrame(records)

def main():
    print(f"Reading countries from {INPUT_FILE}")
    countries = get_countries(INPUT_FILE)
    print(f"Found {len(countries)} countries.")
    
    print("Generating mock FIFA rankings over the last 4 years...")
    df_rankings = generate_mock_rankings(countries)
    
    # Reorder columns
    df_rankings = df_rankings[['Country', 'Ranking', 'Points', 'Date', 'Confederation']]
    
    # Ensure output dir exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print(f"Saving to {OUTPUT_FILE}")
    df_rankings.to_csv(OUTPUT_FILE, index=False)
    print("Done!")

if __name__ == "__main__":
    main()
