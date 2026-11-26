use gpui::{
    AnyElement, Context, CursorStyle, InteractiveElement, IntoElement, ParentElement,
    StatefulInteractiveElement, Styled, div, prelude::*, px,
};

use crate::app::GmacApp;
use crate::components::badge::{StatusDot, pill_badge, status_pill};
use crate::components::button::{Button, ButtonSize, ButtonVariant, icon_button};
use crate::components::segmented::{SegmentOption, segmented_control};
use crate::models::{format_bytes, format_relative_epoch};
use crate::theme::{R_LG, R_MD, R_SM, S1, S2, S3, S4, S5, S6, Theme};
use crate::views::{ActivityTab, NavSection, empty_state};

pub fn render(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let tab = app.activity_tab;

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
                                .child("Activity"),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(theme.muted)
                                .child("Live Windows processes and Wine crash logs"),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(S2)
                        .child(segmented_control(
                            "act-tab",
                            vec![
                                SegmentOption {
                                    value: ActivityTab::Processes,
                                    label: format!("Processes ({})", app.processes.len()).into(),
                                },
                                SegmentOption {
                                    value: ActivityTab::Logs,
                                    label: format!("Logs ({})", app.logs.len()).into(),
                                },
                            ],
                            tab,
                            theme,
                            cx.listener(|this, next: &ActivityTab, _, cx| {
                                this.activity_tab = *next;
                                if *next == ActivityTab::Logs {
                                    this.refresh_logs(cx);
                                } else {
                                    this.refresh_processes(cx);
                                }
                                cx.notify();
                            }),
                        ))
                        .child(icon_button(
                            "act-refresh",
                            "refresh",
                            theme,
                            cx.listener(|this, _, _, cx| {
                                this.refresh_processes(cx);
                                this.refresh_logs(cx);
                            }),
                        ))
                        .when(
                            tab == ActivityTab::Processes && !app.processes.is_empty(),
                            |this| {
                                this.child(
                                    Button::new("act-kill-all", theme)
                                        .label("Kill all")
                                        .icon("stop")
                                        .variant(ButtonVariant::Danger)
                                        .size(ButtonSize::Sm)
                                        .on_click(cx.listener(|this, _, _, cx| {
                                            this.kill_all_processes(cx);
                                        })),
                                )
                            },
                        )
                        .when(tab == ActivityTab::Logs, |this| {
                            this.child(
                                Button::new("act-open-logs", theme)
                                    .label("Open folder")
                                    .icon("folder")
                                    .variant(ButtonVariant::Secondary)
                                    .size(ButtonSize::Sm)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.open_logs_folder(cx);
                                    })),
                            )
                        }),
                ),
        )
        .child(match tab {
            ActivityTab::Processes => render_processes(app, theme, cx),
            ActivityTab::Logs => render_logs(app, theme, cx),
        })
        .into_any_element()
}

