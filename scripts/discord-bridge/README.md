# Discord bridge

`GmacDiscordBridge.exe` relays the Discord RPC named pipe from inside a Wine bottle to the Discord client on the macOS host so a Windows game's rich presence reaches Discord.

`make install` builds `GmacDiscordBridge.exe` from `bridge.c` and copies it into `GmacKit/Sources/GmacKit/Discord/Resources/`, from which it ships as a SwiftPM bundle resource. The built binary is committed because Xcode builds do not invoke `make` and CI lacks a MinGW toolchain. Rebuild and commit the binary whenever `bridge.c` changes.

```sh
brew install mingw-w64   # provides x86_64-w64-mingw32-gcc
make install
```

## Design

Both ends of the Discord RPC transport use the same framing, a little-endian opcode and length followed by JSON, so the relay forwards bytes without parsing messages. It serves `\\.\pipe\discord-ipc-0` (four concurrent pending pipe instances) inside the bottle and relays bytes to whichever of `discord-ipc-0` through `discord-ipc-9` exists in the socket directory it receives. A per-prefix named mutex (`Local\GmacDiscordBridge`) ensures only one relay runs per bottle.

Four design constraints govern changes to `bridge.c`:

- **Raw xnu system calls:** PE code shares an address space with the Unix side of Wine, so a `syscall` instruction enters the kernel directly. A PE module cannot link `libSystem`, and a PE plus unixlib split would tie the binary to a specific Wine build rather than plain MinGW. `bsd_sockaddr_un` follows xnu's layout (a 1-byte length followed by a 1-byte address family), not Linux's 16-bit family field.
- **`EINTR` retry on BSD I/O:** Wine signal delivery can interrupt raw `SYS_READ` and `SYS_WRITE` syscalls, so `unix_read` and `unix_write` loop on `-BSD_EINTR` rather than dropping active connections.
- **Explicit socket directory via `--dir`:** a PE process runs under Wine's Windows environment, where the host's `TMPDIR` may not survive. Gmac passes the host socket directory via `--dir` (falling back to `TMPDIR`, `XDG_RUNTIME_DIR`, or `/tmp`).
- **Wine system process transition after `--grace`:** system processes (`ProcessWineMakeProcessSystem`) do not keep a Wine prefix alive, so the relay shuts down with the bottle once the game exits. The `--grace` window (in milliseconds, default `10000`) keeps the relay from shutting down a cold bottle between starting the relay and starting the game.

## Manual test

Serve a Unix socket at a path short enough to fit `sun_path`, point the relay at its directory, and connect from inside the bottle:

```sh
mkdir -p /tmp/gmacipc
python3 - /tmp/gmacipc/discord-ipc-0 <<'EOF'
import socket, struct, sys
server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(sys.argv[1])
server.listen(1)
conn, _ = server.accept()
header = conn.recv(8)
print(struct.unpack("<II", header), conn.recv(4096))
EOF

WINEPREFIX=/path/to/bottle wine64 GmacDiscordBridge.exe --dir /tmp/gmacipc --grace 600000
```

Passing a large `--grace` value prevents the relay from transitioning into a system process and exiting while testing manually.
