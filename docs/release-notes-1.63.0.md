# Driftile 1.63.0

Driftile 1.63.0 makes window-search position and per-desktop results visible in
the optional Overview.

## Highlights

- Report the selected unique window as `ordinal/total`, with total-only and
  no-match fallbacks when no exact selection is available.
- Show an exact match count on each desktop and statically deemphasize
  zero-result cards during non-whitespace search without hiding or moving them.
- Give every target for the same multi-desktop window one shared ordinal while
  counting it once globally and once on each owning desktop.
- Preserve the previous whitespace-only feedback semantics and every existing
  Overview input path.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The release adds no timer,
animation, KWin request, input target, layout or persistence write, private API,
or KWin fork. Logical persistence remains v4.
