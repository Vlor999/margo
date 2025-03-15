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
            'viewbox': '5.6,45.1,5.8,45.3',  # Viewbox around Grenoble
            'bounded': 1
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

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = (lat2 - lat1) * math.pi / 180
    dLon = (lon2 - lon1) * math.pi / 180
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) * math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def extract_tram_route(tram_route):
    """Extract route points and other details from the tram route"""
    route_points = []
    segments = []
    total_distance = tram_route.get("walkDistance", 0) / 1000
    duration = tram_route.get('duration', 0)
    
    # Extraire les noms de rues pour les renvoyer au frontend
    street_names = []
    street_destinations = []
    
    # Nouvelle liste pour les instructions détaillées pas à pas
    detailed_instructions = []
    
    if 'legs' in tram_route:
        for elem in tram_route['legs']:
            mode = elem.get('mode', '')
            from_stop = elem.get('from', {})
            to_stop = elem.get('to', {})
            
            # Ajouter les noms des arrêts comme noms de rues pour le contexte
            street_name = from_stop.get('name', 'Arrêt inconnu')
            street_names.append(street_name)
            street_destinations.append(to_stop.get('name', 'Destination inconnue'))
            
            # Extraire les instructions détaillées de navigation
            if 'steps' in elem:
                for step in elem['steps']:
                    if 'streetName' in step and 'relativeDirection' in step:
                        instruction = {
                            "distance": step.get('distance', 0) / 1000,  # Convert to km
                            "relativeDirection": step.get('relativeDirection', ''),
                            "absoluteDirection": step.get('absoluteDirection', ''),
                            "streetName": step.get('streetName', ''),
                            "legType": mode
                        }
                        detailed_instructions.append(instruction)
            
            if mode == 'WALK':
                # Walking segment
                segment_points = []
                if 'from' in elem:
                    segment_points.append({"lat": elem['from']['lat'], "lng": elem['from']['lon']})
                
                for step in elem.get('steps', []):
                    if 'lat' in step and 'lon' in step:
                        segment_points.append({"lat": step['lat'], "lng": step['lon']})
                
                if 'to' in elem:
                    segment_points.append({"lat": elem['to']['lat'], "lng": elem['to']['lon']})
                
                if len(segment_points) >= 2:
                    segments.append({
                        "type": "walking",
                        "points": segment_points,
                        "from": from_stop.get('name'),
                        "to": to_stop.get('name'),
                        "duration": elem.get('duration', 0),
                        "distance": elem.get('distance', 0) / 1000 
                    })
                    
                    route_points.extend(segment_points)
                    
            elif mode in ['TRAM', 'BUS', 'RAIL', 'SUBWAY']:
                segment_points = []
                
                if 'from' in elem:
                    segment_points.append({"lat": elem['from']['lat'], "lng": elem['from']['lon']})
                
                try:
                    polyline = elem['legGeometry']['points']
                    lat, lng = 0, 0
                    index = 0
                    
                    while index < len(polyline): # Une focniton ici serait plus propre
                        result = 1
                        shift = 0
                        while True:
                            b = ord(polyline[index]) - 63 - 1
                            index += 1
                            result += b << shift
                            shift += 5
                            if b < 0x1f:
                                break
                        lat += (~(result >> 1) if (result & 1) else (result >> 1))
                        
                        result = 1
                        shift = 0
                        while True:
                            b = ord(polyline[index]) - 63 - 1
                            index += 1
                            result += b << shift
                            shift += 5
                            if b < 0x1f:
                                break
                        lng += (~(result >> 1) if (result & 1) else (result >> 1))
                        
                        segment_points.append({"lat": lat * 1e-5, "lng": lng * 1e-5})
                except Exception as e:
                    print(f"Error decoding polyline: {e}")
                
                if 'to' in elem:
                    segment_points.append({"lat": elem['to']['lat'], "lng": elem['to']['lon']})
                
                if len(segment_points) >= 2: 
                    transit_type = mode.lower()
                    segments.append({
                        "type": transit_type,
                        "line_name": elem.get('routeShortName', transit_type.capitalize()),
                        "route_id": elem.get('routeId', ''),
                        "points": segment_points,
                        "from": from_stop.get('name'),
                        "to": to_stop.get('name'),
                        "duration": elem.get('duration', 0),
                        "distance": elem.get('distance', 0) / 1000,
                        "headsign": elem.get('headsign', '')
                    })
                    
                    route_points.extend(segment_points)
    
    while len(street_names) < len(route_points):
        street_names.append("Rue non identifiée")
    
    return {
        "route": route_points,
        "segments": segments,
        "distance": round(total_distance, 2),
        "duration": round(duration),
        "transport_mode": "transit",
        "streetNames": street_names,
        "streetDestinations": street_destinations,
        "detailed_instructions": detailed_instructions # le chemin
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
        if start_address:
            start_coords = await geocode_address(start_address)
            start_lat, start_lng = start_coords["lat"], start_coords["lng"]
        
        if end_address:
            end_coords = await geocode_address(end_address)
            end_lat, end_lng = end_coords["lat"], end_coords["lng"]
        
        if not all([start_lat, start_lng, end_lat, end_lng]):
            raise HTTPException(status_code=400, detail="Missing coordinates or addresses")

        if transport_mode == "tram" or transport_mode == "transit":
            try:
                print(f"Calculating transit route from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng})")
                
                tram_route = calculate_tram_route((start_lat, start_lng), (end_lat, end_lng))
                
                print(f"MTAG API response: {json.dumps(tram_route)[:200]}...")  # Print first 200 chars
                
                if not tram_route:
                    print("No transit route returned by MTAG API")
                    print("Falling back to walking route")
                    transport_mode = "walking" 
                elif 'error' in tram_route:
                    print(f"MTAG API error: {tram_route['error']}")
                    print("Falling back to walking route")
                    transport_mode = "walking"
                elif 'duration' not in tram_route or not tram_route.get('legs'):
                    print(f"Invalid MTAG API response: {tram_route}")
                    print("Falling back to walking route")
                    transport_mode = "walking"
                else:
                    result = extract_tram_route(tram_route)
                    print(f"Successfully extracted transit route with {len(result['route'])} points and {len(result.get('segments', []))} segments")
                    return result
            except Exception as e:
                print(f"Transit routing error with MTAG API: {e}")
                print("Falling back to walking route")
                transport_mode = "walking"

        # If we reached here for transit mode, it means we're falling back to walking
        # Continue with standard routing for walking/cycling/driving
        # Load GeoJSON data for routing
        file_path = os.path.join(BASE_DIR, "grenoble.geojson")
        with open(file_path, 'r') as file:
            geo_data = json.load(file)

        # Filter data by transport mode
        allowed_types = {
            "walking": ["footway", "path", "pedestrian", "steps", "residential", "service"],
            "cycling": ["cycleway", "residential", "path", "footway", "secondary", "tertiary"],
            "driving": ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service"],
            "transit": [] 
        }
        
        if transport_mode == "transit":
            transport_file_path = os.path.join(BASE_DIR, "data_transport_commun_grenoble_formate.geojson")
            with open(transport_file_path, 'r') as file:
                transport_data = json.load(file)

                geo_data["features"].extend([f for f in transport_data["features"] 
                                        if f.get("geometry", {}).get("type") == "LineString"])
        
        # Create a graph for routing - always use DiGraph for driving to respect one-way streets
        G = nx.DiGraph() if transport_mode == "driving" else nx.Graph()
        
        # Add nodes and edges from filtered features
        valid_features = []
        for feature in geo_data["features"]:
            if feature.get("geometry", {}).get("type") == "LineString":
                highway_type = feature.get("properties", {}).get("highway")
                
                # Skip features that don't match our transport mode
                if transport_mode != "transit" and highway_type not in allowed_types[transport_mode]:
                    continue
                
                valid_features.append(feature)
                coords = feature["geometry"]["coordinates"]
                
                # Check if it's a one-way street
                props = feature.get("properties", {})
                one_way = props.get("oneway") == "yes"
                
                # For one-way streets, we need to check the direction
                if one_way and transport_mode == "driving":
                    # Some OSM data may have explicit direction tags
                    oneway_direction = 1  # Default is forward direction (along the coordinates order)
                    
                    # Check if there's an explicit -1 direction tag
                    if props.get("oneway") == "-1" or props.get("oneway") == "reverse":
                        oneway_direction = -1
                    
                    # Add nodes and edge to the graph in the correct direction
                    for i in range(len(coords) - 1):
                        node1 = tuple(coords[i])
                        node2 = tuple(coords[i + 1])
                        
                        # Calculate distance between nodes
                        dist = calculate_distance(node1[1], node1[0], node2[1], node2[0])
                        
                        G.add_node(node1, pos=node1)
                        G.add_node(node2, pos=node2)
                        
                        # Add edge in correct direction
                        if oneway_direction == 1:
                            G.add_edge(node1, node2, weight=dist, oneway=True)
                        else:
                            G.add_edge(node2, node1, weight=dist, oneway=True)
                else:
                    # For two-way streets or non-driving modes
                    for i in range(len(coords) - 1):
                        node1 = tuple(coords[i])
                        node2 = tuple(coords[i + 1])
                        
                        # Calculate distance between nodes
                        dist = calculate_distance(node1[1], node1[0], node2[1], node2[0])
                        
                        # Add nodes and both directions to the graph
                        G.add_node(node1, pos=node1)
                        G.add_node(node2, pos=node2)
                        G.add_edge(node1, node2, weight=dist)
                        
                        # For non-driving modes or two-way streets, add both directions
                        if transport_mode != "driving" or not one_way:
                            G.add_edge(node2, node1, weight=dist)

        print(f"Created graph with {len(G.nodes())} nodes and {len(G.edges())} edges")
        
        # APPROCHE SIMPLIFIÉE: chercher directement les noeuds les plus proches dans le graphe
        # sans passer par la recherche des routes les plus proches
        
        # Récupérer tous les noeuds du graphe
        all_nodes = list(G.nodes())
        
        if not all_nodes:
            raise HTTPException(status_code=404, detail="Road network graph is empty")
        
        # Trouver les noeuds les plus proches pour le départ et l'arrivée
        # Au lieu de prendre simplement le plus proche, on prend les 10 plus proches
        # et on essaie de trouver une paire qui soit connectée dans le graphe
        start_candidates = sorted(all_nodes, key=lambda node: 
            calculate_distance(node[1], node[0], start_lat, start_lng))[:20]
        
        end_candidates = sorted(all_nodes, key=lambda node: 
            calculate_distance(node[1], node[0], end_lat, end_lng))[:20]
        
        print(f"Found {len(start_candidates)} start candidates and {len(end_candidates)} end candidates")
        
        # On essaie de trouver un chemin valide entre les noeuds candidats
        path_found = False
        closest_start_node = start_candidates[0]  # Par défaut, on prend le plus proche
        closest_end_node = end_candidates[0]  # Par défaut, on prend le plus proche
        
        for start_node in start_candidates:
            for end_node in end_candidates:
                try:
                    # Vérifier si le chemin existe
                    path = nx.shortest_path(G, source=start_node, target=end_node, weight='weight')
                    print(f"Found valid path from {start_node} to {end_node} with {len(path)} nodes")
                    closest_start_node = start_node
                    closest_end_node = end_node
                    path_found = True
                    break
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue
            
            if path_found:
                break
        
        # Calculer les distances
        start_distance = calculate_distance(
            closest_start_node[1], closest_start_node[0], start_lat, start_lng)
        end_distance = calculate_distance(
            closest_end_node[1], closest_end_node[0], end_lat, end_lng)
        
        print(f"Selected start node: {closest_start_node}, distance: {start_distance:.4f}km")
        print(f"Selected end node: {closest_end_node}, distance: {end_distance:.4f}km")
        
        # Log information about the start and end nodes for debugging
        if transport_mode == "driving":
            print(f"Checking start node {closest_start_node} connections:")
            print(f"- Outgoing edges: {len(list(G.out_edges(closest_start_node)))}")
            print(f"- Incoming edges: {len(list(G.in_edges(closest_start_node)))}")
            
            print(f"Checking end node {closest_end_node} connections:")
            print(f"- Outgoing edges: {len(list(G.out_edges(closest_end_node)))}")
            print(f"- Incoming edges: {len(list(G.in_edges(closest_end_node)))}")
        
        # Calculer l'itinéraire le plus court ou créer un itinéraire direct si nécessaire
        try:
            path = nx.shortest_path(G, source=closest_start_node, target=closest_end_node, weight='weight')
            print(f"Calculating path with {len(path)} nodes")
            
            # Vérifier que tous les segments du chemin existent bien dans le graphe
            valid_path = True
            for i in range(len(path) - 1):
                if not G.has_edge(path[i], path[i + 1]):
                    print(f"Edge {path[i]} -> {path[i + 1]} doesn't exist in graph")
                    valid_path = False
                    break
            
            if not valid_path:
                print("Path contains edges that don't exist in the graph, creating direct route")
                path = [closest_start_node, closest_end_node]
                
        except (nx.NetworkXNoPath, nx.NodeNotFound) as e:
            print(f"No path found: {e}, creating direct route")
            path = [closest_start_node, closest_end_node]
        
        # Convertir le chemin en coordonnées pour l'affichage
        route_points = [{"lat": start_lat, "lng": start_lng}]  # Point de départ réel
        
        # Collecter les noms des rues pour chaque segment
        street_names = []
        
        # Ajouter le point le plus proche sur le réseau routier
        route_points.append({"lat": closest_start_node[1], "lng": closest_start_node[0]})
        # Premier nom de rue (pour le point de départ)
        start_street = "rue non identifiée"
        for feature in valid_features:
            coords = feature["geometry"]["coordinates"]
            for i in range(len(coords) - 1):
                if tuple(coords[i]) == closest_start_node or tuple(coords[i+1]) == closest_start_node:
                    if "name" in feature.get("properties", {}):
                        start_street = feature["properties"]["name"]
                        break
        street_names.append(start_street)
        
        # Ajouter tous les points intermédiaires du chemin avec noms de rues et destinations
        street_info = []
        for i in range(len(path)):
            point = path[i]
            if i > 0 and i < len(path) - 1:  # Skip first and last point which we handle separately
                route_points.append({"lat": point[1], "lng": point[0]})
            
            # Trouver le nom de la rue et la destination pour ce point
            street_name = "rue non identifiée"
            destination = None  # Nouvelle variable pour stocker la destination
            
            for feature in valid_features:
                coords = feature["geometry"]["coordinates"]
                props = feature.get("properties", {})
                
                for j in range(len(coords) - 1):
                    if tuple(coords[j]) == point or tuple(coords[j+1]) == point:
                        if "name" in props:
                            street_name = props["name"]
                        
                        # Extraire l'information de destination si elle existe
                        if transport_mode == "driving" and "destination" in props:
                            destination = props["destination"]
                        
                        break
                
                if street_name != "rue non identifiée" or destination:
                    break
            
            # Stocker les informations de rue pour chaque segment
            street_info.append({
                "name": street_name,
                "destination": destination
            })
        
        # Ajouter le point le plus proche du point d'arrivée
        route_points.append({"lat": closest_end_node[1], "lng": closest_end_node[0]})
        
        # Nom de la rue finale
        end_street = "rue non identifiée"
        for feature in valid_features:
            coords = feature["geometry"]["coordinates"]
            for i in range(len(coords) - 1):
                if tuple(coords[i]) == closest_end_node or tuple(coords[i+1]) == closest_end_node:
                    if "name" in feature.get("properties", {}):
                        end_street = feature["properties"]["name"]
                        break
        street_names.append(end_street)
        
        # Ajouter le point d'arrivée réel
        route_points.append({"lat": end_lat, "lng": end_lng})
        street_names.append(end_street)  # Même nom de rue pour le point d'arrivée
        
        # Calculer la distance totale
        distance = 0
        # Distance du point de départ réel au noeud le plus proche
        distance += start_distance
        
        # Distance le long du chemin calculé en vérifiant que les segments existent
        if len(path) > 1:
            if len(path) == 2:
                # S'il s'agit d'un chemin direct, calculer la distance à vol d'oiseau
                segment_distance = calculate_distance(
                    path[0][1], path[0][0], path[1][1], path[1][0])
                distance += segment_distance
            else:
                # Pour un chemin plus complexe, vérifier chaque segment
                for i in range(len(path) - 1):
                    if G.has_edge(path[i], path[i + 1]):
                        segment_distance = G.edges[path[i], path[i + 1]]['weight']
                    else:
                        # Si l'arête n'existe pas, calculer la distance à vol d'oiseau
                        segment_distance = calculate_distance(
                            path[i][1], path[i][0], path[i + 1][1], path[i + 1][0])
                    
                    distance += segment_distance
        
        # Distance du dernier noeud au point d'arrivée réel
        distance += end_distance
        
        # Calculer la durée en fonction du mode de transport
        speeds = {
            "walking": 5,
            "cycling": 15,
            "driving": 40,
            "transit": 20
        }
        speed = speeds.get(transport_mode, 5)
        duration = (distance / speed) * 60 * 60  # Durée en secondes
        
        return {
            "route": route_points,
            "distance": round(distance, 2),
            "duration": round(duration),
            "transport_mode": transport_mode,
            "streetNames": [info["name"] for info in street_info],
            "streetDestinations": [info["destination"] for info in street_info if info["destination"]]
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
