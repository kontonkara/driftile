# Driftile 1.57.0

Driftile 1.57.0 adds two live presentation preferences for optional Overview
window labels.

## Highlights

- Keep ordinary large-thumbnail labels enabled by default, or hide their
  complete footer without changing tabs and minimized placeholders.
- Keep application identity enabled by default, or show bounded captions only
  without reading hidden application identity fields.
- Apply both KConfig preferences without restarting KWin.
- Configure nullable per-user overrides through Home Manager while leaving the
  NixOS system option surface unchanged.
- Fall back to the enabled presentation when external values are malformed.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The release adds no action,
binding, input handler, geometry or layout write, persistence field, animation,
timer, private API, or KWin fork. Search, pointer, keyboard, close, layout, and
logical persistence v4 behavior remain unchanged.
