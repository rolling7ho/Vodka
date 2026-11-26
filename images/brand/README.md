# Gmac Brand Assets

This directory contains the canonical vector marks, system-adaptive application icons, and pure-vector wordmarks for Gmac. Every SVG in this directory uses geometric path primitives without `<text>` elements so assets render identically across browsers, macOS, and documentation without font dependencies.

## Asset inventory

| File | Purpose | Appearance behavior |
|---|---|---|
| `gmac-icon.svg` | Canonical 1024 px squircle application icon | Adaptive via `prefers-color-scheme` |
| `gmac-icon-light.svg` | Light squircle application icon (`#FFFFFF` tile, `#713131` mark) | Fixed light |
| `gmac-icon-dark.svg` | Dark squircle application icon (`#281D1D` to `#191212` tile, `#F5ECEC` arcs, `#D98282` play) | Fixed dark |
| `gmac-mark.svg` | Bare concentric `G` and play mark | Adaptive via `prefers-color-scheme` |
| `gmac-mark-accent.svg` | Bare mark in primary burgundy (`#713131`) | Fixed accent |
| `gmac-mark-mono.svg` | Bare mark in dark ink (`#141414`) | Fixed monochrome |
| `gmac-wordmark.svg` | Integrated pure-vector wordmark (`G` mark and geometric `mac`) | Adaptive two-tone via `prefers-color-scheme` |
| `gmac-wordmark-light.svg` | Integrated pure-vector wordmark for light surfaces (`#713131` and `#161212`) | Fixed light |
| `gmac-wordmark-dark.svg` | Integrated pure-vector wordmark for dark surfaces (`#E09898`, `#D98282`, and `#F5ECEC`) | Fixed dark |
| `gmac-wordmark-mono.svg` | Integrated pure-vector wordmark in single ink | Adaptive monochrome via `prefers-color-scheme` |
| `gmac-lockup-horizontal.svg` | Horizontal lockup for navigation bars and headers | Adaptive two-tone via `prefers-color-scheme` |
| `gmac-lockup-stacked.svg` | Vertical lockup pairing the squircle icon over the wordmark | Adaptive via `prefers-color-scheme` |

## Color tokens

| Token | Light value | Dark value | Usage |
|---|---|---|---|
| Accent | `#713131` | `#D98282` | Play glyph, primary accent, dark-mode links |
| Mark arc | `#713131` | `#F5ECEC` (icon), `#E09898` (wordmark) | Concentric `G` outer and inner arcs |
| Wordmark ink | `#161212` | `#F5ECEC` | `mac` geometric stroke letterforms |
| Tile surface | `#FFFFFF` | `#281D1D` to `#191212` | Squircle application icon background |
| Blueprint grid | `#713131` at 6.5% | `#E09898` at 9% | Radially faded background texture |

## Regenerating raster assets

Run [`scripts/draw-icon.swift`](../../scripts/draw-icon.swift) from the repository root to regenerate all PNG icons under `images/`, `Gmac/Assets.xcassets/`, `GmacThumbnail/Icons.xcassets/`, and `dist/pages/`:

```sh
swiftc -O scripts/draw-icon.swift -o /tmp/draw-icon && /tmp/draw-icon --all .
```

To regenerate the OpenGraph social preview card (`images/og-card.png`, 1200 by 630 pixels) from `dist/pages/_og-card-source.html`, run:

```sh
scripts/build-og-card.sh
```
