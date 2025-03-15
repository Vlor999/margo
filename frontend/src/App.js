import React, { useState, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import { UserPointsProvider } from './contexts/UserPointsContext';

function App() {
  const [filters, setFilters] = useState({
    routeTypes: [],
    transportTypes: [],
    maxSpeed: null
  });
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showBackgroundRoutes, setShowBackgroundRoutes] = useState(true);
  const [showPizzaPoint, setShowPizzaPoint] = useState(true);
  const [mapLayer, setMapLayer] = useState('standard');

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
    <UserPointsProvider>
      <div className={`App ${darkMode ? 'dark-mode' : 'light-mode'}`}>
        <header className="App-header">
          <div className="header-left">
            <button className="sidebar-toggle" onClick={toggleSidebar}>
              <i className="fa fa-bars"></i>
            </button>
            <h1>Found Your Pizza</h1>
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
            showPizzaPoint={showPizzaPoint}
            mapLayer={mapLayer}
          />
          
          {/* Sidebar avec classe conditionnelle */}
          <Sidebar 
            onFilterChange={handleFilterChange} 
            routeDetails={optimizedRoute} 
            setOptimizedRoute={setOptimizedRoute}
            isVisible={sidebarVisible}
            className={!sidebarVisible ? 'hidden' : ''}
          />
          
          {/* Contrôles du bas avec la même animation que la sidebar */}
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
            <button 
              className={`control-btn ${showPizzaPoint ? 'active' : ''}`} 
              onClick={() => setShowPizzaPoint(!showPizzaPoint)}
              title={showPizzaPoint ? "Hide pizza challenge" : "Show pizza challenge"}
            >
              <i className="fa fa-pizza-slice"></i>
            </button>
          </div>
        </div>
      </div>
    </UserPointsProvider>
  );
}

export default App;
