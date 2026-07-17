# Driftile 1.60.0

Driftile 1.60.0 adds bounded adaptive virtual-desktop names and owning-desktop
search to the optional Overview.

## Highlights

- Show a normalized desktop name beside the fixed number gutter on eligible
  large cards while keeping small and narrow cards compact.
- Include each window's owning desktop name in all-term search whether or not
  the label is visible.
- Enable or disable desktop-name labels live through default-enabled KConfig or
  a nullable Home Manager preference.
- Keep the NixOS option surface unchanged; system installations use the same
  per-user effect setting.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Desktop names come from the
read-only public Plasma 6.7+ API and are never written. The release adds no
input path, window or layout write, persistence field, action, binding, private
API, or KWin fork. Logical persistence remains v4.
