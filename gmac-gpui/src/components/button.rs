use gpui::{
    AnyElement, App, ClickEvent, CursorStyle, ElementId, InteractiveElement, IntoElement,
    ParentElement, RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window, div, px,
};

use crate::components::icon;
use crate::theme::{R_SM, S2, S3, Theme};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonVariant {
    Primary,
    Secondary,
    Ghost,
    Danger,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonSize {
    Sm,
    Md,
}

type ClickCallback = Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>;

#[derive(IntoElement)]
pub struct Button {
    id: ElementId,
    label: Option<SharedString>,
    leading_icon: Option<&'static str>,
    variant: ButtonVariant,
    size: ButtonSize,
    disabled: bool,
    full_width: bool,
    theme: Theme,
    on_click: Option<ClickCallback>,
}

impl Button {
    pub fn new(id: impl Into<ElementId>, theme: Theme) -> Self {
        Self {
            id: id.into(),
            label: None,
            leading_icon: None,
            variant: ButtonVariant::Secondary,
            size: ButtonSize::Md,
            disabled: false,
            full_width: false,
            theme,
            on_click: None,
        }
    }

    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = Some(label.into());
        self
    }

    pub fn icon(mut self, icon_name: &'static str) -> Self {
        self.leading_icon = Some(icon_name);
        self
    }

    pub fn variant(mut self, variant: ButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    pub fn size(mut self, size: ButtonSize) -> Self {
        self.size = size;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn full_width(mut self, full_width: bool) -> Self {
        self.full_width = full_width;
        self
    }

    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Box::new(handler));
        self
    }
}

impl RenderOnce for Button {
    fn render(self, _window: &mut Window, _cx: &mut App) -> impl IntoElement {
        let t = self.theme;
        let height = match self.size {
            ButtonSize::Sm => px(30.0),
            ButtonSize::Md => px(34.0),
        };
        let horiz_pad = match (&self.label, self.size) {
            (None, ButtonSize::Sm) => px(6.0),
            (None, ButtonSize::Md) => px(8.0),
            (Some(_), ButtonSize::Sm) => S3,
            (Some(_), ButtonSize::Md) => px(14.0),
        };
        let icon_size = match self.size {
            ButtonSize::Sm => px(13.0),
            ButtonSize::Md => px(14.0),
        };
        let text_size = match self.size {
            ButtonSize::Sm => px(12.5),
            ButtonSize::Md => px(13.5),
        };

        let (bg, hover_bg, active_bg, border, text_color) = match self.variant {
            ButtonVariant::Primary => (
                t.accent,
                t.accent_hover,
                t.accent_active,
                t.accent,
                t.accent_ink,
            ),
            ButtonVariant::Secondary => (
                t.surface,
                t.surface_hover,
                t.surface_subtle,
                t.border_strong,
                t.ink,
            ),
            ButtonVariant::Ghost => (
                gpui::transparent_black(),
                t.surface_subtle,
                t.border,
                gpui::transparent_black(),
                t.muted,
            ),
            ButtonVariant::Danger => (
                t.danger_soft,
                t.danger.opacity(0.18),
                t.danger.opacity(0.24),
                t.danger.opacity(0.35),
                t.danger,
            ),
        };

        let mut el = div()
            .id(self.id)
            .h(height)
            .px(horiz_pad)
            .rounded(R_SM)
            .flex()
            .items_center()
            .justify_center()
            .gap(S2)
            .text_size(text_size)
            .font_weight(gpui::FontWeight::MEDIUM)
            .bg(bg)
            .border_1()
            .border_color(border)
            .text_color(text_color);

        if self.full_width {
            el = el.w_full();
        } else {
            el = el.flex_shrink_0();
        }

        if self.disabled {
            el = el.opacity(0.45);
        } else {
            el = el
                .cursor(CursorStyle::PointingHand)
                .hover(move |s| {
                    let s = s.bg(hover_bg);
                    if matches!(self.variant, ButtonVariant::Ghost) {
                        s.text_color(t.ink)
                    } else {
                        s
                    }
                })
                .active(move |s| s.bg(active_bg));
            if let Some(handler) = self.on_click {
                el = el.on_click(handler);
            }
        }

        if let Some(ic) = self.leading_icon {
            el = el.child(icon(ic, icon_size, text_color));
        }
        if let Some(lbl) = self.label {
            el = el.child(div().whitespace_nowrap().child(lbl));
        }

        el.into_any_element() as AnyElement
    }
}

pub fn icon_button(
    id: impl Into<ElementId>,
    icon_name: &'static str,
    theme: Theme,
    on_click: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
) -> Button {
    Button::new(id, theme)
        .icon(icon_name)
        .variant(ButtonVariant::Ghost)
        .size(ButtonSize::Sm)
        .on_click(on_click)
}
