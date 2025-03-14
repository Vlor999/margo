import React from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';

function App() {
  const [filters, setFilters] = React.useState({
    routeTypes: [],
    transportTypes: [],
    maxSpeed: null
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Grenoble Transport Map</h1>
      </header>
      <div className="App-content">
        <Sidebar onFilterChange={handleFilterChange} />
        <MapComponent filters={filters} />
      </div>
    </div>
  );
}

export default App;
