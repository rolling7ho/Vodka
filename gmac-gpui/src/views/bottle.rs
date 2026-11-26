use std::path::PathBuf;

use gpui::{
    AnyElement, Context, CursorStyle, InteractiveElement, IntoElement, ObjectFit, ParentElement,
    StatefulInteractiveElement, Styled, Window, div, img, prelude::*, px,
};

use crate::app::GmacApp;
use crate::components::badge::{StatusDot, pill_badge, status_pill};
use crate::components::button::{Button, ButtonSize, ButtonVariant, icon_button};
use crate::components::icon;
use crate::components::toggle::{
    card_section, choice_chip, setting_row, setting_row_stacked, toggle_switch,
};
use crate::models::{BottleDto, pretty_backend, pretty_win_version};
use crate::theme::{R_LG, R_MD, R_SM, S1, S2, S3, S4, S5, S6, Theme};
use crate::views::{ActiveModal, BottleTab, PresetFilter, ToastStyle, empty_state};

pub fn render(
    app: &GmacApp,
    bottle_url: &str,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let Some(bottle) = app.bottles.iter().find(|b| b.url == bottle_url) else {
        return div()
            .size_full()
            .p(S6)
            .child(empty_state(
                "pc",
                "PC not found",
                "This PC may have been removed or moved on disk.",
                None,
                theme,
            ))
            .into_any_element();
    };

    let url = bottle.url.clone();
    let tab = app.bottle_tab;
    let is_running = bottle.steam_running || bottle.running_process_count > 0;
    let meta = format!(
        "{} · {} · {}",
        pretty_win_version(&bottle.settings.windows_version),
        pretty_backend(&bottle.resolved_backend),
        if bottle.running_process_count > 0 {
            format!("{} running", bottle.running_process_count)
        } else if bottle.steam_running {
            "Steam running".to_string()
        } else {
            "Idle".to_string()
        }
    );

    let tabs = [
        (BottleTab::Overview, "Overview"),
        (BottleTab::Programs, "Programs"),
        (BottleTab::Settings, "Settings"),
        (BottleTab::Presets, "Presets"),
        (BottleTab::Tools, "Tools"),
    ];

    let url_run = url.clone();
    let url_cdrive = url.clone();
    let url_term = url.clone();
    let url_rename = url.clone();
    let url_dup = url.clone();
    let url_kill = url.clone();
    let url_repair = url.clone();
    let url_remove = url.clone();
    let url_delete = url.clone();
    let bottle_name_del = bottle.name.clone();

    div()
        .relative()
        .size_full()
        .flex()
        .flex_col()
        // Header
        .child(
            div()
                .px(S6)
                .pt(S5)
                .border_b_1()
                .border_color(theme.border)
                .flex()
                .flex_col()
                .gap(S3)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .gap(S4)
                        .child(
                            div()
                                .flex_1()
                                .flex()
                                .flex_col()
                                .gap(px(3.0))
                                .min_w(px(0.0))
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap(S2)
                                        .min_w(px(0.0))
                                        .child(
                                            div()
                                                .text_size(px(20.0))
                                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                                .text_color(theme.ink)
                                                .truncate()
                                                .child(bottle.name.clone()),
                                        )
                                        .child(div().flex_shrink_0().child(status_pill(
                                            if !bottle.is_available {
                                                "Unavailable"
                                            } else if is_running {
                                                "Running"
                                            } else {
                                                "Ready"
                                            },
                                            if !bottle.is_available {
                                                StatusDot::Warning
                                            } else if is_running {
                                                StatusDot::Active
                                            } else {
                                                StatusDot::Idle
                                            },
                                            theme,
                                        ))),
                                )
                                .child(
                                    div()
                                        .text_size(px(13.0))
                                        .text_color(theme.muted)
                                        .truncate()
                                        .child(meta),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap(S2)
                                .flex_shrink_0()
                                .child(
                                    Button::new("pc-run-exe", theme)
                                        .label("Run executable…")
                                        .icon("play")
                                        .variant(ButtonVariant::Primary)
                                        .size(ButtonSize::Sm)
                                        .disabled(!bottle.is_available)
                                        .on_click(cx.listener(move |this, _, window, cx| {
                                            this.pick_and_run_file(url_run.clone(), window, cx);
                                        })),
                                )
                                .child(
                                    Button::new("pc-open-cdrive", theme)
                                        .label("C: drive")
                                        .icon("folder")
                                        .variant(ButtonVariant::Secondary)
                                        .size(ButtonSize::Sm)
                                        .disabled(!bottle.is_available)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.open_c_drive(url_cdrive.clone(), cx);
                                        })),
                                )
                                .child(
                                    Button::new("pc-open-term", theme)
                                        .label("Terminal")
                                        .icon("terminal")
                                        .variant(ButtonVariant::Secondary)
                                        .size(ButtonSize::Sm)
                                        .disabled(!bottle.is_available)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.open_terminal(url_term.clone(), cx);
                                        })),
                                )
                                .child(icon_button(
                                    "pc-more-menu-btn",
                                    "more",
                                    theme,
                                    cx.listener(|this, _, _, cx| {
                                        cx.stop_propagation();
                                        this.open_bottle_menu = !this.open_bottle_menu;
                                        cx.notify();
                                    }),
                                )),
                        ),
                )
                // Underline tabs
                .child(div().flex().items_center().gap(S4).children(
                    tabs.iter().enumerate().map(|(i, (tab_val, label))| {
                        let active = tab == *tab_val;
                        let tv = *tab_val;
                        let u_tab = url.clone();
                        div()
                            .id(("pc-tab", i))
                            .pb(px(10.0))
                            .pt(px(4.0))
                            .border_b_2()
                            .border_color(if active {
                                theme.accent
                            } else {
                                gpui::transparent_black()
                            })
                            .cursor(CursorStyle::PointingHand)
                            .text_size(px(13.0))
                            .font_weight(if active {
                                gpui::FontWeight::SEMIBOLD
                            } else {
                                gpui::FontWeight::MEDIUM
                            })
                            .text_color(if active { theme.ink } else { theme.muted })
                            .hover(move |s| if active { s } else { s.text_color(theme.ink) })
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.select_bottle_tab(&u_tab, tv, cx);
                            }))
                            .child(*label)
                    }),
                )),
        )
        // Body
        .child(
            div()
                .id("bottle-scroll")
                .flex_1()
                .min_h(px(0.0))
                .overflow_y_scroll()
                .child(
                    div()
                        .w_full()
                        .px(S6)
                        .py(S5)
                        .child(match tab {
                            BottleTab::Overview => render_overview(app, bottle, theme, cx),
                            BottleTab::Programs => render_programs(app, bottle, theme, cx),
                            BottleTab::Settings => render_settings(bottle, theme, cx),
                            BottleTab::Presets => render_presets(app, bottle, theme, cx),
                            BottleTab::Tools => render_tools(app, bottle, theme, cx),
                        }),
                ),
        )
        // Popover action menu (rendered last to stack above scrollable body)
        .when(app.open_bottle_menu, |this| {
            this.child(
                div()
                    .id("bottle-menu-popover")
                    .absolute()
                    .top(px(58.0))
                    .right(S6)
                    .w(px(208.0))
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border_strong)
                    .rounded(R_MD)
                    .shadow_lg()
                    .p(px(4.0))
                    .flex()
                    .flex_col()
                    .gap(px(2.0))
                    .on_click(|_, _, cx| cx.stop_propagation())
                    .child(menu_item(
                        "bm-rename",
                        "Rename PC…",
                        false,
                        theme,
                        cx.listener(move |this, _, window, cx| {
                            this.open_bottle_menu = false;
                            this.open_rename_bottle_modal(url_rename.clone(), window, cx);
                        }),
                    ))
                    .child(menu_item(
                        "bm-dup",
                        "Duplicate PC…",
                        false,
                        theme,
                        cx.listener(move |this, _, window, cx| {
                            this.open_bottle_menu = false;
                            this.open_duplicate_bottle_modal(url_dup.clone(), window, cx);
                        }),
                    ))
                    .child(menu_item(
                        "bm-kill",
                        "Kill running processes",
                        false,
                        theme,
                        cx.listener(move |this, _, _, cx| {
                            this.open_bottle_menu = false;
                            this.kill_bottle(url_kill.clone(), cx);
                        }),
                    ))
                    .child(menu_item(
                        "bm-repair",
                        "Repair Wine prefix",
                        false,
                        theme,
                        cx.listener(move |this, _, _, cx| {
                            this.open_bottle_menu = false;
                            this.repair_bottle_prefix(url_repair.clone(), cx);
                        }),
                    ))
                    .child(div().my(px(2.0)).h(px(1.0)).bg(theme.border))
                    .child(menu_item(
                        "bm-remove",
                        "Remove from list",
                        false,
                        theme,
                        cx.listener(move |this, _, _, cx| {
                            this.open_bottle_menu = false;
                            this.remove_bottle_from_list(url_remove.clone(), cx);
                        }),
                    ))
                    .child(menu_item(
                        "bm-delete",
                        "Delete PC…",
                        true,
                        theme,
                        cx.listener(move |this, _, _, cx| {
                            this.open_bottle_menu = false;
                            this.active_modal = Some(ActiveModal::DeleteBottle {
                                url: url_delete.clone(),
                                name: bottle_name_del.clone(),
                                move_to_trash: true,
                            });
                            cx.notify();
                        }),
                    )),
            )
        })
        .into_any_element()
}

