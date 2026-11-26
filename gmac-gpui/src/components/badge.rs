use gpui::{AnyElement, Hsla, IntoElement, ParentElement, SharedString, Styled, div, px};

use crate::theme::{S1, S2, Theme};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusDot {
    Active,
    Pending,
    Warning,
    Idle,
}

impl StatusDot {
    pub fn color(self, theme: Theme) -> Hsla {
        match self {
            Self::Active => theme.success,
            Self::Pending => theme.accent_text,
            Self::Warning => theme.warning,
            Self::Idle => theme.faint,
        }
    }
}

pub fn status_pill(label: impl Into<SharedString>, status: StatusDot, theme: Theme) -> AnyElement {
    let (bg, fg) = match status {
        StatusDot::Active => (theme.success_soft, theme.success),
        StatusDot::Pending => (theme.accent_soft, theme.accent_text),
        StatusDot::Warning => (theme.warning_soft, theme.warning),
        StatusDot::Idle => (theme.surface_subtle, theme.muted),
    };

    div()
        .px(S2)
        .py(px(3.0))
        .rounded(px(999.0))
        .bg(bg)
        .flex()
        .items_center()
        .gap(px(6.0))
        .child(div().size(px(6.0)).rounded(px(999.0)).bg(status.color(theme)))
        .child(
            div()
                .text_size(px(11.5))
                .font_weight(gpui::FontWeight::MEDIUM)
                .text_color(fg)
                .child(label.into()),
        )
        .into_any_element()
}

pub fn pill_badge(label: impl Into<SharedString>, bg: Hsla, fg: Hsla) -> AnyElement {
    div()
        .px(S2)
        .py(px(2.5))
        .rounded(px(999.0))
        .bg(bg)
        .text_size(px(11.5))
        .font_weight(gpui::FontWeight::MEDIUM)
        .text_color(fg)
        .flex()
        .items_center()
        .gap(S1)
        .child(label.into())
        .into_any_element()
}
