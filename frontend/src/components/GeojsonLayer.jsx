import React from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';

function GeojsonLayer({ data, type, filters, onStopClick }) {
  const getRouteStyle = (feature) => {
    const properties = feature.properties || {};
    
    // Default style
    let style = {
      color: '#3388ff',
      weight: 2,
      opacity: 0.7
    };
    
    // Route type styles
    if (type === 'route') {
      const highway = properties.highway;
      
      if (highway === 'footway' || highway === 'path' || highway === 'pedestrian') {
        style.color = '#8B4513'; // Brown for pedestrian paths
        style.weight = 1;
      } else if (highway === 'cycleway') {
        style.color = '#006400'; // Dark green for bicycle paths
        style.dashArray = '5, 5';
      } else if (highway === 'primary') {
        style.color = '#FF0000'; // Red for primary roads
        style.weight = 3;
      } else if (highway === 'secondary') {
        style.color = '#FFA500'; // Orange for secondary roads
        style.weight = 2;
      } else if (highway === 'residential') {
        style.color = '#808080'; // Gray for residential roads
      }
    } 
    // Transport type styles
    else if (type === 'transport') {
      const routeType = properties.route_type;
      
      if (routeType === 'tram') {
        style.color = '#00BFFF'; // Blue for tram routes
        style.weight = 4;
      } else if (routeType === 'bus') {
        style.color = '#32CD32'; // Green for bus routes
        style.weight = 3;
      } else if (routeType === 'subway') {
        style.color = '#800080'; // Purple for subway
        style.weight = 4;
      }
    }
    
    return style;
  };

  const getPointStyle = (feature) => {
    const properties = feature.properties || {};
    
    // Default style for points
    let style = {
      radius: 6,
      fillColor: "#3388ff",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    };
    
    // Style based on point type
    if (properties.public_transport === 'stop_position') {
      if (properties.bus === 'yes') {
        style.fillColor = '#32CD32'; // Green for bus stops
      } else if (properties.tram === 'yes') {
        style.fillColor = '#00BFFF'; // Blue for tram stops
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

  return (
    <GeoJSON 
      data={data}
      style={(feature) => feature.geometry.type === 'Point' ? null : getRouteStyle(feature)}
      pointToLayer={(feature, latlng) => {
        return L.circleMarker(latlng, getPointStyle(feature));
      }}
      onEachFeature={onEachFeature}
    />
  );
}

export default GeojsonLayer;
