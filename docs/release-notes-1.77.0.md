# Driftile 1.77.0

Driftile 1.77.0 makes the optional Overview more spatial without changing
existing configuration.

## Changes

- Expand every workspace into a wide row that preserves output-scale window
  proportions and keeps neighboring logical columns visible.
- Keep one bounded, session-only horizontal viewport per workspace across live
  Overview refreshes.
- Pan the row under the pointer with precise horizontal wheel input, or use
  discrete horizontal steps to select and reveal neighboring windows.
- Reveal off-screen columns during keyboard navigation and fail closed while a
  refreshed desktop list is temporarily unavailable.

The Overview remains an intermediate projection. It still lacks the continuous
camera and live geometry shared with the normal workspace that the planned
spatial architecture requires; search and keyboard help do not close that gap.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
