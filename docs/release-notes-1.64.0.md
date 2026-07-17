# Driftile 1.64.0

The prepared Driftile 1.64.0 package adds structured window search to the
optional Overview.

## Highlights

- Keep case-insensitive whitespace-separated AND matching for existing
  queries.
- Use double quotes for a phrase and a leading `-` to exclude a term or phrase.
- Narrow matches with `title:`, `app:`, `desktop:`, `output:`, and `state:`.
- Treat unknown prefixes as ordinary search text.
- Report malformed recognized scopes or quoted phrases as invalid instead of
  showing partial results.

Examples:

- `app:firefox project`
- `title:"build log" -state:minimized`
- `desktop:"Web 2" output:HDMI`

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing unscoped queries keep
their previous behavior. Search remains session-only and adds no setting,
action, binding, KWin request, layout or persistence write, private API, or
KWin fork. Logical persistence remains v4.
