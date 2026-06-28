import os
import json
import time
import re
import requests
from bs4 import BeautifulSoup
import pandas as pd

# Define paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

def clean_filename(name):
    """Clean table name to be a safe filename."""
    return "".join([c if c.isalnum() or c in "._-" else "_" for c in name])

def save_team_tables(team_name, category, tables_dict):
    """Save parsed tables to the corresponding directories."""
    category_dir = os.path.join(DATA_DIR, team_name, category)
    os.makedirs(category_dir, exist_ok=True)
    
    for table_name, csv_content in tables_dict.items():
        safe_name = clean_filename(table_name)
        file_path = os.path.join(category_dir, f"{safe_name}.csv")
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            f.write(csv_content)
    print(f"Saved {category} tables for {team_name}.")

def process_offline_json(json_path):
    """
    Process an already downloaded JSON stats file (e.g. from the browser subagent)
    and output the tables into CSVs.
    """
    if not os.path.exists(json_path):
        print(f"Error: JSON file not found at {json_path}")
        return False
        
    print(f"Processing JSON file: {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for team in data:
        name = team.get("teamName")
        if not team.get("success"):
            print(f"Skipping {name} (scraped failed: {team.get('error')})")
            continue
            
        save_team_tables(name, "world_cup", team.get("world_cup", {}))
        save_team_tables(name, "all_competitions", team.get("all_competitions", {}))
    return True

def scrape_fbref_direct():
    """
    Direct scraping script that fetches tables using requests & BeautifulSoup.
    Note: FBref implements strict Cloudflare challenges and rate limits. 
    This direct scraping may trigger 403/429 errors.
    """
    main_url = "https://fbref.com/en/comps/1/World-Cup-Stats"
    print(f"Fetching main stats page: {main_url}...")
    
    response = requests.get(main_url, headers=HEADERS)
    if response.status_code != 200:
        print(f"Failed to fetch main page (Status: {response.status_code}). FBref is likely rate-limiting or blocking requests.")
        return
        
    soup = BeautifulSoup(response.content, "lxml")
    
    # Example parsing logic to extract squad links
    squad_links = []
    for a in soup.find_all("a", href=True):
        if "/en/squads/" in a['href'] and "-Stats" in a['href']:
            squad_url = "https://fbref.com" + a['href']
            if squad_url not in squad_links:
                squad_links.append(squad_url)
                
    print(f"Found {len(squad_links)} squad links. Starting scraping with 15-second delays...")
    
    for url in squad_links:
        # Extract team name from URL
        team_name = url.split("/")[-1].replace("-Stats", "").replace("-", " ")
        print(f"\nProcessing {team_name}...")
        
        # 1. Fetch World Cup Squad Page
        time.sleep(15)  # Conservative rate-limit delay
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            tables = pd.read_html(res.text)
            # Match each table to a name and convert to CSV...
            # Note: A headless browser automation approach like Playwright 
            # is highly recommended over direct requests to resolve Cloudflare challenges.
            print(f"Successfully fetched {len(tables)} tables for {team_name}.")
        else:
            print(f"Failed to fetch {team_name} (Status: {res.status_code})")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="FBref World Cup Stats Scraping & Parsing tool.")
    parser.add_argument("--json", type=str, help="Path to a downloaded stats JSON file to parse offline.")
    parser.add_argument("--direct", action="store_true", help="Attempt direct scraping from FBref (may trigger Cloudflare blocks).")
    
    args = parser.parse_args()
    
    if args.json:
        process_offline_json(args.json)
    elif args.direct:
        scrape_fbref_direct()
    else:
        # Default behavior: attempt to parse standard downloads first
        default_paths = [
            r"C:\Users\carlo\Downloads\world_cup_stats.json",
            r"C:\Users\carlo\Downloads\world_cup_stats_retry_final.json"
        ]
        processed = False
        for path in default_paths:
            if os.path.exists(path):
                process_offline_json(path)
                processed = True
        
        if not processed:
            print("No downloaded JSON files found. Run with --json <path> or --direct to scrap.")
