use std::borrow::Cow;

use anyhow::Result;
use gpui::{AssetSource, SharedString};

pub struct GmacAssets;

impl AssetSource for GmacAssets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        let bytes: Option<&'static [u8]> = match path {
            "brand/gmac-mark.svg" => Some(include_bytes!("../assets/brand/gmac-mark.svg")),
            "icons/library.svg" => Some(include_bytes!("../assets/icons/library.svg")),
            "icons/stats.svg" => Some(include_bytes!("../assets/icons/stats.svg")),
            "icons/activity.svg" => Some(include_bytes!("../assets/icons/activity.svg")),
            "icons/pc.svg" => Some(include_bytes!("../assets/icons/pc.svg")),
            "icons/settings.svg" => Some(include_bytes!("../assets/icons/settings.svg")),
            "icons/plus.svg" => Some(include_bytes!("../assets/icons/plus.svg")),
            "icons/play.svg" => Some(include_bytes!("../assets/icons/play.svg")),
            "icons/stop.svg" => Some(include_bytes!("../assets/icons/stop.svg")),
            "icons/search.svg" => Some(include_bytes!("../assets/icons/search.svg")),
            "icons/folder.svg" => Some(include_bytes!("../assets/icons/folder.svg")),
            "icons/terminal.svg" => Some(include_bytes!("../assets/icons/terminal.svg")),
            "icons/wrench.svg" => Some(include_bytes!("../assets/icons/wrench.svg")),
            "icons/trash.svg" => Some(include_bytes!("../assets/icons/trash.svg")),
            "icons/more.svg" => Some(include_bytes!("../assets/icons/more.svg")),
            "icons/check.svg" => Some(include_bytes!("../assets/icons/check.svg")),
            "icons/chevron-right.svg" => Some(include_bytes!("../assets/icons/chevron-right.svg")),
            "icons/chevron-down.svg" => Some(include_bytes!("../assets/icons/chevron-down.svg")),
            "icons/refresh.svg" => Some(include_bytes!("../assets/icons/refresh.svg")),
            "icons/sun.svg" => Some(include_bytes!("../assets/icons/sun.svg")),
            "icons/moon.svg" => Some(include_bytes!("../assets/icons/moon.svg")),
            "icons/pin.svg" => Some(include_bytes!("../assets/icons/pin.svg")),
            "icons/external.svg" => Some(include_bytes!("../assets/icons/external.svg")),
            "icons/warning.svg" => Some(include_bytes!("../assets/icons/warning.svg")),
            "icons/sliders.svg" => Some(include_bytes!("../assets/icons/sliders.svg")),
            "icons/download.svg" => Some(include_bytes!("../assets/icons/download.svg")),
            "icons/x.svg" => Some(include_bytes!("../assets/icons/x.svg")),
            "icons/copy.svg" => Some(include_bytes!("../assets/icons/copy.svg")),
            "icons/gamepad.svg" => Some(include_bytes!("../assets/icons/gamepad.svg")),
            "icons/dock.svg" => Some(include_bytes!("../assets/icons/dock.svg")),
            _ => None,
        };
        Ok(bytes.map(Cow::Borrowed))
    }

    fn list(&self, _path: &str) -> Result<Vec<SharedString>> {
        Ok(vec![
            "brand/gmac-mark.svg".into(),
            "icons/library.svg".into(),
            "icons/stats.svg".into(),
            "icons/activity.svg".into(),
            "icons/pc.svg".into(),
            "icons/settings.svg".into(),
            "icons/plus.svg".into(),
            "icons/play.svg".into(),
            "icons/stop.svg".into(),
            "icons/search.svg".into(),
            "icons/folder.svg".into(),
            "icons/terminal.svg".into(),
            "icons/wrench.svg".into(),
            "icons/trash.svg".into(),
            "icons/more.svg".into(),
            "icons/check.svg".into(),
            "icons/chevron-right.svg".into(),
            "icons/chevron-down.svg".into(),
            "icons/refresh.svg".into(),
            "icons/sun.svg".into(),
            "icons/moon.svg".into(),
            "icons/pin.svg".into(),
            "icons/external.svg".into(),
            "icons/warning.svg".into(),
            "icons/sliders.svg".into(),
            "icons/download.svg".into(),
            "icons/x.svg".into(),
            "icons/copy.svg".into(),
            "icons/gamepad.svg".into(),
            "icons/dock.svg".into(),
        ])
    }
}
