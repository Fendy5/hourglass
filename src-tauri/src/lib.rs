use std::sync::Mutex;
use std::time::Duration;
use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State, WindowEvent, Emitter,
};

#[derive(Clone, Serialize)]
struct TimerTickPayload {
    time_left: f64,
    is_running: bool,
    work_duration: u32,
}

struct TimerState {
    time_left: f64,
    is_running: bool,
    work_duration: u32,
    last_tick: std::time::Instant,
    lang: String,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            time_left: 45.0 * 60.0,
            is_running: false,
            work_duration: 45,
            last_tick: std::time::Instant::now(),
            lang: "zh".to_string(),
        }
    }
}

#[tauri::command]
fn start_timer(state: State<'_, Mutex<TimerState>>) {
    let mut s = state.lock().unwrap();
    if s.time_left <= 0.0 {
        s.time_left = (s.work_duration as f64) * 60.0;
    }
    s.is_running = true;
    s.last_tick = std::time::Instant::now();
}

#[tauri::command]
fn pause_timer(state: State<'_, Mutex<TimerState>>) {
    let mut s = state.lock().unwrap();
    s.is_running = false;
}

#[tauri::command]
fn reset_timer(state: State<'_, Mutex<TimerState>>) {
    let mut s = state.lock().unwrap();
    s.time_left = (s.work_duration as f64) * 60.0;
    s.last_tick = std::time::Instant::now();
}

#[tauri::command]
fn set_duration(state: State<'_, Mutex<TimerState>>, duration: u32) {
    let mut s = state.lock().unwrap();
    s.work_duration = duration;
    s.time_left = (duration as f64) * 60.0;
    s.last_tick = std::time::Instant::now();
}

#[tauri::command]
fn set_language(state: State<'_, Mutex<TimerState>>, lang: String) {
    let mut s = state.lock().unwrap();
    s.lang = lang;
}

