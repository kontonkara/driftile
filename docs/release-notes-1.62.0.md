# Driftile 1.62.0

Driftile 1.62.0 identifies outputs in the optional Overview and makes output
names available to window search.

## Highlights

- Show one bounded output name on eligible multi-output Overview scenes.
- Keep single-output and small scenes unchanged and hide the label during
  search without removing output-name matching.
- Normalize and read the public output name once per scene only when needed.
- Enable or disable labels live through default-enabled KConfig or a nullable
  Home Manager preference.
- Keep the NixOS option surface unchanged; system installations use the same
  per-user effect setting.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The release reads only public
output state and adds no input, focus, window or layout write, timer, animation,
persistence field, private API, or KWin fork. Logical persistence remains v4.
