use std::path::PathBuf;

use gpui::{
    AnyElement, Context, CursorStyle, InteractiveElement, IntoElement, ObjectFit, ParentElement,
    SharedString, StatefulInteractiveElement, Styled, Window, div, img, prelude::*, px,
};

use crate::app::GmacApp;
use crate::components::badge::{StatusDot, pill_badge, status_pill};
use crate::components::button::{Button, ButtonSize, ButtonVariant, icon_button};
use crate::components::icon;
use crate::components::segmented::{SegmentOption, segmented_control};
use crate::models::{
    LibraryItemDto, LibrarySort, SteamPanelDto, SteamSetupStatusDto, format_bytes,
    format_relative_epoch, pretty_backend,
};
use crate::theme::{R_LG, R_MD, R_SM, S1, S2, S3, S4, S5, S6, Theme};
use crate::views::NavSection;

pub fn render(app: &GmacApp, theme: Theme, window: &mut Window, cx: &mut Context<GmacApp>) -> AnyElement {
    let query = app.search_input.read(cx).text().to_lowercase();
    let wine_installed = app
        .runtime_status
        .as_ref()
        .map(|s| s.wine_installed)
        .unwrap_or(false);

    let has_games = !app.library.games.is_empty();
    let has_other = !app.library.other_apps.is_empty();
    let has_steam = !app.library.steam_panels.is_empty();
    let show_setup = app.show_steam_setup || (!wine_installed && !has_games && !has_other && !has_steam);

    let width: f32 = window.viewport_size().width.into();
    let cols: u16 = if width >= 1340.0 {
        5
    } else if width >= 1060.0 {
        4
    } else if width >= 780.0 {
        3
    } else {
        2
    };

    let filtered_games = filter_and_sort(&app.library.games, &query, app.library_sort);
    let filtered_other = filter_and_sort(&app.library.other_apps, &query, app.library_sort);

    div()
        .size_full()
        .flex()
        .flex_col()
        // Header bar
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
                                .child("Library"),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(theme.muted)
                                .child(summary_subtitle(&app.library.games, &app.library.other_apps)),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .child(div().w(px(210.0)).child(app.search_input.clone()))
                        .child(segmented_control(
                            "lib-sort",
                            vec![
                                SegmentOption {
                                    value: LibrarySort::Recent,
                                    label: "Recent".into(),
                                },
                                SegmentOption {
                                    value: LibrarySort::Name,
                                    label: "Name".into(),
                                },
                                SegmentOption {
                                    value: LibrarySort::Bottle,
                                    label: "PC".into(),
                                },
                            ],
                            app.library_sort,
                            theme,
                            cx.listener(|this, sort: &LibrarySort, _, cx| {
                                this.library_sort = *sort;
                                cx.notify();
                            }),
                        ))
                        .child(
                            Button::new("lib-setup-toggle", theme)
                                .label(if show_setup { "Back to library" } else { "Steam setup" })
                                .icon("gamepad")
                                .variant(if show_setup {
                                    ButtonVariant::Primary
                                } else {
                                    ButtonVariant::Secondary
                                })
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.show_steam_setup = !this.show_steam_setup;
                                    this.refresh_steam_setup(cx);
                                    cx.notify();
                                })),
                        )
                        .child(icon_button(
                            "lib-refresh",
                            "refresh",
                            theme,
                            cx.listener(|this, _, _, cx| {
                                this.refresh_library(cx);
                            }),
                        )),
                ),
        )
        // Main scrollable body
        .child(
            div()
                .id("library-scroll")
                .flex_1()
                .min_h(px(0.0))
                .overflow_y_scroll()
                .px(S6)
                .py(S5)
                .flex()
                .flex_col()
                .gap(S6)
                .when(show_setup, |this| {
                    this.child(render_steam_setup(app, theme, cx))
                })
                .when(!show_setup, |this| {
                    this.when(!app.library.steam_panels.is_empty(), |inner| {
                        inner.child(render_steam_panels(&app.library.steam_panels, theme, cx))
                    })
                    .when(
                        filtered_games.is_empty() && filtered_other.is_empty() && app.library.steam_panels.is_empty(),
                        |inner| inner.child(render_steam_setup(app, theme, cx)),
                    )
                    .when(
                        !filtered_games.is_empty() || has_steam,
                        |inner| inner.child(render_games_grid(app, &filtered_games, cols, theme, cx)),
                    )
                    .when(!filtered_other.is_empty(), |inner| {
                        inner.child(render_other_apps(app, &filtered_other, theme, cx))
                    })
                }),
        )
        .into_any_element()
}

