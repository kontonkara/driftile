# Driftile 1.51.0

Driftile 1.51.0 improves the separately installed native shortcut editor while
leaving window-management behavior and default bindings unchanged.

## Highlights

- Show each active action's registered defaults beside its current primary and
  alternate assignments.
- Restore one action or all actions to their registered defaults as pending
  edits; nothing is written before Apply.
- Preserve complete multi-assignment lists and the existing conflict,
  stale-baseline, verified-write, and rollback protections.
- Mark pending rows, search registered defaults, and provide useful tooltips.
- Use Enter to edit the selected action and the platform's standard Find, Save,
  Refresh, and Close shortcuts.
- Install a searchable desktop launcher and AppStream metadata, and expose
  `--help` and `--version` for packaging and diagnostics.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 retain the existing compatibility baseline. The main
KWin package gains no GUI dependency.
