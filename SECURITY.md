# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through
[GitHub's vulnerability reporting](https://github.com/rolling7ho/Vodka/security/advisories/new)
(the repository's **Security** tab, then **Report a vulnerability**), and include:

- what the problem is and what an attacker could do with it
- steps to reproduce it, and the Vodka and macOS versions you used
- a fix, if you have one in mind

You'll get a reply within a few days. Vodka is a small volunteer project, so fixes take as long as
they take, but a serious issue goes ahead of everything else. If you'd like credit in the advisory,
say how you want to be named.

## What's covered

Only the latest version of Vodka gets fixes. In scope:

- the Vodka app, VodkaKit, the VodkaCmd tool and the Quick Look extension
- how Vodka downloads, checks and installs its engine and Apple's Game Porting Toolkit
- the build and install scripts in this repository

Out of scope (please report these upstream):

- bugs in Wine itself ([WineHQ](https://bugs.winehq.org)), DXVK, DXMT, MoltenVK or D3DMetal
- Windows programs you run inside Vodka. Wine isn't a sandbox: a Windows program can read and write
  anything your Mac account can, so only run software you trust.

Vodka bundles the Wine engine rather than writing it. When a serious vulnerability is fixed upstream,
the response is to rebuild the engine on the fixed version and release it.

## Data

Vodka collects no usage data and has no analytics. It goes online only to download its engine and
Steam's installer and to check for updates.
