import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
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
  const [locationInput, setLocationInput] = useState({
    startLat: 45.188529,
    startLng: 5.724524,
    endLat: 45.191676,
    endLng: 5.730119
  });
  const [transportMode, setTransportMode] = useState('walking');
  const [routeInputType, setRouteInputType] = useState('address'); // 'address' or 'coordinates'
  const [addressInput, setAddressInput] = useState({
    startAddress: 'Gare de Grenoble',
    endAddress: 'Maison de la Montagne, Grenoble'
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [showBackgroundRoutes, setShowBackgroundRoutes] = useState(true);

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

  const handleLocationInputChange = (e) => {
    const { name, value } = e.target;
    setLocationInput({
      ...locationInput,
      [name]: parseFloat(value)
    });
  };

  const handleTransportModeChange = (e) => {
    setTransportMode(e.target.value);
  };

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setAddressInput({
      ...addressInput,
      [name]: value
    });
  };

  const toggleRouteInputType = () => {
    setRouteInputType(routeInputType === 'address' ? 'coordinates' : 'address');
  };

  const generateRoute = () => {
    setIsCalculating(true);
    setError(null);
    
    let params = {
      transport_mode: transportMode
    };
    
    if (routeInputType === 'coordinates') {
      params = {
        ...params,
        start_lat: locationInput.startLat,
        start_lng: locationInput.startLng,
        end_lat: locationInput.endLat,
        end_lng: locationInput.endLng
      };
    } else {
      params = {
        ...params,
        start_address: addressInput.startAddress,
        end_address: addressInput.endAddress
      };
    }
    
    axios.get('/api/optimize', { params })
      .then(response => {
        setOptimizedRoute(response.data);
        setShowBackgroundRoutes(false); // Hide background routes when showing the path
      })
      .catch(error => {
        console.error('Error optimizing route:', error);
        setError(error.response?.data?.detail || 'Failed to optimize route');
      })
      .finally(() => {
        setIsCalculating(false);
      });
  };

  const resetRoute = () => {
    setOptimizedRoute(null);
    setShowBackgroundRoutes(true);
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
            
            {/* Only show background routes when not showing a specific route */}
            {showBackgroundRoutes && routesData && (
                <GeojsonLayer 
                    data={routesData} 
                    type="route" 
                    filters={filters}
                />
            )}
            
            {/* Only show transport routes when not showing a specific route */}
            {showBackgroundRoutes && transportData && (
                <GeojsonLayer 
                    data={transportData} 
                    type="transport" 
                    filters={filters}
                    onStopClick={handleStopClick}
                />
            )}
            
            {/* The optimized route will be shown regardless */}
            {optimizedRoute && (
                <OptimizeRoute route={optimizedRoute} simplified={true} />
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
            <div className="input-type-toggle">
                <button 
                    className={`toggle-btn ${routeInputType === 'address' ? 'active' : ''}`} 
                    onClick={toggleRouteInputType}
                >
                    Address
                </button>
                <button 
                    className={`toggle-btn ${routeInputType === 'coordinates' ? 'active' : ''}`} 
                    onClick={toggleRouteInputType}
                >
                    Coordinates
                </button>
            </div>
            
            {routeInputType === 'address' ? (
                <>
                    <div className="form-group">
                        <label>Start Address:</label>
                        <input 
                            type="text" 
                            name="startAddress" 
                            value={addressInput.startAddress} 
                            onChange={handleAddressInputChange} 
                            placeholder="Enter start address"
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>End Address:</label>
                        <input 
                            type="text" 
                            name="endAddress" 
                            value={addressInput.endAddress} 
                            onChange={handleAddressInputChange} 
                            placeholder="Enter destination address"
                            required 
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="form-group">
                        <label>Start Point:</label>
                        <input 
                            type="number" 
                            name="startLat" 
                            value={locationInput.startLat} 
                            onChange={handleLocationInputChange} 
                            placeholder="Latitude" 
                            step="0.000001" 
                            required 
                        />
                        <input 
                            type="number" 
                            name="startLng" 
                            value={locationInput.startLng} 
                            onChange={handleLocationInputChange} 
                            placeholder="Longitude" 
                            step="0.000001" 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>End Point:</label>
                        <input 
                            type="number" 
                            name="endLat" 
                            value={locationInput.endLat} 
                            onChange={handleLocationInputChange} 
                            placeholder="Latitude" 
                            step="0.000001" 
                            required 
                        />
                        <input 
                            type="number" 
                            name="endLng" 
                            value={locationInput.endLng} 
                            onChange={handleLocationInputChange} 
                            placeholder="Longitude" 
                            step="0.000001" 
                            required 
                        />
                    </div>
                </>
            )}
            
            <div className="form-group">
                <label>Transport Mode:</label>
                <select name="transportMode" value={transportMode} onChange={handleTransportModeChange}>
                    <option value="walking">Walking</option>
                    <option value="cycling">Cycling</option>
                    <option value="driving">Driving</option>
                    <option value="transit">Public Transit</option>
                </select>
            </div>
            
            <button 
                type="button" 
                onClick={generateRoute} 
                disabled={isCalculating}
                className={isCalculating ? 'calculating' : ''}
            >
                {isCalculating ? 'Calculating...' : 'Find Route'}
            </button>
            
            {optimizedRoute && (
                <button 
                    type="button" 
                    onClick={resetRoute} 
                    className="reset-route-btn"
                >
                    Clear Route
                </button>
            )}
            
            {error && <div className="error-message">{error}</div>}
        </div>
    </div>
);
}

export default MapComponent;
