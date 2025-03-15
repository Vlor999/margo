import React, { useState, useEffect } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// User position icon
const userIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/411/411763.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

function UserLocationMarker() {
  const [userPosition, setUserPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let watchId = null;
    
    // Function to handle successfully getting position
    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setUserPosition({
        lat: latitude,
        lng: longitude,
        accuracy
      });
    };
    
    // Function to handle errors
    const handleError = (error) => {
      setError(error.message);
      console.error("Error getting user location:", error);
    };
    
    // Options for geolocation
    const options = {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 5000
    };
    
    // Watch position
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        options
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }
    
    // Cleanup function
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  if (!userPosition) return null;

  return (
    <>
      <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
        <Popup>
          <div className="user-location-popup">
            <h3>Votre position</h3>
            <p>Précision: {Math.round(userPosition.accuracy)} mètres</p>
          </div>
        </Popup>
      </Marker>
      <Circle 
        center={[userPosition.lat, userPosition.lng]} 
        radius={userPosition.accuracy} 
        pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
      />
    </>
  );
}

export default UserLocationMarker;
