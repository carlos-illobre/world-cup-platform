import os
import time
import urllib.parse
import pandas as pd
import requests
from bs4 import BeautifulSoup

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UNIFIED_ROSTER_PATH = os.path.join(BASE_DIR, "unified_data", "world_cup_roster.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "unified_data", "all_countries_injuries.csv")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': 'https://www.google.com/'
}

def search_player_url(player_name):
    """Searches for a player on Transfermarkt and returns their profile URL path."""
    query = urllib.parse.quote_plus(player_name)
    url = f"https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query={query}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            print(f"  [Search] Failed for {player_name} (Status: {response.status_code})")
            return None
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Look for the search results table
        # Players are typically listed under a table with class 'items'
        player_table = soup.find("table", class_="items")
        if not player_table:
            # Try finding any link containing /profil/spieler/
            links = soup.find_all("a", href=lambda href: href and "/profil/spieler/" in href)
            if links:
                return links[0]['href']
            return None
            
        # Extract the first player link
        for a in player_table.find_all("a", href=True):
            if "/profil/spieler/" in a['href']:
                return a['href']
                
    except Exception as e:
        print(f"  [Search] Error searching for {player_name}: {e}")
    return None

def scrape_player_details_and_injuries(profile_path, player_name):
    """Scrapes player height, weight, and injury history from Transfermarkt."""
    profile_url = f"https://www.transfermarkt.com{profile_path}"
    injury_url = profile_url.replace("/profil/", "/verletzungen/")
    
    height, weight = "", ""
    injuries = []
    
    # 1. Fetch profile page for Height/Weight (if available)
    try:
        time.sleep(2) # Politeness delay
        res = requests.get(profile_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.content, "html.parser")
            
            # Find height
            height_span = soup.find("span", {"itemprop": "height"})
            if height_span:
                height = height_span.text.strip()
            else:
                # Fallback search in info tables
                for info_label in soup.find_all("span", class_="info-table__label"):
                    if "Altura" in info_label.text or "Height" in info_label.text:
                        val = info_label.find_next_sibling("span", class_="info-table__content")
                        if val:
                            height = val.text.strip()
            
            # Find weight
            for info_label in soup.find_all("span", class_="info-table__label"):
                if "Peso" in info_label.text or "Weight" in info_label.text:
                    val = info_label.find_next_sibling("span", class_="info-table__content")
                    if val:
                        weight = val.text.strip()
    except Exception as e:
        print(f"  [Profile] Error scraping profile for {player_name}: {e}")

    # 2. Fetch Injury history
    try:
        time.sleep(2) # Politeness delay
        res = requests.get(injury_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.content, "html.parser")
            
            # Look for injuries table
            injury_table = soup.find("table", class_="items")
            if injury_table:
                rows = injury_table.find("tbody").find_all("tr") if injury_table.find("tbody") else []
                for row in rows:
                    cols = row.find_all("td")
                    if len(cols) >= 5:
                        season = cols[0].text.strip()
                        injury_type = cols[1].text.strip()
                        from_date = cols[2].text.strip()
                        until_date = cols[3].text.strip()
                        days_missed = cols[4].text.strip()
                        
                        # Games missed is often in the 6th column (index 5)
                        games_missed = ""
                        if len(cols) >= 6:
                            games_missed = cols[5].text.strip()
                            
                        injuries.append({
                            "Temporada": season,
                            "Tipo_Lesion": injury_type,
                            "Desde": from_date,
                            "Hasta": until_date,
                            "Dias_Baja": days_missed,
                            "Partidos_Perdidos": games_missed
                        })
            
            # If no injuries found or table is empty
            if not injuries:
                injuries.append({
                    "Temporada": "-",
                    "Tipo_Lesion": "Ninguna",
                    "Desde": "-",
                    "Hasta": "-",
                    "Dias_Baja": "0",
                    "Partidos_Perdidos": "0"
                })
        else:
            print(f"  [Injuries] Failed to fetch injuries page (Status: {res.status_code})")
            
    except Exception as e:
        print(f"  [Injuries] Error scraping injuries for {player_name}: {e}")
        
    return height, weight, injuries

def main():
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    if not os.path.exists(UNIFIED_ROSTER_PATH):
        print(f"Error: Unified roster not found at {UNIFIED_ROSTER_PATH}")
        return
        
    print(f"Loading roster from {UNIFIED_ROSTER_PATH}...")
    df_roster = pd.read_csv(UNIFIED_ROSTER_PATH)
    
    # Process all players in the roster
    df_filtered = df_roster.copy()
    
    print(f"Found {len(df_filtered)} players across all World Cup teams.")
    
    all_results = []
    processed_players = set()
    
    if os.path.exists(OUTPUT_PATH):
        try:
            existing_df = pd.read_csv(OUTPUT_PATH)
            processed_players = set(existing_df['Jugador'].unique())
            all_results = existing_df.to_dict('records')
            print(f"Resuming: Loaded {len(processed_players)} already processed players. Skipping them...")
        except Exception as e:
            print(f"Error loading existing progress: {e}")
    
    # Track progress and write incrementally to avoid data loss
    for index, row in df_filtered.iterrows():
        player_name = row["Player"]
        country = row["Country"]
        age = row["Age"]
        pos = row["Pos"]
        
        if player_name in processed_players:
            continue
        
        print(f"\n[{index+1}/{len(df_filtered)}] Processing {player_name} ({country})...")
        
        profile_path = search_player_url(player_name)
        if not profile_path:
            print(f"  Player URL not found for {player_name}. Skipping.")
            # Record default empty entry
            all_results.append({
                "Jugador": player_name,
                "Seleccion": country,
                "Posicion": pos,
                "Edad_FBref": age,
                "Altura": "",
                "Peso": "",
                "Temporada": "-",
                "Tipo_Lesion": "No encontrado",
                "Desde": "-",
                "Hasta": "-",
                "Dias_Baja": "0",
                "Partidos_Perdidos": "0"
            })
            continue
            
        print(f"  Found URL: {profile_path}")
        height, weight, injuries = scrape_player_details_and_injuries(profile_path, player_name)
        
        print(f"  Details: Height={height}, Weight={weight}, Injuries Count={len(injuries)}")
        
        for injury in injuries:
            all_results.append({
                "Jugador": player_name,
                "Seleccion": country,
                "Posicion": pos,
                "Edad_FBref": age,
                "Altura": height,
                "Peso": weight,
                **injury
            })
            
        # Small delay between players to prevent IP block
        time.sleep(3)
        
        # Save temporary progress every 5 players
        if (index + 1) % 5 == 0:
            temp_df = pd.DataFrame(all_results)
            temp_df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
            print(f"--> Temporary progress saved to {OUTPUT_PATH} ({len(all_results)} records)")

    # Save final results
    if all_results:
        final_df = pd.DataFrame(all_results)
        final_df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
        print(f"\nScraping finished! Unified dataset saved to: {OUTPUT_PATH}")
    else:
        print("\nNo data collected.")

if __name__ == "__main__":
    main()
