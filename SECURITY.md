# Security

This policy explains how to report security vulnerabilities in Gmac, which components are in scope, and what network activity the application performs.

## Reporting a vulnerability

Do not open a public issue. Report the vulnerability privately through [GitHub's vulnerability reporting](https://github.com/rolling7ho/gmac/security/advisories/new) (the repository's **Security** tab, then **Report a vulnerability**), and include:

- the problem and what an attacker could achieve with it;
- steps to reproduce it, together with the Gmac and macOS versions used;
- a proposed fix, if one is available.

A reply will follow within a few days. Gmac is a small volunteer project, so the time to a fix depends on available capacity, although a serious issue takes precedence over other work. State how you wish to be named if you would like credit in the advisory.

## Scope

Only the most recent version of Gmac receives fixes. In scope:

- the Gmac application, `GmacKit`, `GmacCmd`, and `GmacThumbnail`;
- how Gmac downloads, verifies, and installs its Wine runtime (`Libraries.tar.gz`) and Apple's Game Porting Toolkit (`GPTKImporter`);
- `gmac://` URL parsing and launch handling (`GmacURL`);
- the bundled Discord RPC relay (`GmacDiscordBridge.exe` and `scripts/discord-bridge/`);
- Gmac's patches and build configuration in `rolling7ho/winecx` and `rolling7ho/dxmt` (`gmacmetal`);
- the build, release, and installation scripts in this repository.

Out of scope; report these upstream:

- bugs in upstream Wine ([WineHQ](https://bugs.winehq.org)), DXVK, DXMT, MoltenVK, or Apple D3DMetal;
- Windows programs run inside Gmac. Wine is not a sandbox: a Windows program can read and write anything the macOS user account can access, so run only trusted software.

Gmac builds and publishes its patched Wine/CrossOver runtime (`rolling7ho/winecx`) and optional `gmacmetal` bridge (`rolling7ho/dxmt`) while consuming upstream Wine, CrossOver, DXVK, DXMT, MoltenVK, and user-supplied Apple D3DMetal. When a serious vulnerability is fixed upstream, the response is to rebuild the runtime on the fixed version and publish a new release.

## Data

Gmac collects no usage data and contains no analytics. It accesses the network only to check runtime version metadata (`DistributionConfig.versionPlistURL`), download the Wine runtime archive from GitHub Releases, download the official Steam installer from Valve when requested by the user, and check the Sparkle update feed (`SUFeedURL`).
