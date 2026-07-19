# Driftile 1.83.0

Driftile 1.83.0 improves pointer continuity in the optional spatial Overview.

## Changes

- Pan the row under the pointer with a right-button drag, including when the
  drag starts over a window thumbnail.
- Keep a window drag active while a bounded dwell selects another workspace,
  allowing the transfer to continue in the destination row.
- Refresh an active Overview in place when virtual desktops are added, removed,
  or reordered.
- Reject stale drag, model, geometry, session, and workspace identities instead
  of applying an ambiguous action.

## Upgrade or roll back

No shortcut, setting, schema, layout, or persistence migration is required.
Logical persistence v4 remains compatible in both directions. Install matching
artifacts from one release and follow the [migration guide](migration.md) when
upgrading from or rolling back to 1.82.0.

## Status

Overview remains optional, session-only, and under active development. The
normal Driftile layout stays authoritative, and KDE Plasma with KWin 6.7 or
newer remains required.
