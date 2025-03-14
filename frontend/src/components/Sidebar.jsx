import React, { useState } from 'react';
import axios from 'axios';
import './Sidebar.css';

function Sidebar({ onFilterChange, routeDetails, setOptimizedRoute }) {
  const [activeTab, setActiveTab] = useState('route'); // 'route' or 'filters'
  const [routeTypes, setRouteTypes] = useState([]);
  const [transportTypes, setTransportTypes] = useState([]);
  const [maxSpeed, setMaxSpeed] = useState(null);
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
  const [error, setError] = useState(null);

  const handleRouteTypeChange = (e) => {
    const value = e.target.value;
    if (e.target.checked) {
      setRouteTypes([...routeTypes, value]);
    } else {
      setRouteTypes(routeTypes.filter(type => type !== value));
    }
  };

  const handleTransportTypeChange = (e) => {
    const value = e.target.value;
    if (e.target.checked) {
      setTransportTypes([...transportTypes, value]);
    } else {
      setTransportTypes(transportTypes.filter(type => type !== value));
    }
  };

  const handleMaxSpeedChange = (e) => {
    const value = e.target.value;
    setMaxSpeed(value === '' ? null : parseInt(value, 10));
  };

  const applyFilters = () => {
    onFilterChange({
      routeTypes,
      transportTypes,
      maxSpeed
    });
  };

  const resetFilters = () => {
    setRouteTypes([]);
    setTransportTypes([]);
    setMaxSpeed(null);
    onFilterChange({
      routeTypes: [],
      transportTypes: [],
      maxSpeed: null
    });
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

  const toggleRouteInputType = (type) => {
    setRouteInputType(type);
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
  };

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <div 
          className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => setActiveTab('route')}
        >
          Route Planner
        </div>
        <div 
          className={`sidebar-tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Map Filters
        </div>
      </div>
      
      <div className="sidebar-content">
        {/* Route Planner Tab */}
        <div className={`tab-content ${activeTab === 'route' ? 'active' : ''}`}>
          <div className="route-optimizer">
            <h3>Plan Your Journey</h3>
            
            <div className="input-type-toggle">
              <button 
                className={`toggle-btn ${routeInputType === 'address' ? 'active' : ''}`} 
                onClick={() => toggleRouteInputType('address')}
              >
                Address
              </button>
              <button 
                className={`toggle-btn ${routeInputType === 'coordinates' ? 'active' : ''}`} 
                onClick={() => toggleRouteInputType('coordinates')}
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
            
            <div className="form-group transport-mode-group">
              <label>Transport Mode:</label>
              <select name="transportMode" value={transportMode} onChange={handleTransportModeChange} className="transport-select">
                <option value="walking">🚶‍♂️ Walking</option>
                <option value="cycling">🚲 Cycling</option>
                <option value="driving">🚗 Driving</option>
                <option value="transit">🚌 Public Transit</option>
              </select>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={generateRoute} 
                disabled={isCalculating}
                className={isCalculating ? 'calculating' : ''}
              >
                {isCalculating ? 'Calculating...' : 'Find Route'}
              </button>
              
              {routeDetails && (
                <button 
                  type="button" 
                  onClick={resetRoute} 
                  className="reset-route-btn"
                >
                  Clear Route
                </button>
              )}
            </div>
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        
        {/* Map Filters Tab */}
        <div className={`tab-content ${activeTab === 'filters' ? 'active' : ''}`}>
          <div className="filter-section">
            <h3>Road Types</h3>
            <div className="filter-options">
              <label>
                <input 
                  type="checkbox" 
                  value="primary" 
                  checked={routeTypes.includes('primary')}
                  onChange={handleRouteTypeChange} 
                />
                Main Roads
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="secondary" 
                  checked={routeTypes.includes('secondary')}
                  onChange={handleRouteTypeChange} 
                />
                Secondary Roads
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="residential" 
                  checked={routeTypes.includes('residential')}
                  onChange={handleRouteTypeChange} 
                />
                Residential Streets
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="cycleway" 
                  checked={routeTypes.includes('cycleway')}
                  onChange={handleRouteTypeChange} 
                />
                Bicycle Paths
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="footway" 
                  checked={routeTypes.includes('footway')}
                  onChange={handleRouteTypeChange} 
                />
                Pedestrian Paths
              </label>
            </div>
          </div>
          
          <div className="filter-section">
            <h3>Transport Types</h3>
            <div className="filter-options">
              <label>
                <input 
                  type="checkbox" 
                  value="tram" 
                  checked={transportTypes.includes('tram')}
                  onChange={handleTransportTypeChange} 
                />
                Trams
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="bus" 
                  checked={transportTypes.includes('bus')}
                  onChange={handleTransportTypeChange} 
                />
                Buses
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="subway" 
                  checked={transportTypes.includes('subway')}
                  onChange={handleTransportTypeChange} 
                />
                Subway
              </label>
            </div>
          </div>
          
          <div className="filter-section">
            <h3>Speed Limit</h3>
            <div className="filter-options">
              <label>
                Max Speed (km/h):
                <input 
                  type="number" 
                  value={maxSpeed || ''} 
                  onChange={handleMaxSpeedChange} 
                  min="0" 
                  max="130"
                />
              </label>
            </div>
          </div>
          
          <div className="filter-actions">
            <button className="apply-btn" onClick={applyFilters}>Apply Filters</button>
            <button className="reset-btn" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
