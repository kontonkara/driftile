# Driftile 1.72.0

Driftile 1.72.0 restores runtime dispatch for every registered shortcut action
and improves configuration and Overview-help discoverability.

## Highlights

- Make 30 existing configurable actions reach their established controller
  transactions instead of failing at a missing runtime export.
- Restore boundary and numbered focus, numbered column placement, horizontal
  window swaps, output-aware movement, direct stacked or tabbed presentation,
  and previous or next output transfers.
- Show the exact valid form of role-qualified application selectors in the KCM
  while keeping malformed stored text available for correction.
- Open the existing F1 Overview reference with a left click or touch on its
  hint, with hover and pressed feedback and no background card dispatch.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. This release adds no action ID,
default binding, setting, schema, persistence field, private API, or KWin fork.
Existing shortcut assignments and logical persistence v4 remain unchanged.
