"""
Feature Engineering: Injury × Climate Interaction
===================================================
Creates climate-aware features for the injury prediction model.

Strategy:
- Each injury record is associated with the team's country.
- For World Cup 2026 (USA/Mexico/Canada), we map venues to real coordinates.
- We fetch historical climate data for June-July (tournament months) for each venue.
- We create interaction features: climate × player vulnerability profile.

Climate features are NOT raw temp/humidity, but interaction terms that capture
the MECHANISM by which climate increases injury risk:
  1. Heat stress × muscle injury history → hamstring/quad risk
  2. Altitude fatigue × age → cardiovascular strain
  3. Humidity × training load → dehydration-related fatigue
  4. Temperature differential × adaptation (how different is venue from home climate)

References:
- Ekstrand et al. (2011) - Weather and football injuries
- Orchard et al. (2023) - Climate factors in elite sport injuries  
- FIFA Medical Report Qatar 2022
"""

import pandas as pd
import numpy as np

print("=" * 70)
print("FEATURE ENGINEERING: Injury × Climate Interaction")
print("=" * 70)

# World Cup 2026 venue data (from world_cup_stadiums.csv)
# Elevation and average June-July temperatures for each host city
WC2026_VENUES = {
    'Atlanta': {'lat': 33.755, 'lon': -84.401, 'elevation_m': 316, 'avg_temp_jun_jul': 31.0, 'avg_humidity': 70},
    'Foxborough': {'lat': 42.09, 'lon': -71.264, 'elevation_m': 74, 'avg_temp_jun_jul': 26.0, 'avg_humidity': 65},
    'Arlington': {'lat': 32.747, 'lon': -97.093, 'elevation_m': 198, 'avg_temp_jun_jul': 35.0, 'avg_humidity': 55},
    'Houston': {'lat': 29.684, 'lon': -95.41, 'elevation_m': 10, 'avg_temp_jun_jul': 34.0, 'avg_humidity': 75},
    'Philadelphia': {'lat': 39.901, 'lon': -75.167, 'elevation_m': 12, 'avg_temp_jun_jul': 30.0, 'avg_humidity': 65},
    'Miami': {'lat': 25.958, 'lon': -80.239, 'elevation_m': 2, 'avg_temp_jun_jul': 33.0, 'avg_humidity': 78},
    'Seattle': {'lat': 47.595, 'lon': -122.332, 'elevation_m': 50, 'avg_temp_jun_jul': 22.0, 'avg_humidity': 55},
    'San Francisco': {'lat': 37.713, 'lon': -122.386, 'elevation_m': 5, 'avg_temp_jun_jul': 20.0, 'avg_humidity': 70},
    'Kansas City': {'lat': 39.049, 'lon': -94.484, 'elevation_m': 260, 'avg_temp_jun_jul': 32.0, 'avg_humidity': 65},
    'Dallas': {'lat': 32.747, 'lon': -97.093, 'elevation_m': 198, 'avg_temp_jun_jul': 35.0, 'avg_humidity': 55},
    'Los Angeles': {'lat': 33.953, 'lon': -118.339, 'elevation_m': 71, 'avg_temp_jun_jul': 28.0, 'avg_humidity': 60},
    'Mexico City': {'lat': 19.303, 'lon': -99.15, 'elevation_m': 2240, 'avg_temp_jun_jul': 23.0, 'avg_humidity': 60},
    'Guadalajara': {'lat': 20.702, 'lon': -103.324, 'elevation_m': 1566, 'avg_temp_jun_jul': 28.0, 'avg_humidity': 65},
    'Monterrey': {'lat': 25.672, 'lon': -100.243, 'elevation_m': 540, 'avg_temp_jun_jul': 34.0, 'avg_humidity': 55},
    'Toronto': {'lat': 43.633, 'lon': -79.418, 'elevation_m': 78, 'avg_temp_jun_jul': 26.0, 'avg_humidity': 60},
    'Vancouver': {'lat': 49.277, 'lon': -123.112, 'elevation_m': 5, 'avg_temp_jun_jul': 21.0, 'avg_humidity': 60},
}

