# Driftile 1.86.0

Driftile 1.86.0 adds transactional workspace creation in the spatial Overview
and optional global wheel controls.

## Changes

- Preview and create a virtual desktop at the exact gap between two Overview
  rows, then move the dragged tiled window there without closing the Overview.
- Support the same operation across outputs. Delayed transfers keep the created
  desktop reserved and compensate if the desktop order changes before commit.
- Restore selection, focus, layout, and the still-empty created desktop when a
  placement is rejected or the runtime stops safely.
- Add the optional native **Driftile Wheel Control** effect for desktop
  navigation, column focus, and column movement with modifier-and-wheel input.
- Provide a separate Nix package plus NixOS and Home Manager installation
  options for the native effect.

## Upgrade or roll back

No shortcut, setting, schema, layout, or persistence migration is required.
Logical persistence v4 remains compatible in both directions. The native wheel
effect must be built against the running KWin ABI and enabled separately under
Desktop Effects. Follow the [migration guide](migration.md) when changing from
or returning to 1.85.0.

## Status

Overview remains optional and under active development. The normal Driftile
layout stays authoritative, and KDE Plasma with KWin 6.7 or newer remains
required.
