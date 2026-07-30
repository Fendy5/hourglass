import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

export interface Settings {
  ringtoneType: 'official' | 'custom';
  officialRingtone: string;
  customRingtonePath: string;
  showNotification: boolean;
  language: 'zh' | 'en';
  appearance: 'system' | 'dark' | 'light';
}

const DEFAULT_SETTINGS: Settings = {
  ringtoneType: 'official',
  officialRingtone: '下课铃 (铃声).mp3',
  customRingtonePath: '',
  showNotification: true,
  language: 'zh',
  appearance: 'system',
};

// Singleton store promise
let storePromise: ReturnType<typeof load> | null = null;
const getStore = () => {
  if (!storePromise) {
    storePromise = load('settings.json', { autoSave: false });
  }
  return storePromise;
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    async function initSettings() {
      try {
        const store = await getStore();
        
        // Load initial values
        const loadedSettings = { ...DEFAULT_SETTINGS };
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          const val = await store.get(key);
          if (val !== undefined && val !== null) {
            // @ts-ignore
            loadedSettings[key as keyof Settings] = val;
          }
        }
        setSettings(loadedSettings);
        setIsLoaded(true);
        invoke('set_language', { lang: loadedSettings.language }).catch(console.error);

        // Listen for changes from other windows
        unlisten = await store.onChange((key, value) => {
          setSettings(prev => ({
            ...prev,
            [key]: value as any
          }));
          if (key === 'language') {
            invoke('set_language', { lang: value as string }).catch(console.error);
          }
        });
      } catch (error) {
        console.error("Failed to load settings store:", error);
      }
    }
    
    initSettings();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    try {
      const store = await getStore();
      await store.set(key, value);
      await store.save(); // explicitly save to persist
      // We also update local state instantly for responsiveness
      setSettings(prev => ({ ...prev, [key]: value }));
      if (key === 'language') {
        invoke('set_language', { lang: value as string }).catch(console.error);
      }
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
    }
  };

  return { settings, updateSetting, isLoaded };
}
