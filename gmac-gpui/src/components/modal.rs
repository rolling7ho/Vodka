use gpui::{
    AnyElement, App, ClickEvent, InteractiveElement, IntoElement, ParentElement, SharedString,
    StatefulInteractiveElement, Styled, Window, div, prelude::*, px,
};

use crate::components::button::icon_button;
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
    let dismiss_rc = std::rc::Rc::new(on_dismiss);
    let dismiss_backdrop = std::rc::Rc::clone(&dismiss_rc);
    let dismiss_close = std::rc::Rc::clone(&dismiss_rc);
    let card_id: SharedString = format!("{id}-card").into();
    let close_id: SharedString = format!("{id}-close").into();

    div()
        .id(id)
        .absolute()
        .inset_0()
        .bg(theme.backdrop)
        .flex()
        .items_center()
        .justify_center()
        .on_click(move |ev, window, cx| dismiss_backdrop(ev, window, cx))
        .child(
            div()
                .id(card_id)
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
                        .items_start()
                        .justify_between()
                        .gap(S3)
                        .child(
                            div()
                                .flex()
                                .flex_col()
                                .gap(px(4.0))
                                .flex_1()
                                .min_w(px(0.0))
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
                        .child(icon_button(close_id, "x", theme, move |ev, window, cx| {
                            dismiss_close(ev, window, cx);
                        })),
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
