import pandas as pd
import re

def clean_roster(input_path, output_path):
    df = pd.read_csv(input_path)
    
    # 1. Parse 'Club' into 'League' and 'Club'
    # E.g. '1.eng Manchester City' -> '1.eng' and 'Manchester City'
    def parse_club(club_val):
        if pd.isna(club_val):
            return None, None
        club_str = str(club_val).strip()
        parts = club_str.split(' ', 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        else:
            return None, club_str

    df['League'], df['Club'] = zip(*df['Club'].apply(parse_club))
    
    # 2. Parse 'Age' from 'years-days' format (e.g. '26-361') to numeric decimal
    def parse_age(age_val):
        if pd.isna(age_val):
            return None
        age_str = str(age_val).strip()
        match = re.match(r'^(\d+)-(\d+)$', age_str)
        if match:
            years = int(match.group(1))
            days = int(match.group(2))
            return round(years + days / 365.25, 4)
        return None

    df['Age'] = df['Age'].apply(parse_age)
    
    # 3. Convert 'Birth Date' to YYYY-MM-DD
    df['Birth Date'] = pd.to_datetime(df['Birth Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    
    # 4. Extract 'Birth Country' from 'Birth Place'
    def extract_birth_country(place_val):
        if pd.isna(place_val):
            return None
        place_str = str(place_val).strip()
        if ',' in place_str:
            return place_str.split(',')[-1].strip()
        return place_str

    df['Birth Country'] = df['Birth Place'].apply(extract_birth_country)
    
    # 5. Drop columns 'Category', 'MP', 'Min', 'Gls'
    cols_to_drop = ['Category', 'MP', 'Min', 'Gls']
    df = df.drop(columns=[col for col in cols_to_drop if col in df.columns])
    
    # Reorder columns to put League right before Club or just save as-is
    # Let's save the cleaned dataframe
    df.to_csv(output_path, index=False)
    print("CSV cleaned successfully.")

if __name__ == "__main__":
    clean_roster(
        r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\world_cup_roster.csv",
        r"c:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned_roster.csv"
    )
