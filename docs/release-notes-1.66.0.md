# Driftile 1.66.0

The prepared Driftile 1.66.0 package makes rapid window navigation continuous
and keeps focus recovery reliable through short KWin handoffs.

## Highlights

- Retarget active movement and size interpolation with the configured
  Plasma-scaled duration.
- Continue rapid motion from KWin's interpolated position instead of restarting
  on a shorter interval.
- Keep positive- and negative-coordinate motion on one bounded absolute
  position and translation pair.
- Carry the exact next focus target across a workspace-effect handoff, including
  duplicate activation, transient null focus, and deletion of the prior anchor.
- Detach an already-ending animation ID while its pending end remains counted,
  then track the replacement independently so that end notification cannot
  clear it or leave a stale transform.
- Keep a valid same-context replacement focused after closing a window, and
  restore the captured handoff or prior MRU target if KWin clears it during
  settlement.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The package changes no setting,
shortcut, schema, package identity, or public API. Logical persistence remains
v4, and the transition companion remains optional and disabled by default.
