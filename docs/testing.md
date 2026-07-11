# Testing

## Local checks

```bash
npm ci
npm run check
npm run package
```

## Isolated KWin smoke test

With Nix:

```bash
nix develop .#integration
npm ci
npm run test:integration
```

Use `npm run test:integration -- wayland`, `npm run test:integration -- wayland-multi-output`, or `npm run test:integration -- x11` to select a scenario. The Wayland selection runs separate single-output and two-output sessions.

Without Nix, install Bash, Node.js and npm, KWin 6.7 or newer for Wayland and X11, KGlobalAccelD, KScreen tools, LayerShellQt QML, XWayland, Xvfb, `xrandr`, `xprop`, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, `flock`, GNU `timeout`, and `jq`. Set `DRIFTILE_SMOKE_KGLOBALACCELD` to the `kglobalacceld` executable for X11. If LayerShellQt is outside Qt's standard import path, set `DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT` to the directory containing `org/kde/layershell`. Then run the same npm command.

The test uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Single-output sessions cover shortcut ownership, adjacent and edge column navigation, tiling and scrolling, stack reorder, horizontal extraction, explicit consume, and explicit expel past minimized passive peers, consume and expel edits, floating, layer switching and geometric floating focus, minimized tiled-slot retention, focus skipping, no-wrap boundaries, transactional off-screen reveal, exact logical restoration, native fullscreen and maximize control, column sizing, available-width expansion, visible-group centering, per-window height adjustment, automatic reset, height presets, adjacent and numbered tiled or floating desktop transfers, whole-column desktop transfer past a minimized passive member, numbered tail clamping, dynamic desktop cleanup, KWin-owned window states, exact unload restoration, and native Wayland, XWayland, and native X11 clients. A two-output Wayland session covers independent numbered desktop selection, context-local floating focus, application-driven stacked fullscreen for native Wayland and XWayland windows, native application-driven stacked maximize, XWayland shortcut-driven stacked maximize, whole-column and floating desktop transfers, whole-column output transfer past a minimized passive member, secondary output transfers, focus preservation, exact geometry, capacity limits, topology recovery, and unload ownership.

The unit suite also covers shortcut manifests, numbered desktop validation and tail clamping, immutable whole-column previews, floating transfer isolation and relationship guards, minimized-passive desktop and output transfer, batch transfer commits and rollback, trailing-desktop ownership, stack mutations and rollback, weighted window heights, deterministic output routing, floating ownership, layer focus memory and geometric navigation, minimized tiled-slot and manual-floating-frame retention, minimized focus skipping, vertical reorder, horizontal extraction, explicit consume, and explicit expel across minimized passive slots, no-wrap boundaries, transactional tiled-layer reveal, synchronous and deferred focus confirmation, reentrant focus rejection and rollback, fail-closed non-minimize suspension blockers, all-member transaction guards, projected stack rollback across authoritative removals, stacked fullscreen and maximize extraction past settled minimized peers, exact compensation, optional borderless ownership, reclassification, decorated frame constraints, available-width expansion, exact signed-offset centering, column and window sizing rollback, topology barriers, capacity recovery, and stale callback cancellation.

The isolated two-output Wayland scenario uses KScreen to verify scale and position changes, output disable and re-enable recovery, and stable reachable frames for native Wayland and XWayland windows. A native layer-shell panel verifies work-area recovery.

The isolated X11 scenario verifies shortcut-driven stacked fullscreen and maximize extraction, live RandR mode changes, and work-area recovery from a real EWMH dock strut.

The isolated backend tests do not cover application-driven live constraint-hint changes, size increments, aspect-ratio policies, Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. The guest receives 8 virtual CPUs and 8 GiB of memory. Plasma starts a Wayland session, enables Driftile, claims its shortcut profile, and runs the acceptance pool. Separate Konsole processes provide a stable baseline, while the primary structural workflow uses offline Firefox for direct insertion and as a passive peer during stacked maximize, XWayland xterm for minimized-edge navigation, KDE Calculator as a numbered-desktop destination, and fixed-size XWayland `xmessage` for automatic-floating constraints. A final lifecycle pool repeats Firefox, KDE Calculator, and xterm checks after all physical shortcut scenarios. The VM requires borderless state for tiled, fixed-size, manually floating, and application windows. It focuses, minimizes, restores, resizes, and closes real applications while checking their slots, neighboring frames, and exact layout reflow. `kdotool` reads the active KWin window during these checks.

The host injects real `Meta+H/J/K/L`, `Meta+Home/End`, `Meta+Ctrl+Home/End`, `Meta+Ctrl+J/K`, `Meta+]`, `Meta+PageDown`, `Meta+1`, `Meta+9`, `Meta+Ctrl+2`, `Meta+Ctrl+9`, `Meta+Ctrl+U`, `Meta+,`, `Meta+.`, `Meta+-`, `Meta+=`, `Meta+Shift+-`, `Meta+Shift+=`, `Meta+Ctrl+Shift+R`, `Meta+Ctrl+R`, `Meta+Ctrl+F`, `Meta+Ctrl+C`, `Meta+Shift+V`, `Meta+Shift+F`, and `Meta+M` key sequences through QEMU QMP so Plasma shortcut conflicts cannot hide behind direct invocation. The remaining VM checks cover dynamic desktops, minimized-slot navigation, reorder, horizontal extraction, explicit consume and expel past minimized peers, and restoration, tiled and floating transfers, transfer boundaries, floating-layer and tiled four-way focus, stack editing, direct insertion, floating, singleton and stacked native fullscreen and maximize past minimized peers, column and window sizing, and viewport scrolling with native Wayland and XWayland clients. The isolated X11 suite covers native X11 clients. See [Shortcuts](shortcuts.md).

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest. The launcher closes the VM immediately after the visible checks report success or failure. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
