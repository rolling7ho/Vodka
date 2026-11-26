# Security

## Reporting a vulnerability

Do not open a public issue. Report the vulnerability privately through
[GitHub's vulnerability reporting](https://github.com/rolling7ho/Vodka/security/advisories/new)
(the repository's **Security** tab, then **Report a vulnerability**), and include:

- the problem and what an attacker could achieve with it;
- steps to reproduce it, together with the Vodka and macOS versions used;
- a proposed fix, if one is available.

A reply will follow within a few days. Vodka is a small volunteer project, so the time to
a fix depends on available capacity, although a serious issue takes precedence over other
work. State how you wish to be named if you would like credit in the advisory.

## Scope

Only the most recent version of Vodka receives fixes. In scope:

- the Vodka application, VodkaKit, the VodkaCmd tool and the Quick Look extension;
- how Vodka downloads, verifies and installs its engine and Apple's Game Porting Toolkit;
- the build and install scripts in this repository.

Out of scope; report these upstream:

- bugs in Wine itself ([WineHQ](https://bugs.winehq.org)), DXVK, DXMT, MoltenVK or
  D3DMetal;
- Windows programs run inside Vodka. Wine is not a sandbox: a Windows program can read and
  write anything the Mac account can, so run only trusted software.

Vodka does not author the Wine engine. It downloads a build and installs it. When a serious
vulnerability is fixed upstream, the response is to rebuild the engine on the fixed version
and release it.

## Data

Vodka collects no usage data and contains no analytics. It accesses the network only to
download its engine and Steam's installer, and to check for updates.
