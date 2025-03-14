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

        # Special case for transit mode
        if transport_mode == "transit":
            return await optimize_transit_route(start_lat, start_lng, end_lat, end_lng)

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
            transport_file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble.geojson")
            with open(transport_file_path, 'r') as file:
                transport_data = json.load(file)
                # Combine relevant features
                geo_data["features"].extend([f for f in transport_data["features"] 
                                        if f.get("geometry", {}).get("type") == "LineString"])
        
        # Create a graph for routing
        G = nx.Graph()
        
        # Add nodes and edges from filtered features
        for feature in geo_data["features"]:
            if feature.get("geometry", {}).get("type") == "LineString":
                highway_type = feature.get("properties", {}).get("highway")
                
                # Skip features that don't match our transport mode
                if transport_mode != "transit" and highway_type not in allowed_types[transport_mode]:
                    continue
                
                coords = feature["geometry"]["coordinates"]
                
                # Add nodes and edges to the graph
                for i in range(len(coords) - 1):
                    node1 = tuple(coords[i])
                    node2 = tuple(coords[i + 1])
                    
                    # Calculate distance between nodes
                    dist = math.sqrt((node1[0] - node2[0])**2 + (node1[1] - node2[1])**2)
                    
                    # Add nodes and edge to the graph
                    G.add_node(node1, pos=node1)
                    G.add_node(node2, pos=node2)
                    G.add_edge(node1, node2, weight=dist)

        # Find the closest nodes to start and end points
        start_point = (start_lng, start_lat)
        end_point = (end_lng, end_lat)
        
        closest_start = min(G.nodes, key=lambda node: math.sqrt((node[0] - start_point[0])**2 + 
                                                             (node[1] - start_point[1])**2))
        closest_end = min(G.nodes, key=lambda node: math.sqrt((node[0] - end_point[0])**2 + 
                                                           (node[1] - end_point[1])**2))
        
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
        
        # Convert to kilometers (rough approximation)
        distance = distance * 111  # 1 degree is roughly 111 km
        
        # Calculate duration based on transport mode
        speeds = {
            "walking": 5,
            "cycling": 15,
            "driving": 40,
            "transit": 20
        }
        speed = speeds.get(transport_mode, 5)
        duration = (distance / speed) * 60 * 60  # Duration in seconds
        
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

