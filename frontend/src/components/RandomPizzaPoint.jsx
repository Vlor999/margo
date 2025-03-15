import React, { useState, useEffect, useCallback } from 'react';
import { Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { useUserPoints } from '../contexts/UserPointsContext';
import './RandomPizzaPoint.css';

// Pizza icon
const pizzaIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Trophy icon for collected pizzas
const trophyIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "Expiré";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Location watcher component
function LocationWatcher({ pizzaPoint, onProximity }) {
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [watching, setWatching] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const map = useMap();

  useEffect(() => {
    let watchId = null;
    
    if (pizzaPoint) {
      // Start watching position
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          
          setUserLocation({ lat: userLat, lng: userLng });
          setWatching(true);
          setPermissionRequested(true);
          
          // Calculate distance to pizza point
          if (pizzaPoint) {
            const dist = calculateDistance(
              userLat, userLng,
              pizzaPoint.lat, pizzaPoint.lng
            );
            setDistance(dist);
            
            // Check if user is close enough
            if (dist <= 10) { // 10 meters
              onProximity(pizzaPoint);
            }
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setWatching(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [pizzaPoint, onProximity]);

  return (
    <>
      {userLocation && (
        <>
          <Marker 
            position={[userLocation.lat, userLocation.lng]} 
            icon={new L.Icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/411/411763.png',
              iconSize: [30, 30],
              iconAnchor: [15, 30],
              popupAnchor: [0, -30]
            })}
          >
            <Popup>
              <div className="user-location-popup">
                <h3>Votre position</h3>
                {distance !== null && (
                  <p>Distance de la pizza: <strong>{distance.toFixed(1)} mètres</strong></p>
                )}
                {distance !== null && distance <= 10 && (
                  <p className="close-enough">Vous êtes assez proche pour collecter la pizza!</p>
                )}
              </div>
            </Popup>
          </Marker>
          
          {/* Accuracy circle */}
          <Circle 
            center={[userLocation.lat, userLocation.lng]}
            radius={10} // 10 meters collection radius
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />
        </>
      )}
      
      {!watching && !permissionRequested && (
        <div className="location-permission-overlay">
          <button onClick={() => {
            navigator.geolocation.getCurrentPosition(
              () => setPermissionRequested(true),
              () => {}
            );
          }}>
            Autoriser la localisation pour jouer
          </button>
        </div>
      )}
    </>
  );
}

function RandomPizzaPoint({ setOptimizedRoute }) {
  const [pizzaPoint, setPizzaPoint] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collected, setCollected] = useState(false);
  const [transportMode, setTransportMode] = useState('walking');
  const { collectPizza, pizzaHistory } = useUserPoints();
  
  const fetchRandomPoint = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/random-point');
      setPizzaPoint(response.data.point);
      setRemainingTime(response.data.remainingTime);
      
      // Check if this pizza has already been collected
      const isCollected = pizzaHistory.some(
        pizza => pizza.lat === response.data.point.lat && pizza.lng === response.data.point.lng
      );
      setCollected(isCollected);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching random point:', error);
      setLoading(false);
    }
  }, [pizzaHistory]);

  useEffect(() => {
    // Initial fetch
    fetchRandomPoint();
    
    // Set up interval to update remaining time
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Time expired, fetch new point
          fetchRandomPoint();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Set up interval to check for new point every minute
    const checkInterval = setInterval(() => {
      fetchRandomPoint();
    }, 60000);
    
    return () => {
      clearInterval(timer);
      clearInterval(checkInterval);
    };
  }, [fetchRandomPoint]);

  const handleProximity = useCallback((point) => {
    const success = collectPizza(point);
    if (success) {
      setCollected(true);
      // Show a notification
      const notification = document.createElement('div');
      notification.className = 'popup-notification';
      notification.innerHTML = `
        <h3>🎉 Pizza collectée! 🎉</h3>
        <p>+10 points ajoutés à votre score!</p>
      `;
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }
  }, [collectPizza]);

  const handleNavigateToPizza = () => {
    // Obtenir la position de l'utilisateur
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Calculer un itinéraire vers la pizza avec le mode de transport choisi
          axios.get('/api/optimize', {
            params: {
              start_lat: latitude,
              start_lng: longitude,
              end_lat: pizzaPoint.lat,
              end_lng: pizzaPoint.lng,
              transport_mode: transportMode // Utiliser le mode de transport choisi
            }
          })
          .then(response => {
            // Définir l'itinéraire optimisé
            setOptimizedRoute(response.data);
          })
          .catch(error => {
            console.error('Erreur lors du calcul de l\'itinéraire vers la pizza:', error);
            // Afficher une notification d'erreur
            const notification = document.createElement('div');
            notification.className = 'popup-notification';
            notification.innerHTML = `
              <h3>❌ Erreur</h3>
              <p>Impossible de calculer l'itinéraire vers la pizza</p>
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 3000);
          });
        },
        (error) => {
          console.error('Erreur lors de l\'obtention de la position:', error);
        }
      );
    }
  };

  const handleTransportModeChange = (e) => {
    setTransportMode(e.target.value);
  };

  if (loading || !pizzaPoint) return null;

  return (
    <>
      <Marker 
        position={[pizzaPoint.lat, pizzaPoint.lng]} 
        icon={collected ? trophyIcon : pizzaIcon}
      >
        <Popup>
          <div className="pizza-popup">
            <h3>🍕 Pizza Time! 🍕</h3>
            {collected ? (
              <>
                <p><strong>Félicitations!</strong> Vous avez déjà collecté cette pizza.</p>
                <p>Une nouvelle pizza apparaîtra dans <strong>{formatTimeRemaining(remainingTime)}</strong></p>
              </>
            ) : (
              <>
                <p>Dépêchez-vous d'atteindre ce point pour collecter des points!</p>
                <p>Temps restant: <strong>{formatTimeRemaining(remainingTime)}</strong></p>
                
                {/* Sélecteur de mode de transport */}
                <select 
                  className="transport-mode-select"
                  value={transportMode}
                  onChange={handleTransportModeChange}
                >
                  <option value="walking">🚶‍♂️ À pied</option>
                  <option value="cycling">🚲 Vélo</option>
                  <option value="driving">🚗 Voiture</option>
                  <option value="transit">🚌 Transports</option>
                </select>
                
                <button
                  className="navigate-to-pizza-btn"
                  onClick={handleNavigateToPizza}
                >
                  Naviguer vers la pizza 🧭
                </button>
              </>
            )}
            <div className="timer-bar">
              <div 
                className="timer-progress" 
                style={{ width: `${(remainingTime / (30 * 60)) * 100}%` }}
              ></div>
            </div>
          </div>
        </Popup>
      </Marker>
      
      <LocationWatcher 
        pizzaPoint={pizzaPoint} 
        onProximity={handleProximity}
      />
    </>
  );
}

export default RandomPizzaPoint;