#[tauri::command]
fn get_state(state: State<'_, Mutex<TimerState>>) -> TimerTickPayload {
    let s = state.lock().unwrap();
    TimerTickPayload {
        time_left: s.time_left,
        is_running: s.is_running,
        work_duration: s.work_duration,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_idlemonitor::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            app.manage(Mutex::new(TimerState::default()));

            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let start_i = MenuItem::with_id(app, "start", "Start", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&start_i, &show_i, &settings_i, &quit_i])?;
            let start_i_clone = start_i.clone();
            let show_i_clone = show_i.clone();
            let settings_i_clone = settings_i.clone();
            let quit_i_clone = quit_i.clone();

            let _tray = TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap())
                .icon_as_template(cfg!(target_os = "macos"))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "start" => {
                        if let Some(state) = app.try_state::<Mutex<TimerState>>() {
                            let mut s = state.lock().unwrap();
                            if s.is_running {
                                s.is_running = false;
                            } else {
                                if s.time_left <= 0.0 {
                                    s.time_left = (s.work_duration as f64) * 60.0;
                                }
                                s.is_running = true;
                                s.last_tick = std::time::Instant::now();
                            }
                        }
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(visible) = window.is_visible() {
                                if visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let app_handle = app.handle().clone();

            // 初次打开应用时显示主窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            std::thread::spawn(move || {
                let mut last_emit = std::time::Instant::now();
                let mut last_emitted_is_running = false;
                let mut last_menu_is_running = false;
                let mut last_emitted_work_duration = 45;
                let mut last_emitted_time_left = 45.0 * 60.0;
                let mut last_window_visible = false;
                let mut last_any_visible = false;
                let mut last_lang = "".to_string();

                loop {
                    std::thread::sleep(Duration::from_millis(100));
                    
                    let mut current_lang = "zh".to_string();
                    let mut current_is_running = false;
                    let mut needs_emit = false;
                    let mut current_payload = None;
                    let mut timer_finished = false;

                    if let Some(state) = app_handle.try_state::<Mutex<TimerState>>() {
                        let mut s = state.lock().unwrap();
                        current_lang = s.lang.clone();
                        let now = std::time::Instant::now();
                        
                        if s.is_running {
                            let delta = now.duration_since(s.last_tick).as_secs_f64();
                            s.time_left -= delta;
                            
                            if s.time_left <= 0.0 {
                                s.time_left = 0.0;
                                s.is_running = false;
                                timer_finished = true;
                            }
                        }
                        s.last_tick = now;
                        current_is_running = s.is_running;

                        let state_changed = s.is_running != last_emitted_is_running 
                            || s.work_duration != last_emitted_work_duration 
                            || (s.time_left - last_emitted_time_left).abs() > 1.5;

                        if state_changed || (s.is_running && now.duration_since(last_emit).as_secs_f64() >= 1.0) || timer_finished {
                            needs_emit = true;
                            last_emit = now;
                            last_emitted_is_running = s.is_running;
                            last_emitted_work_duration = s.work_duration;
                            last_emitted_time_left = s.time_left;
                        }

                        if needs_emit {
                            current_payload = Some(TimerTickPayload {
                                time_left: s.time_left,
                                is_running: s.is_running,
                                work_duration: s.work_duration,
                            });
                        }
                    }

                    let lang_changed = current_lang != last_lang;
                    if lang_changed {
                        last_lang = current_lang.clone();
                        if current_lang == "zh" {
                            let _ = settings_i_clone.set_text("设置");
                            let _ = quit_i_clone.set_text("退出");
                        } else {
                            let _ = settings_i_clone.set_text("Settings");
                            let _ = quit_i_clone.set_text("Quit");
                        }
                    }

                    if current_is_running != last_menu_is_running || lang_changed {
                        last_menu_is_running = current_is_running;
                        if current_is_running {
                            let _ = start_i_clone.set_text(if current_lang == "zh" { "暂停" } else { "Pause" });
                        } else {
                            let _ = start_i_clone.set_text(if current_lang == "zh" { "开始" } else { "Start" });
                        }
                    }

                    let mut main_visible = false;
                    let mut settings_visible = false;
                    
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if let Ok(visible) = window.is_visible() {
                            main_visible = visible;
                        }
                    }
                    if let Some(window) = app_handle.get_webview_window("settings") {
                        if let Ok(visible) = window.is_visible() {
                            settings_visible = visible;
                        }
                    }
                    
                    if main_visible != last_window_visible || lang_changed {
                        last_window_visible = main_visible;
                        if main_visible {
                            let _ = show_i_clone.set_text(if current_lang == "zh" { "隐藏" } else { "Hide" });
                        } else {
                            let _ = show_i_clone.set_text(if current_lang == "zh" { "显示" } else { "Show" });
                        }
                    }

                    let any_visible = main_visible || settings_visible;
                    if any_visible != last_any_visible {
                        last_any_visible = any_visible;
                        #[cfg(target_os = "macos")]
                        {
                            if any_visible {
                                let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                            } else {
                                let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
                            }
                        }
                    }

                    if let Some(payload) = current_payload {
                        let _ = app_handle.emit("timer-tick", &payload);

                        if let Some(tray) = app_handle.tray_by_id("main") {
                            let secs = payload.time_left.ceil() as u64;
                            if secs == 0 {
                                let _ = tray.set_title(Some(""));
                            } else {
                                let m = secs / 60;
                                let s = secs % 60;
                                let title = format!("{:02}:{:02}", m, s);
                                let _ = tray.set_title(Some(title));
                            }
                        }
                    }

                    if timer_finished {
                        let _ = app_handle.emit("timer-finished", ());
                        
                        // Delay window showing and focusing so that macOS notification banner 
                        // is not suppressed by the app immediately taking the foreground.
                        let app_handle_clone = app_handle.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(500));
                            if let Some(window) = app_handle_clone.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.set_always_on_top(true);
                                let _ = window.set_always_on_top(false);
                            }
                        });
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_timer,
            pause_timer,
            reset_timer,
            set_duration,
            get_state,
            set_language
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
