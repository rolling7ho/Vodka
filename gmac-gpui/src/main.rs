mod app;
mod assets;
mod bridge;
mod components;
mod models;
mod theme;
mod views;

use std::sync::Arc;

use gpui::{
    App, Application, Bounds, KeyBinding, Menu, MenuItem, SystemMenuType, TitlebarOptions,
    WindowBounds, WindowOptions, point, prelude::*, px, size,
};

use crate::app::{
    CloseWindow, DismissOverlay, GmacApp, NavActivity, NavLibrary, NavStatistics, NewBottle,
    OpenSettings, QuitApp, RefreshView,
};
use crate::assets::GmacAssets;
use crate::bridge::BridgeClient;
use crate::components::input::{Copy, Cut, Paste, SelectAll, bind_text_input_keys};

fn main() {
    let bridge = BridgeClient::spawn().unwrap_or_else(|err| {
        eprintln!("Gmac failed to start gmac-bridge: {err}");
        std::process::exit(1);
    });
    let bridge_cleanup = Arc::clone(&bridge);

    Application::new()
        .with_assets(GmacAssets)
        .run(move |cx: &mut App| {
            bind_text_input_keys(cx);
            cx.bind_keys([
                KeyBinding::new("cmd-q", QuitApp, None),
                KeyBinding::new("cmd-w", CloseWindow, None),
                KeyBinding::new("cmd-n", NewBottle, None),
                KeyBinding::new("cmd-,", OpenSettings, None),
                KeyBinding::new("cmd-r", RefreshView, None),
                KeyBinding::new("cmd-1", NavLibrary, None),
                KeyBinding::new("cmd-2", NavStatistics, None),
                KeyBinding::new("cmd-3", NavActivity, None),
                KeyBinding::new("escape", DismissOverlay, None),
            ]);

            cx.set_menus(vec![
                Menu {
                    name: "Gmac".into(),
                    items: vec![
                        MenuItem::action("Settings…", OpenSettings),
                        MenuItem::separator(),
                        MenuItem::os_submenu("Services", SystemMenuType::Services),
                        MenuItem::separator(),
                        MenuItem::action("Quit Gmac", QuitApp),
                    ],
                },
                Menu {
                    name: "File".into(),
                    items: vec![
                        MenuItem::action("New Windows PC…", NewBottle),
                        MenuItem::separator(),
                        MenuItem::action("Close Window", CloseWindow),
                    ],
                },
                Menu {
                    name: "Edit".into(),
                    items: vec![
                        MenuItem::action("Cut", Cut),
                        MenuItem::action("Copy", Copy),
                        MenuItem::action("Paste", Paste),
                        MenuItem::separator(),
                        MenuItem::action("Select All", SelectAll),
                    ],
                },
                Menu {
                    name: "View".into(),
                    items: vec![
                        MenuItem::action("Library", NavLibrary),
                        MenuItem::action("Statistics", NavStatistics),
                        MenuItem::action("Activity", NavActivity),
                        MenuItem::separator(),
                        MenuItem::action("Refresh", RefreshView),
                    ],
                },
            ]);

            let bridge_on_close = Arc::clone(&bridge_cleanup);
            cx.on_window_closed(move |cx| {
                if cx.windows().is_empty() {
                    bridge_on_close.shutdown();
                    cx.quit();
                }
            })
            .detach();

            let bounds = Bounds::centered(None, size(px(1180.0), px(760.0)), cx);
            let bridge_window = Arc::clone(&bridge);

            let _ = cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    titlebar: Some(TitlebarOptions {
                        title: None,
                        appears_transparent: true,
                        traffic_light_position: Some(point(px(14.0), px(14.0))),
                    }),
                    window_min_size: Some(size(px(920.0), px(600.0))),
                    focus: true,
                    show: true,
                    ..Default::default()
                },
                move |window, cx| {
                    let entity = cx.new(|cx| GmacApp::new(Arc::clone(&bridge_window), window, cx));
                    window.focus(&entity.read(cx).focus_handle);
                    let entity_for_close = entity.downgrade();
                    window.on_window_should_close(cx, move |_window, cx| {
                        let _ = entity_for_close.update(cx, |app, cx| {
                            app.request_quit(cx);
                        });
                        false
                    });
                    entity
                },
            );

            cx.activate(true);
        });
}
