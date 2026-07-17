# Driftile 1.55.0

Driftile 1.55.0 makes eligible minimized stacked tiled members and tracked
floating windows without tabs actionable in the optional Overview.

## Highlights

- Show one compact caption placeholder inside each eligible window's visible
  projected slot or frame.
- Reach placeholders with the pointer, keyboard navigation, or search by title,
  application, attention, or `minimized` state.
- Restore and focus the exact selected window with a click, `Enter`, `Return`,
  or `Space`.
- Close an exact closeable placeholder with middle click or `Delete` without
  restoring it first.
- Preserve attention cues while excluding minimized placeholders from drag and
  drop.
- Hide placeholders for malformed, tiny, fully clipped, offscreen, stale, or
  ineligible projections.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The feature belongs only to the
optional Overview and reuses the existing guarded public restore, focus, and
close paths. The main layout script, settings, actions, default bindings,
transition effect, and logical persistence v4 are unchanged.
