from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import os
import networkx as nx
from shapely.geometry import Point, LineString
from pathlib import Path
import math
import numpy as np
from typing import Optional
import qrcode
import io
from fastapi.responses import StreamingResponse
from mtag_api import calculate_tram_route  # Import the function from mtag_api.py

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
    """Get transport data from data_transport_commun_grenoble_formate.geojson file"""
    try:
        file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble_formate.geojson")
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

@app.get("/api/geocode")
async def geocode_address(address: str):
    """Convert address to coordinates using Nominatim"""
    try:
        # Use Nominatim for geocoding (OpenStreetMap's geocoding service)
        headers = {
            'User-Agent': 'GrenobleTransportApp/1.0'  # Required by Nominatim's terms
        }
        params = {
            'q': address,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1,
            # Focus on Grenoble area for better results
            'viewbox': '5.6,45.1,5.8,45.3',  # Viewbox around Grenoble
            'bounded': 1  # Search only within viewbox
        }
        
        response = requests.get('https://nominatim.openstreetmap.org/search', params=params, headers=headers)
        if response.status_code == 200:
            results = response.json()
            if results and len(results) > 0:
                return {
                    "lat": float(results[0]["lat"]),
                    "lng": float(results[0]["lon"]),
                    "display_name": results[0]["display_name"]
                }
            else:
                raise HTTPException(status_code=404, detail="Address not found")
        else:
            raise HTTPException(status_code=response.status_code, detail="Geocoding service error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper function to calculate distance between two points using Haversine formula
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in kilometers
    dLat = (lat2 - lat1) * math.pi / 180
    dLon = (lon2 - lon1) * math.pi / 180
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) * math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def extract_tram_route(tram_route):
    """Extract route points and other details from the tram route"""
    route_points = []
    segments = []
    total_distance = tram_route["walkDistance"] / 1000  # Convert meters to kilometers
    duration = tram_route['duration']
    
    for key in tram_route:
        if key == 'legs':
            for elem in tram_route['legs']:
                mode = elem['mode']
                if mode == 'WALK':
                    # Walking segment
                    segment_points = [{"lat": elem['from']['lat'], "lng": elem['from']['lon']}]
                    for step in elem.get('steps', []):
                        segment_points.append({"lat": step['lat'], "lng": step['lon']})
                    segment_points.append({"lat": elem['to']['lat'], "lng": elem['to']['lon']})
                    
                    segments.append({
                        "type": "walking",
                        "points": segment_points
                    })
                    
                    route_points.extend(segment_points)
                elif mode == 'TRAM':
                    # Tram segment
                    leg = elem['legGeometry']
                    segment_points = [{"lat": elem['from']['lat'], "lng": elem['from']['lon']}]
                    # Decode polyline points
                    segment_points = []
                    polyline = leg['points']
                    index, lat, lng = 0, 0, 0
                    while index < len(polyline):
                        b, shift, result = 0, 0, 0
                        while True:
                            b = ord(polyline[index]) - 63
                            index += 1
                            result |= (b & 0x1f) << shift
                            shift += 5
                            if b < 0x20:
                                break
                        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
                        lat += dlat

                        shift, result = 0, 0
                        while True:
                            b = ord(polyline[index]) - 63
                            index += 1
                            result |= (b & 0x1f) << shift
                            shift += 5
                            if b < 0x20:
                                break
                        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
                        lng += dlng

                        segment_points.append({"lat": lat / 1e5, "lng": lng / 1e5})
                
                segments.append({
                    "type": "tram" if mode == 'TRAM' else "walking",
                    "line_name": elem.get('routeShortName', 'Tram') if mode == 'TRAM' else None,
                    "points": segment_points
                })
                
                route_points.extend(segment_points)
    
    return {
        "route": route_points,
        "segments": segments,
        "distance": round(total_distance, 2),
        "duration": round(duration),  # Convert seconds to minutes
        "transport_mode": "tram"
    }

