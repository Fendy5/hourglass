import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface GlassPanelProps {
  timeLeft: number;
  workDuration: number;
  isRunning: boolean;
  isCustomMode: boolean;
  setIsCustomMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleDurationChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleReset: () => void;
  toggleTimer: () => void;
  handleClose: () => void;
  formatTime: (seconds: number) => string;
  workTimeToday: number;
  restTimeToday: number;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  timeLeft,
  workDuration,
  isRunning,
  isCustomMode,
  setIsCustomMode,
  handleDurationChange,
  handleReset,
  toggleTimer,
  handleClose,
  formatTime,
  workTimeToday,
  restTimeToday,
}) => {
  const totalSeconds = workDuration * 60;
  const progressPercent = (timeLeft / totalSeconds) * 100;
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="glass-panel">
      
      <header className="header" onMouseDown={() => getCurrentWindow().startDragging()}>
        <div className="drag-region">
          <h2>Hourglass</h2>
        </div>
        <button
          className="close-btn"
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 1L1 11M1 1L11 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      <div className="timer-container">
        <svg className="progress-ring" width="220" height="220">
          <circle
            className="progress-ring-bg"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="10"
            fill="transparent"
            r={radius}
            cx="110"
            cy="110"
          />
          <circle
            className="progress-ring-fill"
            stroke="url(#gradient)"
            strokeWidth="14"
            fill="transparent"
            r={radius}
            cx="110"
            cy="110"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
            }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
              <stop offset="100%" stopColor="rgba(220,235,255,0.7)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="time-display">
          <span className="time-text">{formatTime(timeLeft)}</span>
          <span className="time-label">{isRunning ? "Focusing" : "Paused"}</span>
        </div>
      </div>

      <div className="actions">
        <button className={`btn-primary ${!isRunning ? 'paused' : ''}`} onClick={toggleTimer}>
          {isRunning ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <button className="btn-secondary" onClick={handleReset}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        </button>
      </div>

      <div className="settings-row">
        <span className="settings-label">Session Duration</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            className="glass-select" 
            value={isCustomMode ? 'custom' : workDuration} 
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setIsCustomMode(true);
              } else {
                setIsCustomMode(false);
                handleDurationChange(e);
              }
            }}
          >
            <option value={5}>5 mins</option>
            <option value={10}>10 mins</option>
            <option value={15}>15 mins</option>
            <option value={20}>20 mins</option>
            <option value={25}>25 mins</option>
            <option value={30}>30 mins</option>
            <option value={40}>40 mins</option>
            <option value={45}>45 mins</option>
            <option value="custom">Custom</option>
          </select>
          {isCustomMode && (
            <input
              type="number"
              value={workDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  invoke('set_duration', { duration: val });
                }
              }}
              style={{ width: '60px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', padding: '4px', outline: 'none' }}
              min="1"
            />
          )}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{formatTime(workTimeToday)}</span>
          <span className="stat-name">Work</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatTime(restTimeToday)}</span>
          <span className="stat-name">Rest</span>
        </div>
      </div>

    </div>
  );
};
