# Driftile 1.76.0

Driftile 1.76.0 improves spatial Overview continuity and geometry transitions
without changing existing configuration.

## Changes

- Keep the workspace card under the Overview camera at the same local position
  across live model refreshes, zoom changes, and scene resizes.
- Pan the empty Overview backdrop with a mouse, touchpad, or touchscreen while
  preserving window and desktop drag ownership.
- Retain bounded subpixel wheel movement, clear stale input across mode and
  direction changes, and keep discrete bursts bounded.
- Preserve the earliest geometry baseline when a workspace effect interrupts
  an active window transition, then replay and retarget the movement after the
  effect releases ownership.

The Overview is still an intermediate card-based projection. These changes
improve camera continuity and input, but do not complete the planned continuous
spatial architecture or live-geometry interaction model.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Existing settings, shortcuts,
and logical layout persistence v4 remain compatible.
