use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub wine_installed: bool,
    pub wine_version: Option<String>,
    pub dxmt_version: Option<String>,
    pub dxvk_version: Option<String>,
    pub d3d_metal_installed: bool,
    pub gptk_version: Option<String>,
    #[serde(rename = "gmacD3D12Available")]
    pub gmac_d3d12_available: bool,
    pub rosetta_installed: bool,
    pub default_bottle_dir: String,
    pub logs_dir: String,
    pub logs_bytes: i64,
    pub gptk_store_present: bool,
    pub migration_state: String,
    pub migration_reason: Option<String>,
    pub runtime_tag: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DllOverrideDto {
    pub dll_name: String,
    pub mode: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BottleSettingsDto {
    pub name: String,
    pub windows_version: String,
    pub enhanced_sync: String,
    pub avx_enabled: bool,
    pub graphics_backend: String,
    #[serde(rename = "metalFX")]
    pub metal_fx: bool,
    pub frame_generation: bool,
    pub metal_hud: bool,
    pub metal_trace: bool,
    pub metal_validation: bool,
    pub dxr_enabled: bool,
    pub sequoia_compat_mode: bool,
    pub metal4_enabled: bool,
    pub dxvk_async: bool,
    pub dxvk_hud: String,
    pub native_resolution: bool,
    pub virtual_desktop_enabled: bool,
    pub resolution_preset: String,
    pub custom_resolution_width: i32,
    pub custom_resolution_height: i32,
    pub faster_steam_apps: Vec<i64>,
    pub shader_cache_enabled: bool,
    pub disable_app_nap: bool,
    pub audio_driver: String,
    pub audio_latency_preset: String,
    pub output_device_mode: String,
    pub pinned_device_name: Option<String>,
    pub controller_compatibility_mode: bool,
    #[serde(rename = "disableHIDAPI")]
    pub disable_hidapi: bool,
    pub allow_background_events: bool,
    pub disable_controller_mapping: bool,
    pub use_button_labels: bool,
    pub command_acts_as_control: bool,
    pub launcher_compatibility_mode: bool,
    pub launcher_mode: String,
    pub detected_launcher: Option<String>,
    pub launcher_locale: String,
    pub gpu_spoofing: bool,
    pub gpu_vendor: String,
    pub network_timeout: i32,
    #[serde(rename = "autoEnableDXVK")]
    pub auto_enable_dxvk: bool,
    pub discord_presence: bool,
    pub discord_bridge: bool,
    pub clipboard_policy: String,
    pub kill_on_quit: String,
    pub close_with_processes_policy: String,
    #[serde(rename = "customDLLOverrides")]
    pub custom_dll_overrides: Vec<DllOverrideDto>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BottleDto {
    pub url: String,
    pub name: String,
    pub is_available: bool,
    pub in_flight: bool,
    pub steam_installed: bool,
    pub steam_running: bool,
    pub running_process_count: i32,
    pub pinned_count: i32,
    pub game_count: i32,
    pub resolved_backend: String,
    pub settings: BottleSettingsDto,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamPanelDto {
    pub bottle_url: String,
    pub bottle_name: Option<String>,
    pub icon_path: Option<String>,
    pub is_running: bool,
    pub game_count: i32,
    pub size_on_disk: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryItemDto {
    pub id: String,
    pub name: String,
    pub bottle_url: String,
    pub bottle_name: Option<String>,
    pub source: String,
    pub launch_kind: String,
    pub app_id: Option<i64>,
    pub program_path: Option<String>,
    pub is_launcher: bool,
    pub artwork_path: Option<String>,
    pub icon_path: Option<String>,
    pub last_played_epoch: Option<f64>,
    pub size_on_disk: Option<i64>,
    pub install_path: Option<String>,
    pub state: String,
    pub faster_mode: bool,
    pub compatibility_warning: Option<String>,
    pub compatibility_detail: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPayloadDto {
    pub steam_panels: Vec<SteamPanelDto>,
    pub games: Vec<LibraryItemDto>,
    pub other_apps: Vec<LibraryItemDto>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgramOverridesDto {
    pub graphics_backend: Option<String>,
    pub dxvk_async: Option<bool>,
    pub dxvk_hud: Option<String>,
    pub enhanced_sync: Option<String>,
    pub metal4_enabled: Option<bool>,
    pub shader_cache_enabled: Option<bool>,
    pub virtual_desktop_enabled: Option<bool>,
    pub controller_compatibility_mode: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramDto {
    pub name: String,
    pub url: String,
    pub pinned: bool,
    pub icon_path: Option<String>,
    pub arguments: String,
    pub locale: String,
    pub environment: HashMap<String, String>,
    pub overrides: ProgramOverridesDto,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDto {
    pub pid: i32,
    pub name: String,
    pub memory_usage: String,
    pub kind: String,
    pub bottle_url: String,
    pub bottle_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameStatDto {
    pub id: String,
    pub name: String,
    pub bottle_name: Option<String>,
    pub artwork_path: Option<String>,
    pub icon_path: Option<String>,
    pub total_sec: f64,
    pub last_two_weeks_sec: f64,
    pub last_played_epoch: Option<f64>,
    pub sessions: Option<i32>,
    pub longest_session_sec: Option<f64>,
    pub size_on_disk: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsPayloadDto {
    pub total_playtime_sec: f64,
    pub last_two_weeks_sec: f64,
    pub storage_bytes: i64,
    pub most_played_name: Option<String>,
    pub most_played_sec: Option<f64>,
    pub last_played_name: Option<String>,
    pub longest_session_name: Option<String>,
    pub longest_session_sec: Option<f64>,
    pub played_count: i32,
    pub total_games_count: i32,
    pub games: Vec<GameStatDto>,
    pub unplayed_names: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDbItemDto {
    pub id: String,
    pub name: String,
    pub subtitle: Option<String>,
    pub steam_app_id: Option<i64>,
    pub rating: String,
    pub notes: Vec<String>,
    pub anti_cheat: Option<String>,
    pub default_variant_id: Option<String>,
    pub default_variant_label: Option<String>,
    pub matched_bottle_url: Option<String>,
    pub installed: bool,
    pub applied_here: bool,
    pub applied_snapshot_timestamp: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFileDto {
    pub name: String,
    pub path: String,
    pub modified_epoch: f64,
    pub size_bytes: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemediationDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub what_will_change: String,
    pub undo_path: String,
    pub risk: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashDiagnosisDto {
    pub headline: Option<String>,
    pub primary_category: Option<String>,
    pub primary_confidence: Option<String>,
    pub match_count: i32,
    pub remediations: Vec<RemediationDto>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPrefsDto {
    pub open_steam_at_launch: bool,
    pub game_mode_enabled: bool,
    pub fit_games_below_notch: bool,
    pub skip_quit_confirmation: bool,
    pub default_win_version: String,
    pub default_bottle_location: String,
    pub log_retention_days: i32,
    pub check_gmac_wine_updates: bool,
    pub preferred_terminal: String,
    pub theme_mode: String,
}

impl Default for AppPrefsDto {
    fn default() -> Self {
        Self {
            open_steam_at_launch: false,
            game_mode_enabled: true,
            fit_games_below_notch: false,
            skip_quit_confirmation: false,
            default_win_version: "win10".to_string(),
            default_bottle_location: String::new(),
            log_retention_days: 7,
            check_gmac_wine_updates: true,
            preferred_terminal: "terminal".to_string(),
            theme_mode: "system".to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamSetupStatusDto {
    pub wine_installed: bool,
    pub bottle_url: Option<String>,
    pub bottle_name: Option<String>,
    pub bottle_in_flight: bool,
    pub graphics_backend: Option<String>,
    pub graphics_chosen: bool,
    pub d3d_metal_installed: bool,
    pub steam_installed: bool,
    pub installed_game_count: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatusDto {
    pub default_device_name: Option<String>,
    pub transport_type: Option<String>,
    pub sample_rate_hz: Option<f64>,
    pub output_channels: Option<i32>,
    pub status: String,
    pub summary: String,
    pub findings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeUpdateCheckDto {
    pub update_available: bool,
    pub current_version: Option<String>,
    pub latest_version: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanedBottleDto {
    pub url: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LibrarySort {
    Recent,
    Name,
    Bottle,
}

pub fn format_bytes(bytes: i64) -> String {
    if bytes <= 0 {
        return "0 B".to_string();
    }
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut val = bytes as f64;
    let mut idx = 0;
    while val >= 1000.0 && idx < UNITS.len() - 1 {
        val /= 1000.0;
        idx += 1;
    }
    if idx == 0 {
        format!("{bytes} B")
    } else if val >= 100.0 {
        format!("{val:.0} {}", UNITS[idx])
    } else if val >= 10.0 {
        format!("{val:.1} {}", UNITS[idx])
    } else {
        format!("{val:.2} {}", UNITS[idx])
    }
}

pub fn format_duration(seconds: f64) -> String {
    if seconds <= 0.0 {
        return "—".to_string();
    }
    if seconds < 60.0 {
        return "< 1 min".to_string();
    }
    let minutes = (seconds / 60.0) as i64;
    let hours = minutes / 60;
    let rem_min = minutes % 60;
    if hours == 0 {
        format!("{minutes} min")
    } else if rem_min == 0 || hours >= 100 {
        format!("{hours} h")
    } else {
        format!("{hours} h {rem_min} min")
    }
}

pub fn format_relative_epoch(epoch: f64) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(epoch);
    let delta = (now - epoch).max(0.0) as i64;
    if delta < 90 {
        "just now".to_string()
    } else if delta < 3600 {
        let mins = delta / 60;
        if mins == 1 {
            "1 minute ago".to_string()
        } else {
            format!("{mins} minutes ago")
        }
    } else if delta < 86_400 {
        let hrs = delta / 3600;
        if hrs == 1 {
            "1 hour ago".to_string()
        } else {
            format!("{hrs} hours ago")
        }
    } else {
        let days = delta / 86_400;
        if days == 1 {
            "yesterday".to_string()
        } else if days < 30 {
            format!("{days} days ago")
        } else {
            let months = days / 30;
            if months == 1 {
                "1 month ago".to_string()
            } else {
                format!("{months} months ago")
            }
        }
    }
}

pub fn pretty_win_version(raw: &str) -> &'static str {
    match raw {
        "winxp64" => "Windows XP",
        "win7" => "Windows 7",
        "win8" => "Windows 8",
        "win81" => "Windows 8.1",
        "win10" => "Windows 10",
        "win11" => "Windows 11",
        _ => "Windows 10",
    }
}

pub fn pretty_backend(raw: &str) -> &'static str {
    match raw {
        "recommended" => "Automatic",
        "d3dMetal" => "D3DMetal",
        "dxvk" => "DXVK",
        "dxmt" => "DXMT",
        "dxmtD3D12" => "Gmac DirectX 12 (DXMT)",
        "wined3d" => "WineD3D",
        _ => "Automatic",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_bytes_cleanly() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(7_720_000_000), "7.72 GB");
        assert_eq!(format_bytes(330_000_000), "330 MB");
    }

    #[test]
    fn formats_durations_cleanly() {
        assert_eq!(format_duration(0.0), "—");
        assert_eq!(format_duration(30.0), "< 1 min");
        assert_eq!(format_duration(2700.0), "45 min");
        assert_eq!(format_duration(3600.0), "1 h");
        assert_eq!(format_duration(53_220.0), "14 h 47 min");
        assert_eq!(format_duration(368_880.0), "102 h");
    }

    #[test]
    fn deserializes_bridge_camel_case_and_acronyms() {
        let runtime_json = r#"{
            "wineInstalled": false,
            "wineVersion": null,
            "dxmtVersion": null,
            "dxvkVersion": null,
            "d3dMetalInstalled": false,
            "gptkVersion": null,
            "gmacD3D12Available": true,
            "rosettaInstalled": true,
            "defaultBottleDir": "/Users/test/Library/Containers/Gmac/Bottles",
            "logsDir": "/Users/test/Library/Logs/Gmac",
            "logsBytes": 0,
            "gptkStorePresent": false,
            "migrationState": "notNeeded",
            "migrationReason": null,
            "runtimeTag": "4.6.12-gaming.1"
        }"#;
        let rt: RuntimeStatus = serde_json::from_str(runtime_json).unwrap();
        assert!(rt.gmac_d3d12_available);
        assert!(rt.rosetta_installed);

        let settings_json = r#"{
            "name": "Gaming",
            "windowsVersion": "win10",
            "enhancedSync": "msync",
            "avxEnabled": false,
            "graphicsBackend": "recommended",
            "metalFX": true,
            "frameGeneration": false,
            "metalHud": false,
            "metalTrace": false,
            "metalValidation": false,
            "dxrEnabled": false,
            "sequoiaCompatMode": false,
            "metal4Enabled": true,
            "dxvkAsync": true,
            "dxvkHud": "off",
            "nativeResolution": true,
            "virtualDesktopEnabled": false,
            "resolutionPreset": "native",
            "customResolutionWidth": 1920,
            "customResolutionHeight": 1080,
            "fasterSteamApps": [730],
            "shaderCacheEnabled": true,
            "disableAppNap": true,
            "audioDriver": "coreaudio",
            "audioLatencyPreset": "balanced",
            "outputDeviceMode": "systemDefault",
            "pinnedDeviceName": null,
            "controllerCompatibilityMode": true,
            "disableHIDAPI": false,
            "allowBackgroundEvents": true,
            "disableControllerMapping": false,
            "useButtonLabels": true,
            "commandActsAsControl": false,
            "launcherCompatibilityMode": true,
            "launcherMode": "automatic",
            "detectedLauncher": null,
            "launcherLocale": "auto",
            "gpuSpoofing": false,
            "gpuVendor": "automatic",
            "networkTimeout": 30,
            "autoEnableDXVK": true,
            "discordPresence": false,
            "discordBridge": false,
            "clipboardPolicy": "bidirectional",
            "killOnQuit": "ask",
            "closeWithProcessesPolicy": "ask",
            "customDLLOverrides": [{"dllName": "d3dcompiler_47", "mode": "native,builtin"}]
        }"#;
        let bs: BottleSettingsDto = serde_json::from_str(settings_json).unwrap();
        assert!(bs.metal_fx);
        assert!(!bs.disable_hidapi);
        assert!(bs.auto_enable_dxvk);
        assert_eq!(bs.custom_dll_overrides.len(), 1);
    }
}