fn menu_item(
    id: &'static str,
    label: &'static str,
    danger: bool,
    theme: Theme,
    on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut gpui::App) + 'static,
) -> AnyElement {
    div()
        .id(id)
        .w_full()
        .px(S2)
        .py(px(6.0))
        .rounded(px(5.0))
        .cursor(CursorStyle::PointingHand)
        .text_size(px(12.5))
        .text_color(if danger { theme.danger } else { theme.ink })
        .hover(move |s| {
            s.bg(if danger {
                theme.danger_soft
            } else {
                theme.surface_subtle
            })
        })
        .on_click(on_click)
        .child(label)
        .into_any_element()
}

fn render_overview(
    app: &GmacApp,
    bottle: &BottleDto,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let url = bottle.url.clone();
    let url_steam = url.clone();
    let url_install_steam = url.clone();
    let url_tab_programs = url.clone();
    let url_run = url.clone();

    let pinned: Vec<_> = app
        .programs_by_bottle
        .get(&url)
        .map(|list| list.iter().filter(|p| p.pinned).cloned().collect())
        .unwrap_or_default();

    let pinned_rows: Vec<AnyElement> = pinned
        .iter()
        .enumerate()
        .map(|(i, prog)| {
            let is_last = i + 1 == pinned.len();
            let b_url = url.clone();
            let b_url_unpin = url.clone();
            let p_url = prog.url.clone();
            let p_url_unpin = prog.url.clone();

            let mut row = div()
                .w_full()
                .px(S4)
                .py(S3)
                .flex()
                .items_center()
                .justify_between()
                .gap(S3)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S3)
                        .min_w(px(0.0))
                        .flex_1()
                        .child(
                            div()
                                .size(px(32.0))
                                .rounded(R_SM)
                                .bg(theme.surface_subtle)
                                .border_1()
                                .border_color(theme.border)
                                .overflow_hidden()
                                .flex()
                                .items_center()
                                .justify_center()
                                .flex_shrink_0()
                                .child(if let Some(ip) = &prog.icon_path {
                                    img(PathBuf::from(ip))
                                        .size_full()
                                        .object_fit(ObjectFit::Cover)
                                        .into_any_element()
                                } else {
                                    icon("pc", px(14.0), theme.faint).into_any_element()
                                }),
                        )
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .min_w(px(0.0))
                                .child(
                                    div()
                                        .text_size(px(13.5))
                                        .font_weight(gpui::FontWeight::MEDIUM)
                                        .text_color(theme.ink)
                                        .truncate()
                                        .child(prog.name.clone()),
                                )
                                .child(
                                    div()
                                        .text_size(px(11.5))
                                        .text_color(theme.faint)
                                        .truncate()
                                        .child(prog.url.clone()),
                                ),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .child(
                            Button::new(("ov-unpin", i), theme)
                                .label("Unpin")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.toggle_program_pin(
                                        b_url_unpin.clone(),
                                        p_url_unpin.clone(),
                                        false,
                                        cx,
                                    );
                                })),
                        )
                        .child(
                            Button::new(("ov-run", i), theme)
                                .label("Run")
                                .icon("play")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.run_program(b_url.clone(), p_url.clone(), cx);
                                })),
                        ),
                );
            if !is_last {
                row = row.border_b_1().border_color(theme.border);
            }
            row.into_any_element()
        })
        .collect();

    div()
        .max_w(px(820.0))
        .flex()
        .flex_col()
        .gap(S5)
        .child(
            div()
                .grid()
                .grid_cols(4)
                .gap(S3)
                .child(stat_card(
                    "Windows",
                    pretty_win_version(&bottle.settings.windows_version).to_string(),
                    theme,
                ))
                .child(stat_card(
                    "Graphics",
                    pretty_backend(&bottle.resolved_backend).to_string(),
                    theme,
                ))
                .child(stat_card(
                    "Steam games",
                    bottle.game_count.to_string(),
                    theme,
                ))
                .child(stat_card(
                    "Pinned apps",
                    bottle.pinned_count.to_string(),
                    theme,
                )),
        )
        .child(
            div()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded(R_LG)
                .px(S4)
                .py(S3)
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
                                .text_size(px(14.0))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .child("Steam"),
                        )
                        .child(
                            div()
                                .text_size(px(12.5))
                                .text_color(theme.muted)
                                .child(if bottle.steam_installed {
                                    if bottle.steam_running {
                                        "Steam is currently running in this PC."
                                    } else {
                                        "Steam is installed and ready to launch."
                                    }
                                } else {
                                    "Install Steam into this PC to download and launch Windows games."
                                }),
                        ),
                )
                .child(if bottle.steam_installed {
                    Button::new("ov-open-steam", theme)
                        .label(if bottle.steam_running {
                            "Show Steam"
                        } else {
                            "Open Steam"
                        })
                        .icon("external")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.open_steam(url_steam.clone(), cx);
                        }))
                        .into_any_element()
                } else {
                    Button::new("ov-install-steam", theme)
                        .label("Install Steam")
                        .icon("download")
                        .variant(ButtonVariant::Primary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.install_steam(url_install_steam.clone(), cx);
                        }))
                        .into_any_element()
                }),
        )
        .child(
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
                                .child("Pinned executables"),
                        )
                        .child(
                            Button::new("ov-browse-progs", theme)
                                .label("Browse all programs")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.select_bottle_tab(
                                        &url_tab_programs,
                                        BottleTab::Programs,
                                        cx,
                                    );
                                })),
                        ),
                )
                .when(pinned_rows.is_empty(), |this| {
                    this.child(empty_state(
                        "pin",
                        "No pinned executables",
                        "Pin frequently used installers or games from the Programs tab, or run an .exe directly.",
                        Some(
                            Button::new("ov-empty-run", theme)
                                .label("Run executable…")
                                .icon("play")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, window, cx| {
                                    this.pick_and_run_file(url_run.clone(), window, cx);
                                }))
                                .into_any_element(),
                        ),
                        theme,
                    ))
                })
                .when(!pinned_rows.is_empty(), |this| {
                    this.child(
                        div()
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border)
                            .rounded(R_LG)
                            .overflow_hidden()
                            .children(pinned_rows),
                    )
                }),
        )
        .into_any_element()
}

