import React, { useState, useEffect, useRef } from 'react';
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
  
  // Nouveaux états pour les suggestions d'adresses
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Références pour gérer le clic en dehors des suggestions
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const startSuggestionsRef = useRef(null);
  const endSuggestionsRef = useRef(null);

  // Délai pour la recherche d'adresses
  const debounceTimeoutRef = useRef(null);

  // Effet pour gérer les clics en dehors des suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (startInputRef.current && !startInputRef.current.contains(event.target) && 
          startSuggestionsRef.current && !startSuggestionsRef.current.contains(event.target)) {
        setShowStartSuggestions(false);
      }
      if (endInputRef.current && !endInputRef.current.contains(event.target) && 
          endSuggestionsRef.current && !endSuggestionsRef.current.contains(event.target)) {
        setShowEndSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fonction pour obtenir des suggestions d'adresses
  const fetchAddressSuggestions = async (query, isStart) => {
    if (query.length < 3) {
      isStart ? setStartSuggestions([]) : setEndSuggestions([]);
      isStart ? setShowStartSuggestions(false) : setShowEndSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      // Utilisation de l'API Nominatim avec restriction sur la région de Grenoble
      const params = {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 5,
        viewbox: '5.6,45.1,5.8,45.3',
        bounded: 1,
      };
      
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params,
        headers: { 'User-Agent': 'GrenobleTransportApp/1.0' }
      });
      
      const suggestions = response.data.map(item => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
      
      if (isStart) {
        setStartSuggestions(suggestions);
        setShowStartSuggestions(true);
      } else {
        setEndSuggestions(suggestions);
        setShowEndSuggestions(true);
      }
      setActiveSuggestionIndex(0);
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Fonction pour traiter les changements dans les champs d'adresse avec délai
  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setAddressInput(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear previous debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new debounce timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (name === 'startAddress') {
        fetchAddressSuggestions(value, true);
      } else if (name === 'endAddress') {
        fetchAddressSuggestions(value, false);
      }
    }, 500); // 500ms delay
  };

  // Fonction pour sélectionner une suggestion
  const selectSuggestion = (suggestion, isStart) => {
    if (isStart) {
      setAddressInput(prev => ({ ...prev, startAddress: suggestion.address }));
      setShowStartSuggestions(false);
    } else {
      setAddressInput(prev => ({ ...prev, endAddress: suggestion.address }));
      setShowEndSuggestions(false);
    }
  };

  // Gestion des touches pour navigation dans les suggestions
  const handleKeyDown = (e, isStart) => {
    const suggestions = isStart ? startSuggestions : endSuggestions;
    
    // Si pas de suggestions ou suggestions pas affichées, ne rien faire
    if (!suggestions.length || !(isStart ? showStartSuggestions : showEndSuggestions)) {
      return;
    }
    
    // Flèche bas
    if (e.keyCode === 40) {
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    }
    // Flèche haut
    else if (e.keyCode === 38) {
      setActiveSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : 0
      );
    }
    // Entrée
    else if (e.keyCode === 13) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex], isStart);
    }
    // Échap
    else if (e.keyCode === 27) {
      isStart ? setShowStartSuggestions(false) : setShowEndSuggestions(false);
    }
  };

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
            
            <div className="form-group address-input-group">
              <label>Point de départ:</label>
              <div className="autocomplete-container">
                <input 
                  type="text" 
                  name="startAddress" 
                  value={addressInput.startAddress} 
                  onChange={handleAddressInputChange} 
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  onClick={() => setShowStartSuggestions(true)}
                  placeholder="Adresse de départ"
                  ref={startInputRef}
                />
                {showStartSuggestions && startSuggestions.length > 0 && (
                  <div className="suggestions-list" ref={startSuggestionsRef}>
                    {startSuggestions.map((suggestion, index) => (
                      <div 
                        key={index} 
                        className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                        onClick={() => selectSuggestion(suggestion, true)}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                      >
                        {suggestion.address}
                      </div>
                    ))}
                  </div>
                )}
                {isLoadingSuggestions && showStartSuggestions && (
                  <div className="suggestions-loading">Recherche...</div>
                )}
              </div>
            </div>
            
            <div className="form-group address-input-group">
              <label>Destination:</label>
              <div className="autocomplete-container">
                <input 
                  type="text" 
                  name="endAddress" 
                  value={addressInput.endAddress} 
                  onChange={handleAddressInputChange}
                  onKeyDown={(e) => handleKeyDown(e, false)}
                  onClick={() => setShowEndSuggestions(true)}
                  placeholder="Adresse de destination"
                  ref={endInputRef}
                />
                {showEndSuggestions && endSuggestions.length > 0 && (
                  <div className="suggestions-list" ref={endSuggestionsRef}>
                    {endSuggestions.map((suggestion, index) => (
                      <div 
                        key={index} 
                        className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                        onClick={() => selectSuggestion(suggestion, false)}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                      >
                        {suggestion.address}
                      </div>
                    ))}
                  </div>
                )}
                {isLoadingSuggestions && showEndSuggestions && (
                  <div className="suggestions-loading">Recherche...</div>
                )}
              </div>
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
