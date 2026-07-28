import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isPermissionGranted, requestPermission, sendNotification, onAction, registerActionTypes } from '@tauri-apps/plugin-notification';
import { useSettings } from './hooks/useSettings';
import './App.css';

const RESET_THRESHOLD = 3 * 60; // 3 minutes in seconds

interface TimerState {
  time_left: number;
  is_running: boolean;
  work_duration: number;
}

function App() {
  const [workDuration, setWorkDuration] = useState(45); // in minutes
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const lockedAt = useRef<number | null>(null);
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Stats for today
  const [workTimeToday, setWorkTimeToday] = useState(0);
  const [restTimeToday, setRestTimeToday] = useState(0);

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  useEffect(() => {
    invoke('plugin:idlemonitor|start', { idleThresholdSecs: 300 }).catch(console.error);

    let unlistenLock: () => void;
    let unlistenTick: () => void;
    let unlistenFinish: () => void;
    let unlistenAction: () => void;
    let isMounted = true;

    const setupListeners = async () => {
      // Get initial state
      try {
        const state: TimerState = await invoke('get_state');
        if (!isMounted) return;
        setTimeLeft(state.time_left);
        setIsRunning(state.is_running);
        setWorkDuration(state.work_duration);
        if (![15, 25, 30, 45, 60, 90].includes(state.work_duration)) {
          setIsCustomMode(true);
        }
      } catch (e) {
        console.error("Failed to get initial state", e);
      }

      try {
        await registerActionTypes([{
          id: 'timer-finished',
          actions: [{
            id: 'stop-audio',
            title: '关闭铃声',
            foreground: true
          }]
        }]);
      } catch (e) {
        console.error("Failed to register action types", e);
      }

      let actionListener: any = null;
      try {
        actionListener = await onAction(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        });
      } catch (e) {
        console.error("Failed to set onAction", e);
      }
      if (!isMounted) { 
        if (actionListener) actionListener.unregister(); 
      } else { 
        unlistenAction = actionListener ? () => actionListener.unregister() : () => {}; 
      }

      const tick = await listen<TimerState>('timer-tick', (event) => {
        const { time_left, is_running, work_duration } = event.payload;
        setTimeLeft(time_left);
        setIsRunning(is_running);
        setWorkDuration(work_duration);
        if (![15, 25, 30, 45, 60, 90].includes(work_duration)) {
          setIsCustomMode(true);
        }
        if (is_running && time_left > 0) {
          setWorkTimeToday(prev => prev + 1);
        }
      });
      if (!isMounted) { tick(); } else { unlistenTick = tick; }

      const finish = await listen('timer-finished', async () => {
        // 1. Start ringtone
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          } else {
            audioRef.current = new Audio();
          }

          let audioSrc = '';
          if (settings.ringtoneType === 'custom' && settings.customRingtonePath) {
            audioSrc = convertFileSrc(settings.customRingtonePath);
          } else if (settings.officialRingtone) {
            // Resolve the actual URL from Vite's glob import
            const bellFiles = import.meta.glob('/src/bells/*.{mp3,wav,ogg,aac,m4a}', { eager: true, query: '?url', import: 'default' });
            const foundPath = Object.keys(bellFiles).find(p => p.endsWith(settings.officialRingtone));
            if (foundPath) {
              audioSrc = bellFiles[foundPath] as string;
            } else {
              // Fallback to first available if not found
              const firstBell = Object.values(bellFiles)[0];
              if (firstBell) {
                audioSrc = firstBell as string;
              }
            }
          }

          if (audioSrc) {
            audioRef.current.src = audioSrc;
            audioRef.current.loop = false;
            audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
          }
        } catch (err) {
          console.error("Error playing sound", err);
        }

        // 2. Show Notification / Popup
        if (settings.showNotification) {
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === 'granted';
          }
          if (permissionGranted) {
            sendNotification({ 
              title: 'Hourglass', 
              body: '时间到了，请起身休息一下，喝口水吧！',
              actionTypeId: 'timer-finished',
            });
          }
        }
      });
      if (!isMounted) { finish(); } else { unlistenFinish = finish; }

      const lock = await listen<{ locked: boolean }>('idlemonitor://lock', (event) => {
        if (event.payload.locked) {
          invoke('pause_timer');
          lockedAt.current = Date.now();
        } else {
          if (lockedAt.current) {
            const lockedDuration = (Date.now() - lockedAt.current) / 1000;
            if (lockedDuration >= RESET_THRESHOLD) {
              invoke('reset_timer');
              setRestTimeToday(prev => prev + lockedDuration);
            }
            lockedAt.current = null;
          }
          invoke('start_timer');
        }
      });
      if (!isMounted) { lock(); } else { unlistenLock = lock; }
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (unlistenTick) unlistenTick();
      if (unlistenFinish) unlistenFinish();
      if (unlistenLock) unlistenLock();
      if (unlistenAction) unlistenAction();
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleTimer = () => {
    if (isRunning) {
      invoke('pause_timer');
    } else {
      invoke('start_timer');
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDuration = parseInt(e.target.value, 10);
    invoke('set_duration', { duration: newDuration });
  };

  const handleReset = () => {
    invoke('reset_timer');
  };

  const handleClose = () => {
    stopAudio();
    getCurrentWindow().hide();
  };

  const totalSeconds = workDuration * 60;
  const progressPercent = (timeLeft / totalSeconds) * 100;
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="app-wrapper" onClick={stopAudio}>
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
              <option value={15}>15 mins</option>
              <option value={25}>25 mins</option>
              <option value={30}>30 mins</option>
              <option value={45}>45 mins</option>
              <option value={60}>60 mins</option>
              <option value={90}>90 mins</option>
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
    </div>
  );
}

export default App;
