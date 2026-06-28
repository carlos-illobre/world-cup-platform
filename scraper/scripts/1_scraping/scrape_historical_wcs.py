import os
import pandas as pd

def main():
    target_dir = r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\additional"
    os.makedirs(target_dir, exist_ok=True)
    target_file = os.path.join(target_dir, "historical_world_cups.csv")
    
    url = "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/matches.csv"
    
    try:
        df = pd.read_csv(url)
        # Extract year from match_date
        df['Year'] = pd.to_datetime(df['match_date']).dt.year
        
        # Mapping Fjelstul dataset to requested columns
        mapped_df = pd.DataFrame()
        mapped_df['Year'] = df['Year']
        mapped_df['Stage'] = df['stage_name']
        mapped_df['Country1'] = df['home_team_name']
        mapped_df['Country2'] = df['away_team_name']
        mapped_df['Score1'] = df['home_team_score']
        mapped_df['Score2'] = df['away_team_score']
        mapped_df['Venue'] = df['stadium_name']
        mapped_df['City'] = df['city_name']
        
        mapped_df.to_csv(target_file, index=False)
        print(f"Successfully fetched and saved data to {target_file}")
    except Exception as e:
        print(f"Failed to fetch data from Fjelstul dataset: {e}")
        print("Falling back to martj42 dataset...")
        
        try:
            url2 = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
            df2 = pd.read_csv(url2)
            wc_df = df2[df2['tournament'] == 'FIFA World Cup'].copy()
            wc_df['Year'] = pd.to_datetime(wc_df['date']).dt.year
            
            mapped_df2 = pd.DataFrame()
            mapped_df2['Year'] = wc_df['Year']
            mapped_df2['Stage'] = 'Unknown' # martj42 doesn't have stage
            mapped_df2['Country1'] = wc_df['home_team']
            mapped_df2['Country2'] = wc_df['away_team']
            mapped_df2['Score1'] = wc_df['home_score']
            mapped_df2['Score2'] = wc_df['away_score']
            mapped_df2['Venue'] = wc_df['country']
            mapped_df2['City'] = wc_df['city']
            
            mapped_df2.to_csv(target_file, index=False)
            print(f"Successfully fetched and saved data from martj42 to {target_file}")
        except Exception as e2:
            print(f"Failed to fetch data from martj42 dataset: {e2}")
            raise Exception("Both primary and fallback datasets failed to load. No data was scraped.")

if __name__ == '__main__':
    main()
