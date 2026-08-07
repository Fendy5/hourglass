import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './GlassPanelDark.css';

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

export const GlassPanelDark: React.FC<GlassPanelProps> = ({
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
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="glass-panel-dark">
      
      <header className="header-dark" onMouseDown={() => getCurrentWindow().startDragging()}>
        <div className="drag-region-dark">
          <h2>Hourglass</h2>
        </div>
        <button
          className="close-btn-dark"
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      <div className="timer-container-dark">
        <svg className="progress-ring-dark" width="240" height="240">
          <circle
            className="progress-ring-bg-dark"
            stroke="#333333"
            strokeWidth="12"
            fill="transparent"
            r={radius}
            cx="120"
            cy="120"
          />
          <circle
            className="progress-ring-fill-dark"
            stroke="url(#gradient-dark)"
            strokeWidth="12"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="120"
            cy="120"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
            }}
          />
          <defs>
            <linearGradient id="gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#A0A0A0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="time-display-dark">
          <span className="time-text-dark">{formatTime(timeLeft)}</span>
          <span className="time-label-dark">{isRunning ? "Focusing" : "Paused"}</span>
        </div>
      </div>

      <div className="settings-row-dark">
        <div className="time-selection-wrapper-dark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <select 
            className="glass-select-dark" 
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
              className="custom-time-input-dark"
              min="1"
            />
          )}
        </div>
      </div>

      <div className="actions-dark">
        <button className="btn-dark btn-pink-dark" onClick={toggleTimer}>
          {isRunning ? "Pause" : "Start"}
        </button>
        <button className="btn-dark btn-purple-dark" onClick={handleReset}>
          Reset
        </button>
      </div>

      <div className="stats-row-dark">
        <div className="stat-card-dark">
          <span className="stat-name-dark">Work Today</span>
          <span className="stat-value-dark">{formatTime(workTimeToday)}</span>
        </div>
        <div className="stat-card-dark">
          <span className="stat-name-dark">Rest Today</span>
          <span className="stat-value-dark">{formatTime(restTimeToday)}</span>
        </div>
      </div>

    </div>
  );
};