fn render_processes(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    let rows: Vec<AnyElement> = app
        .processes
        .iter()
        .enumerate()
        .map(|(idx, proc_item)| {
            let is_last = idx + 1 == app.processes.len();
            let bottle_url = proc_item.bottle_url.clone();
            let pid = proc_item.pid;

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
                        .child(status_pill(proc_item.kind.clone(), StatusDot::Active, theme))
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
                                        .child(proc_item.name.clone()),
                                )
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap(S1)
                                        .text_size(px(12.0))
                                        .text_color(theme.muted)
                                        .child({
                                            let nav_url = proc_item.bottle_url.clone();
                                            div()
                                                .id(("proc-pc-link", idx))
                                                .cursor(CursorStyle::PointingHand)
                                                .hover(|s| s.text_color(theme.ink))
                                                .on_click(cx.listener(move |this, _, window, cx| {
                                                    this.navigate(
                                                        NavSection::Bottle(nav_url.clone()),
                                                        window,
                                                        cx,
                                                    );
                                                }))
                                                .child(proc_item.bottle_name.clone())
                                        })
                                        .child(format!(
                                            "· PID {} · {}",
                                            proc_item.pid, proc_item.memory_usage
                                        )),
                                ),
                        ),
                )
                .child(
                    Button::new(("kill-proc", idx), theme)
                        .label("End process")
                        .variant(ButtonVariant::Ghost)
                        .size(ButtonSize::Sm)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.kill_process(bottle_url.clone(), pid, cx);
                        })),
                );
            if !is_last {
                row = row.border_b_1().border_color(theme.border);
            }
            row.into_any_element()
        })
        .collect();

    div()
        .id("act-proc-scroll")
        .flex_1()
        .min_h(px(0.0))
        .overflow_y_scroll()
        .child(
            div()
                .w_full()
                .px(S6)
                .py(S5)
                .when(rows.is_empty(), |this| {
                    this.child(empty_state(
                        "activity",
                        "No Windows processes running",
                        "Active games, Steam, and background Wine services appear here while running.",
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
                }),
        )
        .into_any_element()
}

fn render_logs(app: &GmacApp, theme: Theme, cx: &mut Context<GmacApp>) -> AnyElement {
    if app.logs.is_empty() {
        return div()
            .flex_1()
            .px(S6)
            .py(S5)
            .child(empty_state(
                "warning",
                "No run logs found",
                "Wine launch logs are written automatically when games or executables run.",
                None,
                theme,
            ))
            .into_any_element();
    }

    let log_list: Vec<AnyElement> = app
        .logs
        .iter()
        .enumerate()
        .map(|(idx, log)| {
            let selected = app.selected_log.as_deref() == Some(&log.path);
            let path = log.path.clone();

            div()
                .id(("log-row", idx))
                .w_full()
                .px(S3)
                .py(S2)
                .rounded(R_SM)
                .cursor(CursorStyle::PointingHand)
                .bg(if selected {
                    theme.accent_soft
                } else {
                    gpui::transparent_black()
                })
                .hover(move |s| {
                    if selected {
                        s
                    } else {
                        s.bg(theme.surface_subtle)
                    }
                })
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.select_log(path.clone(), cx);
                }))
                .flex()
                .flex_col()
                .gap(px(2.0))
                .child(
                    div()
                        .text_size(px(12.5))
                        .font_weight(gpui::FontWeight::MEDIUM)
                        .text_color(if selected { theme.accent_text } else { theme.ink })
                        .truncate()
                        .child(log.name.clone()),
                )
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(theme.faint)
                        .child(format!(
                            "{} · {}",
                            format_relative_epoch(log.modified_epoch),
                            format_bytes(log.size_bytes)
                        )),
                )
                .into_any_element()
        })
        .collect();

    div()
        .flex_1()
        .min_h(px(0.0))
        .flex()
        // Left log list
        .child(
            div()
                .id("logs-sidebar")
                .w(px(280.0))
                .h_full()
                .flex_shrink_0()
                .border_r_1()
                .border_color(theme.border)
                .overflow_y_scroll()
                .child(
                    div()
                        .w_full()
                        .p(S3)
                        .flex()
                        .flex_col()
                        .gap(px(2.0))
                        .children(log_list),
                ),
        )
        // Right log viewer + crash classifier
        .child(
            div()
                .flex_1()
                .min_w(px(0.0))
                .h_full()
                .p(S5)
                .flex()
                .flex_col()
                .gap(S4)
                .when_some(app.selected_log.clone(), |this, path| {
                    this.child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .gap(S3)
                            .child(
                                div()
                                    .flex_1()
                                    .min_w(px(0.0))
                                    .text_size(px(13.0))
                                    .font_weight(gpui::FontWeight::MEDIUM)
                                    .text_color(theme.muted)
                                    .truncate()
                                    .child(path.clone()),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap(S2)
                                    .flex_shrink_0()
                                    .child(
                                        Button::new("log-copy-path", theme)
                                            .label("Copy log")
                                            .icon("copy")
                                            .variant(ButtonVariant::Secondary)
                                            .size(ButtonSize::Sm)
                                            .on_click(cx.listener(|this, _, _, cx| {
                                                let text = this.log_text.clone();
                                                cx.write_to_clipboard(gpui::ClipboardItem::new_string(text));
                                                this.push_toast(
                                                    crate::views::ToastStyle::Success,
                                                    "Log copied to clipboard",
                                                    None,
                                                    cx,
                                                );
                                            })),
                                    )
                                    .child(
                                        Button::new("log-analyze", theme)
                                            .label("Analyze crash")
                                            .icon("warning")
                                            .variant(ButtonVariant::Primary)
                                            .size(ButtonSize::Sm)
                                            .on_click(cx.listener(move |this, _, _, cx| {
                                                this.classify_log(path.clone(), cx);
                                            })),
                                    ),
                            ),
                    )
                })
                .when_some(app.crash_diagnosis.clone(), |this, diag| {
                    this.child(
                        div()
                            .bg(theme.surface)
                            .border_1()
                            .border_color(theme.border_strong)
                            .rounded(R_MD)
                            .p(S4)
                            .flex()
                            .flex_col()
                            .gap(S3)
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .gap(S3)
                                    .child(
                                        div()
                                            .text_size(px(14.0))
                                            .font_weight(gpui::FontWeight::SEMIBOLD)
                                            .text_color(theme.ink)
                                            .child(if diag.match_count == 0 {
                                                "No known crash signature matched".to_string()
                                            } else {
                                                diag.headline
                                                    .clone()
                                                    .unwrap_or_else(|| "Crash analysis complete".to_string())
                                            }),
                                    )
                                    .when(diag.match_count > 0, |d| {
                                        d.when_some(diag.primary_confidence.clone(), |d2, conf| {
                                            d2.child(pill_badge(
                                                format!("{conf} confidence"),
                                                theme.accent_soft,
                                                theme.accent_text,
                                            ))
                                        })
                                    }),
                            )
                            .when(diag.match_count == 0 && diag.remediations.is_empty(), |d| {
                                d.child(
                                    div()
                                        .text_size(px(12.5))
                                        .text_color(theme.muted)
                                        .child("No known failure pattern matched this log. Inspect the tail below or open the logs folder to share it."),
                                )
                            })
                            .when(!diag.remediations.is_empty(), |d| {
                                d.child(div().flex().flex_col().gap(S2).children(
                                    diag.remediations.iter().map(|rem| {
                                        div()
                                            .bg(theme.surface_subtle)
                                            .rounded(R_SM)
                                            .p(S3)
                                            .flex()
                                            .flex_col()
                                            .gap(px(3.0))
                                            .child(
                                                div()
                                                    .text_size(px(13.0))
                                                    .font_weight(gpui::FontWeight::SEMIBOLD)
                                                    .text_color(theme.ink)
                                                    .child(rem.title.clone()),
                                            )
                                            .child(
                                                div()
                                                    .text_size(px(12.0))
                                                    .line_height(px(17.0))
                                                    .text_color(theme.muted)
                                                    .child(rem.description.clone()),
                                            )
                                            .child(
                                                div()
                                                    .text_size(px(11.5))
                                                    .text_color(theme.faint)
                                                    .child(format!(
                                                        "Change: {} · Undo: {}",
                                                        rem.what_will_change, rem.undo_path
                                                    )),
                                            )
                                            .into_any_element()
                                    }),
                                ))
                            }),
                    )
                })
                .child(
                    div()
                        .id("log-tail-box")
                        .flex_1()
                        .min_h(px(0.0))
                        .overflow_y_scroll()
                        .bg(theme.surface)
                        .border_1()
                        .border_color(theme.border)
                        .rounded(R_LG)
                        .child(
                            div()
                                .w_full()
                                .p(S4)
                                .font_family("Menlo")
                                .text_size(px(11.5))
                                .line_height(px(17.0))
                                .text_color(theme.ink)
                                .child(if app.log_text.is_empty() {
                                    "Select a log file on the left to inspect its output.".to_string()
                                } else {
                                    app.log_text.clone()
                                }),
                        ),
                ),
        )
        .into_any_element()
}
