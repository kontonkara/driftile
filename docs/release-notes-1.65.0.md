# Driftile 1.65.0

The prepared Driftile 1.65.0 package makes structured Overview searches faster
to edit without closing the Overview.

## Highlights

- Press `Ctrl+Backspace` to remove the complete trailing search clause.
- Remove bare, scoped, excluded, and quoted clauses as one unit.
- Repair a malformed trailing quote by removing its unfinished clause.
- Press `Ctrl+U` to clear a non-empty query and keep the Overview open.
- Keep the existing unmodified `Backspace` and `Escape` behavior.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Search editing is session-only
and adds no global binding, setting, KWin request, layout or persistence write,
private API, or KWin fork. Logical persistence remains v4.
