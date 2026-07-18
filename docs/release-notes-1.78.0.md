# Driftile 1.78.0

Driftile 1.78.0 aligns the optional Overview more closely with the live layout
and fixes picture-in-picture window handling without changing configuration.

## Changes

- Derive each Overview row's initial gaps, work area, output pixel grid, column
  widths, and camera placement from the normal layout solver.
- Keep inactive workspace row cameras stable when another row refreshes.
- Use `Shift` with a vertical wheel for the same bounded horizontal row control
  as a native horizontal wheel.
- Keep Firefox picture-in-picture windows on the floating layer during
  interactive moves instead of admitting them into the tiled layout.

The Overview still uses a captured projection after opening rather than the
normal workspace's continuous camera and live geometry. This release improves
initial spatial agreement but does not complete that architecture.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
