# Driftile 1.74.2

Driftile 1.74.2 stabilizes rapid desktop focus and spatial Overview input.

## Fixes

- Keep the latest horizontal focus direction pressed immediately after a
  desktop switch and replay it once the new tiled active window is available.
- Cancel that replay when a newer activation or context change makes it stale.
- Clear partial Overview wheel input after panning or changing the current
  spatial workspace position.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