fn summary_subtitle(games: &[LibraryItemDto], other: &[LibraryItemDto]) -> String {
    let mut parts = Vec::new();
    if !games.is_empty() {
        parts.push(if games.len() == 1 {
            "1 game".to_string()
        } else {
            format!("{} games", games.len())
        });
    }
    if !other.is_empty() {
        parts.push(if other.len() == 1 {
            "1 app".to_string()
        } else {
            format!("{} apps", other.len())
        });
    }
    if parts.is_empty() {
        "Games and Windows applications across your PCs".to_string()
    } else {
        parts.join(" · ")
    }
}

fn filter_and_sort(items: &[LibraryItemDto], query: &str, sort: LibrarySort) -> Vec<LibraryItemDto> {
    let mut out: Vec<LibraryItemDto> = items
        .iter()
        .filter(|it| {
            if query.is_empty() {
                return true;
            }
            it.name.to_lowercase().contains(query)
                || it
                    .bottle_name
                    .as_deref()
                    .map(|b| b.to_lowercase().contains(query))
                    .unwrap_or(false)
        })
        .cloned()
        .collect();

    match sort {
        LibrarySort::Recent => out.sort_by(|a, b| {
            let run_ord = (b.state == "running").cmp(&(a.state == "running"));
            if run_ord != std::cmp::Ordering::Equal {
                return run_ord;
            }
            let bt = b.last_played_epoch.unwrap_or(0.0);
            let at = a.last_played_epoch.unwrap_or(0.0);
            bt.partial_cmp(&at)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        }),
        LibrarySort::Name => out.sort_by_key(|a| a.name.to_lowercase()),
        LibrarySort::Bottle => out.sort_by(|a, b| {
            a.bottle_name
                .as_deref()
                .unwrap_or("")
                .to_lowercase()
                .cmp(&b.bottle_name.as_deref().unwrap_or("").to_lowercase())
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        }),
    }
    out
}

fn render_steam_panels(
    panels: &[SteamPanelDto],
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let cards: Vec<AnyElement> = panels
        .iter()
        .enumerate()
        .map(|(idx, panel)| {
            let bottle_url_open = panel.bottle_url.clone();
            let bottle_url_stop = panel.bottle_url.clone();
            let bottle_url_store = panel.bottle_url.clone();
            let bottle_url_manage = panel.bottle_url.clone();
            let pc_name = panel
                .bottle_name
                .clone()
                .unwrap_or_else(|| "Steam PC".to_string());
            let meta = format!(
                "{} · {} games · {}",
                pc_name,
                panel.game_count,
                format_bytes(panel.size_on_disk)
            );

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
                        .items_center()
                        .gap(S3)
                        .min_w(px(0.0))
                        .child(
                            div()
                                .size(px(36.0))
                                .rounded(R_SM)
                                .bg(theme.surface_subtle)
                                .border_1()
                                .border_color(theme.border)
                                .flex()
                                .items_center()
                                .justify_center()
                                .overflow_hidden()
                                .flex_shrink_0()
                                .child(if let Some(path) = &panel.icon_path {
                                    img(PathBuf::from(path))
                                        .size_full()
                                        .object_fit(ObjectFit::Cover)
                                        .into_any_element()
                                } else {
                                    icon("gamepad", px(17.0), theme.accent_text).into_any_element()
                                }),
                        )
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .gap(px(2.0))
                                .min_w(px(0.0))
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap(S2)
                                        .child(
                                            div()
                                                .text_size(px(14.0))
                                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                                .text_color(theme.ink)
                                                .child("Steam"),
                                        )
                                        .child(status_pill(
                                            if panel.is_running { "Running" } else { "Ready" },
                                            if panel.is_running {
                                                StatusDot::Active
                                            } else {
                                                StatusDot::Idle
                                            },
                                            theme,
                                        )),
                                )
                                .child(
                                    div()
                                        .text_size(px(12.0))
                                        .text_color(theme.muted)
                                        .truncate()
                                        .child(meta),
                                ),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .child(
                            Button::new(("steam-open", idx), theme)
                                .label(if panel.is_running { "Show Steam" } else { "Open Steam" })
                                .icon("external")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.open_steam(bottle_url_open.clone(), cx);
                                })),
                        )
                        .when(panel.is_running, |d| {
                            d.child(
                                Button::new(("steam-stop", idx), theme)
                                    .label("Stop")
                                    .icon("stop")
                                    .variant(ButtonVariant::Danger)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.stop_steam(bottle_url_stop.clone(), cx);
                                    })),
                            )
                        })
                        .child(
                            Button::new(("steam-store", idx), theme)
                                .label("Store")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.open_steam_store(bottle_url_store.clone(), cx);
                                })),
                        )
                        .child(
                            Button::new(("steam-pc", idx), theme)
                                .label("PC")
                                .icon("pc")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, window, cx| {
                                    this.navigate(
                                        NavSection::Bottle(bottle_url_manage.clone()),
                                        window,
                                        cx,
                                    );
                                })),
                        ),
                )
                .into_any_element()
        })
        .collect();

    div().flex().flex_col().gap(S2).children(cards).into_any_element()
}

