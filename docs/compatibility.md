# Compatibility

## Platform baseline

- KDE Plasma and KWin 6.7 or newer are required.
- Native Wayland is the primary target. Native Wayland and XWayland windows use
  the same layout model.
- Native X11 is verified on one output with a global-workspace fallback.
  Multi-output native X11 remains unverified.
- Optional five-finger touchpad navigation uses KWin's native Wayland gesture
  API. Enabling it in a native X11 session is a safe no-op.
- Desktop reordering fails closed when the KWin X11 scripting backend does not
  expose the required method.
- The optional overview lifecycle is verified with native Wayland, XWayland,
  two virtual Wayland outputs, and single-output native X11. It uses the same
  exact snapshot validation on every backend.

## Installation portability

The main archive and optional overview companion are standard KWin KPackages
and are not tied to a specific Linux distribution. Install them with
`kpackagetool6` on a compatible Plasma desktop. The optional shortcut helper
requires Node.js 22 or newer, `busctl`, and `flock`.

The Nix flake provides separate main and overview packages plus NixOS and Home
Manager modules for `x86_64-linux` and `aarch64-linux`. Other distributions use
the same KPackage archives and portable installation procedure.

## Window and geometry limits

- Exposed client minimum and maximum sizes are enforced as hard layout bounds.
- The Plasma 6.7 `KWin::Window` scripting API does not expose X11 or XWayland
  base sizes, resize increments, aspect bounds, or strict-geometry rules.
  Driftile therefore does not include those hints in its layout model; KWin may
  still adjust an applied frame.
- Exact off-lattice frames are verified with XWayland. Native X11 may quantize
  frames, so its compatibility checks use grid-aligned geometry.
- Live constraint changes are verified with Qt Quick and GTK 3 clients. Broader
  toolkit coverage remains unverified.
- Dialogs, modal and transient windows, non-resizable normal windows, and
  normal windows fixed on both axes remain outside tiling ownership.

## Display hardware limits

Automated coverage uses virtual Wayland outputs, Xvfb, and a visible virtual
machine. Output scale and position changes plus virtual output removal and
re-enablement are covered. Real GPU combinations, physical connector hot-plug,
and a wider hardware matrix remain unverified.

## Integration boundary

Driftile is a KWin extension, not a compositor. It owns layout policy while
KWin remains responsible for windows, geometry application, outputs,
fullscreen, maximize, minimize, and virtual-desktop mechanisms. Plasma's
built-in Overview, Pager, and Task Switcher remain the shell baseline. The
optional companion adds a separate read-only layout view without replacing
them. Unsupported or unavailable KWin mechanisms fail closed instead of being
reimplemented inside Driftile.
