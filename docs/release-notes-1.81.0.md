# Driftile 1.81.0

Driftile 1.81.0 improves spatial Overview continuity, wheel handling, and
picture-in-picture ownership without changing configuration or saved layout
state.

## Changes

- Project eligible current-row tiled windows from guarded live frame geometry.
  Stale, tabbed, unavailable, or context-changing sources fall back to the
  captured plan without retaining live KWin objects.
- Settle precise vertical wheel gestures on the nearest workspace and combine
  rapid discrete steps into one deferred, context-checked selection.
- Keep a manual horizontal live-geometry detachment local to its exact output
  and workspace.
- Preserve picture-in-picture automatic-floating ownership while KWin
  temporarily reports an empty or unavailable window role. An explicit
  different role or window removal clears that ownership.
- Defer outgoing desktop window motion while the workspace transition owns
  presentation.

## Overview status

The Overview is still an intermediate, read-only spatial projection. Inactive
rows and column shells use captured layout state, and it does not yet share one
continuous camera or layout ownership model with the normal workspace.

The packaged Overview search runtime contains no `WeakSet` or `WeakMap` query
cache. Users still running the crash-prone 1.72.0 Overview should upgrade the
effect together with the main extension.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. No shortcut, setting, schema,
layout, or persistence migration is required; logical layout persistence v4
remains compatible.