# Average home climate by country (annual average for training adaptation context)
COUNTRY_HOME_CLIMATE = {
    'Argentina': {'avg_temp': 18, 'avg_humidity': 60, 'avg_elevation': 25},
    'Brazil': {'avg_temp': 26, 'avg_humidity': 75, 'avg_elevation': 100},
    'France': {'avg_temp': 14, 'avg_humidity': 70, 'avg_elevation': 100},
    'Germany': {'avg_temp': 11, 'avg_humidity': 75, 'avg_elevation': 200},
    'Spain': {'avg_temp': 18, 'avg_humidity': 55, 'avg_elevation': 650},
    'England': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 50},
    'Italy': {'avg_temp': 15, 'avg_humidity': 65, 'avg_elevation': 150},
    'Portugal': {'avg_temp': 17, 'avg_humidity': 65, 'avg_elevation': 100},
    'Netherlands': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 5},
    'Belgium': {'avg_temp': 11, 'avg_humidity': 80, 'avg_elevation': 50},
    'United States': {'avg_temp': 15, 'avg_humidity': 60, 'avg_elevation': 200},
    'Mexico': {'avg_temp': 22, 'avg_humidity': 55, 'avg_elevation': 1500},
    'Japan': {'avg_temp': 16, 'avg_humidity': 70, 'avg_elevation': 50},
    'South Korea': {'avg_temp': 14, 'avg_humidity': 65, 'avg_elevation': 50},
    'Senegal': {'avg_temp': 28, 'avg_humidity': 65, 'avg_elevation': 20},
    'Morocco': {'avg_temp': 20, 'avg_humidity': 55, 'avg_elevation': 400},
    'Saudi Arabia': {'avg_temp': 30, 'avg_humidity': 30, 'avg_elevation': 600},
    'Qatar': {'avg_temp': 32, 'avg_humidity': 45, 'avg_elevation': 10},
    'Uruguay': {'avg_temp': 17, 'avg_humidity': 70, 'avg_elevation': 30},
    'Colombia': {'avg_temp': 24, 'avg_humidity': 70, 'avg_elevation': 1500},
    'Ecuador': {'avg_temp': 22, 'avg_humidity': 70, 'avg_elevation': 2800},
    'Canada': {'avg_temp': 6, 'avg_humidity': 65, 'avg_elevation': 100},
    'Australia': {'avg_temp': 22, 'avg_humidity': 55, 'avg_elevation': 50},
    'Croatia': {'avg_temp': 13, 'avg_humidity': 65, 'avg_elevation': 100},
    'Denmark': {'avg_temp': 9, 'avg_humidity': 80, 'avg_elevation': 20},
    'Switzerland': {'avg_temp': 10, 'avg_humidity': 70, 'avg_elevation': 500},
    'Scotland': {'avg_temp': 9, 'avg_humidity': 82, 'avg_elevation': 100},
    'Serbia': {'avg_temp': 12, 'avg_humidity': 65, 'avg_elevation': 150},
    'Poland': {'avg_temp': 9, 'avg_humidity': 75, 'avg_elevation': 150},
    'Wales': {'avg_temp': 10, 'avg_humidity': 80, 'avg_elevation': 50},
    'Iran': {'avg_temp': 20, 'avg_humidity': 35, 'avg_elevation': 1200},
    'Tunisia': {'avg_temp': 20, 'avg_humidity': 60, 'avg_elevation': 50},
    'Cameroon': {'avg_temp': 26, 'avg_humidity': 75, 'avg_elevation': 700},
    'Ghana': {'avg_temp': 27, 'avg_humidity': 75, 'avg_elevation': 100},
    'Nigeria': {'avg_temp': 27, 'avg_humidity': 70, 'avg_elevation': 300},
}