fn stat_card(label: &str, value: String, theme: Theme) -> AnyElement {
    div()
        .bg(theme.surface)
        .border_1()
        .border_color(theme.border)
        .rounded(R_MD)
        .px(S4)
        .py(S3)
        .flex()
        .flex_col()
        .gap(px(2.0))
        .child(
            div()
                .text_size(px(11.5))
                .text_color(theme.muted)
                .child(label.to_string()),
        )
        .child(
            div()
                .text_size(px(15.0))
                .font_weight(gpui::FontWeight::SEMIBOLD)
                .text_color(theme.ink)
                .truncate()
                .child(value),
        )
        .into_any_element()
}

fn render_programs(
    app: &GmacApp,
    bottle: &BottleDto,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let url = bottle.url.clone();
    let url_refresh = url.clone();
    let query = app.program_search_input.read(cx).text().to_lowercase();
    let list = app
        .programs_by_bottle
        .get(&url)
        .cloned()
        .unwrap_or_default();

    let filtered: Vec<_> = list
        .into_iter()
        .filter(|p| query.is_empty() || p.name.to_lowercase().contains(&query) || p.url.to_lowercase().contains(&query))
        .collect();

    let rows: Vec<AnyElement> = filtered
        .iter()
        .enumerate()
        .map(|(i, prog)| {
            let is_last = i + 1 == filtered.len();
            let expanded = app.expanded_program_path.as_deref() == Some(&prog.url);
            let b_url_run = url.clone();
            let b_url_pin = url.clone();
            let p_url_run = prog.url.clone();
            let p_url_pin = prog.url.clone();
            let p_url_exp = prog.url.clone();
            let next_pin = !prog.pinned;

            let mut card = div()
                .w_full()
                .flex()
                .flex_col()
                .child(
                    div()
                        .w_full()
                        .px(S4)
                        .py(S3)
                        .flex()
                        .items_center()
                        .justify_between()
                        .gap(S3)
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap(S3)
                                .min_w(px(0.0))
                                .flex_1()
                                .child(
                                    div()
                                        .size(px(30.0))
                                        .rounded(R_SM)
                                        .bg(theme.surface_subtle)
                                        .border_1()
                                        .border_color(theme.border)
                                        .overflow_hidden()
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .flex_shrink_0()
                                        .child(if let Some(ip) = &prog.icon_path {
                                            img(PathBuf::from(ip))
                                                .size_full()
                                                .object_fit(ObjectFit::Cover)
                                                .into_any_element()
                                        } else {
                                            icon("pc", px(13.0), theme.faint).into_any_element()
                                        }),
                                )
                                .child(
                                    div()
                                        .flex()
                                        .flex_col()
                                        .min_w(px(0.0))
                                        .child(
                                            div()
                                                .text_size(px(13.5))
                                                .font_weight(gpui::FontWeight::MEDIUM)
                                                .text_color(theme.ink)
                                                .truncate()
                                                .child(prog.name.clone()),
                                        )
                                        .child(
                                            div()
                                                .text_size(px(11.5))
                                                .text_color(theme.faint)
                                                .truncate()
                                                .child(prog.url.clone()),
                                        ),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap(S2)
                                .child(
                                    Button::new(("prog-cfg", i), theme)
                                        .label("Options")
                                        .icon(if expanded {
                                            "chevron-down"
                                        } else {
                                            "chevron-right"
                                        })
                                        .variant(ButtonVariant::Ghost)
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.toggle_expand_program(&p_url_exp, cx);
                                        })),
                                )
                                .child(
                                    Button::new(("prog-pin", i), theme)
                                        .label(if prog.pinned { "Unpin" } else { "Pin" })
                                        .icon("pin")
                                        .variant(if prog.pinned {
                                            ButtonVariant::Secondary
                                        } else {
                                            ButtonVariant::Ghost
                                        })
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.toggle_program_pin(
                                                b_url_pin.clone(),
                                                p_url_pin.clone(),
                                                next_pin,
                                                cx,
                                            );
                                        })),
                                )
                                .child(
                                    Button::new(("prog-run", i), theme)
                                        .label("Run")
                                        .icon("play")
                                        .variant(ButtonVariant::Secondary)
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.run_program(
                                                b_url_run.clone(),
                                                p_url_run.clone(),
                                                cx,
                                            );
                                        })),
                                ),
                        ),
                );

            if expanded {
                let b_url_save = url.clone();
                let p_url_save = prog.url.clone();
                let locales = [
                    ("auto", "Auto"),
                    ("en_US.UTF-8", "English"),
                    ("ja_JP.UTF-8", "Japanese"),
                    ("ko_KR.UTF-8", "Korean"),
                    ("zh_CN.UTF-8", "Chinese (SC)"),
                ];
                let current_locale = app.editing_program_locale.as_str();
                let ov = &app.editing_program_overrides;
                let backends: [(Option<&str>, &str); 5] = [
                    (None, "Inherit"),
                    (Some("d3dMetal"), "D3DMetal"),
                    (Some("dxmt"), "DXMT"),
                    (Some("dxvk"), "DXVK"),
                    (Some("wined3d"), "WineD3D"),
                ];

                card = card.child(
                    div()
                        .bg(theme.surface_subtle)
                        .border_t_1()
                        .border_color(theme.border)
                        .px(S4)
                        .py(S3)
                        .flex()
                        .flex_col()
                        .gap(S3)
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .gap(S4)
                                .child(
                                    div()
                                        .text_size(px(12.5))
                                        .text_color(theme.muted)
                                        .child("Launch arguments"),
                                )
                                .child(
                                    div()
                                        .flex_1()
                                        .min_w(px(180.0))
                                        .max_w(px(340.0))
                                        .child(app.program_args_input.clone()),
                                ),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .gap(S4)
                                .child(
                                    div()
                                        .text_size(px(12.5))
                                        .text_color(theme.muted)
                                        .child("Locale"),
                                )
                                .child(div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                                    locales.iter().enumerate().map(|(li, (raw, label))| {
                                        let r = (*raw).to_string();
                                        choice_chip(
                                            ("prog-loc", li),
                                            *label,
                                            current_locale == *raw,
                                            theme,
                                            cx.listener(move |this, _, _, cx| {
                                                this.editing_program_locale = r.clone();
                                                cx.notify();
                                            }),
                                        )
                                    }),
                                )),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .gap(S4)
                                .child(
                                    div()
                                        .text_size(px(12.5))
                                        .text_color(theme.muted)
                                        .child("Graphics backend override"),
                                )
                                .child(div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                                    backends.iter().enumerate().map(|(bi, (raw, label))| {
                                        let active = ov.graphics_backend.as_deref() == *raw;
                                        let next = raw.map(str::to_string);
                                        choice_chip(
                                            ("prog-be", bi),
                                            *label,
                                            active,
                                            theme,
                                            cx.listener(move |this, _, _, cx| {
                                                this.editing_program_overrides.graphics_backend =
                                                    next.clone();
                                                cx.notify();
                                            }),
                                        )
                                    }),
                                )),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .justify_between()
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap(S2)
                                        .child(choice_chip(
                                            "prog-ov-vd",
                                            "Virtual desktop",
                                            ov.virtual_desktop_enabled == Some(true),
                                            theme,
                                            cx.listener(|this, _, _, cx| {
                                                let next = if this
                                                    .editing_program_overrides
                                                    .virtual_desktop_enabled
                                                    == Some(true)
                                                {
                                                    None
                                                } else {
                                                    Some(true)
                                                };
                                                this.editing_program_overrides
                                                    .virtual_desktop_enabled = next;
                                                cx.notify();
                                            }),
                                        ))
                                        .child(choice_chip(
                                            "prog-ov-async",
                                            "DXVK Async",
                                            ov.dxvk_async == Some(true),
                                            theme,
                                            cx.listener(|this, _, _, cx| {
                                                let next =
                                                    if this.editing_program_overrides.dxvk_async
                                                        == Some(true)
                                                    {
                                                        None
                                                    } else {
                                                        Some(true)
                                                    };
                                                this.editing_program_overrides.dxvk_async = next;
                                                cx.notify();
                                            }),
                                        )),
                                )
                                .child(
                                    Button::new(("prog-save-ov", i), theme)
                                        .label("Save options")
                                        .variant(ButtonVariant::Primary)
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.save_program_settings(
                                                b_url_save.clone(),
                                                p_url_save.clone(),
                                                cx,
                                            );
                                        })),
                                ),
                        ),
                );
            }

            if !is_last {
                card = card.border_b_1().border_color(theme.border);
            }
            card.into_any_element()
        })
        .collect();

    div()
        .max_w(px(860.0))
        .flex()
        .flex_col()
        .gap(S4)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .gap(S3)
                .child(div().w(px(280.0)).child(app.program_search_input.clone()))
                .child(icon_button(
                    "prog-refresh",
                    "refresh",
                    theme,
                    cx.listener(move |this, _, _, cx| {
                        this.load_programs(&url_refresh, cx);
                    }),
                )),
        )
        .when(rows.is_empty(), |this| {
            this.child(empty_state(
                "search",
                "No executables found",
                "Install Windows software in this PC or refresh to scan drive_c.",
                None,
                theme,
            ))
        })
        .when(!rows.is_empty(), |this| {
            this.child(
                div()
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border)
                    .rounded(R_LG)
                    .overflow_hidden()
                    .children(rows),
            )
        })
        .into_any_element()
}

