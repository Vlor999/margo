import requests
import json
import time
from datetime import datetime

def calculate_tram_route(start_coords, end_coords, max_retries=3):
    """
    Calculate a public transit route using the MTAG OpenTripPlanner API
    
    Args:
        start_coords: tuple of (lat, lng) for start point
        end_coords: tuple of (lat, lng) for end point
        max_retries: maximum number of retry attempts for transient errors
        
    Returns:
        dict with route information or None if no route found
    """
    for attempt in range(max_retries):
        try:
            # Correct MTAG OpenTripPlanner API endpoint
            url = "https://data.mobilites-m.fr/api/routers/default/plan"
            
            # Format the request parameters with correct modes for public transport
            params = {
                "fromPlace": f"{start_coords[0]},{start_coords[1]}",
                "toPlace": f"{end_coords[0]},{end_coords[1]}",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "time": datetime.now().strftime("%H:%M:%S"),
                "mode": "TRAM,BUS",  # Include all public transport modes
                "maxWalkDistance": 200,  # Increased to 2km for better routes
                "numItineraries": 3
            }
            print(f"Requesting transit route with params: {params}")
            
            # Make the request with a longer timeout
            response = requests.get(url, params=params, timeout=30)
            
            print(f"MTAG API response status: {response.status_code}")
            
            # If we get a server error, retry
            if response.status_code >= 500:
                if attempt < max_retries - 1:
                    print(f"Server error (status {response.status_code}), retrying... (attempt {attempt+1}/{max_retries})")
                    time.sleep(2)  # Wait before retrying
                    continue
                else:
                    return {"error": f"MTAG API returned status code {response.status_code} after {max_retries} attempts"}
            
            if response.status_code != 200:
                return {"error": f"MTAG API returned status code {response.status_code}"}
            
            data = response.json()
            
            # Debug information
            if "plan" in data and "itineraries" in data["plan"]:
                print(f"Found {len(data['plan']['itineraries'])} itineraries")
            else:
                print("No itineraries found in MTAG API response")
                print(f"Response keys: {data.keys()}")
            
            # Check if we have any itineraries
            if "plan" not in data or "itineraries" not in data["plan"] or len(data["plan"]["itineraries"]) == 0:
                return {"error": "No transit routes found by MTAG API"}
            
            itineraries = data.get("plan", {}).get("itineraries", [])
            best_itinerary = min(itineraries, key=lambda x: x.get("duration", float('inf')))
            # Return the first itinerary (usually the most optimal)
            print(best_itinerary)
            return best_itinerary
            
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"Request timeout, retrying... (attempt {attempt+1}/{max_retries})")
                time.sleep(2)  # Wait before retrying
            else:
                return {"error": "MTAG API request timed out after multiple attempts"}
        except requests.exceptions.ConnectionError:
            return {"error": "Connection error - failed to connect to the MTAG API"}
        except Exception as e:
            print(f"Error calculating transit route: {e}")
            return {"error": str(e)}
    
    return {"error": "Maximum retry attempts reached"}


# if __name__ == "__main__":
#     # Test the function with sample coordinates in Grenoble
#     start = (45.188529, 5.724524)  # Grenoble center
#     end = (45.191676, 5.730119)   # Example destination
    
#     result = calculate_tram_route(start, end)
    
#     if "error" in result:
#         print(f"Error: {result['error']}")
#     else:
#         print(f"Found route with duration: {result.get('duration')} seconds")
#         print(f"Number of legs: {len(result.get('legs', []))}")

