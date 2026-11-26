use gpui::{
    AnyElement, Context, InteractiveElement, IntoElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, div, prelude::*, px,
};

use crate::app::GmacApp;
use crate::components::badge::{StatusDot, status_pill};
use crate::components::button::{Button, ButtonSize, ButtonVariant};
use crate::components::segmented::{SegmentOption, segmented_control};
use crate::components::toggle::{card_section, choice_chip, setting_row, toggle_switch};
use crate::models::format_bytes;
use crate::theme::{R_LG, R_SM, S1, S2, S3, S4, S5, S6, Theme, ThemeMode};
use crate::views::{ActiveModal, SettingsTab};

pub fn render(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let tab = app.settings_tab;

    div()
        .size_full()
        .flex()
        .flex_col()
        .child(
            div()
                .px(S6)
                .pt(S5)
                .pb(S4)
                .border_b_1()
                .border_color(theme.border)
                .flex()
                .items_center()
                .justify_between()
                .gap(S4)
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(2.0))
                        .child(
                            div()
                                .text_size(px(20.0))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .child("Settings"),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(theme.muted)
                                .child("Application preferences, Wine runtime, and storage"),
                        ),
                )
                .child(segmented_control(
                    "settings-tab",
                    vec![
                        SegmentOption {
                            value: SettingsTab::General,
                            label: "General".into(),
                        },
                        SegmentOption {
                            value: SettingsTab::Gaming,
                            label: "Gaming".into(),
                        },
                        SegmentOption {
                            value: SettingsTab::Engine,
                            label: "Engine".into(),
                        },
                        SegmentOption {
                            value: SettingsTab::Storage,
                            label: "Storage".into(),
                        },
                    ],
                    tab,
                    theme,
                    cx.listener(|this, next: &SettingsTab, _, cx| {
                        this.settings_tab = *next;
                        if *next == SettingsTab::Storage {
                            this.refresh_storage_candidates(cx);
                        }
                        cx.notify();
                    }),
                )),
        )
        .child(
            div()
                .id("settings-scroll")
                .flex_1()
                .min_h(px(0.0))
                .overflow_y_scroll()
                .child(
                    div()
                        .w_full()
                        .px(S6)
                        .py(S5)
                        .child(
                            div()
                                .max_w(px(760.0))
                                .flex()
                                .flex_col()
                                .gap(S5)
                                .child(match tab {
                                    SettingsTab::General => render_general(app, theme, cx),
                                    SettingsTab::Gaming => render_gaming(app, theme, cx),
                                    SettingsTab::Engine => render_engine(app, theme, cx),
                                    SettingsTab::Storage => render_storage(app, theme, cx),
                                }),
                        ),
                ),
        )
        .into_any_element()
}

