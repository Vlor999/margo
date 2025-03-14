import React from 'react';
import './TransportInfo.css';

function TransportInfo({ stopInfo, onClose }) {
  if (!stopInfo) return null;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="transport-info-container">
      <div className="transport-info-header">
        <h2>Stop {stopInfo.id} Schedules</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="transport-info-content">
        {stopInfo.schedules && stopInfo.schedules.length > 0 ? (
          <div>
            <table className="schedules-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Direction</th>
                  <th>Next Arrival</th>
                  <th>Following Arrival</th>
                </tr>
              </thead>
              <tbody>
                {stopInfo.schedules.map((schedule, index) => (
                  <tr key={index}>
                    <td>{schedule.line || 'N/A'}</td>
                    <td>{schedule.direction || 'N/A'}</td>
                    <td>{formatTime(schedule.nextArrival)}</td>
                    <td>{formatTime(schedule.followingArrival)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No schedule information available for this stop.</p>
        )}
      </div>
    </div>
  );
}

export default TransportInfo;
