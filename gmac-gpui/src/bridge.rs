use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use anyhow::{Context, Result, anyhow};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

#[derive(Debug, Clone)]
pub enum BridgeEvent {
    RuntimeProgress {
        phase: String,
        progress: f64,
        detail: String,
    },
    StateChanged {
        #[allow(dead_code)]
        reason: String,
    },
    Toast {
        style: String,
        message: String,
    },
    CrashDetected {
        program_name: String,
        headline: String,
        log_path: String,
    },
}

#[derive(Serialize)]
struct RpcRequest<'a, P: Serialize> {
    id: u64,
    method: &'a str,
    params: P,
}

type PendingMap = HashMap<u64, mpsc::Sender<Result<Value>>>;

pub struct BridgeClient {
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<PendingMap>>,
    next_id: AtomicU64,
    events_rx: Mutex<mpsc::Receiver<BridgeEvent>>,
    child: Mutex<Option<Child>>,
}

impl BridgeClient {
    pub fn spawn() -> Result<Arc<Self>> {
        let bridge_path = locate_bridge_binary()?;
        let mut child = Command::new(&bridge_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .with_context(|| format!("Failed to spawn gmac-bridge at {}", bridge_path.display()))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Missing stdin pipe for gmac-bridge"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Missing stdout pipe for gmac-bridge"))?;

        let pending: Arc<Mutex<PendingMap>> = Arc::new(Mutex::new(HashMap::new()));
        let (events_tx, events_rx) = mpsc::channel::<BridgeEvent>();

        let pending_reader = Arc::clone(&pending);
        std::thread::Builder::new()
            .name("gmac-bridge-stdout".to_string())
            .spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    let Ok(line) = line else { break };
                    if line.trim().is_empty() {
                        continue;
                    }
                    let Ok(val) = serde_json::from_str::<Value>(&line) else {
                        continue;
                    };

                    if let Some(event_name) = val.get("event").and_then(|v| v.as_str()) {
                        if let Some(ev) = parse_event(event_name, val.get("payload")) {
                            let _ = events_tx.send(ev);
                        }
                        continue;
                    }

                    if let Some(id) = val.get("id").and_then(|v| v.as_u64()) {
                        let tx = pending_reader
                            .lock()
                            .ok()
                            .and_then(|mut map| map.remove(&id));
                        if let Some(tx) = tx {
                            let ok = val.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
                            if ok {
                                let res = val.get("result").cloned().unwrap_or(Value::Null);
                                let _ = tx.send(Ok(res));
                            } else {
                                let err = val
                                    .get("error")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Bridge call failed");
                                let _ = tx.send(Err(anyhow!("{err}")));
                            }
                        }
                    }
                }

                if let Ok(mut map) = pending_reader.lock() {
                    for (_, tx) in map.drain() {
                        let _ = tx.send(Err(anyhow!("gmac-bridge disconnected")));
                    }
                }
            })?;

        Ok(Arc::new(Self {
            stdin: Arc::new(Mutex::new(stdin)),
            pending,
            next_id: AtomicU64::new(1),
            events_rx: Mutex::new(events_rx),
            child: Mutex::new(Some(child)),
        }))
    }

    pub fn call<P: Serialize, R: DeserializeOwned>(&self, method: &str, params: P) -> Result<R> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::channel();
        {
            let mut map = self
                .pending
                .lock()
                .map_err(|_| anyhow!("Bridge pending map poisoned"))?;
            map.insert(id, tx);
        }

        let payload = serde_json::to_string(&RpcRequest { id, method, params })?;
        {
            let mut stdin = self
                .stdin
                .lock()
                .map_err(|_| anyhow!("Bridge stdin lock poisoned"))?;
            if let Err(err) = writeln!(stdin, "{payload}").and_then(|_| stdin.flush()) {
                if let Ok(mut map) = self.pending.lock() {
                    map.remove(&id);
                }
                return Err(err.into());
            }
        }

        let val = rx
            .recv()
            .map_err(|_| anyhow!("Bridge response channel closed for {method}"))??;
        let decoded = serde_json::from_value::<R>(val)
            .with_context(|| format!("Failed to decode bridge response for {method}"))?;
        Ok(decoded)
    }

    pub fn drain_events(&self) -> Vec<BridgeEvent> {
        let mut out = Vec::new();
        if let Ok(rx) = self.events_rx.lock() {
            while let Ok(ev) = rx.try_recv() {
                out.push(ev);
            }
        }
        out
    }

    pub fn shutdown(&self) {
        if let Ok(mut guard) = self.child.lock()
            && let Some(mut child) = guard.take()
        {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for BridgeClient {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn parse_event(name: &str, payload: Option<&Value>) -> Option<BridgeEvent> {
    let payload = payload?;
    match name {
        "runtime_progress" => Some(BridgeEvent::RuntimeProgress {
            phase: payload.get("phase")?.as_str()?.to_string(),
            progress: payload.get("progress")?.as_f64()?,
            detail: payload.get("detail")?.as_str()?.to_string(),
        }),
        "state_changed" => Some(BridgeEvent::StateChanged {
            reason: payload
                .get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("update")
                .to_string(),
        }),
        "toast" => Some(BridgeEvent::Toast {
            style: payload
                .get("style")
                .and_then(|v| v.as_str())
                .unwrap_or("info")
                .to_string(),
            message: payload.get("message")?.as_str()?.to_string(),
        }),
        "crash_detected" => Some(BridgeEvent::CrashDetected {
            program_name: payload
                .get("programName")
                .and_then(|v| v.as_str())
                .unwrap_or("Program")
                .to_string(),
            headline: payload
                .get("headline")
                .and_then(|v| v.as_str())
                .unwrap_or("Crash detected")
                .to_string(),
            log_path: payload
                .get("logPath")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        }),
        _ => None,
    }
}

fn locate_bridge_binary() -> Result<PathBuf> {
    if let Ok(env_path) = std::env::var("GMAC_BRIDGE_PATH") {
        let p = PathBuf::from(env_path);
        if p.is_file() {
            return Ok(p);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe()
        && let Some(dir) = exe.parent()
    {
        candidates.push(dir.join("../Helpers/gmac-bridge"));
        candidates.push(dir.join("gmac-bridge"));
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("GmacKit/.build/release/gmac-bridge"));
        candidates.push(cwd.join("GmacKit/.build/debug/gmac-bridge"));
        candidates.push(cwd.join("../GmacKit/.build/release/gmac-bridge"));
        candidates.push(cwd.join("../GmacKit/.build/debug/gmac-bridge"));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidates.push(manifest_dir.join("../GmacKit/.build/release/gmac-bridge"));
    candidates.push(manifest_dir.join("../GmacKit/.build/debug/gmac-bridge"));

    for path in &candidates {
        if path.is_file() {
            return Ok(path.canonicalize().unwrap_or_else(|_| path.clone()));
        }
    }

    Err(anyhow!(
        "Could not locate gmac-bridge helper binary. Checked: {}",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}
