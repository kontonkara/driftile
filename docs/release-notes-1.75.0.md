# Driftile 1.75.0

Driftile 1.75.0 improves spatial session continuity, gesture ownership, and
desktop-handoff focus without changing existing configuration.

## Changes

- Keep the Overview open when windows are added or removed. Refresh its model
  in place and retry one unstable sample once.
- Preserve search, help, and a still-valid keyboard selection across refresh,
  while clearing stale drag, wheel, and keyboard-boundary state.
- Limit one rapid discrete Overview wheel burst to four workspace steps.
- Complete horizontal, vertical-desktop, and Overview open or close touchpad
  gestures only in their captured activity, desktop, output, and topology.
- Retain only the latest vertical focus intent requested during a desktop
  handoff and replay it once after the matching tiled window becomes active.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