@app.get("/api/optimize")
async def optimize_route(
    start_lat: Optional[float] = None, 
    start_lng: Optional[float] = None, 
    end_lat: Optional[float] = None, 
    end_lng: Optional[float] = None,
    start_address: Optional[str] = None,
    end_address: Optional[str] = None,
    transport_mode: str = "walking"
):
    """Optimize route between two points using the actual roads/paths from GeoJSON data"""
    try:
        # If addresses are provided, geocode them
        if start_address:
            start_coords = await geocode_address(start_address)
            start_lat, start_lng = start_coords["lat"], start_coords["lng"]
        
        if end_address:
            end_coords = await geocode_address(end_address)
            end_lat, end_lng = end_coords["lat"], end_coords["lng"]
        
        if not all([start_lat, start_lng, end_lat, end_lng]):
            raise HTTPException(status_code=400, detail="Missing coordinates or addresses")

        # Special case for tram mode using MTAG API
        if transport_mode == "tram" or transport_mode == "transit":
            tram_route = calculate_tram_route((start_lat, start_lng), (end_lat, end_lng))
            if not tram_route or 'duration' not in tram_route or not tram_route.get('legs'):
                raise HTTPException(status_code=500, detail="Failed to calculate tram route")
            
            return extract_tram_route(tram_route)

        # Standard routing for walking/cycling/driving
        # Load GeoJSON data for routing
        file_path = os.path.join(BASE_DIR, "grenoble.geojson")
        with open(file_path, 'r') as file:
            geo_data = json.load(file)

        # Filter data by transport mode
        allowed_types = {
            "walking": ["footway", "path", "pedestrian", "steps", "residential", "service"],
            "cycling": ["cycleway", "residential", "path", "footway", "secondary", "tertiary"],
            "driving": ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service"],
            "transit": []  # We'll handle transit separately using transport GeoJSON
        }
        
        if transport_mode == "transit":
            # For transit mode, add the transport data
            transport_file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble_formate.geojson")
            with open(transport_file_path, 'r') as file:
                transport_data = json.load(file)
                # Combine relevant features
                geo_data["features"].extend([f for f in transport_data["features"] 
                                        if f.get("geometry", {}).get("type") == "LineString"])
        
        # Create a graph for routing
        G = nx.DiGraph() if transport_mode == "driving" else nx.Graph()
        
        # Add nodes and edges from filtered features
        for feature in geo_data["features"]:
            if feature.get("geometry", {}).get("type") == "LineString":
                highway_type = feature.get("properties", {}).get("highway")
                
                # Skip features that don't match our transport mode
                if transport_mode != "transit" and highway_type not in allowed_types[transport_mode]:
                    continue
                
                coords = feature["geometry"]["coordinates"]
                one_way = feature.get("properties", {}).get("oneway") == "yes"
                
                # Add nodes and edges to the graph
                for i in range(len(coords) - 1):
                    node1 = tuple(coords[i])
                    node2 = tuple(coords[i + 1])
                    
                    # Calculate distance between nodes
                    dist = calculate_distance(node1[1], node1[0], node2[1], node2[0])
                    
                    # Add nodes and edge to the graph
                    G.add_node(node1, pos=node1)
                    G.add_node(node2, pos=node2)
                    G.add_edge(node1, node2, weight=dist)
                    
                    # If it's a one-way street, do not add the reverse edge
                    if not one_way:
                        G.add_edge(node2, node1, weight=dist)

        # Find the closest nodes to start and end points
        start_point = (start_lng, start_lat)
        end_point = (end_lng, end_lat)
        
        closest_start = min(G.nodes, key=lambda node: calculate_distance(node[1], node[0], start_lat, start_lng))
        closest_end = min(G.nodes, key=lambda node: calculate_distance(node[1], node[0], end_lat, end_lng))
        
        # Calculate shortest path using Dijkstra's algorithm
        try:
            path = nx.shortest_path(G, source=closest_start, target=closest_end, weight='weight')
        except nx.NetworkXNoPath:
            # If no path found, create a direct path
            path = [closest_start, closest_end]
        
        # Convert the path to lat/lng format for frontend
        route_points = [{"lat": point[1], "lng": point[0]} for point in path]
        
        # Add start and end points to ensure they are included
        start_point_dict = {"lat": start_lat, "lng": start_lng}
        end_point_dict = {"lat": end_lat, "lng": end_lng}
        
        if start_point_dict != route_points[0]:
            route_points.insert(0, start_point_dict)
        if end_point_dict != route_points[-1]:
            route_points.append(end_point_dict)
        
        # Calculate total distance
        distance = 0
        for i in range(len(path) - 1):
            distance += G.edges[path[i], path[i + 1]]['weight']
        
        # Calculate duration based on transport mode
        speeds = {
            "walking": 5,
            "cycling": 15,
            "driving": 40,
            "transit": 20
        }
        speed = speeds.get(transport_mode, 5)
        duration = (distance / speed) * 60 * 60  # Duration in seconds
        
        # Handle walking to the nearest road for driving mode
        if transport_mode == "driving":
            walking_distance = calculate_distance(start_lat, start_lng, closest_start[1], closest_start[0])
            walking_duration = (walking_distance / 5) * 60 * 60  # 5 km/h walking speed
            duration += walking_duration
            distance += walking_distance
        
        # Handle walking to the nearest tram stop for tram mode
        if transport_mode == "transit":
            tram_stops = [node for node in G.nodes if G.nodes[node].get("type") == "tram_stop"]
            closest_tram_stop = min(tram_stops, key=lambda node: calculate_distance(node[1], node[0], start_lat, start_lng))
            walking_distance = calculate_distance(start_lat, start_lng, closest_tram_stop[1], closest_tram_stop[0])
            walking_duration = (walking_distance / 5) * 60 * 60  # 5 km/h walking speed
            duration += walking_duration
            distance += walking_distance
        
        return {
            "route": route_points,
            "distance": round(distance, 2),
            "duration": round(duration),
            "transport_mode": transport_mode
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in optimize_route: {e}\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize route: {str(e)}")

@app.post("/generate_qr")
async def generate_qr(route: str):
    """Generate a QR code for the given route"""
    try:
        img = qrcode.make(route)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
