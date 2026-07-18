# Driftile 1.79.0

Driftile 1.79.0 adds a bounded live-camera bridge to the optional Overview
without changing configuration or saved layout state.

## Changes

- Follow the live frame geometry of the active eligible tiled window in the
  current Overview row.
- Reattach the row when the active eligible source changes.
- Detach the current source after manual horizontal panning or a keyboard
  reveal, preserving the user's chosen row position until the source or
  Overview session changes.
- Fail closed when the source, output, work area, scale, or window role no
  longer matches the captured row.

Inactive rows remain bounded, captured projections for the current Overview
session. This current-row bridge does not complete a continuous spatial
Overview architecture.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. No shortcut, setting, schema,
layout, or persistence migration is required; logical layout persistence v4
remains compatible.
