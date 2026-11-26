use std::path::PathBuf;

use gpui::{
    AnyElement, Context, InteractiveElement, IntoElement, ObjectFit, ParentElement, Styled, div,
    img, prelude::*, px,
};

use crate::app::GmacApp;
use crate::components::icon;
use crate::models::{format_bytes, format_duration, format_relative_epoch};
use crate::theme::{R_LG, R_MD, R_SM, S1, S2, S3, S4, S5, S6, Theme};
use crate::views::empty_state;

pub fn render(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let stats = &app.statistics;

    let refresh_btn = crate::components::button::icon_button(
        "stats-refresh",
        "refresh",
        theme,
        cx.listener(|this, _, _, cx| {
            this.refresh_statistics(cx);
        }),
    );

    let max_total = stats
        .games
        .iter()
        .map(|g| g.total_sec)
        .fold(0.0_f64, f64::max)
        .max(1.0);

    let has_content = stats.total_games_count > 0 || !stats.games.is_empty();

    div()
        .size_full()
        .flex()
        .flex_col()
        // Header
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
                                .child("Statistics"),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(theme.muted)
                                .child("Playtime, sessions, and storage across your PCs"),
                        ),
                )
                .child(refresh_btn),
        )
        // Scrollable content
        .child(
            div()
                .id("stats-scroll")
                .flex_1()
                .min_h(px(0.0))
                .overflow_y_scroll()
                .px(S6)
                .py(S5)
                .flex()
                .flex_col()
                .gap(S5)
                .when(!has_content, |this| {
                    this.child(empty_state(
                        "stats",
                        "No statistics recorded yet",
                        "Launch games through Gmac to record playtime, session counts, and storage usage.",
                        None,
                        theme,
                    ))
                })
                .when(has_content, |this| {
                    this
                        // 4 metric tiles
                        .child(
                            div()
                                .grid()
                                .grid_cols(4)
                                .gap(S3)
                                .child(metric_tile(
                                    "Total playtime",
                                    format_duration(stats.total_playtime_sec),
                                    None,
                                    theme,
                                ))
                                .child(metric_tile(
                                    "Last two weeks",
                                    format_duration(stats.last_two_weeks_sec),
                                    None,
                                    theme,
                                ))
                                .child(metric_tile(
                                    "Storage used",
                                    format_bytes(stats.storage_bytes),
                                    None,
                                    theme,
                                ))
                                .child(metric_tile(
                                    "Played games",
                                    format!("{} / {}", stats.played_count, stats.total_games_count),
                                    None,
                                    theme,
                                )),
                        )
                        // Highlight row
                        .when(
                            stats.most_played_name.is_some()
                                || stats.last_played_name.is_some()
                                || stats.longest_session_name.is_some(),
                            |inner| {
                                inner.child(
                                    div()
                                        .grid()
                                        .grid_cols(3)
                                        .gap(S3)
                                        .child(highlight_tile(
                                            "Most played",
                                            stats.most_played_name.as_deref().unwrap_or("—"),
                                            stats
                                                .most_played_sec
                                                .map(format_duration)
                                                .as_deref()
                                                .unwrap_or("—"),
                                            theme,
                                        ))
                                        .child(highlight_tile(
                                            "Last played",
                                            stats.last_played_name.as_deref().unwrap_or("—"),
                                            "Most recent session",
                                            theme,
                                        ))
                                        .child(highlight_tile(
                                            "Longest session",
                                            stats.longest_session_name.as_deref().unwrap_or("—"),
                                            stats
                                                .longest_session_sec
                                                .map(format_duration)
                                                .as_deref()
                                                .unwrap_or("—"),
                                            theme,
                                        )),
                                )
                            },
                        )
                        // Breakdown
                        .when(!stats.games.is_empty(), |inner| {
                            let rows: Vec<AnyElement> = stats
                                .games
                                .iter()
                                .enumerate()
                                .map(|(idx, game)| {
                                    let ratio = ((game.total_sec / max_total) as f32).clamp(0.02, 1.0);
                                    let is_last = idx + 1 == stats.games.len();
                                    let subtitle_parts: Vec<String> = [
                                        game.bottle_name.clone(),
                                        game.sessions.map(|s| {
                                            if s == 1 {
                                                "1 session".to_string()
                                            } else {
                                                format!("{s} sessions")
                                            }
                                        }),
                                        game.last_played_epoch.map(format_relative_epoch),
                                    ]
                                    .into_iter()
                                    .flatten()
                                    .collect();

                                    let thumb = if let Some(path) =
                                        game.icon_path.as_ref().or(game.artwork_path.as_ref())
                                    {
                                        div()
                                            .size(px(34.0))
                                            .rounded(R_SM)
                                            .overflow_hidden()
                                            .bg(theme.surface_subtle)
                                            .flex_shrink_0()
                                            .child(
                                                img(PathBuf::from(path))
                                                    .size_full()
                                                    .object_fit(ObjectFit::Cover),
                                            )
                                            .into_any_element()
                                    } else {
                                        div()
                                            .size(px(34.0))
                                            .rounded(R_SM)
                                            .bg(theme.surface_subtle)
                                            .border_1()
                                            .border_color(theme.border)
                                            .flex()
                                            .items_center()
                                            .justify_center()
                                            .flex_shrink_0()
                                            .child(icon("gamepad", px(15.0), theme.faint))
                                            .into_any_element()
                                    };

                                    let mut row = div()
                                        .w_full()
                                        .px(S4)
                                        .py(S3)
                                        .flex()
                                        .items_center()
                                        .gap(S3)
                                        .child(thumb)
                                        .child(
                                            div()
                                                .flex_1()
                                                .min_w(px(0.0))
                                                .flex()
                                                .flex_col()
                                                .gap(px(4.0))
                                                .child(
                                                    div()
                                                        .flex()
                                                        .items_center()
                                                        .justify_between()
                                                        .gap(S3)
                                                        .child(
                                                            div()
                                                                .text_size(px(13.5))
                                                                .font_weight(gpui::FontWeight::MEDIUM)
                                                                .text_color(theme.ink)
                                                                .truncate()
                                                                .child(game.name.clone()),
                                                        )
                                                        .child(
                                                            div()
                                                                .flex()
                                                                .items_center()
                                                                .gap(S4)
                                                                .flex_shrink_0()
                                                                .when_some(game.size_on_disk, |d, sz| {
                                                                    d.child(
                                                                        div()
                                                                            .text_size(px(12.0))
                                                                            .text_color(theme.faint)
                                                                            .child(format_bytes(sz)),
                                                                    )
                                                                })
                                                                .child(
                                                                    div()
                                                                        .text_size(px(13.0))
                                                                        .font_weight(gpui::FontWeight::SEMIBOLD)
                                                                        .text_color(theme.ink)
                                                                        .child(format_duration(game.total_sec)),
                                                                ),
                                                        ),
                                                )
                                                .child(
                                                    div()
                                                        .h(px(4.0))
                                                        .w_full()
                                                        .rounded(px(999.0))
                                                        .bg(theme.surface_subtle)
                                                        .overflow_hidden()
                                                        .child(
                                                            div()
                                                                .h_full()
                                                                .w(gpui::relative(ratio))
                                                                .bg(theme.accent)
                                                                .rounded(px(999.0)),
                                                        ),
                                                )
                                                .when(!subtitle_parts.is_empty(), |d| {
                                                    d.child(
                                                        div()
                                                            .text_size(px(11.5))
                                                            .text_color(theme.muted)
                                                            .child(subtitle_parts.join(" · ")),
                                                    )
                                                }),
                                        );
                                    if !is_last {
                                        row = row.border_b_1().border_color(theme.border);
                                    }
                                    row.into_any_element()
                                })
                                .collect();

                            inner.child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap(S2)
                                    .child(
                                        div()
                                            .text_size(px(12.0))
                                            .font_weight(gpui::FontWeight::SEMIBOLD)
                                            .text_color(theme.muted)
                                            .child("By game"),
                                    )
                                    .child(
                                        div()
                                            .bg(theme.surface)
                                            .border_1()
                                            .border_color(theme.border)
                                            .rounded(R_LG)
                                            .overflow_hidden()
                                            .children(rows),
                                    ),
                            )
                        })
                        .when(!stats.unplayed_names.is_empty(), |inner| {
                            inner.child(
                                div()
                                    .bg(theme.surface)
                                    .border_1()
                                    .border_color(theme.border)
                                    .rounded(R_MD)
                                    .px(S4)
                                    .py(S3)
                                    .flex()
                                    .flex_col()
                                    .gap(S1)
                                    .child(
                                        div()
                                            .text_size(px(12.0))
                                            .font_weight(gpui::FontWeight::SEMIBOLD)
                                            .text_color(theme.muted)
                                            .child(format!(
                                                "Unplayed ({})",
                                                stats.unplayed_names.len()
                                            )),
                                    )
                                    .child(
                                        div()
                                            .text_size(px(12.5))
                                            .line_height(px(18.0))
                                            .text_color(theme.faint)
                                            .child(stats.unplayed_names.join(", ")),
                                    ),
                            )
                        })
                }),
        )
        .into_any_element()
}

