import React, { useState, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';

function App() {
  const [filters, setFilters] = useState({
    routeTypes: [],
    transportTypes: [],
    maxSpeed: null
  });
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showBackgroundRoutes, setShowBackgroundRoutes] = useState(true);;
  const [mapLayer, setMapLayer] = useState('standard');

  // When optimized route changes, hide background routes
  useEffect(() => {
    if (optimizedRoute) {
      setShowBackgroundRoutes(false);
    }
  }, [optimizedRoute]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div className={`App ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      <header className="App-header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <i className="fa fa-bars"></i>
          </button>
          <h1>Grenoble Transport Map</h1>
        </div>
        <div className="header-right">
          <button className="mode-toggle-btn" onClick={toggleDarkMode}>
            {darkMode ? <i className="fa fa-sun"></i> : <i className="fa fa-moon"></i>}
          </button>
        </div>
      </header>
      <div className="App-content">
        <MapComponent 
          filters={filters} 
          optimizedRoute={optimizedRoute}
          setOptimizedRoute={setOptimizedRoute}
          darkMode={darkMode}
          showBackgroundRoutes={showBackgroundRoutes}
          mapLayer={mapLayer}
        />
        
        {sidebarVisible && (
          <Sidebar 
            onFilterChange={handleFilterChange} 
            routeDetails={optimizedRoute} 
            setOptimizedRoute={setOptimizedRoute} 
          />
        )}
        
        {/* Map controls now placed at the bottom next to sidebar, with adjusted class for sidebar visibility */}
        <div className={`bottom-controls ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
          <button 
            className={`control-btn ${mapLayer === 'standard' ? 'active' : ''}`} 
            onClick={() => setMapLayer('standard')}
            title="Standard view"
          >
            <i className="fa fa-map"></i>
          </button>
          <button 
            className={`control-btn ${mapLayer === 'satellite' ? 'active' : ''}`} 
            onClick={() => setMapLayer('satellite')}
            title="Satellite view"
          >
            <i className="fa fa-globe"></i>
          </button>
          <button 
            className={`control-btn ${showBackgroundRoutes ? 'active' : ''}`} 
            onClick={() => setShowBackgroundRoutes(!showBackgroundRoutes)}
            title={showBackgroundRoutes ? "Hide routes" : "Show routes"}
          >
            <i className="fa fa-road"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