fn render_settings(bottle: &BottleDto, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let url = bottle.url.clone();
    let s = &bottle.settings;

    let win_versions = [
        ("winxp64", "Win XP"),
        ("win7", "Win 7"),
        ("win8", "Win 8"),
        ("win81", "Win 8.1"),
        ("win10", "Win 10"),
        ("win11", "Win 11"),
    ];
    let syncs = [("msync", "MSync"), ("esync", "ESync"), ("none", "Off")];
    let backends = [
        ("recommended", "Auto"),
        ("d3dMetal", "D3DMetal"),
        ("dxmt", "DXMT"),
        ("dxmtD3D12", "Gmac D3D12"),
        ("dxvk", "DXVK"),
        ("wined3d", "WineD3D"),
    ];
    let dxvk_huds = [("off", "Off"), ("fps", "FPS"), ("full", "Full")];
    let res_presets = [
        ("native", "Native"),
        ("1080p", "1080p"),
        ("1440p", "1440p"),
        ("4k", "4K"),
    ];
    let audio_drivers = [
        ("coreaudio", "CoreAudio"),
        ("pulse", "Pulse"),
        ("alsa", "ALSA"),
    ];
    let audio_latencies = [
        ("lowLatency", "Low"),
        ("balanced", "Balanced"),
        ("stable", "Stable"),
    ];
    let clipboard_policies = [
        ("bidirectional", "Bidirectional"),
        ("hostOnly", "Mac to Windows"),
        ("isolated", "Isolated"),
    ];
    let kill_policies = [
        ("ask", "Ask"),
        ("alwaysKill", "Always"),
        ("neverKill", "Never"),
    ];

    let launcher_modes = [
        ("automatic", "Auto"),
        ("steam", "Steam"),
        ("ea", "EA"),
        ("ubisoft", "Ubisoft"),
        ("epic", "Epic"),
        ("battlenet", "Battle.net"),
    ];
    let gpu_vendors = [
        ("automatic", "Auto"),
        ("nvidia", "NVIDIA"),
        ("amd", "AMD"),
        ("intel", "Intel"),
    ];
    let close_policies = [
        ("ask", "Ask"),
        ("terminate", "Terminate"),
        ("keepRunning", "Keep running"),
    ];

    let dll_rows: Vec<AnyElement> = s
        .custom_dll_overrides
        .iter()
        .enumerate()
        .map(|(idx, ov)| {
            let is_last = idx + 1 == s.custom_dll_overrides.len();
            let u = url.clone();
            let name = ov.dll_name.clone();
            setting_row(
                ov.dll_name.clone(),
                Some(ov.mode.clone().into()),
                Button::new(("dll-del", idx), theme)
                    .label("Remove")
                    .variant(ButtonVariant::Ghost)
                    .size(ButtonSize::Sm)
                    .on_click(cx.listener(move |this, _, _, cx| {
                        let target_name = name.clone();
                        this.update_bottle_settings(
                            &u,
                            move |bs| {
                                bs.custom_dll_overrides.retain(|d| d.dll_name != target_name);
                            },
                            cx,
                        );
                    })),
                is_last,
                theme,
            )
        })
        .collect();

    div()
        .max_w(px(780.0))
        .flex()
        .flex_col()
        .gap(S5)
        // General
        .child(card_section(
            Some("Windows and threading".into()),
            theme,
            vec![
                setting_row_stacked(
                    "Windows version",
                    None,
                    div().flex().flex_wrap().items_center().gap(S1).children(
                        win_versions.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-win", i),
                                *label,
                                s.windows_version == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(&u, move |bs| bs.windows_version = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Enhanced sync",
                    Some("Shared-memory Wine synchronization primitive.".into()),
                    div().flex().items_center().gap(S1).children(
                        syncs.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-sync", i),
                                *label,
                                s.enhanced_sync == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(&u, move |bs| bs.enhanced_sync = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Enable AVX / AVX2 instructions",
                    Some("Needed by newer titles; requires Rosetta on macOS 15+.".into()),
                    {
                        let u = url.clone();
                        let next = !s.avx_enabled;
                        toggle_switch(
                            "bs-avx",
                            s.avx_enabled,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.avx_enabled = next, cx);
                            }),
                        )
                    },
                    true,
                    theme,
                ),
            ],
        ))
        // Graphics
        .child(card_section(
            Some("Graphics".into()),
            theme,
            vec![
                setting_row_stacked(
                    "Backend",
                    None,
                    div().flex().flex_wrap().items_center().gap(S1).children(
                        backends.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-be", i),
                                *label,
                                s.graphics_backend == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.graphics_backend = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "MetalFX upscaling",
                    Some("Enable MetalFX spatial/temporal scaling when supported.".into()),
                    {
                        let u = url.clone();
                        let next = !s.metal_fx;
                        toggle_switch(
                            "bs-mfx",
                            s.metal_fx,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.metal_fx = next, cx);
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Frame generation",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.frame_generation;
                        toggle_switch(
                            "bs-fgen",
                            s.frame_generation,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.frame_generation = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Metal 4",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.metal4_enabled;
                        toggle_switch(
                            "bs-m4",
                            s.metal4_enabled,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.metal4_enabled = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Metal Performance HUD",
                    Some("Overlay frame rate, GPU timing, and memory usage.".into()),
                    {
                        let u = url.clone();
                        let next = !s.metal_hud;
                        toggle_switch(
                            "bs-mhud",
                            s.metal_hud,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.metal_hud = next, cx);
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "DirectX Raytracing (DXR)",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.dxr_enabled;
                        toggle_switch(
                            "bs-dxr",
                            s.dxr_enabled,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.dxr_enabled = next, cx);
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "DXVK Async shader compilation",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.dxvk_async;
                        toggle_switch(
                            "bs-dxvk-async",
                            s.dxvk_async,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.dxvk_async = next, cx);
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "DXVK HUD",
                    None,
                    div().flex().items_center().gap(S1).children(
                        dxvk_huds.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-dxvkhud", i),
                                *label,
                                s.dxvk_hud == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(&u, move |bs| bs.dxvk_hud = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Metal trace / validation",
                    Some("Enable GPU capture and Metal validation layers for debugging.".into()),
                    div().flex().items_center().gap(S1).children([
                        {
                            let u = url.clone();
                            let next = !s.metal_trace;
                            choice_chip(
                                "bs-mtrace",
                                "Trace",
                                s.metal_trace,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_bottle_settings(&u, move |bs| bs.metal_trace = next, cx);
                                }),
                            )
                        },
                        {
                            let u = url.clone();
                            let next = !s.metal_validation;
                            choice_chip(
                                "bs-mval",
                                "Validation",
                                s.metal_validation,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_bottle_settings(&u, move |bs| bs.metal_validation = next, cx);
                                }),
                            )
                        },
                    ]),
                    false,
                    theme,
                ),
                setting_row(
                    "Sequoia compatibility mode",
                    Some("Work around macOS Sequoia D3DMetal regressions on older titles.".into()),
                    {
                        let u = url.clone();
                        let next = !s.sequoia_compat_mode;
                        toggle_switch(
                            "bs-seq",
                            s.sequoia_compat_mode,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(&u, move |bs| bs.sequoia_compat_mode = next, cx);
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Auto-enable DXVK per executable",
                    Some("Inspect DirectX imports before launch and adjust overrides automatically.".into()),
                    {
                        let u = url.clone();
                        let next = !s.auto_enable_dxvk;
                        toggle_switch(
                            "bs-autodxvk",
                            s.auto_enable_dxvk,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.auto_enable_dxvk = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    true,
                    theme,
                ),
            ],
        ))
        // Display & Performance
        .child(card_section(
            Some("Display and performance".into()),
            theme,
            vec![
                setting_row(
                    "Native Retina resolution",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.native_resolution;
                        toggle_switch(
                            "bs-natres",
                            s.native_resolution,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.native_resolution = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Virtual desktop",
                    Some("Run Windows programs inside a fixed desktop window.".into()),
                    {
                        let u = url.clone();
                        let next = !s.virtual_desktop_enabled;
                        toggle_switch(
                            "bs-vdesk",
                            s.virtual_desktop_enabled,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.virtual_desktop_enabled = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Resolution preset",
                    None,
                    div().flex().items_center().gap(S1).children(
                        res_presets.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-res", i),
                                *label,
                                s.resolution_preset == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.resolution_preset = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Shader cache",
                    Some("Persist compiled shaders between runs to reduce stutter.".into()),
                    {
                        let u = url.clone();
                        let next = !s.shader_cache_enabled;
                        toggle_switch(
                            "bs-shcache",
                            s.shader_cache_enabled,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.shader_cache_enabled = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Disable App Nap",
                    Some("Prevent macOS from throttling background game threads.".into()),
                    {
                        let u = url.clone();
                        let next = !s.disable_app_nap;
                        toggle_switch(
                            "bs-appnap",
                            s.disable_app_nap,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.disable_app_nap = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    true,
                    theme,
                ),
            ],
        ))
        // Audio & Input
        .child(card_section(
            Some("Audio and controllers".into()),
            theme,
            vec![
                setting_row(
                    "Audio driver",
                    None,
                    div().flex().items_center().gap(S1).children(
                        audio_drivers.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-aud-drv", i),
                                *label,
                                s.audio_driver == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.audio_driver = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Audio latency",
                    None,
                    div().flex().items_center().gap(S1).children(
                        audio_latencies.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-aud-lat", i),
                                *label,
                                s.audio_latency_preset == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.audio_latency_preset = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Controller compatibility mode",
                    Some("Stabilize DualSense, Xbox, and Steam Input detection.".into()),
                    {
                        let u = url.clone();
                        let next = !s.controller_compatibility_mode;
                        toggle_switch(
                            "bs-ctrl-compat",
                            s.controller_compatibility_mode,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.controller_compatibility_mode = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Disable HIDAPI",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.disable_hidapi;
                        toggle_switch(
                            "bs-hidapi",
                            s.disable_hidapi,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.disable_hidapi = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Allow background controller events",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.allow_background_events;
                        toggle_switch(
                            "bs-bg-ctrl",
                            s.allow_background_events,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.allow_background_events = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row(
                    "Treat Command key as Control",
                    None,
                    {
                        let u = url.clone();
                        let next = !s.command_acts_as_control;
                        toggle_switch(
                            "bs-cmdctrl",
                            s.command_acts_as_control,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.command_acts_as_control = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    true,
                    theme,
                ),
            ],
        ))
        // Behavior & Launchers
        .child(card_section(
            Some("Launchers, clipboard, and quit behavior".into()),
            theme,
            vec![
                setting_row(
                    "Launcher compatibility mode",
                    Some("Apply stability fixes for third-party game launchers.".into()),
                    {
                        let u = url.clone();
                        let next = !s.launcher_compatibility_mode;
                        toggle_switch(
                            "bs-lnch",
                            s.launcher_compatibility_mode,
                            false,
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.update_bottle_settings(
                                    &u,
                                    move |bs| bs.launcher_compatibility_mode = next,
                                    cx,
                                );
                            }),
                        )
                    },
                    false,
                    theme,
                ),
                setting_row_stacked(
                    "Launcher profile",
                    None,
                    div().flex().flex_wrap().items_center().gap(S1).children(
                        launcher_modes.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-lnch-mode", i),
                                *label,
                                s.launcher_mode == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(&u, move |bs| bs.launcher_mode = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "GPU spoofing",
                    Some("Report a discrete desktop GPU vendor when games restrict integrated adapters.".into()),
                    div().flex().flex_wrap().justify_end().items_center().gap(S2).children({
                        let mut controls = vec![{
                            let u = url.clone();
                            let next = !s.gpu_spoofing;
                            toggle_switch(
                                "bs-gpuspoof",
                                s.gpu_spoofing,
                                false,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.gpu_spoofing = next,
                                        cx,
                                    );
                                }),
                            )
                        }];
                        if s.gpu_spoofing {
                            for (i, (raw, label)) in gpu_vendors.iter().enumerate() {
                                let u = url.clone();
                                let val = (*raw).to_string();
                                controls.push(choice_chip(
                                    ("bs-gpu-vendor", i),
                                    *label,
                                    s.gpu_vendor == *raw,
                                    theme,
                                    cx.listener(move |this, _, _, cx| {
                                        let v = val.clone();
                                        this.update_bottle_settings(
                                            &u,
                                            move |bs| bs.gpu_vendor = v,
                                            cx,
                                        );
                                    }),
                                ));
                            }
                        }
                        controls
                    }),
                    false,
                    theme,
                ),
                setting_row(
                    "Discord Rich Presence / bridge",
                    None,
                    div().flex().items_center().gap(S1).children([
                        {
                            let u = url.clone();
                            let next = !s.discord_presence;
                            choice_chip(
                                "bs-disc-pres",
                                "Presence",
                                s.discord_presence,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.discord_presence = next,
                                        cx,
                                    );
                                }),
                            )
                        },
                        {
                            let u = url.clone();
                            let next = !s.discord_bridge;
                            choice_chip(
                                "bs-disc-br",
                                "RPC Bridge",
                                s.discord_bridge,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.discord_bridge = next,
                                        cx,
                                    );
                                }),
                            )
                        },
                    ]),
                    false,
                    theme,
                ),
                setting_row(
                    "Clipboard sharing",
                    None,
                    div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                        clipboard_policies.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-clip", i),
                                *label,
                                s.clipboard_policy == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.clipboard_policy = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "Kill Wine processes on quit",
                    None,
                    div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                        kill_policies.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-killq", i),
                                *label,
                                s.kill_on_quit == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(&u, move |bs| bs.kill_on_quit = v, cx);
                                }),
                            )
                        }),
                    ),
                    false,
                    theme,
                ),
                setting_row(
                    "When Steam closes",
                    None,
                    div().flex().flex_wrap().justify_end().items_center().gap(S1).children(
                        close_policies.iter().enumerate().map(|(i, (raw, label))| {
                            let u = url.clone();
                            let val = (*raw).to_string();
                            choice_chip(
                                ("bs-closep", i),
                                *label,
                                s.close_with_processes_policy == *raw,
                                theme,
                                cx.listener(move |this, _, _, cx| {
                                    let v = val.clone();
                                    this.update_bottle_settings(
                                        &u,
                                        move |bs| bs.close_with_processes_policy = v,
                                        cx,
                                    );
                                }),
                            )
                        }),
                    ),
                    true,
                    theme,
                ),
            ],
        ))
        // DLL overrides
        .child(
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
                                .child("Custom DLL overrides"),
                        )
                        .child({
                            let u = url.clone();
                            Button::new("bs-add-dll", theme)
                                .label("Add override…")
                                .icon("plus")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, window, cx| {
                                    this.open_add_dll_modal(u.clone(), window, cx);
                                }))
                        }),
                )
                .when(dll_rows.is_empty(), |this| {
                    this.child(
                        div()
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border)
                            .rounded(R_LG)
                            .px(S4)
                            .py(S3)
                            .text_size(px(13.0))
                            .text_color(theme.muted)
                            .child("No custom DLL overrides configured for this PC."),
                    )
                })
                .when(!dll_rows.is_empty(), |this| {
                    this.child(card_section(None, theme, dll_rows))
                }),
        )
        .into_any_element()
}

fn render_presets(
    app: &GmacApp,
    bottle: &BottleDto,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let url = bottle.url.clone();
    let all_entries = app
        .gamedb_by_bottle
        .get(&url)
        .cloned()
        .unwrap_or_default();
    let filter = app.preset_filter;
    let entries: Vec<_> = all_entries
        .into_iter()
        .filter(|e| match filter {
            PresetFilter::All => true,
            PresetFilter::Installed => e.installed,
            PresetFilter::Applied => e.applied_here,
        })
        .collect();

    let rows: Vec<AnyElement> = entries
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let is_last = i + 1 == entries.len();
            let b_url_apply = url.clone();
            let b_url_rev = url.clone();
            let eid = item.id.clone();
            let vid = item.default_variant_id.clone();

            let (r_bg, r_fg, rating_label) = match item.rating.as_str() {
                "platinum" => (theme.success_soft, theme.success, "Platinum"),
                "gold" => (theme.success_soft, theme.success, "Gold"),
                "verified" => (theme.success_soft, theme.success, "Verified"),
                "silver" => (theme.accent_soft, theme.accent_text, "Silver"),
                "playable" => (theme.accent_soft, theme.accent_text, "Playable"),
                "bronze" => (theme.warning_soft, theme.warning, "Bronze"),
                "issues" => (theme.warning_soft, theme.warning, "Issues"),
                "broken" => (theme.danger_soft, theme.danger, "Broken"),
                other => (theme.danger_soft, theme.danger, other),
            };

            let mut row = div()
                .w_full()
                .px(S4)
                .py(S4)
                .flex()
                .items_start()
                .justify_between()
                .gap(S4)
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(S1)
                        .flex_1()
                        .min_w(px(0.0))
                        .child(
                            div()
                                .flex()
                                .flex_wrap()
                                .items_center()
                                .gap(S2)
                                .child(
                                    div()
                                        .text_size(px(14.0))
                                        .font_weight(gpui::FontWeight::SEMIBOLD)
                                        .text_color(theme.ink)
                                        .child(item.name.clone()),
                                )
                                .child(pill_badge(rating_label.to_string(), r_bg, r_fg))
                                .when(item.installed, |d| {
                                    d.child(pill_badge("Installed", theme.surface_subtle, theme.muted))
                                })
                                .when(item.applied_here, |d| {
                                    d.child(status_pill("Applied", StatusDot::Active, theme))
                                })
                                .when_some(item.anti_cheat.clone(), |d, ac| {
                                    d.child(pill_badge(ac, theme.warning_soft, theme.warning))
                                }),
                        )
                        .when_some(item.subtitle.clone(), |d, sub| {
                            d.child(
                                div()
                                    .text_size(px(12.5))
                                    .text_color(theme.muted)
                                    .child(sub),
                            )
                        })
                        .when(!item.notes.is_empty(), |d| {
                            d.child(
                                div()
                                    .text_size(px(12.0))
                                    .line_height(px(17.0))
                                    .text_color(theme.faint)
                                    .child(item.notes.join(" · ")),
                            )
                        }),
                )
                .child(if item.applied_here {
                    Button::new(("gdb-rev", i), theme)
                        .label("Revert")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.revert_gamedb(b_url_rev.clone(), cx);
                        }))
                        .into_any_element()
                } else {
                    Button::new(("gdb-app", i), theme)
                        .label("Apply preset")
                        .variant(ButtonVariant::Primary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.apply_gamedb(b_url_apply.clone(), eid.clone(), vid.clone(), cx);
                        }))
                        .into_any_element()
                });

            if !is_last {
                row = row.border_b_1().border_color(theme.border);
            }
            row.into_any_element()
        })
        .collect();

    div()
        .max_w(px(820.0))
        .flex()
        .flex_col()
        .gap(S4)
        .child(
            div().flex().items_center().gap(S1).children([
                choice_chip(
                    "gdb-f-all",
                    "All",
                    filter == PresetFilter::All,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.preset_filter = PresetFilter::All;
                        cx.notify();
                    }),
                ),
                choice_chip(
                    "gdb-f-inst",
                    "Installed",
                    filter == PresetFilter::Installed,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.preset_filter = PresetFilter::Installed;
                        cx.notify();
                    }),
                ),
                choice_chip(
                    "gdb-f-app",
                    "Applied here",
                    filter == PresetFilter::Applied,
                    theme,
                    cx.listener(|this, _, _, cx| {
                        this.preset_filter = PresetFilter::Applied;
                        cx.notify();
                    }),
                ),
            ]),
        )
        .when(rows.is_empty(), |this| {
            this.child(empty_state(
                "sliders",
                "No presets match",
                "Adjust the filter above or load GameDB compatibility presets for this PC.",
                None,
                theme,
            ))
        })
        .when(!rows.is_empty(), |this| {
            this.child(
                div()
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border)
                    .rounded(R_LG)
                    .overflow_hidden()
                    .children(rows),
            )
        })
        .into_any_element()
}