fn render_games_grid(
    app: &GmacApp,
    games: &[LibraryItemDto],
    cols: u16,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let mut cards: Vec<AnyElement> = games
        .iter()
        .enumerate()
        .map(|(idx, game)| render_game_card(app, idx, game, theme, cx))
        .collect();

    if let Some(first_panel) = app.library.steam_panels.first() {
        let store_url = first_panel.bottle_url.clone();
        cards.push(
            div()
                .id("lib-browse-store-tile")
                .h(px(274.0))
                .rounded(R_LG)
                .border_1()
                .border_dashed()
                .border_color(theme.border_strong)
                .bg(theme.surface_subtle.opacity(0.6))
                .cursor(CursorStyle::PointingHand)
                .hover(|s| s.bg(theme.surface_hover).border_color(theme.accent))
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.open_steam_store(store_url.clone(), cx);
                }))
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .gap(S2)
                .px(S4)
                .child(
                    div()
                        .size(px(36.0))
                        .rounded(px(999.0))
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(icon("plus", px(16.0), theme.muted)),
                )
                .child(
                    div()
                        .text_size(px(13.0))
                        .font_weight(gpui::FontWeight::MEDIUM)
                        .text_color(theme.ink)
                        .child("Browse Steam Store"),
                )
                .child(
                    div()
                        .text_size(px(11.5))
                        .text_color(theme.muted)
                        .text_center()
                        .child("Install new titles directly into Steam"),
                )
                .into_any_element(),
        );
    }

    div()
        .flex()
        .flex_col()
        .gap(S3)
        .child(
            div()
                .text_size(px(13.0))
                .font_weight(gpui::FontWeight::SEMIBOLD)
                .text_color(theme.muted)
                .child(format!("Games ({})", games.len())),
        )
        .child(div().grid().grid_cols(cols).gap(S4).children(cards))
        .into_any_element()
}

