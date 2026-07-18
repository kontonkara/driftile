# Driftile 1.74.1

Driftile 1.74.1 stabilizes spatial Overview input and close-focus recovery.

## Fixes

- Consume wheel events during viewport, window, and workspace drags so the
  active drag remains the sole owner of viewport geometry.
- Clear incomplete discrete wheel input when a drag begins or when search and
  help change the input mode.
- Restore the latest eligible same-context window selected during close
  settlement instead of replacing it with an older focus-history entry.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
