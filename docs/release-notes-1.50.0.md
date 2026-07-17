# Driftile 1.50.0

Driftile 1.50.0 is in development. Its current slice adds an opt-in initial
width policy for new singleton tiled columns.

## Highlights

- Keep the public `33%` column default unchanged. `useInitialWindowWidth`
  defaults to `false`.
- When enabled, capture a new singleton tiled column member's live frame width
  as a fixed logical width. An exact application-width rule remains higher
  priority.
- Apply the existing decorated minimum and maximum constraints and snap the
  result to the assigned output's physical-pixel grid.
- Affect future singleton admissions only. Existing columns, reset behavior,
  persistence schemas, actions, and bindings remain unchanged.
- Configure the policy through KConfig or the typed Home Manager option.
  NixOS-installed packages expose the same per-user KConfig control.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 retain the existing compatibility baseline.
