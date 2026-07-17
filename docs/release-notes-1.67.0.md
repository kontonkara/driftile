# Driftile 1.67.0

Driftile 1.67.0 keeps rapid column motion synchronized, adds desktop
send-without-follow actions, and makes focus recovery after closing a window
resilient to interim null activations.

## Highlights

- Retarget coupled KWin Position and Translation components together on every
  rapid logical position change across negative global coordinates, even when
  one component target is unchanged. This prevents timeline divergence, jerky
  columns, and temporary wallpaper gaps.
- Keep a provisional same-context close-focus handoff in a separate two-entry
  non-null activation chain without scheduling additional work.
- Add 22 unbound actions for sending one window or one complete column to the
  previous, next, or a numbered desktop while leaving the source selected.
- Extract one active tiled member, preserve whole-column state, or send one
  relation-free manually floating window without changing its frame.
- Preserve settled minimized passive peers and focus an eligible window left on
  the source desktop.
- Commit hidden destination ownership without frame writes and reflow it when
  that desktop becomes visible; only the visible source layout is written during
  the command.
- Keep same-target and unsafe operations inert and compensate partial work only
  while exact captured ownership remains valid.
- Leave existing move/follow actions and the bundled 88-action default profile
  unchanged.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The package uses public APIs and
changes no setting or persistence schema. Logical persistence remains v4.
