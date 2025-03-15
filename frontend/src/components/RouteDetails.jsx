import React, { useMemo } from 'react';
import './RouteDetails.css';

// Helper function to get cardinal direction
function getCardinalDirection(bearing) {
  const directions = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"];
  return directions[Math.round(bearing / 45) % 8];
}

// Helper functions - moved outside component to avoid hoisting issues
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (startLat, startLng, endLat, endLng) => {
  const startLatRad = startLat * Math.PI / 180;
  const startLngRad = startLng * Math.PI / 180;
  const endLatRad = endLat * Math.PI / 180;
  const endLngRad = endLng * Math.PI / 180;

  const y = Math.sin(endLngRad - startLngRad) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
          Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(endLngRad - startLngRad);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360
  return bearing;
};

const getTurnDirection = (prevBearing, currentBearing, streetName) => {
  const change = (currentBearing - prevBearing + 360) % 360;
  const streetInfo = streetName ? ` sur ${streetName}` : '';
  
  if (change < 20 || change > 340) {
    return { instruction: `Continuez tout droit${streetInfo}`, icon: "↑" };
  } else if (change < 60) {
    return { instruction: `Tournez légèrement à droite${streetInfo}`, icon: "↗" };
  } else if (change < 120) {
    return { instruction: `Tournez à droite${streetInfo}`, icon: "→" };
  } else if (change < 160) {
    return { instruction: `Tournez fortement à droite${streetInfo}`, icon: "↘" };
  } else if (change < 200) {
    return { instruction: `Faites demi-tour${streetInfo}`, icon: "↓" };
  } else if (change < 240) {
    return { instruction: `Tournez fortement à gauche${streetInfo}`, icon: "↙" };
  } else if (change < 300) {
    return { instruction: `Tournez à gauche${streetInfo}`, icon: "←" };
  } else {
    return { instruction: `Tournez légèrement à gauche${streetInfo}`, icon: "↖" };
  }
};

// Generate navigation instructions based on the route with street names
function generateNavigationInstructions(routeData) {
  if (!routeData || !routeData.route || routeData.route.length < 3) return [];
  
  const instructions = [];
  let prevBearing = null;
  let lastTurnIndex = 0;
  let currentStreetName = routeData.streetNames ? routeData.streetNames[0] || "la rue" : "la rue";
  let cumulativeDistance = 0;
  let lastInstruction = null;
  
  // Start with initial direction
  const initialBearing = calculateBearing(
    routeData.route[0].lat, routeData.route[0].lng, 
    routeData.route[1].lat, routeData.route[1].lng
  );
  
  // Ajouter l'information de destination si disponible au départ
  let startInstruction = `Démarrez en direction ${getCardinalDirection(initialBearing)} sur ${currentStreetName}`;
  if (routeData.transport_mode === "driving" && routeData.streetDestinations && routeData.streetDestinations.length > 0) {
    startInstruction += ` vers ${routeData.streetDestinations[0]}`;
  }
  
  instructions.push({
    instruction: startInstruction,
    icon: "🚩",
    distance: 0
  });
  
  // For each segment in the route, determine the turn direction
  for (let i = 1; i < routeData.route.length - 1; i++) {
    const currentBearing = calculateBearing(
      routeData.route[i].lat, routeData.route[i].lng,
      routeData.route[i + 1].lat, routeData.route[i + 1].lng
    );
    
    // Get current street name if available
    const nextStreetName = routeData.streetNames && routeData.streetNames[i] 
      ? routeData.streetNames[i]
      : null;
    
    if (prevBearing !== null) {
      // Calculate distance for this segment
      const segmentDistance = calculateDistance(
        routeData.route[i-1].lat, routeData.route[i-1].lng,
        routeData.route[i].lat, routeData.route[i].lng
      );
      
      // Add to cumulative distance
      cumulativeDistance += segmentDistance;
      
      // Check if we're changing streets
      const changingStreets = nextStreetName && currentStreetName !== nextStreetName;
      
      // Get direction change
      const { instruction, icon } = getTurnDirection(prevBearing, currentBearing, 
        changingStreets ? nextStreetName : null);
      
      // Only add significant turns or street changes
      if (instruction !== "Continuez tout droit" || changingStreets || i === routeData.route.length - 2) {
        // If we have a "continue straight" on same street, update last instruction with new distance
        if (instruction === "Continuez tout droit" && !changingStreets && lastInstruction) {
          lastInstruction.distance = cumulativeDistance.toFixed(2);
          lastInstruction.instruction = `Continuez tout droit sur ${currentStreetName}`;
          
          // Ajouter l'information de destination si disponible
          if (routeData.transport_mode === "driving" && 
              routeData.streetDestinations && 
              i < routeData.streetDestinations.length && 
              routeData.streetDestinations[i]) {
            lastInstruction.instruction += ` vers ${routeData.streetDestinations[i]}`;
          }
        } else {
          let turnInstruction = instruction;
          
          // Ajouter l'information de destination si disponible
          if (routeData.transport_mode === "driving" && 
              routeData.streetDestinations && 
              i < routeData.streetDestinations.length && 
              routeData.streetDestinations[i]) {
            turnInstruction += ` vers ${routeData.streetDestinations[i]}`;
          }
          
          const newInstruction = {
            instruction: turnInstruction,
            icon,
            distance: cumulativeDistance.toFixed(2),
            streetName: nextStreetName || currentStreetName
          };
          
          instructions.push(newInstruction);
          lastInstruction = newInstruction;
          cumulativeDistance = 0;
          lastTurnIndex = i;
          
          // Update current street name
          if (changingStreets) {
            currentStreetName = nextStreetName;
          }
        }
      }
    }
    
    prevBearing = currentBearing;
  }
  
  // Add arrival instruction
  const finalDistance = calculateDistance(
    routeData.route[lastTurnIndex].lat, routeData.route[lastTurnIndex].lng,
    routeData.route[routeData.route.length - 1].lat, routeData.route[routeData.route.length - 1].lng
  );
  
  instructions.push({
    instruction: "Vous êtes arrivé à destination",
    icon: "🏁",
    distance: finalDistance.toFixed(2)
  });
  
  return instructions;
}

