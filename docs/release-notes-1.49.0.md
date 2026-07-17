# Driftile 1.49.0

Driftile 1.49.0 is in development. It improves close-focus recovery and
optional transition continuity around workspace handoffs.

## Highlights

- Recover the most recently focused eligible window after closing an active
  tiled, manually floating, automatically floating, or application-excluded
  window. Existing same-context and visibility guards still apply.
- Focus that recovery target while an unrelated geometry transaction settles,
  without taking geometry ownership or writing a window frame.
- Preserve the first immediate focus transition after a workspace effect
  releases control, until an explicit activation or visibility opportunity can
  present it.

This batch changes no setting, action, schema, binding, or private API.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 retain the existing compatibility baseline.