# Default for countries not in the map
DEFAULT_CLIMATE = {'avg_temp': 15, 'avg_humidity': 65, 'avg_elevation': 100}


def compute_climate_injury_features(
    player_row: dict,
    venue_temp: float = 25.0,
    venue_humidity: float = 60.0,
    venue_elevation_m: float = 100.0,
) -> dict:
    """
    Computes climate × player interaction features.
    
    These features capture the MECHANISM by which climate increases
    injury risk for specific player profiles.
    
    Parameters
    ----------
    player_row : dict
        Player data (Age, Country, injury history, playing time stats).
    venue_temp : float
        Expected temperature at venue (°C).
    venue_humidity : float
        Expected relative humidity at venue (%).
    venue_elevation_m : float
        Venue elevation in meters.
    
    Returns
    -------
    dict with climate interaction features.
    """
    age = float(player_row.get('Age', 27) or 27)
    country = str(player_row.get('Country', ''))
    is_recurrent = int(player_row.get('is_recurrent', 0) or 0)
    injury_freq = float(player_row.get('injury_frequency', 0) or 0)
    mins_played = float(player_row.get('Playing Time_Min', 0) or 0)
    
    # Home climate for this player's country
    home = COUNTRY_HOME_CLIMATE.get(country, DEFAULT_CLIMATE)
    home_temp = home['avg_temp']
    home_humidity = home['avg_humidity']
    home_elevation = home['avg_elevation']
    
    features = {}
    
    # ─── 1. HEAT STRESS INDEX ───
    # Non-linear: danger scales exponentially above 30°C
    # Combines temperature and humidity (heat index concept)
    heat_index = venue_temp + (0.33 * venue_humidity / 100 * venue_temp) - 10
    features['climate_heat_stress'] = max(0.0, (heat_index - 25) / 20)  # normalized 0-1+
    
    # ─── 2. HEAT × MUSCLE INJURY HISTORY ───
    # Players with recurrent muscle injuries are MORE vulnerable in heat
    # (dehydrated muscles cramp and tear more easily)
    features['climate_heat_x_recurrent'] = features['climate_heat_stress'] * is_recurrent
    
    # ─── 3. HEAT × INJURY FREQUENCY ───
    # High injury frequency + heat = compounding risk
    features['climate_heat_x_injury_freq'] = features['climate_heat_stress'] * min(injury_freq, 5.0)
    
    # ─── 4. ALTITUDE FATIGUE FACTOR ───
    # Significant above 1500m (Mexico City = 2240m)
    # Oxygen saturation drops ~3% per 1000m above sea level
    altitude_factor = max(0.0, (venue_elevation_m - 1000) / 1500)  # 0 below 1000m, scales above
    features['climate_altitude_factor'] = altitude_factor
    
    # ─── 5. ALTITUDE × AGE ───
    # Older players (30+) suffer more from altitude (reduced VO2max adaptation)
    age_factor = max(0.0, (age - 28) / 7)  # 0 for young, increases after 28
    features['climate_altitude_x_age'] = altitude_factor * age_factor
    
    # ─── 6. TEMPERATURE DIFFERENTIAL ───
    # How different is the venue from what the player is used to?
    # Large differentials = body hasn't adapted = higher injury risk
    temp_diff = abs(venue_temp - home_temp)
    features['climate_temp_differential'] = temp_diff / 20.0  # normalized
    
    # ─── 7. HUMIDITY DIFFERENTIAL ───
    humidity_diff = abs(venue_humidity - home_humidity)
    features['climate_humidity_differential'] = humidity_diff / 40.0  # normalized
    
    # ─── 8. ALTITUDE DIFFERENTIAL ───
    # Going from sea level (England) to Mexico City is a massive shock
    elev_diff = abs(venue_elevation_m - home_elevation)
    features['climate_altitude_differential'] = min(elev_diff / 2000.0, 1.5)
    
    # ─── 9. COMBINED ADAPTATION STRESS ───
    # Overall "how foreign is this environment?" score
    features['climate_adaptation_stress'] = (
        features['climate_temp_differential'] * 0.4 +
        features['climate_humidity_differential'] * 0.3 +
        features['climate_altitude_differential'] * 0.3
    )
    
    # ─── 10. DEHYDRATION RISK PROXY ───
    # High temp + high humidity + high playing minutes = dehydration
    min_factor = min(mins_played / 2000, 1.0)  # normalized to typical season minutes
    features['climate_dehydration_risk'] = (
        features['climate_heat_stress'] * 0.5 +
        (venue_humidity / 100) * 0.3 +
        min_factor * 0.2
    ) * max(0, venue_temp - 25) / 15  # only activates in hot conditions
    
    # ─── 11. IS HIGH ALTITUDE (binary) ───
    features['climate_is_high_altitude'] = 1 if venue_elevation_m > 1500 else 0
    
    # ─── 12. IS EXTREME HEAT (binary) ───
    features['climate_is_extreme_heat'] = 1 if venue_temp > 32 else 0
    
    return features


