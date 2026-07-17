# Driftile 1.69.0

Driftile 1.69.0 lets the optional transition effect ignore one exact helper
window without disabling animation for its complete application.

## Highlights

- Exclude windows by exact, case-sensitive KWin caption or `windowRole`, in
  addition to the existing complete `windowClass` exclusion.
- Follow live caption and role changes while avoiding those property reads
  when their corresponding lists are empty.
- Configure all three bounded exclusion lists in the transition KCM.
- Manage caption and role exclusions independently through nullable Home
  Manager options.
- Reject malformed, duplicate, oversized, or overlong exclusion documents as
  one fail-closed transition policy.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The effect uses public
`EffectWindow` properties and changes no layout state, shortcut, or persistence
schema. Logical persistence remains v4.
