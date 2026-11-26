use gpui::{
    AnyElement, Context, CursorStyle, InteractiveElement, IntoElement, ParentElement,
    SharedString, StatefulInteractiveElement, Styled, Window, WindowControlArea, div, prelude::*,
    px, svg,
};

use crate::app::GmacApp;
use crate::components::icon;
use crate::theme::{R_SM, S1, S2, S3, S4, Theme, ThemeMode};
use crate::views::NavSection;

pub fn render(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let process_count = app.processes.len();
    let wine_installed = app
        .runtime_status
        .as_ref()
        .map(|s| s.wine_installed)
        .unwrap_or(false);

    let bottles = &app.bottles;

    let mut bottle_rows: Vec<AnyElement> = Vec::with_capacity(bottles.len());
    for (idx, bottle) in bottles.iter().enumerate() {
        let url = bottle.url.clone();
        let active = app.nav == NavSection::Bottle(url.clone());
        let running = bottle.steam_running || bottle.running_process_count > 0;
        let name: SharedString = bottle.name.clone().into();
        let meta: SharedString = if !bottle.is_available {
            "Unavailable".into()
        } else if bottle.running_process_count > 0 {
            format!("{} running", bottle.running_process_count).into()
        } else if bottle.steam_running {
            "Steam running".into()
        } else {
            crate::models::pretty_backend(&bottle.resolved_backend).into()
        };

        let dot_color = if !bottle.is_available {
            theme.warning
        } else if running {
            theme.success
        } else {
            theme.faint
        };

        bottle_rows.push(
            div()
                .id(("sb-bottle", idx))
                .w_full()
                .px(S2)
                .py(px(7.0))
                .rounded(R_SM)
                .cursor(CursorStyle::PointingHand)
                .flex()
                .items_center()
                .gap(S2)
                .bg(if active {
                    theme.accent_soft
                } else {
                    gpui::transparent_black()
                })
                .hover(move |s| {
                    if active {
                        s
                    } else {
                        s.bg(theme.surface_subtle)
                    }
                })
                .on_click(cx.listener(move |this, _, window, cx| {
                    this.navigate(NavSection::Bottle(url.clone()), window, cx);
                }))
                .child(div().size(px(6.0)).rounded(px(999.0)).bg(dot_color).flex_shrink_0())
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .flex_1()
                        .min_w(px(0.0))
                        .child(
                            div()
                                .text_size(px(13.0))
                                .font_weight(if active {
                                    gpui::FontWeight::SEMIBOLD
                                } else {
                                    gpui::FontWeight::MEDIUM
                                })
                                .text_color(if active {
                                    theme.accent_text
                                } else {
                                    theme.ink
                                })
                                .truncate()
                                .child(name),
                        )
                        .child(
                            div()
                                .text_size(px(11.0))
                                .text_color(theme.faint)
                                .truncate()
                                .child(meta),
                        ),
                )
                .into_any_element(),
        );
    }

    let (theme_icon, theme_label) = match app.theme_mode() {
        ThemeMode::System => (if theme.is_dark { "moon" } else { "sun" }, "Auto"),
        ThemeMode::Light => ("sun", "Light"),
        ThemeMode::Dark => ("moon", "Dark"),
    };

    div()
        .w(px(228.0))
        .h_full()
        .flex_shrink_0()
        .bg(theme.sidebar_bg)
        .border_r_1()
        .border_color(theme.border)
        .flex()
        .flex_col()
        // Top header with macOS traffic-light clearance (76px left margin or dedicated strip)
        .child(
            div()
                .h(px(40.0))
                .w_full()
                .window_control_area(WindowControlArea::Drag)
                .flex()
                .items_center()
                .pl(px(78.0))
                .pr(S3)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(px(7.0))
                        .child(
                            svg()
                                .path("brand/gmac-mark.svg")
                                .size(px(16.0))
                                .text_color(theme.accent_text),
                        )
                        .child(
                            div()
                                .text_size(px(13.5))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .child("Gmac"),
                        ),
                ),
        )
        // Primary nav items
        .child(
            div()
                .px(S3)
                .pt(S2)
                .pb(S3)
                .flex()
                .flex_col()
                .gap(px(2.0))
                .child(nav_item(
                    "nav-library",
                    "Library",
                    "library",
                    app.nav == NavSection::Library,
                    None,
                    theme,
                    cx.listener(|this, _, window, cx| {
                        this.navigate(NavSection::Library, window, cx);
                    }),
                ))
                .child(nav_item(
                    "nav-statistics",
                    "Statistics",
                    "stats",
                    app.nav == NavSection::Statistics,
                    None,
                    theme,
                    cx.listener(|this, _, window, cx| {
                        this.navigate(NavSection::Statistics, window, cx);
                    }),
                ))
                .child(nav_item(
                    "nav-activity",
                    "Activity",
                    "activity",
                    app.nav == NavSection::Activity,
                    (process_count > 0).then(|| process_count.to_string().into()),
                    theme,
                    cx.listener(|this, _, window, cx| {
                        this.navigate(NavSection::Activity, window, cx);
                    }),
                )),
        )
        // PCs section
        .child(
            div()
                .px(S4)
                .pt(S2)
                .pb(S1)
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_size(px(11.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD)
                        .text_color(theme.faint)
                        .child("PCs"),
                )
                .child(
                    div()
                        .id("sb-new-pc")
                        .size(px(22.0))
                        .rounded(px(5.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .cursor(CursorStyle::PointingHand)
                        .hover(|s| s.bg(theme.surface_subtle))
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.open_create_bottle_modal(window, cx);
                        }))
                        .child(icon("plus", px(13.0), theme.muted)),
                ),
        )
        .child(
            div()
                .id("sb-bottle-list")
                .flex_1()
                .min_h(px(0.0))
                .overflow_y_scroll()
                .px(S3)
                .py(S1)
                .flex()
                .flex_col()
                .gap(px(2.0))
                .children(bottle_rows)
                .when(bottles.is_empty(), |this| {
                    this.child(
                        div()
                            .px(S2)
                            .py(S2)
                            .text_size(px(12.0))
                            .text_color(theme.faint)
                            .child("No PCs yet"),
                    )
                }),
        )
        // Footer: Engine indicator, Settings, Theme toggle
        .child(
            div()
                .px(S3)
                .py(S3)
                .border_t_1()
                .border_color(theme.border)
                .flex()
                .flex_col()
                .gap(px(4.0))
                .child(
                    div()
                        .px(S2)
                        .py(px(4.0))
                        .flex()
                        .items_center()
                        .gap(px(7.0))
                        .child(
                            div()
                                .size(px(6.0))
                                .rounded(px(999.0))
                                .bg(if wine_installed {
                                    theme.success
                                } else {
                                    theme.warning
                                }),
                        )
                        .child(
                            div()
                                .text_size(px(11.5))
                                .text_color(theme.muted)
                                .truncate()
                                .child(if wine_installed {
                                    app.runtime_status
                                        .as_ref()
                                        .and_then(|s| s.wine_version.as_deref())
                                        .map(|v| format!("Engine {v}"))
                                        .unwrap_or_else(|| "Engine ready".to_string())
                                } else {
                                    "Engine not installed".to_string()
                                }),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S1)
                        .child(
                            div().flex_1().child(nav_item(
                                "nav-settings",
                                "Settings",
                                "settings",
                                app.nav == NavSection::Settings,
                                None,
                                theme,
                                cx.listener(|this, _, window, cx| {
                                    this.navigate(NavSection::Settings, window, cx);
                                }),
                            )),
                        )
                        .child(
                            div()
                                .id("sb-theme-cycle")
                                .h(px(30.0))
                                .px(S2)
                                .rounded(R_SM)
                                .flex()
                                .items_center()
                                .gap(px(5.0))
                                .cursor(CursorStyle::PointingHand)
                                .text_size(px(11.5))
                                .text_color(theme.muted)
                                .hover(|s| s.bg(theme.surface_subtle).text_color(theme.ink))
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.cycle_theme_mode(cx);
                                }))
                                .child(icon(theme_icon, px(13.0), theme.muted))
                                .child(theme_label),
                        ),
                ),
        )
        .into_any_element()
}

