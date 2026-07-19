# Driftile 1.84.0

Driftile 1.84.0 adds exact spatial window placement to the optional Overview.

## Changes

- Accept keyboard and pointer input from the first visible opening frame and
  release input ownership as soon as closing begins.
- Refresh an active Overview after authoritative layout publications without
  polling or taking layout ownership.
- Drop a tiled window into an exact stack half, column boundary, or empty row,
  including another desktop on the same output.
- Keep the Overview open after a successful placement. Rejected commands
  restore the prior desktop, focus, layout activation, and layout state.

## Upgrade or roll back

No shortcut, setting, schema, layout, or persistence migration is required.
Logical persistence v4 remains compatible in both directions. Install matching
artifacts from one release and follow the [migration guide](migration.md) when
upgrading from or rolling back to 1.83.0.

## Status

Overview remains optional and under active development. The normal Driftile
layout stays authoritative, and KDE Plasma with KWin 6.7 or newer remains
required.
