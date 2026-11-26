use gpui::{
    AnyElement, App, ClickEvent, InteractiveElement, IntoElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, Window, div, prelude::*, px,
};

use crate::theme::{R_LG, S2, S3, S4, S5, Theme};

#[allow(clippy::too_many_arguments)]
pub fn modal_dialog(
    id: &'static str,
    title: impl Into<SharedString>,
    subtitle: Option<SharedString>,
    width: f32,
    theme: Theme,
    on_dismiss: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    body: AnyElement,
    footer: AnyElement,
) -> AnyElement {
    div()
        .id(id)
        .absolute()
        .inset_0()
        .bg(theme.backdrop)
        .flex()
        .items_center()
        .justify_center()
        .on_click(on_dismiss)
        .child(
            div()
                .id("modal-card")
                .w(px(width))
                .max_w(px(620.0))
                .bg(theme.surface)
                .border_1()
                .border_color(theme.border_strong)
                .rounded(R_LG)
                .shadow_lg()
                .p(S5)
                .flex()
                .flex_col()
                .gap(S4)
                .on_click(|_, _, cx| cx.stop_propagation())
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(4.0))
                        .child(
                            div()
                                .text_size(px(16.0))
                                .font_weight(gpui::FontWeight::SEMIBOLD)
                                .text_color(theme.ink)
                                .child(title.into()),
                        )
                        .when_some(subtitle, |this, sub| {
                            this.child(
                                div()
                                    .text_size(px(13.0))
                                    .line_height(px(19.0))
                                    .text_color(theme.muted)
                                    .child(sub),
                            )
                        }),
                )
                .child(body)
                .child(
                    div()
                        .pt(S3)
                        .border_t_1()
                        .border_color(theme.border)
                        .flex()
                        .items_center()
                        .justify_end()
                        .gap(S2)
                        .child(footer),
                ),
        )
        .into_any_element()
}
