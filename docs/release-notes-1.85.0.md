# Driftile 1.85.0

Driftile 1.85.0 extends exact spatial window placement across outputs and adds
direct touch interaction to the optional Overview.

## Changes

- Preview a stack half, column boundary, or empty-row target before release,
  then place tiled windows at the same exact targets across outputs.
- Keep floating and non-exact drags on Plasma's native route. Exact tiled moves
  wait for KWin's destination output and final frame, including delayed Wayland
  updates.
- Restore the previous output, per-output desktop selection, focus, geometry,
  and layout when an exact cross-output move is rejected.
- Drive opening and closing directly from the configured touchpad swipe.
  Cancellation returns to the previous endpoint, while stale contexts close
  safely.
- Move eligible window thumbnails on a touchscreen after a long press without
  turning taps or the close affordance into drags.

## Upgrade or roll back

No shortcut, setting, schema, layout, or persistence migration is required.
Logical persistence v4 remains compatible in both directions. Install matching
artifacts from one release and follow the [migration guide](migration.md) when
upgrading from or rolling back to 1.84.0.

## Status

Overview remains optional and under active development. The normal Driftile
layout stays authoritative, and KDE Plasma with KWin 6.7 or newer remains
required.
