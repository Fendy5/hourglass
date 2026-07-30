import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from './hooks/useSettings';
import './Settings.css';
import { Music, MessageSquare, Globe, Info, SunMoon } from 'lucide-react';

// @ts-ignore
const bellFiles = import.meta.glob('/src/bells/*.{mp3,wav,ogg,aac,m4a}', { eager: true, query: '?url', import: 'default' });
const bellOptions = Object.keys(bellFiles).map(path => {
  return {
    name: path.replace('/src/bells/', ''),
    url: bellFiles[path] as string
  };
});

export default function Settings() {
  const { settings, updateSetting, isLoaded } = useSettings();
  const [version, setVersion] = useState('');
  const [activeTab, setActiveTab] = useState('ringtone');

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
    
    // Listen for close event if we want to handle anything, though system titlebar closes automatically
    const unlisten = getCurrentWindow().onCloseRequested(() => {
      // Clean up if needed
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleSelectCustomRingtone = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'wav', 'ogg', 'aac']
        }]
      });
      if (selected && typeof selected === 'string') {
        updateSetting('customRingtonePath', selected);
        updateSetting('ringtoneType', 'custom');
      }
    } catch (e) {
      console.error("Failed to select file:", e);
    }
  };

  if (!isLoaded) {
    return <div className="settings-loading">Loading...</div>;
  }

  // Simple localization dictionary based on current setting
  const t = (key: string) => {
    const zh: Record<string, string> = {
      ringtone: '铃声',
      ringtoneDesc: '倒计时结束之后播放铃声',
      officialRingtone: '官方铃声',
      officialRingtoneDesc: '内置若干铃声',
      myRingtone: '我的铃声',
      myRingtoneDesc: '支持用户选择铃声',
      popup: '弹窗',
      popupDesc: '设置是否在通知栏显示倒计时结束消息',
      language: '语言',
      chinese: '中文',
      english: '英文',
      about: '关于',
      versionInfo: '版本信息',
      selectFile: '选择文件',
      notSelected: '未选择',
      appearance: '外观',
      appearanceDesc: '设置应用的主题配色',
      themeSystem: '跟随系统',
      themeLight: '浅色模式',
      themeDark: '深色模式',
    };
    const en: Record<string, string> = {
      ringtone: 'Ringtone',
      ringtoneDesc: 'Play ringtone after countdown ends',
      officialRingtone: 'Official ringtones',
      officialRingtoneDesc: 'Built-in ringtones',
      myRingtone: 'My ringtones',
      myRingtoneDesc: 'Support user selecting ringtones',
      popup: 'Popup',
      popupDesc: 'Set whether to show countdown end message in notification bar',
      language: 'Language',
      chinese: 'Chinese',
      english: 'English',
      about: 'About',
      versionInfo: 'Version Info',
      selectFile: 'Select File',
      notSelected: 'Not selected',
      appearance: 'Appearance',
      appearanceDesc: 'Set application theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
    };
    return settings.language === 'en' ? en[key] : zh[key];
  };

  const tabs = [
    { id: 'ringtone', label: t('ringtone'), icon: <Music size={18} /> },
    { id: 'popup', label: t('popup'), icon: <MessageSquare size={18} /> },
    { id: 'appearance', label: t('appearance'), icon: <SunMoon size={18} /> },
    { id: 'language', label: t('language'), icon: <Globe size={18} /> },
    { id: 'about', label: t('about'), icon: <Info size={18} /> },
  ];

  return (
    <div className="settings-window-wrapper" data-tauri-drag-region>
      <div className="settings-sidebar" data-tauri-drag-region>
        <div className="settings-drag-space" data-tauri-drag-region></div>
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </div>
        ))}
      </div>
      <div className="settings-content">
        
        {/* 铃声 */}
        {activeTab === 'ringtone' && (
          <section className="settings-section fade-in">
            <h2>{t('ringtone')}</h2>
            <div className="settings-group">
              <p className="settings-desc">{t('ringtoneDesc')}</p>
              
              <div className="settings-card">
                <div className="settings-item">
                  <div className="settings-item-header">
                    <label>
                      <input 
                        type="radio" 
                        name="ringtoneType" 
                        checked={settings.ringtoneType === 'official'}
                        onChange={() => updateSetting('ringtoneType', 'official')}
                      />
                      <span className="radio-label">{t('officialRingtone')}</span>
                    </label>
                  </div>
                  <p className="settings-desc indent">{t('officialRingtoneDesc')}</p>
                  {settings.ringtoneType === 'official' && (
                    <select 
                      className="settings-select indent"
                      value={settings.officialRingtone}
                      onChange={(e) => updateSetting('officialRingtone', e.target.value)}
                    >
                      {bellOptions.length > 0 ? (
                        bellOptions.map(bell => (
                          <option key={bell.name} value={bell.name}>{bell.name.replace(/\.[^/.]+$/, "")}</option>
                        ))
                      ) : (
                        <option value="">{t('notSelected')}</option>
                      )}
                    </select>
                  )}
                </div>
                
                <div className="settings-divider"></div>

                <div className="settings-item">
                  <div className="settings-item-header">
                    <label>
                      <input 
                        type="radio" 
                        name="ringtoneType" 
                        checked={settings.ringtoneType === 'custom'}
                        onChange={() => updateSetting('ringtoneType', 'custom')}
                      />
                      <span className="radio-label">{t('myRingtone')}</span>
                    </label>
                  </div>
                  <p className="settings-desc indent">{t('myRingtoneDesc')}</p>
                  {settings.ringtoneType === 'custom' && (
                    <div className="custom-ringtone-picker indent">
                      <button className="settings-btn" onClick={handleSelectCustomRingtone}>
                        {t('selectFile')}
                      </button>
                      <span className="custom-path" title={settings.customRingtonePath}>
                        {settings.customRingtonePath ? settings.customRingtonePath.split(/[/\\]/).pop() : t('notSelected')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 弹窗 */}
        {activeTab === 'popup' && (
          <section className="settings-section fade-in">
            <h2>{t('popup')}</h2>
            <div className="settings-card">
              <label className="settings-item row-between">
                <span className="settings-desc m-0">{t('popupDesc')}</span>
                <input 
                  type="checkbox" 
                  className="toggle-switch"
                  checked={settings.showNotification}
                  onChange={(e) => updateSetting('showNotification', e.target.checked)}
                />
              </label>
            </div>
          </section>
        )}

        {/* 外观 */}
        {activeTab === 'appearance' && (
          <section className="settings-section fade-in">
            <h2>{t('appearance')}</h2>
            <div className="settings-group">
              <p className="settings-desc">{t('appearanceDesc')}</p>
              <div className="settings-card">
                <label className="settings-item radio-row">
                  <input 
                    type="radio" 
                    name="appearance" 
                    checked={settings.appearance === 'system'}
                    onChange={() => updateSetting('appearance', 'system')}
                  />
                  <span className="radio-label">{t('themeSystem')}</span>
                </label>
                <div className="settings-divider"></div>
                <label className="settings-item radio-row">
                  <input 
                    type="radio" 
                    name="appearance" 
                    checked={settings.appearance === 'light'}
                    onChange={() => updateSetting('appearance', 'light')}
                  />
                  <span className="radio-label">{t('themeLight')}</span>
                </label>
                <div className="settings-divider"></div>
                <label className="settings-item radio-row">
                  <input 
                    type="radio" 
                    name="appearance" 
                    checked={settings.appearance === 'dark'}
                    onChange={() => updateSetting('appearance', 'dark')}
                  />
                  <span className="radio-label">{t('themeDark')}</span>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* 语言 */}
        {activeTab === 'language' && (
          <section className="settings-section fade-in">
            <h2>{t('language')}</h2>
            <div className="settings-card">
              <label className="settings-item radio-row">
                <input 
                  type="radio" 
                  name="language" 
                  checked={settings.language === 'zh'}
                  onChange={() => updateSetting('language', 'zh')}
                />
                <span className="radio-label">{t('chinese')}</span>
              </label>
              <div className="settings-divider"></div>
              <label className="settings-item radio-row">
                <input 
                  type="radio" 
                  name="language" 
                  checked={settings.language === 'en'}
                  onChange={() => updateSetting('language', 'en')}
                />
                <span className="radio-label">{t('english')}</span>
              </label>
            </div>
          </section>
        )}

        {/* 关于 */}
        {activeTab === 'about' && (
          <section className="settings-section fade-in">
            <h2>{t('about')}</h2>
            <div className="settings-card">
              <div className="settings-item row-between">
                <span>{t('versionInfo')}</span>
                <span className="version-number">v{version}</span>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
