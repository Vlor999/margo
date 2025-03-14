import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import GeojsonLayer from './GeojsonLayer';
import TransportInfo from './TransportInfo';
import OptimizeRoute from './OptimizeRoute';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Grenoble coordinates
const GRENOBLE_CENTER = [45.188529, 5.724524];
const ZOOM_LEVEL = 13;

function MapComponent({ filters }) {
  const [routesData, setRoutesData] = useState(null);
  const [transportData, setTransportData] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch routes data
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

    // Fetch transport data
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

  const handleOptimizeRoute = (start, end, mode) => {
    axios.get('/api/optimize', {
      params: {
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        transport_mode: mode
      }
    }).then(response => {
      setOptimizedRoute(response.data);
    }).catch(error => {
      console.error('Error optimizing route:', error);
      setError('Failed to optimize route');
    });
  };

  if (loading) return <div>Loading map data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="map-container">
      <MapContainer 
        center={GRENOBLE_CENTER} 
        zoom={ZOOM_LEVEL} 
        style={{ height: '80vh', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {routesData && (
          <GeojsonLayer 
            data={routesData} 
            type="route" 
            filters={filters}
          />
        )}
        
        {transportData && (
          <GeojsonLayer 
            data={transportData} 
            type="transport" 
            filters={filters}
            onStopClick={handleStopClick}
          />
        )}
        
        {optimizedRoute && (
          <OptimizeRoute route={optimizedRoute} />
        )}
      </MapContainer>
      
      {selectedStop && (
        <TransportInfo 
          stopInfo={selectedStop} 
          onClose={() => setSelectedStop(null)} 
        />
      )}
      
      <div className="route-optimizer">
        <h3>Route Optimizer</h3>
        <form onSubmit={(e) => {
          e.preventDefault();
          const start = {
            lat: parseFloat(e.target.startLat.value),
            lng: parseFloat(e.target.startLng.value)
          };
          const end = {
            lat: parseFloat(e.target.endLat.value),
            lng: parseFloat(e.target.endLng.value)
          };
          const mode = e.target.transportMode.value;
          handleOptimizeRoute(start, end, mode);
        }}>
          <div className="form-group">
            <label>Start Point:</label>
            <input type="number" name="startLat" placeholder="Latitude" step="0.000001" required />
            <input type="number" name="startLng" placeholder="Longitude" step="0.000001" required />
          </div>
          <div className="form-group">
            <label>End Point:</label>
            <input type="number" name="endLat" placeholder="Latitude" step="0.000001" required />
            <input type="number" name="endLng" placeholder="Longitude" step="0.000001" required />
          </div>
          <div className="form-group">
            <label>Transport Mode:</label>
            <select name="transportMode">
              <option value="walking">Walking</option>
              <option value="cycling">Cycling</option>
              <option value="driving">Driving</option>
              <option value="transit">Public Transit</option>
            </select>
          </div>
          <button type="submit">Find Route</button>
        </form>
      </div>
    </div>
  );
}

export default MapComponent;
