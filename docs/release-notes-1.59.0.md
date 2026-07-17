# Driftile 1.59.0

Driftile 1.59.0 adds bounded static window-state badges and state search to the
optional Overview.

## Highlights

- Show one `Fullscreen`, `Maximized`, or `Floating` badge on an eligible large,
  selected ordinary thumbnail.
- Treat only full two-axis maximize as `Maximized`, with fullscreen taking
  presentation precedence over maximized and floating.
- Keep every true lowercase state term available to all-term search, including
  tracked floating state hidden behind a higher-priority badge.
- Enable or disable badges live through KConfig or a nullable Home Manager
  preference without disabling state search.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The release adds no input path,
window-state or layout write, persistence field, action, binding, private API,
or KWin fork. Logical persistence remains v4.
