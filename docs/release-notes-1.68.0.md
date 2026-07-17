# Driftile 1.68.0

Driftile 1.68.0 keeps rapid three-column motion visually continuous and
restores focus when KWin clears a provisional replacement during window close.

## Highlights

- Retarget both active position components when a small corrective resize
  changes a moving window's center without changing its frame origin.
- Keep partially off-screen columns aligned during rapid reversals instead of
  accumulating a stale per-window transform and exposing a wallpaper gap.
- Recover the exact same-context close handoff after the event order
  `removed -> replacement -> no active window -> removal`.
- Preserve the removed automatic-floating window's last visible context long
  enough to select a safe replacement.
- Fall back within the same tiled or floating layer when the provisional
  replacement becomes minimized or otherwise ineligible.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The package uses public APIs and
changes no setting, shortcut, or persistence schema. Logical persistence
remains v4.