fn metric_tile(label: &str, value: String, detail: Option<&str>, theme: Theme) -> AnyElement {
    div()
        .bg(theme.surface)
        .border_1()
        .border_color(theme.border)
        .rounded(R_LG)
        .px(S4)
        .py(S4)
        .flex()
        .flex_col()
        .gap(px(4.0))
        .child(
            div()
                .text_size(px(12.0))
                .text_color(theme.muted)
                .child(label.to_string()),
        )
        .child(
            div()
                .text_size(px(21.0))
                .font_weight(gpui::FontWeight::SEMIBOLD)
                .text_color(theme.ink)
                .child(value),
        )
        .when_some(detail.map(str::to_string), |d, det| {
            d.child(div().text_size(px(11.5)).text_color(theme.faint).child(det))
        })
        .into_any_element()
}

fn highlight_tile(label: &str, title: &str, meta: &str, theme: Theme) -> AnyElement {
    div()
        .bg(theme.surface)
        .border_1()
        .border_color(theme.border)
        .rounded(R_MD)
        .px(S4)
        .py(S3)
        .flex()
        .flex_col()
        .gap(px(3.0))
        .child(
            div()
                .text_size(px(11.5))
                .text_color(theme.faint)
                .child(label.to_string()),
        )
        .child(
            div()
                .text_size(px(14.0))
                .font_weight(gpui::FontWeight::SEMIBOLD)
                .text_color(theme.ink)
                .truncate()
                .child(title.to_string()),
        )
        .child(
            div()
                .text_size(px(12.0))
                .text_color(theme.muted)
                .truncate()
                .child(meta.to_string()),
        )
        .into_any_element()
}
