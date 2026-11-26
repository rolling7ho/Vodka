use gpui::{AnyElement, IntoElement, ParentElement, SharedString, Styled, div, prelude::*, px};

use crate::theme::{R_LG, S2, S4, S5, Theme};

pub mod activity;
pub mod bottle;
pub mod library;
pub mod settings;
pub mod sidebar;
pub mod statistics;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NavSection {
    Library,
    Statistics,
    Activity,
    Bottle(String),
    Settings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BottleTab {
    Overview,
    Programs,
    Settings,
    Presets,
    Tools,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsTab {
    General,
    Gaming,
    Engine,
    Storage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityTab {
    Processes,
    Logs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToastStyle {
    Info,
    Success,
    Warning,
    Error,
}

impl ToastStyle {
    pub fn from_str(raw: &str) -> Self {
        match raw {
            "success" => Self::Success,
            "warning" => Self::Warning,
            "error" => Self::Error,
            _ => Self::Info,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ToastState {
    pub style: ToastStyle,
    pub message: String,
    pub log_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RuntimeProgress {
    pub phase: String,
    pub progress: f64,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActiveModal {
    CreateBottle {
        win_version: String,
        location: Option<String>,
    },
    RenameBottle {
        url: String,
    },
    DuplicateBottle {
        url: String,
    },
    DeleteBottle {
        url: String,
        name: String,
        move_to_trash: bool,
    },
    ConfirmUninstallRuntime,
    ConfirmClearShaders,
    ConfirmQuit {
        running_count: i32,
    },
    AddDllOverride {
        url: String,
        mode: String,
    },
}

pub fn empty_state(
    icon_name: &'static str,
    title: impl Into<SharedString>,
    subtitle: impl Into<SharedString>,
    action: Option<AnyElement>,
    theme: Theme,
) -> AnyElement {
    div()
        .w_full()
        .py(px(56.0))
        .px(S5)
        .bg(theme.surface)
        .border_1()
        .border_color(theme.border)
        .rounded(R_LG)
        .flex()
        .flex_col()
        .items_center()
        .justify_center()
        .gap(S4)
        .child(
            div()
                .size(px(40.0))
                .rounded(px(999.0))
                .bg(theme.surface_subtle)
                .border_1()
                .border_color(theme.border)
                .flex()
                .items_center()
                .justify_center()
                .child(crate::components::icon(icon_name, px(18.0), theme.muted)),
        )
        .child(
            div()
                .flex()
                .flex_col()
                .items_center()
                .gap(px(4.0))
                .max_w(px(380.0))
                .child(
                    div()
                        .text_size(px(15.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD)
                        .text_color(theme.ink)
                        .child(title.into()),
                )
                .child(
                    div()
                        .text_size(px(13.0))
                        .line_height(px(19.0))
                        .text_color(theme.muted)
                        .text_center()
                        .child(subtitle.into()),
                ),
        )
        .when_some(action, |this, act| this.child(div().pt(S2).child(act)))
        .into_any_element()
}
