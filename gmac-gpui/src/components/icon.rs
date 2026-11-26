use gpui::{Hsla, Pixels, Svg, Styled, svg};

pub fn icon(name: &'static str, size: Pixels, color: Hsla) -> Svg {
    svg()
        .path(format!("icons/{name}.svg"))
        .size(size)
        .flex_shrink_0()
        .text_color(color)
}
