# Driftile 1.70.0

Driftile 1.70.0 lets existing exact application rules target one specific KWin
window role without affecting every window from the application.

## Highlights

- Use `application-id|windowRole` anywhere an exact application identifier is
  accepted.
- Prefer the role-specific rule, then fall back to the ordinary application
  rule for layout, sizing, placement, destination, focus, presentation,
  exclusion, and initial-state policies.
- Keep all existing plain application rules and defaults unchanged.
- Expose the selector syntax once in the Applications page of the KCM and in
  the configuration guide.
- Fall back safely when `windowRole` is empty, unavailable, malformed, or
  unreadable, and skip role lookup when the relevant rule collection is empty.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The selector reads the public
`windowRole` property and adds no setting, action, shortcut, or persistence
schema. Logical persistence remains v4.
