use gpui::{
    AnyElement, App, ClickEvent, CursorStyle, ElementId, InteractiveElement, IntoElement,
    ParentElement, SharedString, StatefulInteractiveElement, Styled, Window, div, prelude::*, px,
};

use crate::theme::{R_MD, R_SM, S2, S3, S4, Theme};

pub fn toggle_switch(
    id: impl Into<ElementId>,
    checked: bool,
    disabled: bool,
    theme: Theme,
    on_toggle: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
) -> AnyElement {
    let track_bg = if checked {
        theme.accent
    } else {
        theme.border_strong
    };
    let thumb_bg = if checked {
        theme.accent_ink
    } else {
        theme.surface
    };

    let mut el = div()
        .id(id)
        .w(px(36.0))
        .h(px(20.0))
        .p(px(2.0))
        .rounded(px(999.0))
        .bg(track_bg)
        .flex()
        .items_center()
        .flex_shrink_0();

    if checked {
        el = el.justify_end();
    } else {
        el = el.justify_start();
    }

    if disabled {
        el = el.opacity(0.45);
    } else {
        el = el
            .cursor(CursorStyle::PointingHand)
            .hover(move |s| {
                s.bg(if checked {
                    theme.accent_hover
                } else {
                    theme.muted.opacity(0.55)
                })
            })
            .on_click(on_toggle);
    }

    el.child(div().size(px(16.0)).rounded(px(999.0)).bg(thumb_bg))
        .into_any_element()
}

pub fn setting_row(
    title: impl Into<SharedString>,
    subtitle: Option<SharedString>,
    control: impl IntoElement,
    is_last: bool,
    theme: Theme,
) -> AnyElement {
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
                .flex_col()
                .gap(px(2.0))
                .flex_1()
                .min_w(px(0.0))
                .overflow_hidden()
                .child(
                    div()
                        .text_size(px(13.5))
                        .font_weight(gpui::FontWeight::MEDIUM)
                        .text_color(theme.ink)
                        .child(title.into()),
                )
                .when_some(subtitle, |this, sub| {
                    this.child(
                        div()
                            .text_size(px(12.0))
                            .text_color(theme.muted)
                            .line_height(px(17.0))
                            .child(sub),
                    )
                }),
        )
        .child(div().flex_shrink_0().max_w(px(460.0)).child(control));

    if !is_last {
        row = row.border_b_1().border_color(theme.border);
    }

    row.into_any_element()
}

pub fn setting_row_stacked(
    title: impl Into<SharedString>,
    subtitle: Option<SharedString>,
    control: impl IntoElement,
    is_last: bool,
    theme: Theme,
) -> AnyElement {
    let mut row = div()
        .w_full()
        .px(S4)
        .py(S3)
        .flex()
        .flex_col()
        .gap(S2)
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
                        .child(title.into()),
                )
                .when_some(subtitle, |this, sub| {
                    this.child(
                        div()
                            .text_size(px(12.0))
                            .text_color(theme.muted)
                            .line_height(px(17.0))
                            .child(sub),
                    )
                }),
        )
        .child(div().w_full().child(control));

    if !is_last {
        row = row.border_b_1().border_color(theme.border);
    }

    row.into_any_element()
}

pub fn card_section(
    title: Option<SharedString>,
    theme: Theme,
    rows: Vec<AnyElement>,
) -> AnyElement {
    div()
        .flex()
        .flex_col()
        .gap(S2)
        .when_some(title, |this, t| {
            this.child(
                div()
                    .text_size(px(13.0))
                    .font_weight(gpui::FontWeight::MEDIUM)
                    .text_color(theme.muted)
                    .px(px(2.0))
                    .child(t),
            )
        })
        .child(
            div()
                .w_full()
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border)
                .rounded(R_MD)
                .overflow_hidden()
                .children(rows),
        )
        .into_any_element()
}

pub fn choice_chip(
    id: impl Into<ElementId>,
    label: impl Into<SharedString>,
    active: bool,
    theme: Theme,
    on_click: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
) -> AnyElement {
    div()
        .id(id)
        .h(px(28.0))
        .px(px(11.0))
        .rounded(R_SM)
        .flex_shrink_0()
        .whitespace_nowrap()
        .flex()
        .items_center()
        .justify_center()
        .text_size(px(12.5))
        .font_weight(gpui::FontWeight::MEDIUM)
        .cursor(CursorStyle::PointingHand)
        .border_1()
        .bg(if active {
            theme.accent_soft
        } else {
            theme.surface_subtle
        })
        .border_color(if active {
            theme.accent
        } else {
            theme.border
        })
        .text_color(if active {
            theme.accent_text
        } else {
            theme.muted
        })
        .hover(move |s| {
            if active {
                s
            } else {
                s.bg(theme.surface_hover).text_color(theme.ink)
            }
        })
        .on_click(on_click)
        .child(label.into())
        .into_any_element()
}
