import React from 'react';
import './RouteDetails.css';

function RouteDetails({ route, onClose }) {
  if (!route) return null;

  // Helper function to format time in minutes and seconds
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    } else {
      return `${minutes} min`;
    }
  };

  // Get icon for transport mode
  const getTransportIcon = (type) => {
    switch (type) {
      case 'walking':
        return '🚶';
      case 'cycling':
        return '🚲';
      case 'driving':
        return '🚗';
      case 'bus':
        return '🚌';
      case 'tram':
        return '🚊';
      case 'subway':
        return '🚇';
      default:
        return '🚶';
    }
  };

  return (
    <div className="route-details-container">
      <div className="route-details-header">
        <h2>Itinéraire</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="route-details-summary">
        <div className="route-total-info">
          <div className="route-total-distance">
            <span className="label">Distance:</span>
            <span className="value">{route.distance.toFixed(2)} km</span>
          </div>
          <div className="route-total-duration">
            <span className="label">Durée:</span>
            <span className="value">{formatDuration(route.duration)}</span>
          </div>
        </div>
        <div className="route-transport-mode">
          {route.transport_mode === 'transit' ? 'Transport en commun' : 
           route.transport_mode === 'walking' ? 'Marche à pied' :
           route.transport_mode === 'cycling' ? 'Vélo' : 'Voiture'}
        </div>
      </div>

      <div className="route-details-segments">
        {route.segments ? (
          <div className="segments-list">
            {route.segments.map((segment, index) => {
              // Calculate segment distance
              const segmentDistance = segment.points ? 
                segment.points.reduce((total, point, i, points) => {
                  if (i === 0) return total;
                  const prev = points[i-1];
                  // Calculate distance between points (approximation)
                  const lat1 = prev.lat;
                  const lon1 = prev.lng;
                  const lat2 = point.lat;
                  const lon2 = point.lng;
                  
                  const R = 6371; // Earth radius in kilometers
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                            Math.sin(dLon/2) * Math.sin(dLon/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const distance = R * c;
                  
                  return total + distance;
                }, 0).toFixed(2) : 'N/A';
              
              // Estimate segment duration based on transport type
              const speed = segment.type === 'walking' ? 5 : 
                          segment.type === 'cycling' ? 15 : 
                          segment.type === 'driving' ? 40 : 
                          segment.type === 'bus' ? 20 : 
                          segment.type === 'tram' ? 30 : 20; // km/h
              
              const segmentDuration = segmentDistance !== 'N/A' ? 
                Math.round((parseFloat(segmentDistance) / speed) * 60 * 60) : 0;

              return (
                <div key={index} className="segment-item">
                  <div className="segment-icon">
                    {getTransportIcon(segment.type)}
                  </div>
                  <div className="segment-details">
                    <div className="segment-type">
                      {segment.type === 'walking' ? 'Marche à pied' : 
                       segment.type === 'cycling' ? 'Vélo' : 
                       segment.type === 'driving' ? 'Voiture' : 
                       segment.type === 'bus' ? 'Bus' : 
                       segment.type === 'tram' ? 'Tramway' : 'Transport'}
                      
                      {segment.line_name && <span className="segment-line"> {segment.line_name}</span>}
                    </div>
                    <div className="segment-metrics">
                      <span className="segment-distance">{segmentDistance} km</span>
                      <span className="segment-duration">{formatDuration(segmentDuration)}</span>
                    </div>
                    {index < route.segments.length - 1 && (
                      <div className="segment-connection">
                        <span className="connection-dot"></span>
                        {segment.type !== route.segments[index + 1].type && (
                          <span className="connection-label">
                            Changement: {route.segments[index + 1].type === 'walking' ? 'Marche à pied' : 
                              route.segments[index + 1].type === 'bus' ? 'Bus' : 
                              route.segments[index + 1].type === 'tram' ? 'Tramway' : 'Transport'}
                            {route.segments[index + 1].line_name && ` ${route.segments[index + 1].line_name}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="simple-route">
            <div className="segment-item">
              <div className="segment-icon">
                {getTransportIcon(route.transport_mode)}
              </div>
              <div className="segment-details">
                <div className="segment-type">
                  {route.transport_mode === 'walking' ? 'Marche à pied' : 
                   route.transport_mode === 'cycling' ? 'Vélo' : 
                   route.transport_mode === 'driving' ? 'Voiture' : 'Transport'}
                </div>
                <div className="segment-metrics">
                  <span className="segment-distance">{route.distance.toFixed(2)} km</span>
                  <span className="segment-duration">{formatDuration(route.duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RouteDetails;