fn render_tools(
    app: &GmacApp,
    bottle: &BottleDto,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let url = bottle.url.clone();
    let tools = [
        ("winecfg", "Wine Configuration"),
        ("regedit", "Registry Editor"),
        ("control", "Control Panel"),
        ("taskmgr", "Task Manager"),
        ("cmd", "Command Prompt"),
        ("uninstaller", "Add / Remove Programs"),
        ("explorer", "Wine Explorer"),
    ];

    let report = app.stability_reports.get(&url).cloned();
    let url_rep = url.clone();
    let url_repair = url.clone();

    div()
        .max_w(px(820.0))
        .flex()
        .flex_col()
        .gap(S5)
        .child(
            div()
                .flex()
                .flex_col()
                .gap(S2)
                .child(
                    div()
                        .text_size(px(12.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD)
                        .text_color(theme.muted)
                        .child("Windows utilities"),
                )
                .child(div().grid().grid_cols(3).gap(S3).children(
                    tools.iter().enumerate().map(|(i, (cmd, title))| {
                        let u = url.clone();
                        let c = (*cmd).to_string();
                        div()
                            .id(("win-tool", i))
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border)
                            .rounded(R_MD)
                            .px(S4)
                            .py(S3)
                            .cursor(CursorStyle::PointingHand)
                            .hover(|s| s.bg(theme.surface_hover).border_color(theme.border_strong))
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.run_bottle_tool(u.clone(), c.clone(), cx);
                            }))
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap(px(2.0))
                                    .child(
                                        div()
                                            .text_size(px(13.5))
                                            .font_weight(gpui::FontWeight::MEDIUM)
                                            .text_color(theme.ink)
                                            .child(*title),
                                    )
                                    .child(
                                        div()
                                            .text_size(px(11.5))
                                            .text_color(theme.faint)
                                            .child(format!("{cmd}.exe")),
                                    ),
                            )
                            .child(icon("wrench", px(14.0), theme.muted))
                    }),
                )),
        )
        .child(card_section(
            Some("Prefix maintenance and audio".into()),
            theme,
            vec![
                setting_row(
                    "Repair Wine prefix",
                    Some("Re-run wineboot -u and re-verify required system files.".into()),
                    Button::new("tool-repair", theme)
                        .label("Repair prefix")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.repair_bottle_prefix(url_repair.clone(), cx);
                        })),
                    false,
                    theme,
                ),
                setting_row(
                    "macOS audio probe",
                    Some(
                        app.audio_status
                            .as_ref()
                            .map(|a| {
                                let dev = a.default_device_name.as_deref().unwrap_or("Default");
                                let rate = a
                                    .sample_rate_hz
                                    .map(|r| format!("{:.0} Hz", r))
                                    .unwrap_or_else(|| "—".to_string());
                                let ch = a
                                    .output_channels
                                    .map(|c| format!("{c} ch"))
                                    .unwrap_or_else(|| "—".to_string());
                                let transport = a.transport_type.as_deref().unwrap_or("");
                                if transport.is_empty() {
                                    format!("{} · {dev} ({rate}, {ch})", a.summary)
                                } else {
                                    format!("{} · {dev} ({transport}, {rate}, {ch})", a.summary)
                                }
                            })
                            .unwrap_or_else(|| "Inspect active output device, sample rate, and CoreAudio findings.".to_string())
                            .into(),
                    ),
                    Button::new("tool-audio-probe", theme)
                        .label("Probe audio")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.refresh_audio_status(cx);
                        })),
                    app.audio_status
                        .as_ref()
                        .map(|a| a.findings.is_empty())
                        .unwrap_or(true),
                    theme,
                ),
            ]
            .into_iter()
            .chain(
                app.audio_status
                    .as_ref()
                    .filter(|a| !a.findings.is_empty())
                    .map(|a| {
                        setting_row(
                            "Audio findings",
                            Some(a.findings.join(" · ").into()),
                            status_pill(a.status.clone(), StatusDot::Warning, theme),
                            true,
                            theme,
                        )
                    }),
            )
            .collect(),
        ))
        .child(
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
                                .child("Stability diagnostics report"),
                        )
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap(S2)
                                .when_some(report.clone(), |d, txt| {
                                    d.child(
                                        Button::new("tool-copy-rep", theme)
                                            .label("Copy")
                                            .icon("copy")
                                            .variant(ButtonVariant::Ghost)
                                            .size(ButtonSize::Sm)
                                            .on_click(cx.listener(move |this, _, _, cx| {
                                                cx.write_to_clipboard(gpui::ClipboardItem::new_string(
                                                    txt.clone(),
                                                ));
                                                this.push_toast(
                                                    ToastStyle::Success,
                                                    "Report copied to clipboard",
                                                    None,
                                                    cx,
                                                );
                                            })),
                                    )
                                })
                                .child(
                                    Button::new("tool-gen-rep", theme)
                                        .label("Generate report")
                                        .variant(ButtonVariant::Secondary)
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.load_stability_report(url_rep.clone(), cx);
                                        })),
                                ),
                        ),
                )
                .when_some(report, |this, text| {
                    this.child(
                        div()
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border)
                            .rounded(R_LG)
                            .p(S4)
                            .font_family("Menlo")
                            .text_size(px(11.5))
                            .line_height(px(17.0))
                            .text_color(theme.ink)
                            .child(text),
                    )
                }),
        )
        .into_any_element()
}