fn render_game_card(
    app: &GmacApp,
    idx: usize,
    game: &LibraryItemDto,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let menu_open = app.open_game_menu_id.as_deref() == Some(&game.id);
    let is_running = game.state == "running";
    let is_launching = game.state == "launching";

    let game_for_primary = game.clone();
    let game_id_menu = game.id.clone();
    let game_for_dock = game.clone();
    let bottle_url_faster = game.bottle_url.clone();
    let bottle_url_pc = game.bottle_url.clone();
    let app_id_opt = game.app_id;
    let faster_now = game.faster_mode;
    let install_path = game.install_path.clone().or_else(|| game.program_path.clone());

    let meta_line: SharedString = match (game.last_played_epoch, game.size_on_disk) {
        (Some(ep), Some(sz)) => {
            format!("{} · {}", format_relative_epoch(ep), format_bytes(sz)).into()
        }
        (Some(ep), None) => format_relative_epoch(ep).into(),
        (None, Some(sz)) => format_bytes(sz).into(),
        (None, None) => game
            .bottle_name
            .clone()
            .unwrap_or_else(|| "Steam".to_string())
            .into(),
    };

    let artwork = if let Some(path) = &game.artwork_path {
        img(PathBuf::from(path))
            .size_full()
            .object_fit(ObjectFit::Cover)
            .into_any_element()
    } else {
        let initial = game
            .name
            .chars()
            .next()
            .map(|c| c.to_uppercase().to_string())
            .unwrap_or_else(|| "G".to_string());
        div()
            .size_full()
            .bg(theme.surface_subtle)
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .gap(S2)
            .child(
                div()
                    .size(px(40.0))
                    .rounded(R_MD)
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border)
                    .flex()
                    .items_center()
                    .justify_center()
                    .text_size(px(18.0))
                    .font_weight(gpui::FontWeight::SEMIBOLD)
                    .text_color(theme.accent_text)
                    .child(initial),
            )
            .into_any_element()
    };

    div()
        .id(("game-card", idx))
        .relative()
        .h(px(274.0))
        .bg(theme.surface)
        .border_1()
        .border_color(if is_running {
            theme.success.opacity(0.6)
        } else {
            theme.border
        })
        .rounded(R_LG)
        .overflow_hidden()
        .flex()
        .flex_col()
        // Artwork top section
        .child(
            div()
                .relative()
                .h(px(164.0))
                .w_full()
                .bg(theme.surface_subtle)
                .overflow_hidden()
                .child(artwork)
                .when(is_running || is_launching, |d| {
                    d.child(
                        div()
                            .absolute()
                            .top(S2)
                            .left(S2)
                            .child(status_pill(
                                if is_running { "Running" } else { "Launching…" },
                                if is_running {
                                    StatusDot::Active
                                } else {
                                    StatusDot::Pending
                                },
                                theme,
                            )),
                    )
                })
                .when_some(game.compatibility_warning.clone(), |d, warn| {
                    d.child(
                        div().absolute().top(S2).right(S2).child(pill_badge(
                            warn,
                            theme.warning_soft,
                            theme.warning,
                        )),
                    )
                }),
        )
        // Metadata + action row
        .child(
            div()
                .flex_1()
                .p(S3)
                .flex()
                .flex_col()
                .justify_between()
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(2.0))
                        .child(
                            div()
                                .text_size(px(13.5))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .truncate()
                                .child(game.name.clone()),
                        )
                        .child(
                            div()
                                .text_size(px(11.5))
                                .text_color(theme.muted)
                                .truncate()
                                .child(meta_line),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .gap(S2)
                        .child(
                            div().flex_1().child(
                                Button::new(("game-play", idx), theme)
                                    .label(if is_running { "Stop" } else { "Play" })
                                    .icon(if is_running { "stop" } else { "play" })
                                    .variant(if is_running {
                                        ButtonVariant::Danger
                                    } else {
                                        ButtonVariant::Primary
                                    })
                                    .size(ButtonSize::Sm)
                                    .full_width(true)
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        if is_running {
                                            this.stop_library_item(&game_for_primary, cx);
                                        } else {
                                            this.launch_library_item(&game_for_primary, cx);
                                        }
                                    })),
                            ),
                        )
                        .child(icon_button(
                            ("game-more", idx),
                            "more",
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                cx.stop_propagation();
                                if this.open_game_menu_id.as_deref() == Some(&game_id_menu) {
                                    this.open_game_menu_id = None;
                                } else {
                                    this.open_game_menu_id = Some(game_id_menu.clone());
                                }
                                cx.notify();
                            }),
                        )),
                ),
        )
        // Anchored popover menu
        .when(menu_open, |card| {
            card.child(
                div()
                    .id(("game-popover", idx))
                    .absolute()
                    .right(S3)
                    .bottom(px(46.0))
                    .w(px(192.0))
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
                    .when_some(app_id_opt, |menu, app_id| {
                        menu.child(popover_item(
                            ("gp-fast", idx),
                            if faster_now {
                                "Disable faster launch"
                            } else {
                                "Enable faster launch"
                            },
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.open_game_menu_id = None;
                                this.toggle_faster_mode(
                                    bottle_url_faster.clone(),
                                    app_id,
                                    !faster_now,
                                    cx,
                                );
                            }),
                        ))
                    })
                    .when_some(install_path, |menu, path| {
                        menu.child(popover_item(
                            ("gp-finder", idx),
                            "Show in Finder",
                            theme,
                            cx.listener(move |this, _, _, cx| {
                                this.open_game_menu_id = None;
                                this.show_in_finder(path.clone(), cx);
                            }),
                        ))
                    })
                    .child(popover_item(
                        ("gp-dock", idx),
                        "Add to Dock",
                        theme,
                        cx.listener(move |this, _, _, cx| {
                            this.open_game_menu_id = None;
                            this.add_to_dock(&game_for_dock, cx);
                        }),
                    ))
                    .child(popover_item(
                        ("gp-pc", idx),
                        "Open PC settings",
                        theme,
                        cx.listener(move |this, _, window, cx| {
                            this.open_game_menu_id = None;
                            this.navigate(NavSection::Bottle(bottle_url_pc.clone()), window, cx);
                        }),
                    )),
            )
        })
        .into_any_element()
}

