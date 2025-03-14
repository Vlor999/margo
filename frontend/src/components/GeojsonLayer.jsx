import React, { useRef, useEffect } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

function GeojsonLayer({ data, type, filters, onStopClick }) {
  const geoJsonRef = useRef(null);
  const map = useMap();
  
  // Optimize data if needed before rendering
  const optimizedData = React.useMemo(() => {
    // If no data, return null
    if (!data || !data.features) return null;
    
    // Clone the data to avoid mutating the original
    const clonedData = JSON.parse(JSON.stringify(data));
    
    // For large datasets, consider simplifying the features based on zoom
    const zoom = map.getZoom();
    const simplifyThreshold = zoom < 13 ? 0.0001 : 0;
    
    // If we're at a low zoom level, limit the number of features
    if (zoom < 12) {
      // Keep only major roads and transit lines for better performance
      clonedData.features = clonedData.features.filter(feature => {
        const props = feature.properties || {};
        if (type === 'route') {
          return ['primary', 'secondary', 'motorway', 'trunk'].includes(props.highway);
        } else if (type === 'transport') {
          return props.route_type === 'tram';
        }
        return true;
      });
    }
    
    return clonedData;
  }, [data, map.getZoom(), type]);
  
  const getRouteStyle = (feature) => {
    const properties = feature.properties || {};
    
    // Default style - reduced weight from 2 to 0.8
    let style = {
      color: '#3388ff',
      weight: 0.8,
      opacity: 0.6
    };
    
    // Route type styles
    if (type === 'route') {
      const highway = properties.highway;
      
      if (highway === 'footway' || highway === 'path' || highway === 'pedestrian') {
        style.color = '#8B4513'; // Brown for pedestrian paths
        style.weight = 0.5;
      } else if (highway === 'cycleway') {
        style.color = '#006400'; // Dark green for bicycle paths
        style.weight = 0.7;
        style.dashArray = '3, 3'; // Reduced from '5, 5'
      } else if (highway === 'primary') {
        style.color = '#FF0000'; // Red for primary roads
        style.weight = 1.5; // Reduced from 3
      } else if (highway === 'secondary') {
        style.color = '#FFA500'; // Orange for secondary roads
        style.weight = 1; // Reduced from 2
      } else if (highway === 'residential') {
        style.color = '#808080'; // Gray for residential roads
        style.weight = 0.6;
      }
    } 
    // Transport type styles
    else if (type === 'transport') {
      const routeType = properties.route_type;
      
      if (routeType === 'tram') {
        style.color = '#00BFFF'; // Blue for tram routes
        style.weight = 1.5; // Reduced from 4
      } else if (routeType === 'bus') {
        style.color = '#32CD32'; // Green for bus routes
        style.weight = 1; // Reduced from 3
      } else if (routeType === 'subway') {
        style.color = '#800080'; // Purple for subway
        style.weight = 1.5; // Reduced from 4
      }
    }
    
    return style;
  };

  const getPointStyle = (feature) => {
    const properties = feature.properties || {};
    
    // Default style for points - reduced radius from 6 to 3
    let style = {
      radius: 3,
      fillColor: "#3388ff",
      color: "#000",
      weight: 0.5, // Reduced from 1
      opacity: 1,
      fillOpacity: 0.8
    };
    
    // Style based on point type
    if (properties.public_transport === 'stop_position') {
      if (properties.bus === 'yes') {
        style.fillColor = '#32CD32'; // Green for bus stops
        style.radius = 2.5; // Smaller radius for bus stops
      } else if (properties.tram === 'yes') {
        style.fillColor = '#00BFFF'; // Blue for tram stops
        style.radius = 2.5; // Smaller radius for tram stops
      }
    }
    
    return style;
  };

  const onEachFeature = (feature, layer) => {
    // Add popups with information
    if (feature.properties) {
      const props = feature.properties;
      let popupContent = '<div class="popup-content">';
      
      if (type === 'route') {
        popupContent += `<h3>Road Information</h3>`;
        if (props.name) popupContent += `<p><strong>Name:</strong> ${props.name}</p>`;
        if (props.highway) popupContent += `<p><strong>Type:</strong> ${props.highway}</p>`;
        if (props.maxspeed) popupContent += `<p><strong>Max Speed:</strong> ${props.maxspeed} km/h</p>`;
        if (props.surface) popupContent += `<p><strong>Surface:</strong> ${props.surface}</p>`;
        if (props.lanes) popupContent += `<p><strong>Lanes:</strong> ${props.lanes}</p>`;
      } else if (type === 'transport') {
        if (props.public_transport === 'stop_position') {
          popupContent += `<h3>Transit Stop</h3>`;
          if (props.name) popupContent += `<p><strong>Name:</strong> ${props.name}</p>`;
          if (props.ref) popupContent += `<p><strong>Reference:</strong> ${props.ref}</p>`;
          
          // Add button to show schedules
          if (props.ref) {
            popupContent += `<button class="schedule-btn" data-stop-id="${props.ref}">Show Schedules</button>`;
          }
        } else {
          popupContent += `<h3>Transport Route</h3>`;
          if (props.name) popupContent += `<p><strong>Line:</strong> ${props.name}</p>`;
          if (props.route_type) popupContent += `<p><strong>Type:</strong> ${props.route_type}</p>`;
        }
      }
      
      popupContent += '</div>';
      layer.bindPopup(popupContent);
      
      // Add click event for stops to fetch schedules
      if (type === 'transport' && props.public_transport === 'stop_position' && props.ref && onStopClick) {
        layer.on('click', () => {
          onStopClick(props.ref);
        });
      }
    }
  };
  
  // Pause rendering during map move for better performance
  useEffect(() => {
    if (!geoJsonRef.current) return;
    
    const onMoveStart = () => {
      if (geoJsonRef.current && geoJsonRef.current.leafletElement) {
        geoJsonRef.current.leafletElement.options.renderer = L.svg({ padding: 0.5 });
      }
    };
    
    const onMoveEnd = () => {
      if (geoJsonRef.current && geoJsonRef.current.leafletElement) {
        geoJsonRef.current.leafletElement.options.renderer = L.canvas({ padding: 0.5 });
        geoJsonRef.current.leafletElement.redraw();
      }
    };
    
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    
    return () => {
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
    };
  }, [map]);

  if (!optimizedData) return null;

  return (
    <GeoJSON 
      data={optimizedData}
      style={(feature) => feature.geometry.type === 'Point' ? null : getRouteStyle(feature)}
      pointToLayer={(feature, latlng) => {
        return L.circleMarker(latlng, getPointStyle(feature));
      }}
      onEachFeature={onEachFeature}
      ref={geoJsonRef}
      renderer={L.canvas({ padding: 0.5 })} // Use canvas renderer for better performance
    />
  );
}

export default GeojsonLayer;