fn render_general(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let prefs = &app.prefs;
    let mode = ThemeMode::from_str(&prefs.theme_mode);

    let win_options = [
        ("win10", "Win 10"),
        ("win11", "Win 11"),
        ("win81", "Win 8.1"),
        ("win7", "Win 7"),
    ];
    let term_options = [("terminal", "Terminal"), ("iterm", "iTerm2")];

    div()
        .flex()
        .flex_col()
        .gap(S5)
        .child(card_section(
            Some("Appearance".into()),
            theme,
            vec![setting_row(
                "Theme",
                Some("Match macOS appearance or lock light or dark surfaces.".into()),
                segmented_control(
                    "pref-theme",
                    vec![
                        SegmentOption {
                            value: ThemeMode::System,
                            label: "System".into(),
                        },
                        SegmentOption {
                            value: ThemeMode::Light,
                            label: "Light".into(),
                        },
                        SegmentOption {
                            value: ThemeMode::Dark,
                            label: "Dark".into(),
                        },
                    ],
                    mode,
                    theme,
                    cx.listener(|this, next: &ThemeMode, _, cx| {
                        this.set_theme_mode(*next, cx);
                    }),
                ),
                true,
                theme,
            )],
        ))
        .child(card_section(
            Some("Startup and PCs".into()),
            theme,
            vec![
                setting_row(
                    "Open Steam at launch",
                    Some("Start Steam automatically when Gmac opens.".into()),
                    toggle_switch(
                        "pref-open-steam",
                        prefs.open_steam_at_launch,
                        false,
                        theme,
                        cx.listener(|this, _, _, cx| {
                            let next = !this.prefs.open_steam_at_launch;
                            this.update_prefs(|p| p.open_steam_at_launch = next, cx);
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Default Windows version",
                    Some("Version assigned when creating new PCs.".into()),
                    div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                        win_options.iter().enumerate().map(|(i, (ver, label))| {
                            let val = (*ver).to_string();
                            let active = prefs.default_win_version == *ver;
                            choice_chip(
                                ("pref-win", i),
                                *label,
                                active,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_prefs(|p| p.default_win_version = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Preferred terminal",
                    Some("Application used when opening a PC shell.".into()),
                    div().flex().items_center().gap(S1).children(
                        term_options.iter().enumerate().map(|(i, (val, label))| {
                            let v = (*val).to_string();
                            let active = prefs.preferred_terminal == *val;
                            choice_chip(
                                ("pref-term", i),
                                *label,
                                active,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let next = v.clone();
                                    this.update_prefs(|p| p.preferred_terminal = next, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Quit without confirmation",
                    Some("Skip the confirmation prompt when Windows processes are still active.".into()),
                    toggle_switch(
                        "pref-skip-quit",
                        prefs.skip_quit_confirmation,
                        false,
                        theme,
                        cx.listener(|this, _, _, cx| {
                            let next = !this.prefs.skip_quit_confirmation;
                            this.update_prefs(|p| p.skip_quit_confirmation = next, cx);
                        }),
                    ),
                    true,
                    theme,
                ),
            ],
        ))
        .into_any_element()
}

fn render_gaming(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let prefs = &app.prefs;

    card_section(
        Some("macOS gaming integration".into()),
        theme,
        vec![
            setting_row(
                "macOS Game Mode",
                Some("Prioritize CPU and GPU resources and reduce Bluetooth audio/input latency when games run.".into()),
                toggle_switch(
                    "pref-gamemode",
                    prefs.game_mode_enabled,
                    false,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        let next = !this.prefs.game_mode_enabled;
                        this.update_prefs(|p| p.game_mode_enabled = next, cx);
                    }),
                ),
                false,
                theme,
            ),
            setting_row(
                "Fit fullscreen games below notch",
                Some("Reserve the MacBook display camera housing area so fullscreen HUD elements stay visible.".into()),
                toggle_switch(
                    "pref-notch",
                    prefs.fit_games_below_notch,
                    false,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        let next = !this.prefs.fit_games_below_notch;
                        this.update_prefs(|p| p.fit_games_below_notch = next, cx);
                    }),
                ),
                false,
                theme,
            ),
            setting_row(
                "Check GmacWine updates automatically",
                Some("Look for newer runtime releases on launch.".into()),
                toggle_switch(
                    "pref-updates",
                    prefs.check_gmac_wine_updates,
                    false,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        let next = !this.prefs.check_gmac_wine_updates;
                        this.update_prefs(|p| p.check_gmac_wine_updates = next, cx);
                    }),
                ),
                true,
                theme,
            ),
        ],
    )
}

fn render_engine(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let status = app.runtime_status.as_ref();
    let wine_installed = status.map(|s| s.wine_installed).unwrap_or(false);
    let d3d_installed = status.map(|s| s.d3d_metal_installed).unwrap_or(false);
    let rosetta = status.map(|s| s.rosetta_installed).unwrap_or(false);
    let gmac_d3d12 = status.map(|s| s.gmac_d3d12_available).unwrap_or(false);

    let progress = app.runtime_progress.as_ref();

    div()
        .flex()
        .flex_col()
        .gap(S5)
        .when_some(progress, |this, prog| {
            let pct = prog.progress.clamp(0.0, 1.0) as f32;
            this.child(
                div()
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border_strong)
                    .rounded(R_LG)
                    .p(S4)
                    .flex()
                    .flex_col()
                    .gap(S2)
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div()
                                    .text_size(px(13.5))
                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                    .text_color(theme.ink)
                                    .child(prog.phase.clone()),
                            )
                            .child(
                                div()
                                    .text_size(px(12.0))
                                    .text_color(theme.muted)
                                    .child(format!("{:.0}%", pct * 100.0)),
                            ),
                    )
                    .child(
                        div()
                            .h(px(6.0))
                            .w_full()
                            .rounded(px(999.0))
                            .bg(theme.surface_subtle)
                            .overflow_hidden()
                            .child(
                                div()
                                    .h_full()
                                    .w(gpui::relative(pct))
                                    .bg(theme.accent)
                                    .rounded(px(999.0)),
                            ),
                    )
                    .when(!prog.detail.is_empty(), |d| {
                        d.child(
                            div()
                                .text_size(px(12.0))
                                .text_color(theme.muted)
                                .child(prog.detail.clone()),
                        )
                    }),
            )
        })
        .child(card_section(
            Some("Runtime components".into()),
            theme,
            vec![
                setting_row(
                    "GmacWine",
                    Some(
                        status
                            .and_then(|s| s.wine_version.as_deref())
                            .map(|v| format!("Version {v}"))
                            .unwrap_or_else(|| "Required to launch Windows applications.".to_string())
                            .into(),
                    ),
                    div()
                        .flex()
                        .flex_wrap()
                        .justify_end()
                        .items_center()
                        .gap(S2)
                        .child(status_pill(
                            if wine_installed { "Installed" } else { "Not installed" },
                            if wine_installed { StatusDot::Active } else { StatusDot::Warning },
                            theme,
                        ))
                        .when(!wine_installed, |d| {
                            d.child(
                                Button::new("eng-install", theme)
                                    .label("Install")
                                    .icon("download")
                                    .variant(ButtonVariant::Primary)
                                    .size(ButtonSize::Sm)
                                    .disabled(app.runtime_progress.is_some())
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.install_runtime(cx);
                                    })),
                            )
                        })
                        .when(wine_installed, |d| {
                            d.child(
                                Button::new("eng-check-upd", theme)
                                    .label("Check updates")
                                    .variant(ButtonVariant::Secondary)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.check_runtime_updates(cx);
                                    })),
                            )
                            .child(
                                Button::new("eng-uninstall", theme)
                                    .label("Uninstall")
                                    .variant(ButtonVariant::Danger)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.active_modal = Some(ActiveModal::ConfirmUninstallRuntime);
                                        cx.notify();
                                    })),
                            )
                        }),
                    false,
                    theme,
                ),
                setting_row(
                    "D3DMetal (Game Porting Toolkit)",
                    Some(
                        status
                            .and_then(|s| s.gptk_version.as_deref())
                            .map(|v| format!("GPTK {v} imported"))
                            .unwrap_or_else(|| "Optional DirectX 11 and 12 translator from Apple GPTK DMG.".to_string())
                            .into(),
                    ),
                    div()
                        .flex()
                        .flex_wrap()
                        .justify_end()
                        .items_center()
                        .gap(S2)
                        .child(status_pill(
                            if d3d_installed { "Ready" } else { "Not imported" },
                            if d3d_installed { StatusDot::Active } else { StatusDot::Idle },
                            theme,
                        ))
                        .child(
                            Button::new("eng-import-gptk", theme)
                                .label("Import DMG…")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(|this, _, window, cx| {
                                    this.import_gptk_dmg(window, cx);
                                })),
                        ),
                    false,
                    theme,
                ),
                setting_row(
                    "DXMT / Gmac D3D12",
                    Some(
                        format!(
                            "DXMT {} · DXVK {} · Bundled D3D12 {}",
                            status.and_then(|s| s.dxmt_version.as_deref()).unwrap_or("—"),
                            status.and_then(|s| s.dxvk_version.as_deref()).unwrap_or("—"),
                            if gmac_d3d12 { "available" } else { "unavailable" }
                        )
                        .into(),
                    ),
                    status_pill(
                        if gmac_d3d12 { "Bundled" } else { "Not bundled" },
                        if gmac_d3d12 { StatusDot::Active } else { StatusDot::Idle },
                        theme,
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Rosetta 2",
                    Some("Required on Apple Silicon to run x86_64 Windows binaries.".into()),
                    status_pill(
                        if rosetta { "Installed" } else { "Missing" },
                        if rosetta { StatusDot::Active } else { StatusDot::Warning },
                        theme,
                    ),
                    true,
                    theme,
                ),
            ],
        ))
        .when_some(app.runtime_update_check.clone(), |this, upd| {
            this.child(
                div()
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border)
                    .rounded(R_SM)
                    .px(S4)
                    .py(S3)
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(
                        div()
                            .text_size(px(13.0))
                            .text_color(theme.ink)
                            .child(if upd.update_available {
                                format!(
                                    "GmacWine {} is available (installed: {}).",
                                    upd.latest_version,
                                    upd.current_version.as_deref().unwrap_or("none")
                                )
                            } else {
                                format!("GmacWine is up to date ({}).", upd.latest_version)
                            }),
                    )
                    .when(upd.update_available, |d| {
                        d.child(
                            Button::new("eng-upd-install", theme)
                                .label("Update now")
                                .variant(ButtonVariant::Primary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.install_runtime(cx);
                                })),
                        )
                    }),
            )
        })
        .child(card_section(
            Some("Maintenance".into()),
            theme,
            vec![
                setting_row(
                    "Clear shader caches",
                    Some("Stops running PCs and clears D3DMetal, DXVK, and DXMT shader caches.".into()),
                    Button::new("eng-clear-shaders", theme)
                        .label("Clear caches")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.active_modal = Some(ActiveModal::ConfirmClearShaders);
                            cx.notify();
                        })),
                    false,
                    theme,
                ),
                setting_row(
                    "Wine logs folder",
                    Some(
                        status
                            .map(|s| format!("{} ({})", s.logs_dir, format_bytes(s.logs_bytes)))
                            .unwrap_or_else(|| "Inspect raw Wine output logs.".to_string())
                            .into(),
                    ),
                    Button::new("eng-open-logs", theme)
                        .label("Open folder")
                        .icon("folder")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.open_logs_folder(cx);
                        })),
                    true,
                    theme,
                ),
            ],
        ))
        .into_any_element()
}