fn popover_item(
    id: (&'static str, usize),
    label: &'static str,
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
        .text_color(theme.ink)
        .hover(|s| s.bg(theme.surface_subtle))
        .on_click(on_click)
        .child(label)
        .into_any_element()
}

fn render_other_apps(
    _app: &GmacApp,
    apps: &[LibraryItemDto],
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let rows: Vec<AnyElement> = apps
        .iter()
        .enumerate()
        .map(|(idx, item)| {
            let is_last = idx + 1 == apps.len();
            let item_launch = item.clone();
            let item_dock = item.clone();
            let prog_path = item.program_path.clone();
            let bottle_url = item.bottle_url.clone();

            let mut row = div()
                .w_full()
                .px(S4)
                .py(S3)
                .flex()
                .items_center()
                .justify_between()
                .gap(S4)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S3)
                        .min_w(px(0.0))
                        .flex_1()
                        .child(
                            div()
                                .size(px(34.0))
                                .rounded(R_SM)
                                .bg(theme.surface_subtle)
                                .border_1()
                                .border_color(theme.border)
                                .overflow_hidden()
                                .flex()
                                .items_center()
                                .justify_center()
                                .flex_shrink_0()
                                .child(if let Some(path) = &item.icon_path {
                                    img(PathBuf::from(path))
                                        .size_full()
                                        .object_fit(ObjectFit::Cover)
                                        .into_any_element()
                                } else {
                                    icon("pc", px(15.0), theme.faint).into_any_element()
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
                                        .child(item.name.clone()),
                                )
                                .when_some(item.bottle_name.clone(), |d, bn| {
                                    d.child(
                                        div()
                                            .text_size(px(11.5))
                                            .text_color(theme.muted)
                                            .truncate()
                                            .child(bn),
                                    )
                                }),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .when_some(prog_path.clone(), |d, p| {
                            d.child(
                                Button::new(("other-unpin", idx), theme)
                                    .label("Unpin")
                                    .variant(ButtonVariant::Ghost)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        this.unpin_library_item(
                                            bottle_url.clone(),
                                            p.clone(),
                                            cx,
                                        );
                                    })),
                            )
                        })
                        .child(
                            Button::new(("other-dock", idx), theme)
                                .label("Add to Dock")
                                .variant(ButtonVariant::Ghost)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.add_to_dock(&item_dock, cx);
                                })),
                        )
                        .child(
                            Button::new(("other-run", idx), theme)
                                .label("Launch")
                                .icon("play")
                                .variant(ButtonVariant::Secondary)
                                .size(ButtonSize::Sm)
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    this.launch_library_item(&item_launch, cx);
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
        .flex()
        .flex_col()
        .gap(S3)
        .child(
            div()
                .text_size(px(13.0))
                .font_weight(gpui::FontWeight::SEMIBOLD)
                .text_color(theme.muted)
                .child(format!("Other apps ({})", apps.len())),
        )
        .child(
            div()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded(R_LG)
                .overflow_hidden()
                .children(rows),
        )
        .into_any_element()
}

