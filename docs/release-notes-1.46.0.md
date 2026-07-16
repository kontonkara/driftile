# Driftile 1.46.0

Driftile 1.46.0 improves focus recovery and presentation timing while reducing
repeated transition and border-management work.

## Highlights

- Restore the most recent eligible same-context window after an active
  automatic-floating window closes, including dialogs, transients, and
  application exclusions, while preserving a valid replacement already
  selected by KWin.
- Present the selected tiled column first during a focus transaction, avoiding
  an incoherent intermediate frame when moving from a full-width column to a
  narrower column.
- Retarget an active size animation with capped timing when KWin follows it with
  a small settling correction instead of snapping to the final size.
- Cache unchanged transition eligibility and evaluate the dynamic predicate
  once per geometry signal.
- Coalesce repeated rejected borderless requests for the same non-normal helper
  role without suppressing attempts for normal windows.

Logical layout state remains v4. Settings, shortcut IDs, default bindings, and
the optional overview are unchanged.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.46.0`](https://github.com/kontonkara/driftile/releases/tag/v1.46.0) and
verify them with `SHA256SUMS`:

- `driftile-1.46.0.kwinscript`
- `driftile-overview-1.46.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.46.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.46.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.46.0 artifact, then re-enable them. Nix users should pin the input to
`v1.46.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.46.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.46.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.46.0/docs/configuration.md).