// Generate transit-specific instructions (tram/bus direction & stops)
function generateTransitInstructions(routeData) {
  if (!routeData || !routeData.segments) return [];
  
  const instructions = [];
  
  // Traitement des instructions détaillées si disponibles
  if (routeData.detailed_instructions && routeData.detailed_instructions.length > 0) {
    // Début du trajet
    instructions.push({
      instruction: "Démarrez votre trajet",
      icon: "🚩",
      distance: 0
    });
    
    // Parcourir les instructions détaillées
    routeData.detailed_instructions.forEach((step, index) => {
      let instruction = '';
      let icon = "➡️";
      
      // Traduire les directions en français
      const directionMap = {
        'DEPART': 'Partez',
        'LEFT': 'Tournez à gauche',
        'SLIGHTLY_LEFT': 'Tournez légèrement à gauche',
        'RIGHT': 'Tournez à droite',
        'SLIGHTLY_RIGHT': 'Tournez légèrement à droite',
        'CONTINUE': 'Continuez',
        'CIRCLE_COUNTERCLOCKWISE': 'Prenez le rond-point dans le sens inverse des aiguilles',
        'CIRCLE_CLOCKWISE': 'Prenez le rond-point dans le sens des aiguilles',
        'HARD_LEFT': 'Tournez fortement à gauche',
        'HARD_RIGHT': 'Tournez fortement à droite',
        'UTURN_LEFT': 'Faites demi-tour à gauche',
        'UTURN_RIGHT': 'Faites demi-tour à droite',
        'ELEVATOR': 'Prenez l\'ascenseur'
      };
      
      // Définir l'icône en fonction du type de segment
      if (step.legType === 'TRAM') {
        icon = "🚊";
      } else if (step.legType === 'BUS') {
        icon = "🚌";
      } else if (step.legType === 'WALK') {
        icon = "🚶";
      }
      
      const direction = directionMap[step.relativeDirection] || step.relativeDirection;
      
      // Construire l'instruction en français
      if (step.relativeDirection === 'DEPART') {
        instruction = `Partez sur ${step.streetName}`;
      } else {
        instruction = `${direction} sur ${step.streetName}`;
      }
      
      instructions.push({
        instruction,
        icon,
        distance: step.distance.toFixed(2)
      });
    });
    
    // Fin du trajet
    instructions.push({
      instruction: "Vous êtes arrivé à destination",
      icon: "🏁",
      distance: 0
    });
    
    return instructions;
  }
  
  // Fallback au système précédent si les instructions détaillées ne sont pas disponibles
  routeData.segments.forEach((segment, index) => {
    if (segment.type === 'tram' || segment.type === 'bus') {
      const pointsCount = segment.points.length;
      if (pointsCount < 2) return;
      
      // Improved instructions with more details
      const transportType = segment.type === 'tram' ? 'Tram' : 'Bus';
      const lineName = segment.line_name || '';
      const fromStop = segment.from || '';
      const toStop = segment.to || '';
      const headsign = segment.headsign || '';
      
      let detailedInstruction = `Prenez le ${transportType} ${lineName}`;
      if (headsign) {
        detailedInstruction += ` direction "${headsign}"`;
      }
      if (fromStop && toStop) {
        detailedInstruction += ` de l'arrêt "${fromStop}" vers "${toStop}"`;
      }
      
      instructions.push({
        instruction: detailedInstruction,
        icon: segment.type === 'tram' ? "🚊" : "🚌",
        distance: segment.distance ? segment.distance.toFixed(2) : 0,
        isTransport: true
      });
    } else if (segment.type === 'walking') {
      // Improved walking instructions
      const fromPlace = segment.from || '';
      const toPlace = segment.to || '';
      
      let walkingInstruction = "Marchez";
      if (fromPlace && toPlace) {
        walkingInstruction += ` de "${fromPlace}" vers "${toPlace}"`;
      } else if (index > 0) {
        // If previous segment was transport, add exit instruction
        const prevSegment = routeData.segments[index - 1];
        if (prevSegment && (prevSegment.type === 'tram' || prevSegment.type === 'bus')) {
          walkingInstruction = `Descendez à "${prevSegment.to}" et continuez à pied`;
          if (toPlace) {
            walkingInstruction += ` vers "${toPlace}"`;
          }
        }
      }
      
      instructions.push({
        instruction: walkingInstruction,
        icon: "🚶",
        distance: segment.distance ? segment.distance.toFixed(2) : 0
      });
    }
  });
  
  return instructions;
}

