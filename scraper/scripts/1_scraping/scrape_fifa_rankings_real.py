import os
import time
import requests
import pandas as pd
from io import StringIO
from datetime import datetime

def fetch_real_fifa_rankings():
    urls = [
        "https://raw.githubusercontent.com/Dato-Futbol/fifa-ranking/refs/heads/master/ranking_fifa_historical.csv",
        "https://raw.githubusercontent.com/martj42/international_results/master/fifa_ranking.csv",
        "https://raw.githubusercontent.com/tadhgfitzgerald/fifa_ranking/master/fifa_ranking.csv"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    max_retries = 3
    base_delay = 2

    for url in urls:
        for attempt in range(max_retries):
            try:
                print(f"Attempt {attempt + 1}: Fetching data from {url}...")
                response = requests.get(url, headers=headers, timeout=15)
                
                if response.status_code == 200:
                    print("Data successfully fetched!")
                    df = pd.read_csv(StringIO(response.text))
                    
                    if 'rank_date' in df.columns:
                        df['rank_date'] = pd.to_datetime(df['rank_date'], errors='coerce')
                        df = df.dropna(subset=['rank_date'])
                        four_years_ago = datetime.now().year - 4
                        df = df[df['rank_date'].dt.year >= four_years_ago]
                    elif 'date' in df.columns:
                        df['date'] = pd.to_datetime(df['date'], errors='coerce')
                        df = df.dropna(subset=['date'])
                        four_years_ago = datetime.now().year - 4
                        df = df[df['date'].dt.year >= four_years_ago]
                    return df
                elif response.status_code == 404:
                    print(f"404 Not Found for {url}. Trying next url...")
                    break # Next URL
                elif response.status_code in [403, 429]:
                    print(f"Rate limited or forbidden ({response.status_code}).")
                    response.raise_for_status()
                else:
                    response.raise_for_status()

            except requests.exceptions.RequestException as e:
                print(f"Request failed: {e}")
                
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    print(f"Max retries reached for {url}.")
                    
    raise Exception("Failed to fetch real FIFA rankings after trying multiple sources.")

if __name__ == "__main__":
    output_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\additional"
    output_file = os.path.join(output_dir, "fifa_rankings_historical.csv")
    
    df = fetch_real_fifa_rankings()
    
    if df is not None and not df.empty:
        os.makedirs(output_dir, exist_ok=True)
        df.to_csv(output_file, index=False)
        print(f"Successfully saved {len(df)} rows to {output_file}")
    else:
        raise Exception("Fetched data is empty. Not creating CSV.")
