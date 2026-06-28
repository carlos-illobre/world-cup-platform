import pandas as pd

print("Loading matches and weather data...")
matches = pd.read_csv('data/4_featured/master_matches_featured.csv')
weather = pd.read_csv('data/1_raw/historical_weather.csv')

# Convert dates to merge
matches['Date'] = pd.to_datetime(matches['Date'])
weather['Date'] = pd.to_datetime(weather['Date'])

# Keep the original shape of matches and merge the closest weather data by Date and Host Proxy
# Wait, we need to map the matches back to their host proxy to merge correctly
COUNTRY_COORDS = {
    'Argentina': (-34.6037, -58.3816),
    'Brazil': (-15.8267, -47.9218),
    'France': (48.8566, 2.3522),
    'Germany': (52.5200, 13.4050),
    'Spain': (40.4168, -3.7038),
    'England': (51.5074, -0.1278),
    'Italy': (41.9028, 12.4964),
    'Portugal': (38.7223, -9.1393),
    'United States': (38.9072, -77.0369),
    'Mexico': (19.4326, -99.1332),
    'Qatar': (25.2854, 51.5310), # Neutral fallback
    'Japan': (35.6762, 139.6503),
    'South Korea': (37.5665, 126.9780),
    'Netherlands': (52.3676, 4.9041),
    'Senegal': (14.7167, -17.4677),
    'Morocco': (34.0209, -6.8416),
    'Saudi Arabia': (24.7136, 46.6753),
    'Uruguay': (-34.9011, -56.1645),
    'Colombia': (4.7110, -74.0721),
    'Chile': (-33.4489, -70.6693),
}

def get_coords(country):
    if pd.isna(country):
        return COUNTRY_COORDS['Qatar']
    if country in COUNTRY_COORDS:
        return COUNTRY_COORDS[country]
    return COUNTRY_COORDS['Qatar']

lats = []
lons = []
for idx, row in matches.iterrows():
    venue = row.get('Venue', 'Neutral')
    host_country = row['Country'] if venue == 'Home' else row['Opponent']
    if venue == 'Neutral': host_country = 'Qatar'
    lat, lon = get_coords(host_country)
    lats.append(lat)
    lons.append(lon)

matches['Latitude'] = lats
matches['Longitude'] = lons

# Round lat/lon to avoid float merging issues
matches['Latitude'] = matches['Latitude'].round(4)
matches['Longitude'] = matches['Longitude'].round(4)
weather['Latitude'] = weather['Latitude'].round(4)
weather['Longitude'] = weather['Longitude'].round(4)

print("Merging...")
matches_weather = pd.merge(matches, weather, on=['Date', 'Latitude', 'Longitude'], how='left')

# Impute missing weather with means
matches_weather['temp_max'] = matches_weather['temp_max'].fillna(matches_weather['temp_max'].mean())
matches_weather['precipitation'] = matches_weather['precipitation'].fillna(0)
matches_weather['wind_speed'] = matches_weather['wind_speed'].fillna(matches_weather['wind_speed'].mean())

print(f"Missing weather after imputation: {matches_weather['temp_max'].isnull().sum()}")

output_path = 'data/4_featured/master_matches_weather.csv'
matches_weather.to_csv(output_path, index=False)
print(f"Saved {len(matches_weather)} matches with weather data to {output_path}")

# Now we prepare X_match_weather for the XGBoost model
# Same features as Phase 5, but we add temp_max, precipitation, wind_speed
X_df = matches_weather.copy()
# Create Target (1 for Win, 0 for Draw/Loss)
# Result is W, D, L
if 'Result' in X_df.columns:
    X_df = X_df.dropna(subset=['Result'])
    X_df['Target_Win'] = (X_df['Result'] == 'W').astype(int)

# Create Weather categories for easy plotting/inference later
X_df['is_raining'] = (X_df['precipitation'] > 2.0).astype(int)
X_df['is_hot'] = (X_df['temp_max'] > 30.0).astype(int)

X_df.to_csv('data/4_featured/X_match_weather.csv', index=False)
print("Saved X_match_weather.csv")
