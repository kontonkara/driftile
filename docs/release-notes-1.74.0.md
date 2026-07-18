# Driftile 1.74.0

Driftile 1.74.0 turns the optional Overview into a spatial workspace view and
keeps window motion continuous when workspace effects overlap navigation.

## Highlights

- Present workspaces as a vertically scrollable stack at their real output
  aspect ratio, centered on the current workspace.
- Configure Overview zoom from `0.2` to `0.75`; the default is `0.5`.
- Pan with touch or a high-resolution touchpad, and use discrete wheel steps to
  select adjacent workspaces without closing the Overview.
- Keep search-result wheel cycling, bounded `Home`/`End` navigation, virtualized
  off-screen cards, and edge auto-pan during window or workspace drags.
- Preserve every deferred current-context column when a workspace animation and
  rapid window navigation overlap.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing shortcuts and logical
layout persistence v4 remain compatible. Spatial navigation is contained in the
optional Overview and uses public KWin effect APIs.
