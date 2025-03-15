import React from 'react';
import { useUserPoints } from '../contexts/UserPointsContext';
import './LevelProgressBar.css';

const LevelProgressBar = () => {
  const { points, levelInfo, resetPoints } = useUserPoints();
  
  return (
    <div className="level-progress-container">
      <div className="level-header">
        <div className="level-info">
          <h3>Niveau {levelInfo.level}: {levelInfo.title}</h3>
          <p className="points-total">{points} points</p>
        </div>
        <button onClick={resetPoints} className="reset-points-btn" title="Réinitialiser les points">
          <i className="fa fa-undo"></i>
        </button>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${levelInfo.progress}%` }}
        ></div>
      </div>
      
      {levelInfo.pointsForNextLevel && (
        <div className="next-level-minimal">
          {points} / {levelInfo.pointsForNextLevel}
        </div>
      )}
      
      <div className="pizza-points-note">
        1 pizza = 10 points
      </div>
    </div>
  );
};

export default LevelProgressBar;
