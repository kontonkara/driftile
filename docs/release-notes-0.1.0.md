# Driftile 0.1.0

Driftile 0.1.0 provides scrollable tiling as a KWin extension for KDE Plasma.

## Requirements

- KDE Plasma and KWin 6.7 or newer.
- Wayland with native Wayland and XWayland windows, or a single-output native
  X11 session.

## Included behavior

- Independent horizontal column layouts for each output and virtual desktop.
- Vertical window stacks, keyboard-driven focus and movement, column and window
  sizing, viewport scrolling, and transfers between desktops and outputs.
- Floating-window handling, minimized-window retention, and native fullscreen
  and maximize integration.
- A shared trailing empty virtual desktop with conservative creation and
  cleanup.
- Configurable gaps, default column width, resize steps, and optional
  borderless presentation.
- An optional helper for claiming and safely restoring the default shortcut
  profile.

Follow the [installation guide](https://github.com/kontonkara/driftile/blob/v0.1.0/docs/installation.md)
to verify and install the release artifacts, enable Driftile, and configure
shortcuts.

## Upgrade note

If the shortcut helper owns the profile, release it with the helper from the
installed version first. Disable Driftile in **KWin Scripts** and select
**Apply** before upgrading the package. Enable the new version and claim or
assign its shortcuts after the upgrade.

## Known limits

These limits apply to the tagged 0.1.0 artifacts.

- Physical connector hot-plugging has not been verified; automated coverage
  uses virtual output removal and reattachment.
- Native X11 is verified on one output. Native X11 multi-output remains
  unverified.
- Exact extension reloads restore logical order, sizes, viewport state, and
  floating anchors. Cross-session restore waits up to five seconds for a
  complete strongly identified window set; otherwise the stored snapshot is
  skipped.
- Reconnecting an absent output does not yet restore a known historical
  topology.
