import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";


delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function OptimizeRoute({ route, simplified = false }) {
  if (!route || !route.route || route.route.length < 2) return null;
  
  const positions = route.route.map(point => [point.lat, point.lng]).filter(point => point[0] !== undefined && point[1] !== undefined);
  

  const hasSegments = route.segments && route.segments.length > 0;
  

  if (route.transport_mode === "transit" && hasSegments) {
    return (
      <>
        {/* Render each segment with appropriate styling */}
        {route.segments.map((segment, index) => {
          const segmentPositions = segment.points.map(point => [point.lat, point.lng]).filter(point => point[0] !== undefined && point[1] !== undefined);
          

          if (segmentPositions.length < 2) return null;
          

          let color = '#3388ff';
          let weight = 3; 
          let dashArray = null;
          
          switch (segment.type) {
            case 'walking':
              color = '#8B4513';
              weight = 2;
              dashArray = '3, 3'; 
              break;
            case 'tram':
              color = '#800080';
              weight = 3;
              break;
            case 'bus':
              color = '#008000'; 
              weight = 2.5;
              break;
            default:
              color = '#3388ff';
          }
          
          return (
            <Polyline 
              key={`segment-${index}`}
              positions={segmentPositions}
              color={color}
              weight={weight}
              opacity={0.8}
              dashArray={dashArray}
            />
          );
        })}
        
        {/* Markers for start, end, and transfer points */}
        {/* Start marker */}
        <Marker position={positions[0]}>
          <Popup>
            <div>
              <h3>Start Point</h3>
              <p>Multi-modal journey:</p>
              {route.segment_info && (
                <ul>
                  {route.segment_info.map((seg, idx) => (
                    <li key={idx}>
                      {seg.type === 'walking' ? 'Walk' : seg.name} ({seg.distance.toFixed(2)} km / {seg.duration} mins)
                    </li>
                  ))}
                </ul>
              )}
              <p><strong>Total distance:</strong> {route.distance.toFixed(2)} km</p>
              <p><strong>Total time:</strong> {Math.round(route.duration / 60)} mins</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Transfer points between segments (excluding start and end) */}
        {hasSegments && route.segments.length > 1 && route.segments.slice(0, -1).map((segment, index) => {
          if (index === 0) return null; 
          
          const transferPoint = segment.points[segment.points.length - 1];
          const nextSegment = route.segments[index + 1];
          
          if (!nextSegment || 
              (transferPoint.lat === positions[0][0] && transferPoint.lng === positions[0][1]) || 
              (transferPoint.lat === positions[positions.length - 1][0] && transferPoint.lng === positions[positions.length - 1][1])) {
            return null;
          }
          
          return (
            <Marker 
              key={`transfer-${index}`} 
              position={[transferPoint.lat, transferPoint.lng]}
              icon={new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })}
            >
              <Popup>
                <div>
                  <h3>Transfer Point</h3>
                  <p>Change from {segment.type} to {nextSegment.type}</p>
                  {segment.line_name && <p>From: {segment.line_name}</p>}
                  {nextSegment.line_name && <p>To: {nextSegment.line_name}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* End marker */}
        <Marker position={positions[positions.length - 1]}>
          <Popup>
            <div>
              <h3>Destination</h3>
              <p><strong>Total distance:</strong> {route.distance.toFixed(2)} km</p>
              <p><strong>Total time:</strong> {Math.round(route.duration / 60)} mins</p>
            </div>
          </Popup>
        </Marker>
      </>
    );
  }
  

  let color = '#3388ff'; // jolie
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
    default:
      color = '#3388ff';
  }

  return (
    <>
      <Polyline 
        positions={positions} 
        color={color}
        weight={3} 
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
