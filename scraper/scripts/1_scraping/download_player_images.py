import os
import sys
import time
import urllib.parse
import unicodedata
import pandas as pd
import requests
from bs4 import BeautifulSoup

# Configurar encoding para consola
sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROSTER_PATH = os.path.join(BASE_DIR, "unified_data", "world_cup_roster.csv")
IMAGE_DIR = os.path.join(BASE_DIR, "unified_data", "player_images")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': 'https://www.google.com/'
}

def normalize_filename(name):
    # Remove accents and special characters
    n = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    # Replace spaces with underscores and lowercase
    return n.lower().replace(" ", "_").replace("-", "_").replace("'", "")

def search_player_url(player_name):
    query = urllib.parse.quote_plus(player_name)
    url = f"https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query={query}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.content, "html.parser")
        player_table = soup.find("table", class_="items")
        if not player_table:
            links = soup.find_all("a", href=lambda href: href and "/profil/spieler/" in href)
            if links:
                return links[0]['href']
            return None
            
        for a in player_table.find_all("a", href=True):
            if "/profil/spieler/" in a['href']:
                return a['href']
    except:
        pass
    return None

def download_image(player_name, index):
    filename = f"{index}_{normalize_filename(player_name)}.jpg"
    filepath = os.path.join(IMAGE_DIR, filename)
    
    # Resume functionality
    if os.path.exists(filepath):
        print(f"  [Skip] Image already exists: {filename}")
        return True
        
    profile_path = search_player_url(player_name)
    if not profile_path:
        print(f"  [Error] Could not find profile for {player_name}")
        return False
        
    profile_url = f"https://www.transfermarkt.com{profile_path}"
    time.sleep(2) # Politeness delay
    
    try:
        res = requests.get(profile_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            soup = BeautifulSoup(res.content, "html.parser")
            
            # Find the image
            img_tag = soup.find("img", class_="data-header__profile-image")
            if not img_tag:
                # Fallback to search any image inside a portrait container
                container = soup.find("div", class_="data-header__profile-container")
                if container:
                    img_tag = container.find("img")
                    
            if img_tag and img_tag.get("src"):
                img_url = img_tag["src"]
                
                # Fetch the image
                img_res = requests.get(img_url, headers=HEADERS, timeout=10)
                if img_res.status_code == 200:
                    with open(filepath, 'wb') as f:
                        f.write(img_res.content)
                    print(f"  [Success] Saved {filename}")
                    return True
                else:
                    print(f"  [Error] Failed to download image for {player_name} (Status: {img_res.status_code})")
            else:
                print(f"  [Error] Image tag not found in profile for {player_name}")
        else:
            print(f"  [Error] Failed to load profile for {player_name} (Status: {res.status_code})")
    except Exception as e:
        print(f"  [Exception] {e}")
        
    return False

def main():
    if not os.path.exists(ROSTER_PATH):
        print("Roster file not found!")
        return
        
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR)
        
    df = pd.read_csv(ROSTER_PATH)
    print(f"Starting image download for {len(df)} players...")
    
    for index, row in df.iterrows():
        player_name = row["Player"]
        player_id = index + 1 # 1-indexed ID based on CSV row
        
        print(f"[{player_id}/{len(df)}] {player_name} ({row['Country']})")
        download_image(player_name, player_id)
        
        # Sleep to avoid rate limiting
        time.sleep(2)

if __name__ == "__main__":
    main()
