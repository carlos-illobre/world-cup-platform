import os
import csv
import time
import random
import requests
from bs4 import BeautifulSoup
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

input_csv = r"C:\Users\carlo\Downloads\world_cup_scraper\unified_data\cleaned\cleaned_roster.csv"
output_dir = r"C:\Users\carlo\Downloads\world_cup_scraper\unified_data\additional"
output_csv = os.path.join(output_dir, "player_market_values.csv")

os.makedirs(output_dir, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
}

def get_with_retry(url, max_retries=3):
    retries = 0
    backoff = 5
    while retries < max_retries:
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                return response
            elif response.status_code in [403, 429]:
                logging.warning(f"Received {response.status_code} for {url}. Retrying in {backoff} seconds...")
                time.sleep(backoff)
                backoff *= 2
                retries += 1
            else:
                logging.error(f"Received unexpected status code {response.status_code} for {url}.")
                return None
        except requests.exceptions.RequestException as e:
            logging.error(f"Request failed: {e}")
            time.sleep(backoff)
            backoff *= 2
            retries += 1
    
    raise Exception(f"Failed to fetch {url} after {max_retries} retries due to Cloudflare or blocking.")

def fetch_market_value(player_name):
    query = player_name.replace(" ", "+")
    url = f"https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query={query}"
    
    response = get_with_retry(url)
    if not response:
        return None
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    try:
        table = soup.find("table", class_="items")
        if table:
            tbody = table.find("tbody")
            if tbody:
                first_row = tbody.find("tr")
                if first_row:
                    mv_td = first_row.find("td", class_="rechts hauptlink")
                    if mv_td:
                        return mv_td.text.strip()
                    # Sometimes it's in a different td, fallback
                    tds = first_row.find_all("td")
                    if tds:
                        return tds[-1].text.strip()
    except Exception as e:
        logging.error(f"Error parsing DOM for {player_name}: {e}")
        
    return None

def main():
    players = []
    with open(input_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            players.append(row["Player"])

    # For testing or long runs, we will log every player.
    logging.info(f"Total players to fetch: {len(players)}")

    with open(output_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Player", "MarketValue_EUR"])
        
        for player in players:
            logging.info(f"Fetching market value for {player}...")
            mv = fetch_market_value(player)
            writer.writerow([player, mv if mv else "Unknown"])
            f.flush()
            
            delay = random.uniform(2, 5)
            time.sleep(delay)
            
    logging.info("Finished scraping market values.")

if __name__ == "__main__":
    main()