async def optimize_transit_route(start_lat, start_lng, end_lat, end_lng):
    """Find optimal route using public transit, including walking to/from stops and transfers"""
    try:
        # Load transport data
        transport_file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble.geojson")
        with open(transport_file_path, 'r') as file:
            transport_data = json.load(file)
        
        # Load walking paths
        walking_file_path = os.path.join(BASE_DIR, "grenoble.geojson")
        with open(walking_file_path, 'r') as file:
            walking_data = json.load(file)
        
        # Extract transport stops and lines
        stops = []
        transport_lines = []
        
        for feature in transport_data["features"]:
            if feature.get("geometry", {}).get("type") == "Point" and feature.get("properties", {}).get("public_transport") == "stop_position":
                # This is a transport stop
                coords = feature["geometry"]["coordinates"]
                stops.append({
                    "id": feature["properties"].get("ref", f"stop_{len(stops)}"),
                    "name": feature["properties"].get("name", "Unnamed Stop"),
                    "lng": coords[0],
                    "lat": coords[1],
                    "type": "tram" if feature["properties"].get("tram") == "yes" else 
                          ("bus" if feature["properties"].get("bus") == "yes" else "transport")
                })
            elif feature.get("geometry", {}).get("type") == "LineString":
                # This is a transport line
                transport_lines.append({
                    "id": feature["properties"].get("id", f"line_{len(transport_lines)}"),
                    "name": feature["properties"].get("name", "Unnamed Line"),
                    "type": feature["properties"].get("route_type", "unknown"),
                    "coords": feature["geometry"]["coordinates"]
                })
        
        # Find stops near start point (max 500m)
        start_point = (start_lng, start_lat)
        MAX_WALKING_DISTANCE = 0.005  # ~500m in coordinate units
        
        start_stops = []
        for stop in stops:
            dist = ((stop["lng"] - start_point[0])**2 + (stop["lat"] - start_point[1])**2)**0.5
            if dist <= MAX_WALKING_DISTANCE:
                start_stops.append({**stop, "distance": dist * 111000})  # approx distance in meters
        
        # Find stops near end point
        end_point = (end_lng, end_lat)
        end_stops = []
        for stop in stops:
            dist = ((stop["lng"] - end_point[0])**2 + (stop["lat"] - end_point[1])**2)**0.5
            if dist <= MAX_WALKING_DISTANCE:
                end_stops.append({**stop, "distance": dist * 111000})
        
        # If no nearby stops are found, fall back to walking route
        if not start_stops or not end_stops:
            print("No transit stops found nearby. Falling back to walking route.")
            return await optimize_walking_route(start_lat, start_lng, end_lat, end_lng)
        
        # For simplicity, use the closest stop at each end for now
        # In a full solution, you'd search multiple possibilities
        closest_start_stop = min(start_stops, key=lambda x: x["distance"])
        closest_end_stop = min(end_stops, key=lambda x: x["distance"])
        
        # Create a graph for transport network
        G = nx.Graph()
        
        # Add walking edges to the graph (simplified for this example)
        add_walking_edges_to_graph(G, walking_data, stops)
        
        # Add transit line edges
        for line in transport_lines:
            coords = line["coords"]
            line_type = line["type"]
            
            # Speed multipliers based on transport type
            speed_multiplier = 3 if line_type == "tram" else 2  # Tram faster than bus
            
            # Find stops along this line
            line_stops = []
            for stop in stops:
                # Check if stop is near any point on the line
                for coord in coords:
                    if ((stop["lng"] - coord[0])**2 + (stop["lat"] - coord[1])**2)**0.5 <= 0.0001:
                        line_stops.append(stop)
                        break
            
            # Add edges between consecutive stops on the line
            for i in range(len(line_stops) - 1):
                stop1 = line_stops[i]
                stop2 = line_stops[i + 1]
                stop1_id = f"stop_{stop1['id']}"
                stop2_id = f"stop_{stop2['id']}"
                
                # Calculate distance (rough approximation)
                dist = ((stop1["lng"] - stop2["lng"])**2 + (stop1["lat"] - stop2["lat"])**2)**0.5 * 111  # km
                
                # Add both stops to graph if not already there
                if not G.has_node(stop1_id):
                    G.add_node(stop1_id, pos=(stop1["lng"], stop1["lat"]), type="stop", name=stop1["name"])
                
                if not G.has_node(stop2_id):
                    G.add_node(stop2_id, pos=(stop2["lng"], stop2["lat"]), type="stop", name=stop2["name"])
                
                # Add edge between stops with transit type and faster speed
                G.add_edge(
                    stop1_id, stop2_id,
                    weight=dist / speed_multiplier,  # Less weight = faster travel
                    type=line_type,
                    line_name=line["name"]
                )
        
        # Add start and end points to the graph
        start_node = "start"
        end_node = "end"
        G.add_node(start_node, pos=start_point, type="point")
        G.add_node(end_node, pos=end_point, type="point")
        
        # Add walking edges from start point to nearby stops
        for stop in start_stops:
            stop_id = f"stop_{stop['id']}"
            if not G.has_node(stop_id):
                G.add_node(stop_id, pos=(stop["lng"], stop["lat"]), type="stop", name=stop["name"])
            
            G.add_edge(
                start_node, stop_id,
                weight=stop["distance"] / 1000 / 5,  # 5 km/h walking
                type="walking",
                line_name=None
            )
        
        # Add walking edges from nearby stops to end point
        for stop in end_stops:
            stop_id = f"stop_{stop['id']}"
            if not G.has_node(stop_id):
                G.add_node(stop_id, pos=(stop["lng"], stop["lat"]), type="stop", name=stop["name"])
            
            G.add_edge(
                stop_id, end_node,
                weight=stop["distance"] / 1000 / 5,  # 5 km/h walking
                type="walking",
                line_name=None
            )
        
        # Find the shortest path
        try:
            path = nx.shortest_path(G, source=start_node, target=end_node, weight='weight')
        except nx.NetworkXNoPath:
            # If no path found, fall back to direct walking
            print("No transit path found. Falling back to walking route.")
            return await optimize_walking_route(start_lat, start_lng, end_lat, end_lng)
        
        # Extract route information
        route_points = []
        segments = []
        total_distance = 0
        current_segment_type = None
        current_segment_name = None
        current_segment_points = []
        
        for i in range(len(path) - 1):
            node1 = path[i]
            node2 = path[i + 1]
            edge_data = G.get_edge_data(node1, node2)
            
            # Add intermediate points if needed for better visualization
            pos1 = G.nodes[node1]["pos"]
            pos2 = G.nodes[node2]["pos"]
            
            # Add first point
            if i == 0:
                route_points.append({"lat": start_lat, "lng": start_lng})
                current_segment_points.append({"lat": start_lat, "lng": start_lng})
            
            # Check if this is a new segment type
            new_segment_type = edge_data["type"]
            new_segment_name = edge_data.get("line_name")
            
            if new_segment_type != current_segment_type or new_segment_name != current_segment_name:
                # Save previous segment if it exists
                if current_segment_type is not None:
                    segments.append({
                        "type": current_segment_type,
                        "line_name": current_segment_name,
                        "points": current_segment_points
                    })
                
                # Start new segment
                current_segment_type = new_segment_type
                current_segment_name = new_segment_name
                current_segment_points = [{"lat": G.nodes[node1]["pos"][1], "lng": G.nodes[node1]["pos"][0]}]
            
            # Add intermediate point
            current_segment_points.append({"lat": G.nodes[node2]["pos"][1], "lng": G.nodes[node2]["pos"][0]})
            
            # Add to main route points
            route_points.append({"lat": G.nodes[node2]["pos"][1], "lng": G.nodes[node2]["pos"][0]})
            
            # Add the distance
            total_distance += edge_data["weight"] * (5 if edge_data["type"] == "walking" else 
                                                   20 if edge_data["type"] == "bus" else 
                                                   35 if edge_data["type"] == "tram" else 15)
        
        # Add the final segment
        if current_segment_type is not None:
            segments.append({
                "type": current_segment_type,
                "line_name": current_segment_name,
                "points": current_segment_points
            })
        
        # Make sure we end at the exact destination
        if route_points[-1]["lat"] != end_lat or route_points[-1]["lng"] != end_lng:
            route_points.append({"lat": end_lat, "lng": end_lng})
            if segments and segments[-1]["type"] == "walking":
                segments[-1]["points"].append({"lat": end_lat, "lng": end_lng})
        
        # Calculate duration based on segments
        duration = 0
        for segment in segments:
            segment_distance = 0
            points = segment["points"]
            for i in range(len(points) - 1):
                p1 = points[i]
                p2 = points[i + 1]
                segment_distance += ((p1["lng"] - p2["lng"])**2 + (p1["lat"] - p2["lat"])**2)**0.5 * 111  # km
            
            # Calculate time based on transport type
            speed = 5 if segment["type"] == "walking" else 20 if segment["type"] == "bus" else 35  # km/h
            segment_duration = (segment_distance / speed) * 60 * 60  # seconds
            duration += segment_duration
            
            # Add waiting time for transit (approx. 5 minutes)
            if segment["type"] != "walking":
                duration += 300  # 5 minutes in seconds
        
        return {
            "route": route_points,
            "segments": segments,
            "distance": round(total_distance, 2),
            "duration": round(duration),
            "transport_mode": "transit"
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in optimize_transit_route: {e}\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize transit route: {str(e)}")

async def optimize_walking_route(start_lat, start_lng, end_lat, end_lng):
    """Fallback to pure walking route"""
    # This is a simplified version - you can copy the regular walking route logic here
    try:
        # Create a direct path with a few intermediate points
        num_points = 5
        route_points = []
        
        for i in range(num_points + 1):
            ratio = i / num_points
            lat = float(start_lat) + (float(end_lat) - float(start_lat)) * ratio
            lng = float(start_lng) + (float(end_lng) - float(start_lng)) * ratio
            
            route_points.append({"lat": lat, "lng": lng})
        
        # Calculate distance using haversine formula
        from math import sqrt, sin, cos, atan2, radians
        
        def haversine_distance(lat1, lon1, lat2, lon2):
            R = 6371.0  # Earth radius in km
            lat1_rad = radians(float(lat1))
            lon1_rad = radians(float(lon1))
            lat2_rad = radians(float(lat2))
            lon2_rad = radians(float(lon2))
            dlon = lon2_rad - lon1_rad
            dlat = lat2_rad - lat1_rad
            a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
            c = 2 * atan2(sqrt(a), sqrt(1 - a))
            distance = R * c
            return distance
        
        distance = haversine_distance(start_lat, start_lng, end_lat, end_lng)
        duration = (distance / 5) * 60 * 60  # 5 km/h walking speed
        
        return {
            "route": route_points,
            "segments": [{
                "type": "walking",
                "line_name": None,
                "points": route_points
            }],
            "distance": round(distance, 2),
            "duration": round(duration),
            "transport_mode": "walking"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def add_walking_edges_to_graph(G, walking_data, stops):
    """Add walking paths between nearby stops to the graph"""
    # This is a simplified implementation - for a real app, you'd use a more complete walking network
    
    # Create a small walking network around each stop
    WALKING_RADIUS = 0.001  # approx. 100m radius
    
    # Connect nearby stops with walking edges
    for i in range(len(stops)):
        stop1 = stops[i]
        stop1_id = f"stop_{stop1['id']}"
        
        for j in range(i+1, len(stops)):
            stop2 = stops[j]
            stop2_id = f"stop_{stop2['id']}"
            
            # Calculate distance
            dist = ((stop1["lng"] - stop2["lng"])**2 + (stop1["lat"] - stop2["lat"])**2)**0.5
            
            # If stops are close enough for walking, connect them
            if dist <= WALKING_RADIUS:
                # Add both stops to graph if not already there
                if not G.has_node(stop1_id):
                    G.add_node(stop1_id, pos=(stop1["lng"], stop1["lat"]), type="stop", name=stop1["name"])
                
                if not G.has_node(stop2_id):
                    G.add_node(stop2_id, pos=(stop2["lng"], stop2["lat"]), type="stop", name=stop2["name"])
                
                # Calculate walking time (5 km/h)
                walking_distance = dist * 111  # km
                walking_time = walking_distance / 5  # hours
                
                # Add walking edge
                G.add_edge(
                    stop1_id, stop2_id,
                    weight=walking_time,
                    type="walking",
                    line_name=None
                )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
