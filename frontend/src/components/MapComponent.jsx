import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import GeojsonLayer from './GeojsonLayer';
import TransportInfo from './TransportInfo';
import OptimizeRoute from './OptimizeRoute';
import RouteDetails from './RouteDetails';
import RandomPizzaPoint from './RandomPizzaPoint';
import UserLocationMarker from './UserLocationMarker'; // Import du nouveau composant
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

function MapEventHandler({ setIsMoving }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMoveStart = () => setIsMoving(true);
    const handleMoveEnd = () => {
      setTimeout(() => setIsMoving(false), 100);
    };
    
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    
    return () => {
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
    };
  }, [map, setIsMoving]);
  
  return null;
}

const GRENOBLE_CENTER = [45.188529, 5.724524];
const ZOOM_LEVEL = 13;

function MapComponent({ 
  filters, 
  optimizedRoute, 
  setOptimizedRoute, 
  darkMode,
  showBackgroundRoutes, 
  mapLayer,
  showPizzaPoint  // Assurez-vous que cette prop est correctement reçue
}) {
  const [routesData, setRoutesData] = useState(null);
  const [transportData, setTransportData] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    const fetchRoutesData = async () => {
      try {
        const params = {};
        if (filters.routeTypes.length > 0) {
          params.route_type = filters.routeTypes.join(',');
        }
        if (filters.maxSpeed) {
          params.max_speed = filters.maxSpeed;
        }

        const response = await axios.get('/api/routes/filter', { params });
        setRoutesData(response.data);
      } catch (error) {
        console.error('Error fetching routes data:', error);
        setError('Failed to load routes data');
      }
    };

    const fetchTransportData = async () => {
      try {
        const response = await axios.get('/api/geojson/transport');
        setTransportData(response.data);
      } catch (error) {
        console.error('Error fetching transport data:', error);
        setError('Failed to load transport data');
      } finally {
        setLoading(false);
      }
    };

    fetchRoutesData();
    fetchTransportData();
  }, [filters]);

  const handleStopClick = async (stopId) => {
    try {
      const response = await axios.get(`/api/mtag/${stopId}`);
      setSelectedStop({
        id: stopId,
        schedules: response.data
      });
    } catch (error) {
      console.error('Error fetching stop schedules:', error);
      setError('Failed to load stop schedules');
    }
  };

  if (loading) return <div className="loading-overlay">Loading map data...</div>;
  if (error) return <div className="error-overlay">Error: {error}</div>;

  return (
    <div className="map-container">
      <MapContainer 
        center={GRENOBLE_CENTER} 
        zoom={ZOOM_LEVEL} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className={darkMode ? 'dark-map' : ''}
        preferCanvas={true}
      >
        <ZoomControl position="bottomright" />
        <MapEventHandler setIsMoving={setIsMoving} />
        
        {mapLayer === 'standard' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={darkMode 
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        
        {/* Ne pas rendre les routes pendant le déplacement de la carte */}
        {!isMoving && showBackgroundRoutes && routesData && (
          <GeojsonLayer 
            data={routesData} 
            type="route" 
            filters={filters}
          />
        )}
        
        {/* Ne pas rendre le transport pendant le déplacement de la carte */}
        {!isMoving && showBackgroundRoutes && transportData && (
          <GeojsonLayer 
            data={transportData} 
            type="transport" 
            filters={filters}
            onStopClick={handleStopClick}
          />
        )}
        
        {/* L'itinéraire optimisé est toujours affiché pour une meilleure expérience utilisateur */}
        {optimizedRoute && (
          <OptimizeRoute route={optimizedRoute} />
        )}
        
        {/* Ajout du composant de position utilisateur */}
        <UserLocationMarker />
        
        {/* Affichage du point pizza si activé, et passage de setOptimizedRoute */}
        {showPizzaPoint && <RandomPizzaPoint setOptimizedRoute={setOptimizedRoute} />}
      </MapContainer>
      
      {/* Info panels */}
      {selectedStop && (
        <TransportInfo 
          stopInfo={selectedStop} 
          onClose={() => setSelectedStop(null)} 
        />
      )}

      {optimizedRoute && (
        <RouteDetails 
          route={optimizedRoute} 
          onClose={() => setOptimizedRoute(null)} 
        />
      )}
    </div>
  );
}

export default MapComponent;
