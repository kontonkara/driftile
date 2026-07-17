# Driftile 1.52.0

Driftile 1.52.0 adds configurable tiled or floating admission for genuinely
new normal windows.

## Highlights

- Keep `tiled` as the behavior-preserving global default, or select `floating`
  for future normal windows.
- Set exact, case-sensitive application rules to `tiled` or `floating`.
- Resolve an exact rule before the existing applications-initially-floating
  list and the global default.
- Keep dialogs, transients, fixed-size windows, and application tiling
  exclusions under their existing automatic ownership.
- Snapshot the policy when a new window is first tracked. Live settings changes
  do not move or reclassify existing windows.
- Configure both values through the KConfig page or typed Home Manager options.
  NixOS installations use the same per-user KConfig values.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 retain the existing compatibility baseline. Logical
layout persistence remains v4, with no new action or default binding.
