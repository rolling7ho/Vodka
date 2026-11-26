# Discord bridge

Relays the Discord RPC named pipe from inside a bottle to the Discord client on the host, so
that a Windows game's rich presence reaches Discord on macOS.

`make install` builds `GmacDiscordBridge.exe` and places it in
`GmacKit/Sources/GmacKit/Discord/Resources/`, from which it ships as a bundle resource.
The built binary is committed, because Xcode builds do not run `make` and CI has no MinGW
toolchain. Rebuild and commit the binary whenever `bridge.c` changes.

```
brew install mingw-w64   # provides x86_64-w64-mingw32-gcc
make install
```

## Design

Both ends of the Discord RPC transport use the same framing, a little-endian opcode and
length followed by JSON, so the relay forwards bytes without parsing messages. It serves
`\\.\pipe\discord-ipc-0` inside the prefix and relays bytes to whichever of
`discord-ipc-0` to `discord-ipc-9` exists in the socket directory it is given.

Three constraints apply to any change:

- **The socket is reached through raw xnu system calls.** PE code shares an address space
  with the Unix side of Wine, so a `syscall` instruction enters the kernel directly. A PE
  module cannot link libSystem, and the supported alternative, a PE plus a unixlib half,
  would have to be built against a specific Wine build rather than plain MinGW. `sockaddr_un`
  here follows xnu's layout (a length byte followed by a family byte), not Linux's 16-bit
  family field.
- **The socket directory is passed with `--dir`.** A PE process sees Wine's Windows
  environment, in which the host's `TMPDIR` may not have survived, and the sockets are named
  relative to that directory.
- **The relay becomes a Wine system process after a grace period.** System processes do not
  keep a prefix alive, so the relay stops holding a bottle open once the game exits and
  terminates with the prefix rather than outliving it. The grace period exists because Gmac
  starts the relay immediately before the game, and a prefix containing no ordinary process
  begins shutting down.

## Manual test

Serve a socket at a path short enough to fit `sun_path`, point the relay at it, and connect
from inside the prefix:

```
mkdir -p /tmp/gmacipc
python3 - /tmp/gmacipc/discord-ipc-0 <<'EOF'
import socket, struct, sys
server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(sys.argv[1]); server.listen(1)
conn, _ = server.accept()
header = conn.recv(8)
print(struct.unpack("<II", header), conn.recv(4096))
EOF

WINEPREFIX=... wine64 GmacDiscordBridge.exe --dir /tmp/gmacipc --grace 600000
```

`--grace` is specified in milliseconds. A large value prevents the relay from standing down
while it is being tested.