fn render_steam_setup(
    app: &GmacApp,
    theme: Theme,
    cx: &mut Context<GmacApp>,
) -> AnyElement {
    let setup: SteamSetupStatusDto = app.steam_setup.clone().unwrap_or(SteamSetupStatusDto {
        wine_installed: app
            .runtime_status
            .as_ref()
            .map(|s| s.wine_installed)
            .unwrap_or(false),
        bottle_url: app.bottles.first().map(|b| b.url.clone()),
        bottle_name: app.bottles.first().map(|b| b.name.clone()),
        bottle_in_flight: false,
        graphics_backend: app
            .bottles
            .first()
            .map(|b| b.settings.graphics_backend.clone()),
        graphics_chosen: !app.bottles.is_empty(),
        d3d_metal_installed: app
            .runtime_status
            .as_ref()
            .map(|s| s.d3d_metal_installed)
            .unwrap_or(false),
        steam_installed: app.bottles.iter().any(|b| b.steam_installed),
        installed_game_count: 0,
    });

    let step1_done = setup.wine_installed;
    let step2_done = setup.bottle_url.is_some();
    let step3_done = step2_done && setup.graphics_chosen;
    let step4_done = setup.steam_installed;

    let step1_action = if step1_done {
        status_pill("Installed", StatusDot::Active, theme)
    } else {
        Button::new("setup-install-wine", theme)
            .label(if app.runtime_progress.is_some() {
                "Installing…"
            } else {
                "Install GmacWine"
            })
            .icon("download")
            .variant(ButtonVariant::Primary)
            .size(ButtonSize::Sm)
            .disabled(app.runtime_progress.is_some())
            .on_click(cx.listener(|this, _, _, cx| {
                this.install_runtime(cx);
            }))
            .into_any_element()
    };

    let step2_action = if let Some(name) = &setup.bottle_name {
        status_pill(name.clone(), StatusDot::Active, theme)
    } else {
        Button::new("setup-create-pc", theme)
            .label("Create Steam PC")
            .icon("plus")
            .variant(ButtonVariant::Primary)
            .size(ButtonSize::Sm)
            .disabled(!step1_done || setup.bottle_in_flight)
            .on_click(cx.listener(|this, _, _, cx| {
                this.create_steam_bottle(cx);
            }))
            .into_any_element()
    };

    let selected_backend = setup.graphics_backend.as_deref().unwrap_or("recommended");
    let backend_options = [
        ("recommended", "Automatic"),
        ("d3dMetal", "D3DMetal"),
        ("dxmt", "DXMT"),
        ("dxvk", "DXVK"),
    ];

    let step3_controls = div()
        .flex()
        .items_center()
        .gap(S2)
        .children(backend_options.iter().enumerate().map(|(i, (raw, label))| {
            let active = selected_backend == *raw;
            let raw_str = (*raw).to_string();
            let bottle_opt = setup.bottle_url.clone();
            Button::new(("setup-backend", i), theme)
                .label(*label)
                .variant(if active {
                    ButtonVariant::Primary
                } else {
                    ButtonVariant::Secondary
                })
                .size(ButtonSize::Sm)
                .disabled(bottle_opt.is_none())
                .on_click(cx.listener(move |this, _, _, cx| {
                    if let Some(url) = &bottle_opt {
                        this.set_steam_bottle_backend(url.clone(), raw_str.clone(), cx);
                    }
                }))
        }))
        .when(!setup.d3d_metal_installed, |d| {
            d.child(
                Button::new("setup-import-gptk", theme)
                    .label("Import GPTK DMG…")
                    .variant(ButtonVariant::Ghost)
                    .size(ButtonSize::Sm)
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.import_gptk_dmg(window, cx);
                    })),
            )
        })
        .into_any_element();

    let step4_bottle = setup.bottle_url.clone();
    let step4_bottle_install = step4_bottle.clone();
    let step4_action = if step4_done {
        if let Some(url) = step4_bottle {
            Button::new("setup-open-steam", theme)
                .label("Open Steam")
                .icon("external")
                .variant(ButtonVariant::Primary)
                .size(ButtonSize::Sm)
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.open_steam(url.clone(), cx);
                }))
                .into_any_element()
        } else {
            status_pill("Installed", StatusDot::Active, theme)
        }
    } else {
        let disabled = step4_bottle_install.is_none();
        Button::new("setup-install-steam", theme)
            .label("Install Steam")
            .icon("download")
            .variant(ButtonVariant::Primary)
            .size(ButtonSize::Sm)
            .disabled(disabled)
            .on_click(cx.listener(move |this, _, _, cx| {
                if let Some(url) = &step4_bottle_install {
                    this.install_steam(url.clone(), cx);
                }
            }))
            .into_any_element()
    };

    div()
        .max_w(px(740.0))
        .flex()
        .flex_col()
        .gap(S5)
        .child(
            div()
                .flex()
                .flex_col()
                .gap(S1)
                .child(
                    div()
                        .text_size(px(18.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD)
                        .text_color(theme.ink)
                        .child("Set up Steam on Mac"),
                )
                .child(
                    div()
                        .text_size(px(13.0))
                        .line_height(px(19.0))
                        .text_color(theme.muted)
                        .child("Follow these steps to prepare GmacWine, create a Windows PC, and install Steam."),
                ),
        )
        .when_some(app.runtime_progress.as_ref(), |this, prog| {
            let pct = prog.progress.clamp(0.0, 1.0) as f32;
            this.child(
                div()
                    .bg(theme.surface)
                    .border_1()
                    .border_color(theme.border_strong)
                    .rounded(R_MD)
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
                                    .text_size(px(13.0))
                                    .font_weight(gpui::FontWeight::MEDIUM)
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
                            .child(div().h_full().w(gpui::relative(pct)).bg(theme.accent)),
                    ),
            )
        })
        .child(
            div()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded(R_LG)
                .overflow_hidden()
                .child(setup_step_row(
                    1,
                    "Install GmacWine",
                    "Downloads the Wine runtime and Vulkan/Metal translation libraries.",
                    step1_done,
                    step1_action,
                    false,
                    theme,
                ))
                .child(setup_step_row(
                    2,
                    "Create a Steam PC",
                    "Initializes a dedicated Windows environment for your Steam library.",
                    step2_done,
                    step2_action,
                    false,
                    theme,
                ))
                .child(setup_step_row(
                    3,
                    "Choose graphics backend",
                    &format!(
                        "Currently selected: {}. You can switch per game or per PC at any time.",
                        pretty_backend(selected_backend)
                    ),
                    step3_done,
                    step3_controls,
                    false,
                    theme,
                ))
                .child(setup_step_row(
                    4,
                    "Install Steam",
                    "Downloads and runs the Windows Steam installer inside your PC.",
                    step4_done,
                    step4_action,
                    true,
                    theme,
                )),
        )
        .child(
            div()
                .flex()
                .items_center()
                .gap(S2)
                .child(
                    Button::new("setup-new-custom", theme)
                        .label("Create custom PC…")
                        .icon("plus")
                        .variant(ButtonVariant::Secondary)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.open_create_bottle_modal(window, cx);
                        })),
                )
                .child(
                    Button::new("setup-import-existing", theme)
                        .label("Import existing PC…")
                        .icon("folder")
                        .variant(ButtonVariant::Ghost)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.import_existing_bottle(window, cx);
                        })),
                ),
        )
        .into_any_element()
}

