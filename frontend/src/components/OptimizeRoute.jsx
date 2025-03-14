import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function OptimizeRoute({ route, simplified = false }) {
  if (!route || !route.route || route.route.length < 2) return null;
  
  // Extract coordinates for the polyline
  const positions = route.route.map(point => [point.lat, point.lng]);
  
  // Determine color based on transport mode
  let color = '#3388ff'; // Default blue
  switch (route.transport_mode) {
    case 'walking':
      color = '#8B4513'; // Brown
      break;
    case 'cycling':
      color = '#006400'; // Dark green
      break;
    case 'driving':
      color = '#FF0000'; // Red
      break;
    case 'transit':
      color = '#800080'; // Purple
      break;
    default:
      color = '#3388ff'; // Default blue
  }

  // If simplified mode is requested, just show a direct route
  // without segments or intermediate markers
  return (
    <>
      <Polyline 
        positions={positions} 
        color={color}
        weight={5}
        opacity={0.7}
      />
      
      {/* Start marker */}
      <Marker position={positions[0]}>
        <Popup>
          <div>
            <h3>Start Point</h3>
            <p>Transport mode: {route.transport_mode}</p>
            {route.distance > 0 && <p>Distance: {route.distance.toFixed(2)} km</p>}
            {route.duration > 0 && <p>Duration: {Math.round(route.duration / 60)} mins</p>}
          </div>
        </Popup>
      </Marker>
      
      {/* End marker */}
      <Marker position={positions[positions.length - 1]}>
        <Popup>
          <div>
            <h3>Destination</h3>
            <p>Transport mode: {route.transport_mode}</p>
            {route.distance > 0 && <p>Distance: {route.distance.toFixed(2)} km</p>}
            {route.duration > 0 && <p>Duration: {Math.round(route.duration / 60)} mins</p>}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

export default OptimizeRoute;
