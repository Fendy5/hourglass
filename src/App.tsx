import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isPermissionGranted, requestPermission, sendNotification, onAction, registerActionTypes } from '@tauri-apps/plugin-notification';
import { useSettings } from './hooks/useSettings';
import { GlassPanel } from './components/GlassPanel';
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

  return (
    <div className="app-wrapper" onClick={stopAudio}>
      <GlassPanel
        timeLeft={timeLeft}
        workDuration={workDuration}
        isRunning={isRunning}
        isCustomMode={isCustomMode}
        setIsCustomMode={setIsCustomMode}
        handleDurationChange={handleDurationChange}
        handleReset={handleReset}
        toggleTimer={toggleTimer}
        handleClose={handleClose}
        formatTime={formatTime}
        workTimeToday={workTimeToday}
        restTimeToday={restTimeToday}
      />
    </div>
  );
}

export default App;
