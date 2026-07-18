# Driftile 1.80.0

Driftile 1.80.0 improves focus continuity around desktop handoffs and window
closure without changing configuration or saved layout state.

## Changes

- Queue up to four immediate horizontal focus requests after a desktop handoff,
  advancing only after each exact destination activation is confirmed.
  Vertical and boundary-edge input keeps one superseding request.
- Restore eligible same-context automatic-floating utilities, transients, and
  application-excluded windows after the active window closes. Ordinary
  non-normal windows still fail closed.
- Keep immediate focus input owned by one exact unresolved output-local handoff
  even when KWin temporarily reports an active window on another output.
  Ambiguous, global, and stale handoffs fail closed without moving that output.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. No shortcut, setting, schema,
layout, or persistence migration is required; logical layout persistence v4
remains compatible.
