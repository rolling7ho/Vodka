use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use gpui::{
    AnyElement, App, AsyncApp, Context, Entity, FocusHandle, Focusable, InteractiveElement,
    IntoElement, ParentElement, PathPromptOptions, Render,
    StatefulInteractiveElement, Styled, WeakEntity, Window, actions, div, prelude::*, px,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::bridge::{BridgeClient, BridgeEvent};
use crate::components::button::{Button, ButtonSize, ButtonVariant};
use crate::components::icon;
use crate::components::input::{TextInput, TextInputEvent};
use crate::components::modal::modal_dialog;
use crate::components::toggle::choice_chip;
use crate::models::{
    AppPrefsDto, AudioStatusDto, BottleDto, BottleSettingsDto, CrashDiagnosisDto, DllOverrideDto,
    GameDbItemDto, LibraryItemDto, LibraryPayloadDto, LibrarySort, LogFileDto, OrphanedBottleDto,
    ProcessDto, ProgramDto, ProgramOverridesDto, RuntimeStatus, RuntimeUpdateCheckDto,
    StatisticsPayloadDto, SteamSetupStatusDto, pretty_win_version,
};
use crate::theme::{R_MD, S1, S2, S3, S4, S5, Theme, ThemeMode};
use crate::views::{
    ActiveModal, ActivityTab, BottleTab, NavSection, RuntimeProgress, SettingsTab, ToastState,
    ToastStyle,
};

actions!(
    gmac_app,
    [
        QuitApp,
        CloseWindow,
        NewBottle,
        OpenSettings,
        RefreshView,
        NavLibrary,
        NavStatistics,
        NavActivity,
        DismissOverlay,
    ]
);

pub struct GmacApp {
    pub bridge: Arc<BridgeClient>,
    pub focus_handle: FocusHandle,

    pub nav: NavSection,
    pub bottle_tab: BottleTab,
    pub settings_tab: SettingsTab,
    pub activity_tab: ActivityTab,

    pub runtime_status: Option<RuntimeStatus>,
    pub runtime_progress: Option<RuntimeProgress>,
    pub runtime_update_check: Option<RuntimeUpdateCheckDto>,

    pub bottles: Vec<BottleDto>,
    pub library: LibraryPayloadDto,
    pub statistics: StatisticsPayloadDto,
    pub steam_setup: Option<SteamSetupStatusDto>,
    pub prefs: AppPrefsDto,

    pub processes: Vec<ProcessDto>,
    pub logs: Vec<LogFileDto>,
    pub selected_log: Option<String>,
    pub log_text: String,
    pub crash_diagnosis: Option<CrashDiagnosisDto>,
    pub audio_status: Option<AudioStatusDto>,

    pub programs_by_bottle: HashMap<String, Vec<ProgramDto>>,
    pub gamedb_by_bottle: HashMap<String, Vec<GameDbItemDto>>,
    pub stability_reports: HashMap<String, String>,
    pub orphans: Vec<OrphanedBottleDto>,
    pub legacy_bottles: Vec<OrphanedBottleDto>,

    pub library_sort: LibrarySort,
    pub show_steam_setup: bool,
    pub open_game_menu_id: Option<String>,
    pub open_bottle_menu: bool,

    pub expanded_program_path: Option<String>,
    pub editing_program_locale: String,
    pub editing_program_overrides: ProgramOverridesDto,

    pub search_input: Entity<TextInput>,
    pub program_search_input: Entity<TextInput>,
    pub program_args_input: Entity<TextInput>,
    pub modal_input: Entity<TextInput>,

    pub active_modal: Option<ActiveModal>,
    pub toast: Option<ToastState>,
    refresh_queued: bool,
    toast_seq: u64,
    quit_in_progress: bool,
}

impl Focusable for GmacApp {
    fn focus_handle(&self, _cx: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}

impl GmacApp {
    pub fn new(bridge: Arc<BridgeClient>, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let initial_theme = Theme::for_appearance(ThemeMode::System, window.appearance());

        let search_input =
            cx.new(|cx| TextInput::new(cx, "Search library…", initial_theme).with_leading_icon("search"));
        let program_search_input =
            cx.new(|cx| TextInput::new(cx, "Filter programs…", initial_theme).with_leading_icon("search"));
        let program_args_input = cx.new(|cx| TextInput::new(cx, "Optional command line arguments", initial_theme));
        let modal_input = cx.new(|cx| TextInput::new(cx, "Name", initial_theme));

        cx.subscribe(&search_input, |_, _, _: &TextInputEvent, cx| cx.notify())
            .detach();
        cx.subscribe(&program_search_input, |_, _, _: &TextInputEvent, cx| cx.notify())
            .detach();
        cx.subscribe(&modal_input, |this, _, ev: &TextInputEvent, cx| {
            if matches!(ev, TextInputEvent::Submitted) {
                this.submit_active_modal(cx);
            } else if matches!(ev, TextInputEvent::Cancelled) {
                this.active_modal = None;
                cx.notify();
            }
        })
        .detach();

        let app = Self {
            bridge,
            focus_handle: cx.focus_handle(),
            nav: NavSection::Library,
            bottle_tab: BottleTab::Overview,
            settings_tab: SettingsTab::General,
            activity_tab: ActivityTab::Processes,
            runtime_status: None,
            runtime_progress: None,
            runtime_update_check: None,
            bottles: Vec::new(),
            library: LibraryPayloadDto::default(),
            statistics: StatisticsPayloadDto::default(),
            steam_setup: None,
            prefs: AppPrefsDto::default(),
            processes: Vec::new(),
            logs: Vec::new(),
            selected_log: None,
            log_text: String::new(),
            crash_diagnosis: None,
            audio_status: None,
            programs_by_bottle: HashMap::new(),
            gamedb_by_bottle: HashMap::new(),
            stability_reports: HashMap::new(),
            orphans: Vec::new(),
            legacy_bottles: Vec::new(),
            library_sort: LibrarySort::Recent,
            show_steam_setup: false,
            open_game_menu_id: None,
            open_bottle_menu: false,
            expanded_program_path: None,
            editing_program_locale: "auto".to_string(),
            editing_program_overrides: ProgramOverridesDto::default(),
            search_input,
            program_search_input,
            program_args_input,
            modal_input,
            active_modal: None,
            toast: None,
            refresh_queued: false,
            toast_seq: 0,
            quit_in_progress: false,
        };

        app.start_event_pump(cx);
        app.bootstrap(cx);
        app
    }

    pub fn theme_mode(&self) -> ThemeMode {
        ThemeMode::from_str(&self.prefs.theme_mode)
    }

    fn current_theme(&self, window: &Window) -> Theme {
        Theme::for_appearance(self.theme_mode(), window.appearance())
    }

    fn sync_input_themes(&self, theme: Theme, cx: &mut Context<Self>) {
        self.search_input.update(cx, |i, _| i.set_theme(theme));
        self.program_search_input.update(cx, |i, _| i.set_theme(theme));
        self.program_args_input.update(cx, |i, _| i.set_theme(theme));
        self.modal_input.update(cx, |i, _| i.set_theme(theme));
    }

    fn start_event_pump(&self, cx: &mut Context<Self>) {
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            loop {
                cx.background_executor()
                    .timer(Duration::from_millis(120))
                    .await;
                let keep_going = this.update(cx, |app, cx| {
                    let events = app.bridge.drain_events();
                    for ev in events {
                        app.handle_bridge_event(ev, cx);
                    }
                });
                if keep_going.is_err() {
                    break;
                }
            }
        })
        .detach();
    }

    fn handle_bridge_event(&mut self, ev: BridgeEvent, cx: &mut Context<Self>) {
        match ev {
            BridgeEvent::RuntimeProgress {
                phase,
                progress,
                detail,
            } => {
                if progress >= 1.0 && phase.to_lowercase().contains("ready") {
                    self.runtime_progress = None;
                } else {
                    self.runtime_progress = Some(RuntimeProgress {
                        phase,
                        progress,
                        detail,
                    });
                }
                cx.notify();
            }
            BridgeEvent::StateChanged { .. } => {
                if !self.refresh_queued {
                    self.refresh_queued = true;
                    cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
                        cx.background_executor()
                            .timer(Duration::from_millis(180))
                            .await;
                        let _ = this.update(cx, |app, cx| {
                            app.refresh_queued = false;
                            app.refresh_bottles(cx);
                            app.refresh_library(cx);
                            app.refresh_processes(cx);
                            app.refresh_steam_setup(cx);
                        });
                    })
                    .detach();
                }
            }
            BridgeEvent::Toast { style, message } => {
                self.push_toast(ToastStyle::from_str(&style), message, None, cx);
            }
            BridgeEvent::CrashDetected {
                program_name,
                headline,
                log_path,
            } => {
                self.push_toast(
                    ToastStyle::Warning,
                    format!("{program_name}: {headline}"),
                    Some(log_path),
                    cx,
                );
            }
        }
    }

    fn spawn_rpc<P, R, F>(&self, method: &'static str, params: P, on_ok: F, cx: &mut Context<Self>)
    where
        P: Serialize + Send + 'static,
        R: DeserializeOwned + Send + 'static,
        F: FnOnce(&mut Self, R, &mut Context<Self>) + 'static,
    {
        let bridge = Arc::clone(&self.bridge);
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let res: anyhow::Result<R> = cx
                .background_executor()
                .spawn(async move { bridge.call(method, params) })
                .await;
            let _ = this.update(cx, |app, cx| match res {
                Ok(val) => on_ok(app, val, cx),
                Err(err) => app.push_toast(ToastStyle::Error, err.to_string(), None, cx),
            });
        })
        .detach();
    }

    pub fn bootstrap(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "prefs.get",
            json!({}),
            |app, prefs: AppPrefsDto, cx| {
                app.prefs = prefs;
                cx.notify();
            },
            cx,
        );
        self.spawn_rpc(
            "bootstrap",
            json!({}),
            |app, status: RuntimeStatus, cx| {
                app.runtime_status = Some(status);
                app.refresh_bottles(cx);
                app.refresh_library(cx);
                app.refresh_steam_setup(cx);
                app.refresh_processes(cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn navigate(&mut self, next: NavSection, _window: &mut Window, cx: &mut Context<Self>) {
        self.open_game_menu_id = None;
        self.open_bottle_menu = false;
        self.nav = next.clone();
        match next {
            NavSection::Library => {
                self.refresh_library(cx);
                self.refresh_steam_setup(cx);
            }
            NavSection::Statistics => self.refresh_statistics(cx),
            NavSection::Activity => {
                self.refresh_processes(cx);
                self.refresh_logs(cx);
            }
            NavSection::Bottle(ref url) => {
                self.load_programs(url, cx);
                if self.bottle_tab == BottleTab::Presets {
                    self.load_gamedb(url, cx);
                }
            }
            NavSection::Settings => {
                self.refresh_runtime_status(cx);
                if self.settings_tab == SettingsTab::Storage {
                    self.refresh_storage_candidates(cx);
                }
            }
        }
        cx.notify();
    }

    pub fn select_bottle_tab(&mut self, bottle_url: &str, tab: BottleTab, cx: &mut Context<Self>) {
        self.bottle_tab = tab;
        match tab {
            BottleTab::Overview | BottleTab::Programs => self.load_programs(bottle_url, cx),
            BottleTab::Presets => self.load_gamedb(bottle_url, cx),
            BottleTab::Tools => {
                self.refresh_audio_status(cx);
            }
            BottleTab::Settings => {}
        }
        cx.notify();
    }

    pub fn push_toast(
        &mut self,
        style: ToastStyle,
        message: impl Into<String>,
        log_path: Option<String>,
        cx: &mut Context<Self>,
    ) {
        self.toast_seq = self.toast_seq.wrapping_add(1);
        let seq = self.toast_seq;
        self.toast = Some(ToastState {
            style,
            message: message.into(),
            log_path,
        });
        cx.notify();

        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            cx.background_executor().timer(Duration::from_secs(6)).await;
            let _ = this.update(cx, |app, cx| {
                if app.toast_seq == seq {
                    app.toast = None;
                    cx.notify();
                }
            });
        })
        .detach();
    }

    pub fn cycle_theme_mode(&mut self, cx: &mut Context<Self>) {
        let next = match self.theme_mode() {
            ThemeMode::System => ThemeMode::Light,
            ThemeMode::Light => ThemeMode::Dark,
            ThemeMode::Dark => ThemeMode::System,
        };
        self.set_theme_mode(next, cx);
    }

    pub fn set_theme_mode(&mut self, mode: ThemeMode, cx: &mut Context<Self>) {
        self.update_prefs(|p| p.theme_mode = mode.as_str().to_string(), cx);
    }

    pub fn update_prefs(&mut self, f: impl FnOnce(&mut AppPrefsDto), cx: &mut Context<Self>) {
        f(&mut self.prefs);
        let payload = self.prefs.clone();
        self.spawn_rpc(
            "prefs.set",
            payload,
            |app, updated: AppPrefsDto, cx| {
                app.prefs = updated;
                cx.notify();
            },
            cx,
        );
        cx.notify();
    }

    pub fn refresh_current(&mut self, cx: &mut Context<Self>) {
        self.refresh_bottles(cx);
        match &self.nav {
            NavSection::Library => {
                self.refresh_library(cx);
                self.refresh_steam_setup(cx);
            }
            NavSection::Statistics => self.refresh_statistics(cx),
            NavSection::Activity => {
                self.refresh_processes(cx);
                self.refresh_logs(cx);
            }
            NavSection::Bottle(url) => {
                let u = url.clone();
                self.load_programs(&u, cx);
                self.load_gamedb(&u, cx);
            }
            NavSection::Settings => {
                self.refresh_runtime_status(cx);
                self.refresh_storage_candidates(cx);
            }
        }
    }

    pub fn refresh_runtime_status(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "runtime.status",
            json!({}),
            |app, st: RuntimeStatus, cx| {
                app.runtime_status = Some(st);
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_bottles(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.list",
            json!({}),
            |app, list: Vec<BottleDto>, cx| {
                app.bottles = list;
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_library(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "library.load",
            json!({}),
            |app, payload: LibraryPayloadDto, cx| {
                app.library = payload;
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_steam_setup(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "steam.setupStatus",
            json!({}),
            |app, status: SteamSetupStatusDto, cx| {
                app.steam_setup = Some(status);
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_statistics(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "statistics.load",
            json!({}),
            |app, stats: StatisticsPayloadDto, cx| {
                app.statistics = stats;
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_processes(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "processes.list",
            json!({}),
            |app, procs: Vec<ProcessDto>, cx| {
                app.processes = procs;
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_logs(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "diagnostics.listLogs",
            json!({}),
            |app, logs: Vec<LogFileDto>, cx| {
                let first = logs.first().map(|l| l.path.clone());
                app.logs = logs;
                if app.selected_log.is_none()
                    && let Some(p) = first
                {
                    app.select_log(p, cx);
                }
                cx.notify();
            },
            cx,
        );
    }

    pub fn select_log(&mut self, path: String, cx: &mut Context<Self>) {
        self.selected_log = Some(path.clone());
        self.crash_diagnosis = None;
        self.spawn_rpc(
            "diagnostics.readLog",
            json!({ "path": path }),
            |app, val: Value, cx| {
                app.log_text = val
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                cx.notify();
            },
            cx,
        );
    }

    pub fn classify_log(&self, path: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "diagnostics.classifyLog",
            json!({ "path": path }),
            |app, diag: CrashDiagnosisDto, cx| {
                app.crash_diagnosis = Some(diag);
                cx.notify();
            },
            cx,
        );
    }

    pub fn install_runtime(&mut self, cx: &mut Context<Self>) {
        self.runtime_progress = Some(RuntimeProgress {
            phase: "Starting GmacWine installation…".to_string(),
            progress: 0.02,
            detail: String::new(),
        });
        cx.notify();
        self.spawn_rpc(
            "runtime.install",
            json!({}),
            |app, st: RuntimeStatus, cx| {
                app.runtime_status = Some(st);
                app.runtime_progress = None;
                app.refresh_steam_setup(cx);
                app.push_toast(ToastStyle::Success, "GmacWine is installed and ready.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn check_runtime_updates(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "runtime.checkUpdates",
            json!({}),
            |app, res: RuntimeUpdateCheckDto, cx| {
                app.runtime_update_check = Some(res);
                cx.notify();
            },
            cx,
        );
    }

    pub fn uninstall_runtime(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "runtime.uninstall",
            json!({}),
            |app, st: RuntimeStatus, cx| {
                app.runtime_status = Some(st);
                app.runtime_update_check = None;
                app.refresh_steam_setup(cx);
                app.push_toast(ToastStyle::Info, "GmacWine has been removed.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn clear_shader_caches(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "runtime.clearShaderCaches",
            json!({}),
            |app, _: Value, cx| {
                app.push_toast(ToastStyle::Success, "Shader caches cleared.", None, cx);
            },
            cx,
        );
    }

    pub fn open_logs_folder(&self, cx: &mut Context<Self>) {
        self.spawn_rpc("runtime.openLogsFolder", json!({}), |_, _: Value, _| {}, cx);
    }

    pub fn import_gptk_dmg(&self, window: &mut Window, cx: &mut Context<Self>) {
        let rx = cx.prompt_for_paths(PathPromptOptions {
            files: true,
            directories: false,
            multiple: false,
            prompt: Some("Select Apple Game Porting Toolkit DMG".into()),
        });
        let handle = window.window_handle();
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let Ok(Ok(Some(paths))) = rx.await else {
                return;
            };
            let Some(path) = paths.into_iter().next() else {
                return;
            };
            let _ = handle;
            let _ = this.update(cx, |app, cx| {
                app.spawn_rpc(
                    "gptk.importDmg",
                    json!({ "path": path.to_string_lossy().to_string() }),
                    |app, st: RuntimeStatus, cx| {
                        app.runtime_status = Some(st);
                        app.refresh_steam_setup(cx);
                        app.push_toast(
                            ToastStyle::Success,
                            "D3DMetal imported from GPTK disk image.",
                            None,
                            cx,
                        );
                        cx.notify();
                    },
                    cx,
                );
            });
        })
        .detach();
    }

    pub fn pick_default_bottle_location(&self, _window: &mut Window, cx: &mut Context<Self>) {
        let rx = cx.prompt_for_paths(PathPromptOptions {
            files: false,
            directories: true,
            multiple: false,
            prompt: Some("Choose default folder for new PCs".into()),
        });
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let Ok(Ok(Some(paths))) = rx.await else {
                return;
            };
            let Some(dir) = paths.into_iter().next() else {
                return;
            };
            let _ = this.update(cx, |app, cx| {
                let path_str = dir.to_string_lossy().to_string();
                app.update_prefs(|p| p.default_bottle_location = path_str, cx);
            });
        })
        .detach();
    }

    pub fn refresh_storage_candidates(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.orphans",
            json!({}),
            |app, items: Vec<OrphanedBottleDto>, cx| {
                app.orphans = items;
                cx.notify();
            },
            cx,
        );
        self.spawn_rpc(
            "bottles.legacyWhisky",
            json!({}),
            |app, items: Vec<OrphanedBottleDto>, cx| {
                app.legacy_bottles = items;
                cx.notify();
            },
            cx,
        );
    }

    pub fn reimport_orphans(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.reimportOrphans",
            json!({}),
            |app, list: Vec<BottleDto>, cx| {
                app.bottles = list;
                app.orphans.clear();
                app.refresh_library(cx);
                app.push_toast(ToastStyle::Success, "Orphaned PCs re-imported.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn import_existing_bottle(&self, _window: &mut Window, cx: &mut Context<Self>) {
        let rx = cx.prompt_for_paths(PathPromptOptions {
            files: false,
            directories: true,
            multiple: false,
            prompt: Some("Select existing PC folder".into()),
        });
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let Ok(Ok(Some(paths))) = rx.await else {
                return;
            };
            let Some(dir) = paths.into_iter().next() else {
                return;
            };
            let _ = this.update(cx, |app, cx| {
                app.import_bottle_at_path(dir.to_string_lossy().to_string(), cx);
            });
        })
        .detach();
    }

    pub fn import_bottle_at_path(&self, path: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.importExisting",
            json!({ "path": path }),
            |app, list: Vec<BottleDto>, cx| {
                app.bottles = list;
                app.refresh_library(cx);
                app.refresh_storage_candidates(cx);
                app.push_toast(ToastStyle::Success, "PC imported.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn create_steam_bottle(&self, cx: &mut Context<Self>) {
        let win_ver = self.prefs.default_win_version.clone();
        self.spawn_rpc(
            "bottles.create",
            json!({ "name": "Steam", "windowsVersion": win_ver }),
            |app, created: BottleDto, cx| {
                app.bottles.push(created);
                app.refresh_steam_setup(cx);
                app.push_toast(ToastStyle::Success, "Steam PC created.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn set_steam_bottle_backend(&self, url: String, backend: String, cx: &mut Context<Self>) {
        self.update_bottle_settings(
            &url,
            move |s| s.graphics_backend = backend,
            cx,
        );
    }

    pub fn install_steam(&mut self, url: String, cx: &mut Context<Self>) {
        self.push_toast(ToastStyle::Info, "Installing Steam…", None, cx);
        self.spawn_rpc(
            "steam.install",
            json!({ "url": url }),
            |app, st: SteamSetupStatusDto, cx| {
                app.steam_setup = Some(st);
                app.show_steam_setup = false;
                app.refresh_bottles(cx);
                app.refresh_library(cx);
                app.push_toast(ToastStyle::Success, "Steam installed.", None, cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn open_steam(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc("steam.open", json!({ "url": bottle_url }), |_, _: Value, _| {}, cx);
    }

    pub fn open_steam_store(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "library.sendToSteam",
            json!({ "bottleUrl": bottle_url, "argument": "steam://store" }),
            |_, _: Value, _| {},
            cx,
        );
    }

    pub fn stop_steam(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc("bottles.kill", json!({ "url": bottle_url }), |_, _: Value, _| {}, cx);
    }

    pub fn launch_library_item(&self, item: &LibraryItemDto, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "library.launch",
            json!({
                "bottleUrl": item.bottle_url,
                "launchKind": item.launch_kind,
                "appId": item.app_id,
                "programPath": item.program_path,
            }),
            |app, _: Value, cx| {
                app.refresh_library(cx);
            },
            cx,
        );
    }

    pub fn stop_library_item(&self, item: &LibraryItemDto, cx: &mut Context<Self>) {
        let Some(app_id) = item.app_id else { return };
        self.spawn_rpc(
            "library.stop",
            json!({ "bottleUrl": item.bottle_url, "appId": app_id }),
            |app, _: Value, cx| {
                app.refresh_library(cx);
            },
            cx,
        );
    }

    pub fn toggle_faster_mode(
        &self,
        bottle_url: String,
        app_id: i64,
        faster: bool,
        cx: &mut Context<Self>,
    ) {
        self.spawn_rpc(
            "library.toggleFasterMode",
            json!({ "bottleUrl": bottle_url, "appId": app_id, "faster": faster }),
            |app, _: Value, cx| {
                app.refresh_library(cx);
            },
            cx,
        );
    }

    pub fn add_to_dock(&self, item: &LibraryItemDto, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "library.addToDock",
            json!({
                "bottleUrl": item.bottle_url,
                "name": item.name,
                "launchKind": item.launch_kind,
                "appId": item.app_id,
                "programPath": item.program_path,
            }),
            |app, _: Value, cx| {
                app.push_toast(ToastStyle::Success, "Shortcut added to Dock.", None, cx);
            },
            cx,
        );
    }

    pub fn unpin_library_item(
        &self,
        bottle_url: String,
        program_path: String,
        cx: &mut Context<Self>,
    ) {
        self.spawn_rpc(
            "library.unpin",
            json!({ "bottleUrl": bottle_url, "programPath": program_path }),
            |app, _: Value, cx| {
                app.refresh_library(cx);
            },
            cx,
        );
    }

    pub fn show_in_finder(&self, path: String, cx: &mut Context<Self>) {
        self.spawn_rpc("library.showInFinder", json!({ "path": path }), |_, _: Value, _| {}, cx);
    }

    pub fn pick_and_run_file(
        &self,
        bottle_url: String,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let rx = cx.prompt_for_paths(PathPromptOptions {
            files: true,
            directories: false,
            multiple: false,
            prompt: Some("Select Windows executable (.exe / .msi / .bat)".into()),
        });
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let Ok(Ok(Some(paths))) = rx.await else {
                return;
            };
            let Some(file) = paths.into_iter().next() else {
                return;
            };
            let _ = this.update(cx, |app, cx| {
                app.spawn_rpc(
                    "programs.runFile",
                    json!({ "url": bottle_url, "path": file.to_string_lossy().to_string() }),
                    |app, _: Value, cx| {
                        app.refresh_processes(cx);
                    },
                    cx,
                );
            });
        })
        .detach();
    }

    pub fn open_c_drive(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc("bottles.openCDrive", json!({ "url": bottle_url }), |_, _: Value, _| {}, cx);
    }

    pub fn open_terminal(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc("bottles.openTerminal", json!({ "url": bottle_url }), |_, _: Value, _| {}, cx);
    }

    pub fn kill_bottle(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.kill",
            json!({ "url": bottle_url }),
            |app, _: Value, cx| {
                app.refresh_bottles(cx);
                app.refresh_processes(cx);
                app.push_toast(ToastStyle::Info, "Stopped PC processes.", None, cx);
            },
            cx,
        );
    }

    pub fn repair_bottle_prefix(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.repairPrefix",
            json!({ "url": bottle_url }),
            |app, _: Value, cx| {
                app.push_toast(ToastStyle::Success, "Wine prefix repaired.", None, cx);
            },
            cx,
        );
    }

    pub fn remove_bottle_from_list(&self, bottle_url: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.removeFromList",
            json!({ "url": bottle_url }),
            |app, list: Vec<BottleDto>, cx| {
                app.bottles = list;
                app.nav = NavSection::Library;
                app.refresh_library(cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn run_bottle_tool(&self, bottle_url: String, tool: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "bottles.runTool",
            json!({ "url": bottle_url, "tool": tool }),
            |_, _: Value, _| {},
            cx,
        );
    }

    pub fn update_bottle_settings(
        &self,
        bottle_url: &str,
        mutate: impl FnOnce(&mut BottleSettingsDto),
        cx: &mut Context<Self>,
    ) {
        let Some(existing) = self.bottles.iter().find(|b| b.url == bottle_url) else {
            return;
        };
        let mut settings = existing.settings.clone();
        mutate(&mut settings);
        let url_owned = bottle_url.to_string();
        self.spawn_rpc(
            "bottles.updateSettings",
            json!({ "url": url_owned, "settings": settings }),
            |app, updated: BottleDto, cx| {
                if let Some(slot) = app.bottles.iter_mut().find(|b| b.url == updated.url) {
                    *slot = updated;
                }
                app.refresh_steam_setup(cx);
                cx.notify();
            },
            cx,
        );
    }

    pub fn load_programs(&self, bottle_url: &str, cx: &mut Context<Self>) {
        let u = bottle_url.to_string();
        let u_store = u.clone();
        self.spawn_rpc(
            "programs.list",
            json!({ "url": u }),
            move |app, list: Vec<ProgramDto>, cx| {
                app.programs_by_bottle.insert(u_store, list);
                cx.notify();
            },
            cx,
        );
    }

    pub fn run_program(&self, bottle_url: String, program_path: String, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "programs.run",
            json!({ "url": bottle_url, "programPath": program_path }),
            |app, _: Value, cx| {
                app.refresh_processes(cx);
            },
            cx,
        );
    }

    pub fn toggle_program_pin(
        &self,
        bottle_url: String,
        program_path: String,
        pinned: bool,
        cx: &mut Context<Self>,
    ) {
        let u_reload = bottle_url.clone();
        self.spawn_rpc(
            "programs.togglePin",
            json!({ "url": bottle_url, "programPath": program_path, "pinned": pinned }),
            move |app, _: Value, cx| {
                app.load_programs(&u_reload, cx);
                app.refresh_bottles(cx);
                app.refresh_library(cx);
            },
            cx,
        );
    }

    pub fn toggle_expand_program(&mut self, program_path: &str, cx: &mut Context<Self>) {
        if self.expanded_program_path.as_deref() == Some(program_path) {
            self.expanded_program_path = None;
            cx.notify();
            return;
        }
        self.expanded_program_path = Some(program_path.to_string());
        if let NavSection::Bottle(url) = &self.nav
            && let Some(progs) = self.programs_by_bottle.get(url)
            && let Some(prog) = progs.iter().find(|p| p.url == program_path)
        {
            let args = prog.arguments.clone();
            let loc = if prog.locale.is_empty() {
                "auto".to_string()
            } else {
                prog.locale.clone()
            };
            let ov = prog.overrides.clone();
            self.editing_program_locale = loc;
            self.editing_program_overrides = ov;
            self.program_args_input.update(cx, |inp, cx| inp.set_text(args, cx));
        }
        cx.notify();
    }

    pub fn save_program_settings(
        &self,
        bottle_url: String,
        program_path: String,
        cx: &mut Context<Self>,
    ) {
        let arguments = self.program_args_input.read(cx).text().to_string();
        let locale = self.editing_program_locale.clone();
        let overrides = self.editing_program_overrides.clone();
        let u_reload = bottle_url.clone();
        self.spawn_rpc(
            "programs.updateSettings",
            json!({
                "url": bottle_url,
                "programPath": program_path,
                "arguments": arguments,
                "locale": locale,
                "overrides": overrides,
            }),
            move |app, _: Value, cx| {
                app.load_programs(&u_reload, cx);
                app.push_toast(ToastStyle::Success, "Program options saved.", None, cx);
            },
            cx,
        );
    }

    pub fn load_gamedb(&self, bottle_url: &str, cx: &mut Context<Self>) {
        let u = bottle_url.to_string();
        let u_store = u.clone();
        self.spawn_rpc(
            "gamedb.list",
            json!({ "bottleUrl": u }),
            move |app, list: Vec<GameDbItemDto>, cx| {
                app.gamedb_by_bottle.insert(u_store, list);
                cx.notify();
            },
            cx,
        );
    }

    pub fn apply_gamedb(
        &self,
        bottle_url: String,
        entry_id: String,
        variant_id: Option<String>,
        cx: &mut Context<Self>,
    ) {
        let u_reload = bottle_url.clone();
        self.spawn_rpc(
            "gamedb.apply",
            json!({ "url": bottle_url, "entryId": entry_id, "variantId": variant_id }),
            move |app, _: Value, cx| {
                app.load_gamedb(&u_reload, cx);
                app.refresh_bottles(cx);
                app.push_toast(ToastStyle::Success, "Preset applied to PC.", None, cx);
            },
            cx,
        );
    }

    pub fn revert_gamedb(&self, bottle_url: String, cx: &mut Context<Self>) {
        let u_reload = bottle_url.clone();
        self.spawn_rpc(
            "gamedb.revert",
            json!({ "url": bottle_url }),
            move |app, _: Value, cx| {
                app.load_gamedb(&u_reload, cx);
                app.refresh_bottles(cx);
                app.push_toast(ToastStyle::Info, "Preset reverted.", None, cx);
            },
            cx,
        );
    }

    pub fn load_stability_report(&self, bottle_url: String, cx: &mut Context<Self>) {
        let u = bottle_url.clone();
        self.spawn_rpc(
            "diagnostics.stabilityReport",
            json!({ "url": bottle_url }),
            move |app, val: Value, cx| {
                let text = val
                    .get("report")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                app.stability_reports.insert(u, text);
                cx.notify();
            },
            cx,
        );
    }

    pub fn refresh_audio_status(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "diagnostics.audioStatus",
            json!({}),
            |app, st: AudioStatusDto, cx| {
                app.audio_status = Some(st);
                cx.notify();
            },
            cx,
        );
    }

    pub fn kill_process(&self, bottle_url: String, pid: i32, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "processes.kill",
            json!({ "url": bottle_url, "pid": pid }),
            |app, _: Value, cx| {
                app.refresh_processes(cx);
                app.refresh_bottles(cx);
            },
            cx,
        );
    }

    pub fn kill_all_processes(&self, cx: &mut Context<Self>) {
        self.spawn_rpc(
            "processes.killAll",
            json!({}),
            |app, _: Value, cx| {
                app.refresh_processes(cx);
                app.refresh_bottles(cx);
                app.push_toast(ToastStyle::Info, "Stopped all Windows processes.", None, cx);
            },
            cx,
        );
    }

    pub fn open_create_bottle_modal(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let win_ver = self.prefs.default_win_version.clone();
        self.modal_input.update(cx, |i, cx| i.clear(cx));
        self.active_modal = Some(ActiveModal::CreateBottle {
            win_version: win_ver,
            location: None,
        });
        self.modal_input.read(cx).focus(window);
        cx.notify();
    }

    pub fn open_rename_bottle_modal(
        &mut self,
        url: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let current_name = self
            .bottles
            .iter()
            .find(|b| b.url == url)
            .map(|b| b.name.clone())
            .unwrap_or_default();
        self.modal_input.update(cx, |i, cx| i.set_text(current_name, cx));
        self.active_modal = Some(ActiveModal::RenameBottle { url });
        self.modal_input.read(cx).focus(window);
        cx.notify();
    }

    pub fn open_duplicate_bottle_modal(
        &mut self,
        url: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let suggested = self
            .bottles
            .iter()
            .find(|b| b.url == url)
            .map(|b| format!("{} Copy", b.name))
            .unwrap_or_else(|| "PC Copy".to_string());
        self.modal_input.update(cx, |i, cx| i.set_text(suggested, cx));
        self.active_modal = Some(ActiveModal::DuplicateBottle { url });
        self.modal_input.read(cx).focus(window);
        cx.notify();
    }

    pub fn open_add_dll_modal(
        &mut self,
        url: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.modal_input.update(cx, |i, cx| i.clear(cx));
        self.active_modal = Some(ActiveModal::AddDllOverride {
            url,
            mode: "native,builtin".to_string(),
        });
        self.modal_input.read(cx).focus(window);
        cx.notify();
    }

    pub fn request_quit(&mut self, cx: &mut Context<Self>) {
        if self.quit_in_progress {
            return;
        }
        if self.prefs.skip_quit_confirmation {
            self.finish_quit(cx);
            return;
        }
        let bridge = Arc::clone(&self.bridge);
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let res: anyhow::Result<Value> = cx
                .background_executor()
                .spawn(async move { bridge.call("app.quitCheck", json!({})) })
                .await;
            let count = res
                .ok()
                .and_then(|v| v.get("runningCount").and_then(|n| n.as_i64()))
                .unwrap_or(0) as i32;
            let _ = this.update(cx, |app, cx| {
                if count > 0 {
                    app.active_modal = Some(ActiveModal::ConfirmQuit {
                        running_count: count,
                    });
                    cx.notify();
                } else {
                    app.finish_quit(cx);
                }
            });
        })
        .detach();
    }

    pub fn finish_quit(&mut self, cx: &mut Context<Self>) {
        self.quit_in_progress = true;
        let bridge = Arc::clone(&self.bridge);
        cx.spawn(async move |_this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let b = Arc::clone(&bridge);
            let _ = cx
                .background_executor()
                .spawn(async move {
                    let _: anyhow::Result<Value> = b.call("app.prepareQuit", json!({}));
                    b.shutdown();
                })
                .await;
            let _ = cx.update(|cx| cx.quit());
        })
        .detach();
    }

    pub fn submit_active_modal(&mut self, cx: &mut Context<Self>) {
        let Some(modal) = self.active_modal.clone() else {
            return;
        };
        let input_text = self.modal_input.read(cx).text().trim().to_string();

        match modal {
            ActiveModal::CreateBottle {
                win_version,
                location,
            } => {
                if input_text.is_empty() {
                    self.push_toast(ToastStyle::Warning, "Enter a name for the new PC.", None, cx);
                    return;
                }
                self.active_modal = None;
                self.spawn_rpc(
                    "bottles.create",
                    json!({
                        "name": input_text,
                        "windowsVersion": win_version,
                        "location": location,
                    }),
                    |app, created: BottleDto, cx| {
                        let url = created.url.clone();
                        app.bottles.push(created);
                        app.nav = NavSection::Bottle(url);
                        app.refresh_steam_setup(cx);
                        app.push_toast(ToastStyle::Success, "PC created.", None, cx);
                        cx.notify();
                    },
                    cx,
                );
            }
            ActiveModal::RenameBottle { url } => {
                if input_text.is_empty() {
                    return;
                }
                self.active_modal = None;
                self.spawn_rpc(
                    "bottles.rename",
                    json!({ "url": url, "name": input_text }),
                    |app, updated: BottleDto, cx| {
                        if let Some(slot) = app.bottles.iter_mut().find(|b| b.url == updated.url) {
                            *slot = updated;
                        }
                        app.refresh_library(cx);
                        cx.notify();
                    },
                    cx,
                );
            }
            ActiveModal::DuplicateBottle { url } => {
                self.active_modal = None;
                let req_name = if input_text.is_empty() {
                    Value::Null
                } else {
                    Value::String(input_text)
                };
                self.spawn_rpc(
                    "bottles.duplicate",
                    json!({ "url": url, "name": req_name }),
                    |app, cloned: BottleDto, cx| {
                        let next_url = cloned.url.clone();
                        app.bottles.push(cloned);
                        app.nav = NavSection::Bottle(next_url);
                        cx.notify();
                    },
                    cx,
                );
            }
            ActiveModal::DeleteBottle {
                url, move_to_trash, ..
            } => {
                self.active_modal = None;
                self.spawn_rpc(
                    "bottles.delete",
                    json!({ "url": url, "moveToTrash": move_to_trash }),
                    |app, list: Vec<BottleDto>, cx| {
                        app.bottles = list;
                        app.nav = NavSection::Library;
                        app.refresh_library(cx);
                        app.push_toast(ToastStyle::Info, "PC deleted.", None, cx);
                        cx.notify();
                    },
                    cx,
                );
            }
            ActiveModal::ConfirmUninstallRuntime => {
                self.active_modal = None;
                self.uninstall_runtime(cx);
            }
            ActiveModal::ConfirmClearShaders => {
                self.active_modal = None;
                self.clear_shader_caches(cx);
            }
            ActiveModal::ConfirmQuit { .. } => {
                self.active_modal = None;
                self.finish_quit(cx);
            }
            ActiveModal::AddDllOverride { url, mode } => {
                if input_text.is_empty() {
                    return;
                }
                self.active_modal = None;
                self.update_bottle_settings(
                    &url,
                    move |bs| {
                        bs.custom_dll_overrides.retain(|d| d.dll_name != input_text);
                        bs.custom_dll_overrides.push(DllOverrideDto {
                            dll_name: input_text,
                            mode,
                        });
                    },
                    cx,
                );
            }
        }
        cx.notify();
    }

    fn render_active_modal(&self, theme: Theme, cx: &mut Context<Self>) -> Option<AnyElement> {
        let modal = self.active_modal.as_ref()?;
        match modal {
            ActiveModal::CreateBottle {
                win_version,
                location: _,
            } => {
                let win_choices = [("win10", "Win 10"), ("win11", "Win 11"), ("win7", "Win 7")];
                let body = div()
                    .flex()
                    .flex_col()
                    .gap(S3)
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap(px(4.0))
                            .child(
                                div()
                                    .text_size(px(12.5))
                                    .text_color(theme.muted)
                                    .child("PC name"),
                            )
                            .child(self.modal_input.clone()),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div()
                                    .text_size(px(12.5))
                                    .text_color(theme.muted)
                                    .child("Windows version"),
                            )
                            .child(div().flex().items_center().gap(S1).children(
                                win_choices.iter().enumerate().map(|(i, (raw, label))| {
                                    let active = win_version == *raw;
                                    let r = (*raw).to_string();
                                    choice_chip(
                                        ("mc-win", i),
                                        *label,
                                        active,
                                        theme,
                                        cx.listener(move |this, _, _, cx| {
                                            if let Some(ActiveModal::CreateBottle {
                                                win_version,
                                                ..
                                            }) = &mut this.active_modal
                                            {
                                                *win_version = r.clone();
                                                cx.notify();
                                            }
                                        }),
                                    )
                                }),
                            )),
                    )
                    .into_any_element();

                let footer = modal_footer(
                    "Cancel",
                    "Create PC",
                    ButtonVariant::Primary,
                    theme,
                    cx,
                );

                Some(modal_dialog(
                    "modal-create-pc",
                    "Create Windows PC",
                    Some(
                        format!(
                            "Initializes a {} container inside your PCs folder.",
                            pretty_win_version(win_version)
                        )
                        .into(),
                    ),
                    440.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::RenameBottle { .. } => {
                let body = div().child(self.modal_input.clone()).into_any_element();
                let footer = modal_footer("Cancel", "Save name", ButtonVariant::Primary, theme, cx);
                Some(modal_dialog(
                    "modal-rename-pc",
                    "Rename PC",
                    None,
                    400.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::DuplicateBottle { .. } => {
                let body = div().child(self.modal_input.clone()).into_any_element();
                let footer = modal_footer("Cancel", "Duplicate", ButtonVariant::Primary, theme, cx);
                Some(modal_dialog(
                    "modal-dup-pc",
                    "Duplicate PC",
                    Some("Creates an independent copy of drive_c and all settings.".into()),
                    420.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::DeleteBottle {
                name,
                move_to_trash,
                ..
            } => {
                let trash = *move_to_trash;
                let body = div()
                    .flex()
                    .items_center()
                    .gap(S2)
                    .child(choice_chip(
                        "del-trash",
                        "Move to Trash",
                        trash,
                        theme,
                        cx.listener(|this, _, _, cx| {
                            if let Some(ActiveModal::DeleteBottle { move_to_trash, .. }) =
                                &mut this.active_modal
                            {
                                *move_to_trash = true;
                                cx.notify();
                            }
                        }),
                    ))
                    .child(choice_chip(
                        "del-perm",
                        "Delete permanently",
                        !trash,
                        theme,
                        cx.listener(|this, _, _, cx| {
                            if let Some(ActiveModal::DeleteBottle { move_to_trash, .. }) =
                                &mut this.active_modal
                            {
                                *move_to_trash = false;
                                cx.notify();
                            }
                        }),
                    ))
                    .into_any_element();
                let footer = modal_footer("Cancel", "Delete PC", ButtonVariant::Danger, theme, cx);
                Some(modal_dialog(
                    "modal-del-pc",
                    format!("Delete “{name}”?"),
                    Some("All Windows applications, save data, and prefixes inside this PC will be deleted.".into()),
                    440.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::ConfirmUninstallRuntime => {
                let body = div()
                    .text_size(px(13.0))
                    .line_height(px(19.0))
                    .text_color(theme.muted)
                    .child("Your Windows PCs stay on disk, but you will need to reinstall GmacWine before launching games again.")
                    .into_any_element();
                let footer = modal_footer("Cancel", "Uninstall", ButtonVariant::Danger, theme, cx);
                Some(modal_dialog(
                    "modal-uninstall-rt",
                    "Uninstall GmacWine?",
                    None,
                    420.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::ConfirmClearShaders => {
                let body = div()
                    .text_size(px(13.0))
                    .line_height(px(19.0))
                    .text_color(theme.muted)
                    .child("Running PCs will be stopped before clearing compiled D3DMetal, DXVK, and DXMT shaders.")
                    .into_any_element();
                let footer = modal_footer(
                    "Cancel",
                    "Clear caches",
                    ButtonVariant::Primary,
                    theme,
                    cx,
                );
                Some(modal_dialog(
                    "modal-clear-sh",
                    "Clear shader caches?",
                    None,
                    420.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::ConfirmQuit { running_count } => {
                let body = div()
                    .text_size(px(13.0))
                    .line_height(px(19.0))
                    .text_color(theme.muted)
                    .child(format!(
                        "{running_count} Windows {} currently running. Quitting will clean up Wine processes according to each PC's policy.",
                        if *running_count == 1 { "process is" } else { "processes are" }
                    ))
                    .into_any_element();
                let footer = modal_footer("Cancel", "Quit Gmac", ButtonVariant::Danger, theme, cx);
                Some(modal_dialog(
                    "modal-quit",
                    "Quit Gmac?",
                    None,
                    420.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
            ActiveModal::AddDllOverride { mode, .. } => {
                let modes = [
                    ("native,builtin", "Native then Builtin"),
                    ("builtin,native", "Builtin then Native"),
                    ("native", "Native only"),
                    ("builtin", "Builtin only"),
                    ("", "Disable"),
                ];
                let body = div()
                    .flex()
                    .flex_col()
                    .gap(S3)
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap(px(4.0))
                            .child(
                                div()
                                    .text_size(px(12.5))
                                    .text_color(theme.muted)
                                    .child("DLL name (without .dll)"),
                            )
                            .child(self.modal_input.clone()),
                    )
                    .child(
                        div().flex().flex_wrap().gap(S1).children(modes.iter().enumerate().map(
                            |(i, (raw, label))| {
                                let r = (*raw).to_string();
                                choice_chip(
                                    ("dll-mode", i),
                                    *label,
                                    mode == *raw,
                                    theme,
                                    cx.listener(move |this, _, _, cx| {
                                        if let Some(ActiveModal::AddDllOverride { mode, .. }) =
                                            &mut this.active_modal
                                        {
                                            *mode = r.clone();
                                            cx.notify();
                                        }
                                    }),
                                )
                            },
                        )),
                    )
                    .into_any_element();
                let footer = modal_footer("Cancel", "Add override", ButtonVariant::Primary, theme, cx);
                Some(modal_dialog(
                    "modal-add-dll",
                    "Add DLL override",
                    None,
                    440.0,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.active_modal = None;
                        cx.notify();
                    }),
                    body,
                    footer,
                ))
            }
        }
    }

    fn render_toast(&self, theme: Theme, cx: &mut Context<Self>) -> Option<AnyElement> {
        let toast = self.toast.as_ref()?;
        let dot_color = match toast.style {
            ToastStyle::Info => theme.accent_text,
            ToastStyle::Success => theme.success,
            ToastStyle::Warning => theme.warning,
            ToastStyle::Error => theme.danger,
        };
        let log_path = toast.log_path.clone();

        Some(
            div()
                .id("toast-banner")
                .absolute()
                .right(S5)
                .bottom(S5)
                .max_w(px(420.0))
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border_strong)
                .rounded(R_MD)
                .shadow_lg()
                .px(S4)
                .py(S3)
                .flex()
                .items_center()
                .gap(S3)
                .child(div().size(px(8.0)).rounded(px(999.0)).bg(dot_color).flex_shrink_0())
                .child(
                    div()
                        .flex_1()
                        .text_size(px(13.0))
                        .text_color(theme.ink)
                        .child(toast.message.clone()),
                )
                .when_some(log_path, |d, p| {
                    d.child(
                        Button::new("toast-view-log", theme)
                            .label("Inspect")
                            .variant(ButtonVariant::Secondary)
                            .size(ButtonSize::Sm)
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.toast = None;
                                this.nav = NavSection::Activity;
                                this.activity_tab = ActivityTab::Logs;
                                this.refresh_logs(cx);
                                this.select_log(p.clone(), cx);
                                this.classify_log(p.clone(), cx);
                                cx.notify();
                            })),
                    )
                })
                .child(
                    div()
                        .id("toast-close")
                        .p(px(4.0))
                        .rounded(px(4.0))
                        .cursor(gpui::CursorStyle::PointingHand)
                        .hover(|s| s.bg(theme.surface_subtle))
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.toast = None;
                            cx.notify();
                        }))
                        .child(icon("x", px(13.0), theme.muted)),
                )
                .into_any_element(),
        )
    }
}

fn modal_footer(
    cancel_label: &'static str,
    confirm_label: &'static str,
    confirm_variant: ButtonVariant,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    div()
        .flex()
        .items_center()
        .gap(S2)
        .child(
            Button::new("modal-cancel", theme)
                .label(cancel_label)
                .variant(ButtonVariant::Secondary)
                .size(ButtonSize::Md)
                .on_click(cx.listener(|this, _, _, cx| {
                    this.active_modal = None;
                    cx.notify();
                })),
        )
        .child(
            Button::new("modal-confirm", theme)
                .label(confirm_label)
                .variant(confirm_variant)
                .size(ButtonSize::Md)
                .on_click(cx.listener(|this, _, _, cx| {
                    this.submit_active_modal(cx);
                })),
        )
        .into_any_element()
}

impl Render for GmacApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let theme = self.current_theme(window);
        self.sync_input_themes(theme, cx);

        let content: AnyElement = match self.nav.clone() {
            NavSection::Library => crate::views::library::render(self, theme, window, cx),
            NavSection::Statistics => crate::views::statistics::render(self, theme, cx),
            NavSection::Activity => crate::views::activity::render(self, theme, cx),
            NavSection::Bottle(url) => crate::views::bottle::render(self, &url, theme, cx),
            NavSection::Settings => crate::views::settings::render(self, theme, cx),
        };

        div()
            .id("gmac-root")
            .track_focus(&self.focus_handle)
            .size_full()
            .bg(theme.bg)
            .text_color(theme.ink)
            .on_action(cx.listener(|this, _: &QuitApp, _, cx| {
                this.request_quit(cx);
            }))
            .on_action(cx.listener(|this, _: &CloseWindow, _, cx| {
                this.request_quit(cx);
            }))
            .on_action(cx.listener(|this, _: &NewBottle, window, cx| {
                this.open_create_bottle_modal(window, cx);
            }))
            .on_action(cx.listener(|this, _: &OpenSettings, window, cx| {
                this.navigate(NavSection::Settings, window, cx);
            }))
            .on_action(cx.listener(|this, _: &RefreshView, _, cx| {
                this.refresh_current(cx);
            }))
            .on_action(cx.listener(|this, _: &NavLibrary, window, cx| {
                this.navigate(NavSection::Library, window, cx);
            }))
            .on_action(cx.listener(|this, _: &NavStatistics, window, cx| {
                this.navigate(NavSection::Statistics, window, cx);
            }))
            .on_action(cx.listener(|this, _: &NavActivity, window, cx| {
                this.navigate(NavSection::Activity, window, cx);
            }))
            .on_action(cx.listener(|this, _: &DismissOverlay, _, cx| {
                this.active_modal = None;
                this.open_game_menu_id = None;
                this.open_bottle_menu = false;
                cx.notify();
            }))
            .on_click(cx.listener(|this, _, _, cx| {
                if this.open_game_menu_id.is_some() || this.open_bottle_menu {
                    this.open_game_menu_id = None;
                    this.open_bottle_menu = false;
                    cx.notify();
                }
            }))
            .flex()
            .child(crate::views::sidebar::render(self, theme, cx))
            .child(div().flex_1().h_full().min_w(px(0.0)).child(content))
            .when_some(self.render_toast(theme, cx), |this, t| this.child(t))
            .when_some(self.render_active_modal(theme, cx), |this, m| this.child(m))
    }
}
