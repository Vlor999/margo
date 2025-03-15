import React, { useState } from 'react';
import axios from 'axios';
import './Sidebar.css';
import LevelProgressBar from './LevelProgressBar';

function Sidebar({ onFilterChange, routeDetails, setOptimizedRoute, isVisible = true, className = '' }) {
  const [activeTab, setActiveTab] = useState('route');
  const [routeTypes, setRouteTypes] = useState([]);
  const [transportTypes, setTransportTypes] = useState([]);
  const [maxSpeed, setMaxSpeed] = useState(null);
  const [transportMode, setTransportMode] = useState('walking');
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

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setAddressInput({
      ...addressInput,
      [name]: value
    });
  };

  const generateRoute = () => {
    setIsCalculating(true);
    setError(null);
    
    const params = {
      transport_mode: transportMode,
      start_address: addressInput.startAddress,
      end_address: addressInput.endAddress
    };
    
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
    <div className={`sidebar ${className}`}>
      {/* Barre de niveau toujours visible en haut */}
      <div className="sidebar-header">
        <LevelProgressBar />
      </div>
      
      <div className="sidebar-tabs">
        <div 
          className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => setActiveTab('route')}
        >
          Itinéraire
        </div>
        <div 
          className={`sidebar-tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Filtres
        </div>
      </div>
      
      <div className="sidebar-content">
        {/* Route Planner Tab - Version simplifiée */}
        <div className={`tab-content ${activeTab === 'route' ? 'active' : ''}`}>
          <div className="route-optimizer">
            <h3>Planifiez votre trajet</h3>
            
            <div className="form-group">
              <label>Point de départ:</label>
              <input 
                type="text" 
                name="startAddress" 
                value={addressInput.startAddress} 
                onChange={handleAddressInputChange} 
                placeholder="Adresse de départ"
              />
            </div>
            
            <div className="form-group">
              <label>Destination:</label>
              <input 
                type="text" 
                name="endAddress" 
                value={addressInput.endAddress} 
                onChange={handleAddressInputChange} 
                placeholder="Adresse de destination"
              />
            </div>
            
            <div className="form-group transport-mode-group">
              <label>Mode de transport:</label>
              <select 
                name="transportMode" 
                value={transportMode} 
                onChange={(e) => setTransportMode(e.target.value)} 
                className="transport-select"
              >
                <option value="walking">🚶‍♂️ À pied</option>
                <option value="cycling">🚲 Vélo</option>
                <option value="driving">🚗 Voiture</option>
                <option value="transit">🚌 Transports</option>
              </select>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={generateRoute} 
                disabled={isCalculating}
                className={isCalculating ? 'calculating' : ''}
              >
                {isCalculating ? 'Calcul...' : 'Trouver un itinéraire'}
              </button>
              
              {routeDetails && (
                <button 
                  type="button" 
                  onClick={resetRoute} 
                  className="reset-route-btn"
                >
                  Effacer l'itinéraire
                </button>
              )}
            </div>
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        
        {/* Map Filters Tab - Version simplifiée */}
        <div className={`tab-content ${activeTab === 'filters' ? 'active' : ''}`}>
          <div className="filter-section">
            <h3>Types de routes</h3>
            <div className="filter-options compact">
              <label>
                <input 
                  type="checkbox" 
                  value="primary" 
                  checked={routeTypes.includes('primary')}
                  onChange={handleRouteTypeChange} 
                />
                Routes principales
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="cycleway" 
                  checked={routeTypes.includes('cycleway')}
                  onChange={handleRouteTypeChange} 
                />
                Pistes cyclables
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value="footway" 
                  checked={routeTypes.includes('footway')}
                  onChange={handleRouteTypeChange} 
                />
                Chemins piétons
              </label>
            </div>
          </div>
          
          <div className="filter-section">
            <h3>Transports</h3>
            <div className="filter-options compact">
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
                Bus
              </label>
            </div>
            
            <div className="filter-actions">
              <button className="apply-btn" onClick={applyFilters}>Appliquer</button>
              <button className="reset-btn" onClick={resetFilters}>Réinitialiser</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