fn setup_step_row(
    num: usize,
    title: &str,
    description: &str,
    done: bool,
    action: AnyElement,
    is_last: bool,
    theme: Theme,
) -> AnyElement {
    let mut row = div()
        .w_full()
        .px(S4)
        .py(S4)
        .flex()
        .items_center()
        .justify_between()
        .gap(S4)
        .child(
            div()
                .flex()
                .items_center()
                .gap(S3)
                .flex_1()
                .min_w(px(0.0))
                .child(
                    div()
                        .size(px(26.0))
                        .rounded(px(999.0))
                        .bg(if done {
                            theme.success_soft
                        } else {
                            theme.surface_subtle
                        })
                        .border_1()
                        .border_color(if done {
                            theme.success.opacity(0.4)
                        } else {
                            theme.border
                        })
                        .flex()
                        .items_center()
                        .justify_center()
                        .flex_shrink_0()
                        .child(if done {
                            icon("check", px(13.0), theme.success).into_any_element()
                        } else {
                            div()
                                .text_size(px(12.0))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.muted)
                                .child(num.to_string())
                                .into_any_element()
                        }),
                )
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(2.0))
                        .min_w(px(0.0))
                        .child(
                            div()
                                .text_size(px(13.5))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .child(title.to_string()),
                        )
                        .child(
                            div()
                                .text_size(px(12.0))
                                .line_height(px(17.0))
                                .text_color(theme.muted)
                                .child(description.to_string()),
                        ),
                ),
        )
        .child(div().flex_shrink_0().child(action));

    if !is_last {
        row = row.border_b_1().border_color(theme.border);
    }
    row.into_any_element()
}
