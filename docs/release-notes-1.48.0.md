# Driftile 1.48.0

Driftile 1.48.0 is the latest stable release. It improves horizontal focus
handoffs, optional transition retargeting, and pointer feedback for empty
destinations.

## Highlights

- Reveal an ordinary column next to a full-width predecessor at the right edge
  with the smallest required scroll. The predecessor remains partially visible
  and later columns stay outside the viewport.
- Keep rapid alternating horizontal focus changes to one optional transition
  transform per attribute. Duplicate and stale frame reports, including
  XWayland-style bursts, are coalesced, and an ended transition ID is replaced
  cleanly when an in-place retarget fails.
- Show a predicted singleton frame while dragging to a selected empty output or
  virtual desktop. The preview is visual only; normal admission decides the
  layout after the drop.

This batch changes no setting, action, schema, default binding, or private API.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 retain the existing compatibility baseline.

## Install

Download the matching artifacts from the
[`v1.48.0` release](https://github.com/kontonkara/driftile/releases/tag/v1.48.0)
and verify them with `SHA256SUMS`:

- `driftile-1.48.0.kwinscript`
- `driftile-overview-1.48.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.48.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.48.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.48.0 artifact, then re-enable them. Nix users can pin the input to
`v1.48.0` and rebuild.