# List of all climate features (for model training)
CLIMATE_FEATURE_NAMES = [
    'climate_heat_stress',
    'climate_heat_x_recurrent',
    'climate_heat_x_injury_freq',
    'climate_altitude_factor',
    'climate_altitude_x_age',
    'climate_temp_differential',
    'climate_humidity_differential',
    'climate_altitude_differential',
    'climate_adaptation_stress',
    'climate_dehydration_risk',
    'climate_is_high_altitude',
    'climate_is_extreme_heat',
]


def augment_injuries_with_climate(injuries_df: pd.DataFrame) -> pd.DataFrame:
    """
    Augments the injuries dataframe with climate features.
    
    For historical injury data, we simulate venue conditions by sampling
    from World Cup 2026 venues (since the model will be used to predict
    risk AT those venues). This creates training signal for the model to
    learn climate × player interactions.
    
    Strategy:
    - Each injury record gets augmented with a random WC2026 venue's climate
    - This creates diverse training conditions
    - The model learns: "players with profile X are MORE at risk in venue Y"
    """
    print(f"\nAugmenting {len(injuries_df)} injury records with climate features...")
    
    venue_list = list(WC2026_VENUES.values())
    np.random.seed(42)
    
    # Assign each injury a random venue (simulating "what if this player plays here")
    venue_indices = np.random.randint(0, len(venue_list), size=len(injuries_df))
    
    all_climate_features = []
    
    for idx, row in injuries_df.iterrows():
        venue = venue_list[venue_indices[len(all_climate_features) % len(venue_list)]]
        
        player_data = row.to_dict() if hasattr(row, 'to_dict') else dict(row)
        
        climate_feats = compute_climate_injury_features(
            player_row=player_data,
            venue_temp=venue['avg_temp_jun_jul'],
            venue_humidity=venue['avg_humidity'],
            venue_elevation_m=venue['elevation_m'],
        )
        all_climate_features.append(climate_feats)
    
    climate_df = pd.DataFrame(all_climate_features)
    
    # Concatenate with original
    result = pd.concat([injuries_df.reset_index(drop=True), climate_df], axis=1)
    
    print(f"Added {len(CLIMATE_FEATURE_NAMES)} climate interaction features")
    print(f"New shape: {result.shape}")
    print(f"\nClimate feature statistics:")
    print(result[CLIMATE_FEATURE_NAMES].describe().round(3))
    
    return result


if __name__ == '__main__':
    # Load injuries
    DATA_PATH = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_injuries_featured.csv'
    OUTPUT_PATH = r'c:\Users\carlo\Downloads\world_cup_scraper\unified_data\master_injuries_climate_featured.csv'
    
    df = pd.read_csv(DATA_PATH, low_memory=False)
    print(f"Loaded: {df.shape}")
    
    augmented = augment_injuries_with_climate(df)
    augmented.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved augmented dataset to: {OUTPUT_PATH}")
