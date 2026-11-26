use std::rc::Rc;

use gpui::{
    AnyElement, App, ClickEvent, CursorStyle, ElementId, InteractiveElement, IntoElement,
    ParentElement, SharedString, StatefulInteractiveElement, Styled, Window, div, px,
};

use crate::theme::{R_SM, Theme};

pub struct SegmentOption<T: Copy + PartialEq + 'static> {
    pub value: T,
    pub label: SharedString,
}

type SelectCallback<T> = Rc<dyn Fn(&T, &mut Window, &mut App)>;

pub fn segmented_control<T: Copy + PartialEq + 'static>(
    id_prefix: &'static str,
    options: Vec<SegmentOption<T>>,
    selected: T,
    theme: Theme,
    on_select: impl Fn(&T, &mut Window, &mut App) + 'static,
) -> AnyElement {
    let cb: SelectCallback<T> = Rc::new(on_select);
    let children: Vec<AnyElement> = options
        .into_iter()
        .enumerate()
        .map(|(idx, opt)| {
            let active = opt.value == selected;
            let cb = Rc::clone(&cb);
            let val = opt.value;
            let el_id: ElementId = (id_prefix, idx).into();

            div()
                .id(el_id)
                .h(px(24.0))
                .px(px(10.0))
                .rounded(px(5.0))
                .flex()
                .items_center()
                .justify_center()
                .text_size(px(12.5))
                .font_weight(if active {
                    gpui::FontWeight::MEDIUM
                } else {
                    gpui::FontWeight::NORMAL
                })
                .cursor(CursorStyle::PointingHand)
                .bg(if active {
                    theme.surface
                } else {
                    gpui::transparent_black()
                })
                .border_1()
                .border_color(if active {
                    theme.border
                } else {
                    gpui::transparent_black()
                })
                .text_color(if active { theme.ink } else { theme.muted })
                .hover(move |s| {
                    if active {
                        s
                    } else {
                        s.text_color(theme.ink)
                    }
                })
                .on_click(move |_: &ClickEvent, window, cx| cb(&val, window, cx))
                .child(opt.label)
                .into_any_element()
        })
        .collect();

    div()
        .p(px(2.0))
        .rounded(R_SM)
        .bg(theme.surface_subtle)
        .border_1()
        .border_color(theme.border)
        .flex()
        .items_center()
        .gap(px(2.0))
        .children(children)
        .into_any_element()
}
