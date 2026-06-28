import pandas as pd
import numpy as np

# Load data
input_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_matches.csv"
output_path = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_matches_featured.csv"
df = pd.read_csv(input_path)

df['Date'] = pd.to_datetime(df['Date'])
df = df.sort_values(by=['Country', 'Date']).reset_index(drop=True)

def get_points(res):
    if res == 'W': return 3
    elif res == 'D': return 1
    elif res == 'L': return 0
    else: return np.nan

df['Points'] = df['Result'].apply(get_points)

# Clean GF and GA columns to extract only numeric values
df['GF'] = df['GF'].astype(str).str.extract(r'^(\d+)').astype(float)
df['GA'] = df['GA'].astype(str).str.extract(r'^(\d+)').astype(float)

# Create shifted columns within groups to avoid data leakage
df['Points_shifted'] = df.groupby('Country')['Points'].shift(1)
df['GF_shifted'] = df.groupby('Country')['GF'].shift(1)
df['GA_shifted'] = df.groupby('Country')['GA'].shift(1)

# 1. form_last_5
df['form_last_5'] = df.groupby('Country')['Points_shifted'].transform(lambda x: x.rolling(5, min_periods=1).sum())

# 2. form_last_10
df['form_last_10'] = df.groupby('Country')['Points_shifted'].transform(lambda x: x.rolling(10, min_periods=1).sum())

# 3. goals_scored_last_5
df['goals_scored_last_5'] = df.groupby('Country')['GF_shifted'].transform(lambda x: x.rolling(5, min_periods=1).mean())

# 4. goals_conceded_last_5
df['goals_conceded_last_5'] = df.groupby('Country')['GA_shifted'].transform(lambda x: x.rolling(5, min_periods=1).mean())

# 5. days_since_last_match
df['days_since_last_match'] = df.groupby('Country')['Date'].diff().dt.days

# 6. win_rate_home, win_rate_away, win_rate_neutral
df['is_win'] = (df['Result'] == 'W').astype(int)
df['played'] = df['Result'].notna().astype(int)

for venue, rate_col in [('Home', 'win_rate_home'), ('Away', 'win_rate_away'), ('Neutral', 'win_rate_neutral')]:
    df[f'{venue}_win'] = df['is_win'] * (df['Venue'] == venue).astype(int)
    df[f'{venue}_played'] = df['played'] * (df['Venue'] == venue).astype(int)
    
    cum_wins = df.groupby('Country')[f'{venue}_win'].transform(lambda x: x.cumsum().shift(1))
    cum_played = df.groupby('Country')[f'{venue}_played'].transform(lambda x: x.cumsum().shift(1))
    
    df[rate_col] = cum_wins / cum_played
    
    df.drop(columns=[f'{venue}_win', f'{venue}_played'], inplace=True)

# Drop temporary columns
df.drop(columns=['Points', 'Points_shifted', 'GF_shifted', 'GA_shifted', 'is_win', 'played'], inplace=True)

df.to_csv(output_path, index=False)
print("Feature engineering completed. Saved to:", output_path)
