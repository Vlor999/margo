import requests
import json
from typing import List, Dict, Tuple

MTAG_BASE_URL = "https://data.mobilites-m.fr/api/"

def calculate_tram_route(start_coords: Tuple[float, float], end_coords: Tuple[float, float], mode:str="TRAM") -> Dict:
    """Calculate tram route between two points using MTAG API"""
    try:
        url = f"{MTAG_BASE_URL}routers/default/plan"
        params = {
            'fromPlace': f"{start_coords[0]},{start_coords[1]}",
            'toPlace': f"{end_coords[0]},{end_coords[1]}",
            'mode': f'{mode}',
            'maxWalkDistance': 200,  # Max walking distance to/from tram stops in meters
            'numItineraries': 3  # Fetch up to 3 itineraries
        }
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Extract the best itinerary (shortest duration)
        itineraries = data.get("plan", {}).get("itineraries", [])
        if not itineraries:
            print("No itineraries found.")
            return {}
        
        best_itinerary = min(itineraries, key=lambda x: x.get("duration", float('inf')))
        return best_itinerary
    except requests.RequestException as e:
        print(f"Error calculating tram route: {e}")
        return {}


if __name__ == "__main__":
    
    # Example usage of calculate_tram_route
    start_coords = (45.1980908,5.7384596)  # Example start coordinates
    end_coords = (45.1897742,5.7155743)  # Example end coordinates
    tram_route = calculate_tram_route(start_coords, end_coords, "CAR")
    
    with open("tram_route.json", "w", encoding="utf-8") as f:
        json.dump(tram_route, f, indent=4, ensure_ascii=False)
    