fn render_storage(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let default_dir: SharedString = if app.prefs.default_bottle_location.is_empty() {
        app.runtime_status
            .as_ref()
            .map(|s| s.default_bottle_dir.clone())
            .unwrap_or_else(|| "Default container folder".to_string())
            .into()
    } else {
        app.prefs.default_bottle_location.clone().into()
    };

    let retention_days = [1, 7, 14, 30];

    div()
        .flex()
        .flex_col()
        .gap(S5)
        .child(card_section(
            Some("Locations and retention".into()),
            theme,
            vec![
                setting_row(
                    "Default PC folder",
                    Some(default_dir),
                    Button::new("stor-pick-dir", theme)
                        .label("Change…")
                        .icon("folder")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.pick_default_bottle_location(window, cx);
                        })),
                    false,
                    theme,
                ),
                setting_row(
                    "Import existing PC folder",
                    Some("Register an existing Wine bottle directory on disk.".into()),
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .child(
                            Button::new("stor-scan-pcs", theme)
                                .label("Scan for PCs")
                                .icon("refresh")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.refresh_storage_candidates(cx);
                                })),
                        )
                        .child(
                            Button::new("stor-import-dir", theme)
                                .label("Import PC…")
                                .icon("folder")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(|this, _, window, cx| {
                                    this.import_existing_bottle(window, cx);
                                })),
                        ),
                    false,
                    theme,
                ),
                setting_row(
                    "Log retention",
                    Some("Automatically delete Wine logs older than this window.".into()),
                    div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                        retention_days.iter().enumerate().map(|(i, days)| {
                            let d = *days;
                            let active = app.prefs.log_retention_days == d;
                            choice_chip(
                                ("stor-ret", i),
                                format!("{d} d"),
                                active,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_prefs(|p| p.log_retention_days = d, cx);
                                }),
                            )
                        }),
                    ),
                    true,
                    theme,
                ),
            ],
        ))
        .when(!app.orphans.is_empty(), |this| {
            let rows: Vec<AnyElement> = app
                .orphans
                .iter()
                .enumerate()
                .map(|(i, o)| {
                    let is_last = i + 1 == app.orphans.len();
                    let url = o.url.clone();
                    setting_row(
                        o.name.clone(),
                        Some(o.url.clone().into()),
                        Button::new(("orphan-imp", i), theme)
                            .label("Re-import")
                            .variant(ButtonVariant::Secondary)
                            .size(ButtonSize::Sm)
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.import_bottle_at_path(url.clone(), cx);
                            })),
                        is_last,
                        theme,
                    )
                })
                .collect();

            this.child(
                div()
                    .flex()
                    .flex_col()
                    .gap(S2)
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div()
                                    .text_size(px(12.0))
                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                    .text_color(theme.muted)
                                    .child("Orphaned PCs on disk"),
                            )
                            .child(
                                Button::new("stor-reimport-all", theme)
                                    .label("Re-import all")
                                    .variant(ButtonVariant::Secondary)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.reimport_orphans(cx);
                                    })),
                            ),
                    )
                    .child(card_section(None, theme, rows)),
            )
        })
        .when(!app.legacy_bottles.is_empty(), |this| {
            let rows: Vec<AnyElement> = app
                .legacy_bottles
                .iter()
                .enumerate()
                .map(|(i, l)| {
                    let is_last = i + 1 == app.legacy_bottles.len();
                    let url = l.url.clone();
                    setting_row(
                        l.name.clone(),
                        Some(l.url.clone().into()),
                        Button::new(("legacy-imp", i), theme)
                            .label("Import")
                            .variant(ButtonVariant::Secondary)
                            .size(ButtonSize::Sm)
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.import_bottle_at_path(url.clone(), cx);
                            })),
                        is_last,
                        theme,
                    )
                })
                .collect();
            this.child(card_section(Some("Whisky PCs available to import".into()), theme, rows))
        })
        .into_any_element()
}
