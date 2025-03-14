from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import os
from pathlib import Path

app = FastAPI(title="Grenoble Transport API")

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

BASE_DIR = Path(__file__).resolve().parent.parent

# API routes
@app.get("/")
def read_root():
    return {"message": "Welcome to Grenoble Transport API"}

@app.get("/api/mtag/{route_name}")
async def get_mtag_data(route_name: str):
    """Get schedule data from MTAG API for a specific route"""
    try:
        url = f"https://data.mobilites-m.fr/api/ficheHoraires/json?route=SEM%3A{route_name}"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="MTAG API request failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/geojson/routes")
async def get_routes_data():
    """Get route data from grenoble.geojson file"""
    try:
        file_path = os.path.join(BASE_DIR, "grenoble.geojson")
        with open(file_path, 'r') as file:
            data = json.load(file)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/geojson/transport")
async def get_transport_data():
    """Get transport data from data_transport_commun_grenoble.geojson file"""
    try:
        file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble.geojson")
        with open(file_path, 'r') as file:
            data = json.load(file)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/routes/filter")
async def filter_routes(route_type: str = None, max_speed: int = None):
    """Filter routes by type and/or max speed"""
    try:
        file_path = os.path.join(BASE_DIR, "grenoble.geojson")
        with open(file_path, 'r') as file:
            data = json.load(file)
        
        if route_type or max_speed:
            filtered_features = []
            for feature in data.get('features', []):
                properties = feature.get('properties', {})
                
                # Apply filters
                if route_type and properties.get('highway') != route_type:
                    continue
                if max_speed and properties.get('maxspeed') and int(properties.get('maxspeed')) > max_speed:
                    continue
                
                filtered_features.append(feature)
            
            data['features'] = filtered_features
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/optimize")
async def optimize_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float, transport_mode: str = "walking"):
    """Optimize route between two points"""
    # This is a placeholder for a more complex route optimization algorithm
    # In a real app, you might use libraries like networkx or pgRouting
    return {
        "route": [
            {"lat": start_lat, "lng": start_lng},
            {"lat": (start_lat + end_lat) / 2, "lng": (start_lng + end_lng) / 2},
            {"lat": end_lat, "lng": end_lng}
        ],
        "distance": 0,
        "duration": 0,
        "transport_mode": transport_mode
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
