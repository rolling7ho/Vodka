use gpui::{Hsla, Pixels, WindowAppearance, px, rgb, rgba};

/// Spacing scale (4, 8, 12, 16, 24, 32, 48).
pub const S1: Pixels = px(4.0);
pub const S2: Pixels = px(8.0);
pub const S3: Pixels = px(12.0);
pub const S4: Pixels = px(16.0);
pub const S5: Pixels = px(24.0);
pub const S6: Pixels = px(32.0);
#[allow(dead_code)]
pub const S7: Pixels = px(48.0);

/// Radius family (one consistent scale across the app).
pub const R_SM: Pixels = px(6.0);
pub const R_MD: Pixels = px(10.0);
pub const R_LG: Pixels = px(12.0);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThemeMode {
    System,
    Light,
    Dark,
}

impl ThemeMode {
    pub fn from_str(raw: &str) -> Self {
        match raw {
            "light" => Self::Light,
            "dark" => Self::Dark,
            _ => Self::System,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Theme {
    pub is_dark: bool,
    pub bg: Hsla,
    pub sidebar_bg: Hsla,
    pub surface: Hsla,
    pub surface_hover: Hsla,
    pub surface_subtle: Hsla,
    pub ink: Hsla,
    pub muted: Hsla,
    pub faint: Hsla,
    pub border: Hsla,
    pub border_strong: Hsla,
    pub accent: Hsla,
    pub accent_text: Hsla,
    pub accent_hover: Hsla,
    pub accent_active: Hsla,
    pub accent_soft: Hsla,
    pub accent_ink: Hsla,
    pub success: Hsla,
    pub success_soft: Hsla,
    pub warning: Hsla,
    pub warning_soft: Hsla,
    pub danger: Hsla,
    pub danger_soft: Hsla,
    pub backdrop: Hsla,
}

impl Theme {
    pub fn for_appearance(mode: ThemeMode, appearance: WindowAppearance) -> Self {
        let dark = match mode {
            ThemeMode::System => matches!(
                appearance,
                WindowAppearance::Dark | WindowAppearance::VibrantDark
            ),
            ThemeMode::Light => false,
            ThemeMode::Dark => true,
        };
        if dark { Self::dark() } else { Self::light() }
    }

    pub fn light() -> Self {
        Self {
            is_dark: false,
            bg: rgb(0xF6F4F3).into(),
            sidebar_bg: rgb(0xEFECEB).into(),
            surface: rgb(0xFFFFFF).into(),
            surface_hover: rgb(0xFAF8F7).into(),
            surface_subtle: rgb(0xECE8E7).into(),
            ink: rgb(0x171414).into(),
            muted: rgb(0x685F5F).into(),
            faint: rgb(0x8C8282).into(),
            border: rgb(0xE3DFDE).into(),
            border_strong: rgb(0xCFC9C8).into(),
            accent: rgb(0x713131).into(),
            accent_text: rgb(0x713131).into(),
            accent_hover: rgb(0x5D2727).into(),
            accent_active: rgb(0x4B1F1F).into(),
            accent_soft: rgba(0x71313117).into(),
            accent_ink: rgb(0xFFFFFF).into(),
            success: rgb(0x1F7A4D).into(),
            success_soft: rgba(0x1F7A4D1A).into(),
            warning: rgb(0xA86416).into(),
            warning_soft: rgba(0xA864161C).into(),
            danger: rgb(0xB4232C).into(),
            danger_soft: rgba(0xB4232C1A).into(),
            backdrop: rgba(0x17141466).into(),
        }
    }

    pub fn dark() -> Self {
        Self {
            is_dark: true,
            bg: rgb(0x120F0F).into(),
            sidebar_bg: rgb(0x0E0C0C).into(),
            surface: rgb(0x1A1616).into(),
            surface_hover: rgb(0x221D1D).into(),
            surface_subtle: rgb(0x161313).into(),
            ink: rgb(0xF3ECEC).into(),
            muted: rgb(0x9C9090).into(),
            faint: rgb(0x6E6464).into(),
            border: rgb(0x282222).into(),
            border_strong: rgb(0x383030).into(),
            accent: rgb(0x8C3E3E).into(),
            accent_text: rgb(0xD98282).into(),
            accent_hover: rgb(0x9E4848).into(),
            accent_active: rgb(0x783333).into(),
            accent_soft: rgba(0xD9828224).into(),
            accent_ink: rgb(0xFFFFFF).into(),
            success: rgb(0x34B374).into(),
            success_soft: rgba(0x34B37421).into(),
            warning: rgb(0xD99338).into(),
            warning_soft: rgba(0xD9933824).into(),
            danger: rgb(0xDF535B).into(),
            danger_soft: rgba(0xDF535B24).into(),
            backdrop: rgba(0x00000080).into(),
        }
    }
}