fn nav_item(
    id: &'static str,
    label: &'static str,
    icon_name: &'static str,
    active: bool,
    badge: Option<SharedString>,
    theme: Theme,
    on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut gpui::App) + 'static,
) -> AnyElement {
    let color = if active { theme.accent_text } else { theme.muted };
    div()
        .id(id)
        .w_full()
        .h(px(30.0))
        .px(S2)
        .rounded(R_SM)
        .cursor(CursorStyle::PointingHand)
        .flex()
        .items_center()
        .justify_between()
        .gap(S2)
        .bg(if active {
            theme.accent_soft
        } else {
            gpui::transparent_black()
        })
        .hover(move |s| {
            if active {
                s
            } else {
                s.bg(theme.surface_subtle)
            }
        })
        .on_click(on_click)
        .child(
            div()
                .flex()
                .items_center()
                .gap(S2)
                .child(icon(icon_name, px(14.0), color))
                .child(
                    div()
                        .text_size(px(13.0))
                        .font_weight(if active {
                            gpui::FontWeight::SEMIBOLD
                        } else {
                            gpui::FontWeight::MEDIUM
                        })
                        .text_color(if active { theme.accent_text } else { theme.ink })
                        .child(label),
                ),
        )
        .when_some(badge, |this, text| {
            this.child(
                div()
                    .px(px(6.0))
                    .py(px(1.5))
                    .rounded(px(999.0))
                    .bg(theme.surface_subtle)
                    .border_1()
                    .border_color(theme.border)
                    .text_size(px(11.0))
                    .font_weight(gpui::FontWeight::MEDIUM)
                    .text_color(theme.ink)
                    .child(text),
            )
        })
        .into_any_element()
}
