# Driftile 1.53.0

Driftile 1.53.0 adds read-only attention cues to the optional Overview.

## Highlights

- Mark a requesting window with a static accent and compact badge on its
  visible thumbnail or tab.
- Mark the owning desktop in its number gutter, including when the requesting
  window is outside the visible viewport.
- Find requesting windows with the search terms `urgent` or `attention` and
  combine them with existing title or application terms.
- Update every cue from public KWin attention events without polling,
  animation, focus changes, or layout writes.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The feature belongs only to the
optional Overview effect; the main layout script, transitions, settings,
actions, default bindings, and logical persistence v4 are unchanged.