// Fonction pour formater la distance (retourne null si inférieure à 0.01 km)
const formatDistance = (distance) => {
  return parseFloat(distance) >= 0.01 ? `${distance} km` : null;
};

function RouteDetails({ route, onClose }) {
  // Use useMemo with the helper functions correctly defined above
  const allInstructions = useMemo(() => {
    if (!route) return [];
    
    // Determine which instructions to generate based on transport mode
    const transportMode = route.transport_mode || 'walking';
    if (transportMode === 'transit') {
      return generateTransitInstructions(route);
    } else {
      return generateNavigationInstructions(route);
    }
  }, [route]);

  // Early return if no route data
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

      {/* Navigation Instructions */}
      <div className="route-navigation-instructions">
        <h3>Instructions de navigation</h3>
        <div className="instructions-list">
          {allInstructions.map((instruction, index) => (
            <div className="instruction-item" key={index}>
              <div className="instruction-icon">{instruction.icon}</div>
              <div className="instruction-content">
                <div className="instruction-text">{instruction.instruction}</div>
                {instruction.distance >= 0.01 && (
                  <div className="instruction-distance">
                    {instruction.distance} km
                  </div>
                )}
              </div>
            </div>
          ))}
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
                  return total + calculateDistance(prev.lat, prev.lng, point.lat, point.lng);
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
                      {parseFloat(segmentDistance) >= 0.01 && (
                        <span className="segment-distance">{segmentDistance} km</span>
                      )}
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
                  {route.distance >= 0.01 && (
                    <span className="segment-distance">{route.distance.toFixed(2)} km</span>
                  )}
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
