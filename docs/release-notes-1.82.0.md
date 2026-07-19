# Driftile 1.82.0

Driftile 1.82.0 turns the optional Overview into one continuous spatial plane
without changing the authoritative layout or saved state.

## Changes

- Present virtual desktops as full-width rows stacked in one continuous plane.
- Project the normal solver's exact tiled frames, stacked members, selected
  tabbed members, work areas, gaps, pixel grid, and camera placement. Floating
  windows keep their output-local geometry.
- Use a complete guarded live snapshot for a current-row column and fall back
  to solved geometry when that snapshot is stale or incomplete.
- Reverse the opening camera and zoom path when closing, including an
  interrupted opening or a manually panned current row.
- Navigate in two axes with pointer drags, wheel input, keyboard selection, and
  bounded edge movement during window and workspace drags.
- Keep decorative chrome disabled by default. Empty and floating-only rows use
  bounded planning contexts instead of clearing valid neighboring rows.
- Draw the backdrop once at the scene root instead of constructing repeated
  KWin background items. Live identities and external values continue to fail
  closed.

## Overview boundary

Overview remains an optional, session-only projection. It can issue guarded
KWin focus, transfer, and desktop-reorder requests, but the normal Driftile
layout stays authoritative; the effect does not acquire layout ownership or
persist its camera. The packaged runtime contains no `WeakSet` or `WeakMap`.

The packaged physical workspace-reorder checkpoint now targets the compact row
marker used by the full-width plane.

## Upgrade or roll back

No shortcut, setting, schema, layout, or persistence migration is required.
Logical persistence v4 remains compatible in both directions. Install matching
artifacts from one release and follow the [migration guide](migration.md) when
upgrading from or rolling back to 1.81.0.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The Overview remains optional,
uses public KWin APIs, and can be disabled without changing the main layout.
