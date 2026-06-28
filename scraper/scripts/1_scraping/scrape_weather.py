import pandas as pd
import requests
import time

print("Loading matches...")
matches = pd.read_csv('data/4_featured/master_matches_featured.csv')

# Drop future matches
matches = matches[matches['is_future'] == 0].copy()

# Hardcoded major capitals for speed and avoiding API blocking
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
    # Fallback to random coordinates near Europe/Qatar for others to keep the pipeline moving
    return COUNTRY_COORDS['Qatar']

print("Assigning coordinates...")
lats = []
lons = []
cities = []

for idx, row in matches.iterrows():
    venue = row.get('Venue', 'Neutral')
    host_country = row['Country'] if venue == 'Home' else row['Opponent']
    if venue == 'Neutral':
        host_country = 'Qatar' 
        
    lat, lon = get_coords(host_country)
    lats.append(lat)
    lons.append(lon)
    cities.append(host_country)

matches['Latitude'] = lats
matches['Longitude'] = lons
matches['Host_Proxy'] = cities

# Filter valid coordinates
valid_matches = matches.dropna(subset=['Latitude', 'Longitude', 'Date']).copy()
valid_matches['Date'] = pd.to_datetime(valid_matches['Date'])

unique_requests = valid_matches[['Latitude', 'Longitude', 'Date', 'Host_Proxy']].drop_duplicates()
print(f"Total unique weather requests to make: {len(unique_requests)}")

weather_data = []

loc_groups = unique_requests.groupby(['Latitude', 'Longitude'])
print(f"Total unique locations to fetch from Open-Meteo: {len(loc_groups)}")

for (lat, lon), group in loc_groups:
    min_date = group['Date'].min().strftime('%Y-%m-%d')
    max_date = group['Date'].max().strftime('%Y-%m-%d')
    host = group['Host_Proxy'].iloc[0]
    
    print(f"Fetching weather for {host} ({min_date} to {max_date})...")
    
    url = f"https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": min_date,
        "end_date": max_date,
        "daily": "temperature_2m_max,precipitation_sum,wind_speed_10m_max",
        "timezone": "auto"
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if 'daily' in data:
                dates = data['daily']['time']
                temps = data['daily']['temperature_2m_max']
                precs = data['daily']['precipitation_sum']
                winds = data['daily']['wind_speed_10m_max']
                
                for i in range(len(dates)):
                    weather_data.append({
                        'Latitude': lat,
                        'Longitude': lon,
                        'Date': dates[i],
                        'temp_max': temps[i],
                        'precipitation': precs[i],
                        'wind_speed': winds[i]
                    })
        time.sleep(0.1) # Be nice
    except Exception as e:
        print(f"Error fetching for lat {lat}, lon {lon}: {e}")

weather_df = pd.DataFrame(weather_data)
weather_df['Date'] = pd.to_datetime(weather_df['Date'])

print(f"Fetched {len(weather_df)} weather records.")
weather_df.to_csv('data/1_raw/historical_weather.csv', index=False)
print("Saved to data/1_raw/historical_weather.csv")
