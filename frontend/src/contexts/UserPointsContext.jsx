import React, { createContext, useState, useContext, useEffect } from 'react';

// Constantes pour le système de niveaux
const POINTS_PER_PIZZA = 10;
const LEVELS = [
  { level: 1, pointsNeeded: 0, title: "Débutant" },
  { level: 2, pointsNeeded: 20, title: "Amateur de pizza" },
  { level: 3, pointsNeeded: 50, title: "Chasseur de pizza" },
  { level: 4, pointsNeeded: 100, title: "Maître pizzaiolo" },
  { level: 5, pointsNeeded: 200, title: "Légende de la pizza" }
];

// Créer le contexte
export const UserPointsContext = createContext();

// Hook personnalisé pour utiliser le contexte des points
export const useUserPoints = () => useContext(UserPointsContext);

// Provider du contexte
export const UserPointsProvider = ({ children }) => {
  // Récupérer les points sauvegardés dans le localStorage
  const [points, setPoints] = useState(() => {
    const savedPoints = localStorage.getItem('userPoints');
    return savedPoints ? parseInt(savedPoints, 10) : 0;
  });
  
  // Informations sur le niveau actuel
  const [levelInfo, setLevelInfo] = useState({ level: 1, title: "Débutant", progress: 0 });
  
  // Historique des pizzas collectées
  const [pizzaHistory, setPizzaHistory] = useState(() => {
    const savedHistory = localStorage.getItem('pizzaHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  // Calculer les informations de niveau en fonction des points
  useEffect(() => {
    // Sauvegarder les points dans le localStorage
    localStorage.setItem('userPoints', points.toString());
    
    // Calculer le niveau actuel
    let currentLevel = LEVELS[0];
    let nextLevel = LEVELS[1];
    
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (points >= LEVELS[i].pointsNeeded) {
        currentLevel = LEVELS[i];
        nextLevel = LEVELS[i + 1] || null;
        break;
      }
    }
    
    // Calculer la progression vers le prochain niveau
    let progress = 100;
    if (nextLevel) {
      const pointsForNextLevel = nextLevel.pointsNeeded - currentLevel.pointsNeeded;
      const currentPointsInLevel = points - currentLevel.pointsNeeded;
      progress = Math.min(Math.floor((currentPointsInLevel / pointsForNextLevel) * 100), 100);
    }
    
    setLevelInfo({
      level: currentLevel.level,
      title: currentLevel.title,
      progress,
      pointsForNextLevel: nextLevel ? nextLevel.pointsNeeded : null
    });
  }, [points]);

  // Sauvegarder l'historique des pizzas
  useEffect(() => {
    localStorage.setItem('pizzaHistory', JSON.stringify(pizzaHistory));
  }, [pizzaHistory]);

  // Fonction pour ajouter des points quand on atteint une pizza
  const collectPizza = (pizzaPoint) => {
    // Vérifier si cette pizza spécifique a déjà été collectée
    const alreadyCollected = pizzaHistory.some(
      pizza => pizza.lat === pizzaPoint.lat && pizza.lng === pizzaPoint.lng
    );
    
    if (!alreadyCollected) {
      setPoints(prev => prev + POINTS_PER_PIZZA);
      setPizzaHistory(prev => [...prev, {
        ...pizzaPoint,
        collectedAt: new Date().toISOString(),
        pointsAwarded: POINTS_PER_PIZZA
      }]);
      
      return true; // La pizza a été collectée avec succès
    }
    
    return false; // La pizza avait déjà été collectée
  };

  // Réinitialiser les points (pour les tests)
  const resetPoints = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser vos points et votre historique ?")) {
      setPoints(0);
      setPizzaHistory([]);
      localStorage.removeItem('userPoints');
      localStorage.removeItem('pizzaHistory');
    }
  };

  return (
    <UserPointsContext.Provider value={{
      points,
      levelInfo,
      pizzaHistory,
      collectPizza,
      resetPoints
    }}>
      {children}
    </UserPointsContext.Provider>
  );
};

