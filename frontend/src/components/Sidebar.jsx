import React, { useState } from 'react';
import './Sidebar.css';

function Sidebar({ onFilterChange }) {
  const [routeTypes, setRouteTypes] = useState([]);
  const [transportTypes, setTransportTypes] = useState([]);
  const [maxSpeed, setMaxSpeed] = useState(null);

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

  return (
    <div className="sidebar">
      <h2>Filters</h2>
      
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
  );
}

export default Sidebar;
