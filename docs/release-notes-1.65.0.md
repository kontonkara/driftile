# Driftile 1.65.0

Driftile 1.65.0 adds bounded search alternatives and makes structured Overview
searches faster to edit without closing the Overview.

## Highlights

- Separate up to four alternative AND groups with a standalone unquoted `|`.
- Combine scopes, quoted phrases, and exclusions independently in each group.
- Keep quoted and attached pipes literal.
- Reject leading, trailing, consecutive, and fifth groups with the existing
  invalid-query feedback instead of exposing partial results.
- Cap the total query at 128 Unicode code points and share one eight-clause
  budget across all groups.
- Press `Ctrl+Backspace` to remove the complete trailing search clause.
- Remove bare, scoped, excluded, and quoted clauses as one unit.
- Repair a malformed trailing quote by removing its unfinished clause.
- Press `Ctrl+U` to clear a non-empty query and keep the Overview open.
- Keep the existing unmodified `Backspace` and `Escape` behavior.

## Examples

- `app:firefox title:"release notes" -state:minimized | app:konsole "build log"`
  finds either a non-minimized Firefox release-notes window or a Konsole build
  log.
- `desktop:"Web 2" output:HDMI | state:urgent -app:telegram` finds either a
  window on the named desktop and output or an urgent non-Telegram window.
- `title:"release | notes"` and `title:foo|bar` search for literal pipes rather
  than creating alternatives.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Overview search remains
session-only and adds no global binding, setting, KWin request, layout or
persistence write, private API, or KWin fork. Logical persistence remains v4.
