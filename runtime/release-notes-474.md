# Runtime 4.7.3 experimental notes

This note records the source commit, additions, and archive digest for an experimental Windows runtime build derived from the upstream 4.7.3 lane for Gmac.

The runtime is built from upstream [runtime 4.7.3](https://github.com/dappermint/winecx-gptk/releases/tag/runtime-v4.7.3) (CrossOver 26.3 changes on Wine 11.17, GPTK-capable for DirectX 12 via Apple D3DMetal, with DXMT 0.80, DXVK 1.10.3, and MoltenVK 1.4.2) with two additions:

- **32-bit DXVK fix** from upstream ([dappermint/winecx-gptk#7](https://github.com/dappermint/winecx-gptk/pull/7)): the 32-bit `dxgi.dll` is included so 32-bit DirectX 10 and 11 games can create a device.
- **Retina fix** (carried from 4.6.5): in Retina mode, cross-process GPU windows such as Steam web views render at point size so Steam remains sharp while games run at native resolution.

**Source:** Wine from [rolling7ho/winecx@b21cca2](https://github.com/rolling7ho/winecx/commit/b21cca2b987bd6da25c75b4ff1f11c523c0dc4cd) (branch `retina-fix-1117`), which adds the Retina commit onto upstream [dappermint/winecx@e0aa380](https://github.com/rolling7ho/winecx/commit/e0aa380780b73e20fabcfe78fd42713b94929a53). Build recipe: [dappermint/winecx-gptk@a416631](https://github.com/dappermint/winecx-gptk/tree/a416631c2dee55835b11aa478e79fef639c4243e), run locally with `MACOSX_DEPLOYMENT_TARGET=15.0`.

**Verification gates passed:** relocatable tree, window creation, Media Foundation decoders, and 694 of 694 bundled libraries loaded.

**SHA-256 (`Libraries.tar.gz`):** `5cb7aedeb3abf39353d2217642f604cc12cc2416ad547cdf27b2a0942c636600`
