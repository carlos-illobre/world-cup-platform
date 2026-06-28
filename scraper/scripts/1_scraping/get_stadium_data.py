import os
import csv
import time
import requests
import re

stadiums_info = [
    {"id": 1, "name": "Mercedes-Benz Stadium", "city": "Atlanta", "country": "USA", "capacity": 71000, "roof": "Retractable", "lat": 33.755, "lon": -84.401},
    {"id": 2, "name": "Gillette Stadium", "city": "Foxborough", "country": "USA", "capacity": 65878, "roof": "Open", "lat": 42.090, "lon": -71.264},
    {"id": 3, "name": "AT&T Stadium", "city": "Arlington", "country": "USA", "capacity": 80000, "roof": "Retractable", "lat": 32.747, "lon": -97.093},
    {"id": 4, "name": "NRG Stadium", "city": "Houston", "country": "USA", "capacity": 72220, "roof": "Retractable", "lat": 29.684, "lon": -95.410},
    {"id": 5, "name": "Arrowhead Stadium", "city": "Kansas City", "country": "USA", "capacity": 76416, "roof": "Open", "lat": 39.048, "lon": -94.483},
    {"id": 6, "name": "SoFi Stadium", "city": "Inglewood", "country": "USA", "capacity": 70240, "roof": "Fixed", "lat": 33.953, "lon": -118.339},
    {"id": 7, "name": "Hard Rock Stadium", "city": "Miami Gardens", "country": "USA", "capacity": 64767, "roof": "Open Canopy", "lat": 25.958, "lon": -80.238},
    {"id": 8, "name": "MetLife Stadium", "city": "East Rutherford", "country": "USA", "capacity": 82500, "roof": "Open", "lat": 40.813, "lon": -74.074},
    {"id": 9, "name": "Lincoln Financial Field", "city": "Philadelphia", "country": "USA", "capacity": 69796, "roof": "Open", "lat": 39.900, "lon": -75.167},
    {"id": 10, "name": "Levi's Stadium", "city": "Santa Clara", "country": "USA", "capacity": 68500, "roof": "Open", "lat": 37.403, "lon": -121.969},
    {"id": 11, "name": "Lumen Field", "city": "Seattle", "country": "USA", "capacity": 69000, "roof": "Open", "lat": 47.595, "lon": -122.331},
    {"id": 12, "name": "Estadio Akron", "city": "Zapopan", "country": "Mexico", "capacity": 48071, "roof": "Open Canopy", "lat": 20.681, "lon": -103.462},
    {"id": 13, "name": "Estadio Azteca", "city": "Mexico City", "country": "Mexico", "capacity": 83264, "roof": "Open Canopy", "lat": 19.302, "lon": -99.150},
    {"id": 14, "name": "Estadio BBVA", "city": "Guadalupe", "country": "Mexico", "capacity": 53500, "roof": "Open", "lat": 25.669, "lon": -100.244},
    {"id": 15, "name": "BMO Field", "city": "Toronto", "country": "Canada", "capacity": 30000, "roof": "Open Canopy", "lat": 43.633, "lon": -79.418},
    {"id": 16, "name": "BC Place", "city": "Vancouver", "country": "Canada", "capacity": 54500, "roof": "Retractable", "lat": 49.276, "lon": -123.111}
]

HEADERS = {
    'User-Agent': 'WorldCupPredictorBot/1.0 (contact: test@example.com)'
}

OUTPUT_CSV = "unified_data/world_cup_stadiums.csv"
IMG_DIR = "unified_data/stadium_images"

os.makedirs(IMG_DIR, exist_ok=True)

def sanitize_filename(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9]', '_', s)
    s = re.sub(r'_+', '_', s)
    return s.strip('_')

def get_elevation(lat, lon):
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if 'elevation' in data and data['elevation']:
            return data['elevation'][0]
    except Exception as e:
        print(f"Error fetching elevation: {e}")
    return None

def download_wikipedia_image(stadium_name, stadium_id):
    search_term = stadium_name
    if "Akron" in stadium_name: search_term = "Estadio Akron"
    if "BBVA" in stadium_name: search_term = "Estadio BBVA"
    if "AT&T" in stadium_name: search_term = "AT%26T Stadium"
    
    url = f"https://en.wikipedia.org/w/api.php?action=query&titles={search_term}&prop=pageimages&format=json&pithumbsize=1000"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page_info in pages.items():
            if 'thumbnail' in page_info:
                img_url = page_info['thumbnail']['source']
                
                img_data = requests.get(img_url, headers=HEADERS, timeout=10).content
                safe_name = sanitize_filename(stadium_name)
                filepath = os.path.join(IMG_DIR, f"{stadium_id}_{safe_name}.jpg")
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                return filepath
    except Exception as e:
        print(f"Error fetching image for {stadium_name}: {e}")
    return None

def main():
    print("Starting World Cup Stadium Data Extraction...")
    results = []
    
    for st in stadiums_info:
        print(f"\nProcessing {st['name']} ({st['city']})...")
        
        lat, lon = st['lat'], st['lon']
        print(f"  Coordinates: {lat}, {lon}")
        
        elevation = get_elevation(lat, lon)
        print(f"  Elevation: {elevation} m")
        
        img_path = download_wikipedia_image(st['name'], st['id'])
        print(f"  Image: {'Downloaded' if img_path else 'Failed'}")
        
        time.sleep(1.0)
        
        st_data = {
            "ID": st["id"],
            "Stadium": st["name"],
            "City": st["city"],
            "Country": st["country"],
            "Capacity": st["capacity"],
            "Roof_Type": st["roof"],
            "Surface": "Natural Grass (FIFA)",
            "Latitude": lat,
            "Longitude": lon,
            "Elevation_m": elevation
        }
        results.append(st_data)
        
    print(f"\nSaving {len(results)} stadiums to {OUTPUT_CSV}...")
    keys = results[0].keys()
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        dict_writer = csv.DictWriter(f, keys)
        dict_writer.writeheader()
        dict_writer.writerows(results)
    print("Done!")

if __name__ == "__main__":
    main()
