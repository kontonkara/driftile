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

Without Nix, install Bash, Node.js and npm, KWin 6.7 or newer for Wayland and X11, KGlobalAccelD, KScreen tools, LayerShellQt QML, Xwayland, Xvfb, `xrandr`, `xprop`, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, GNU `timeout`, and `jq`. Set `DRIFTILE_SMOKE_KGLOBALACCELD` to the `kglobalacceld` executable for X11. If LayerShellQt is outside Qt's standard import path, set `DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT` to the directory containing `org/kde/layershell`. Then run the same npm command.

The test uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Its single-output sessions verify three-window tiling, viewport reveal, vertical stack focus and editing, direct insertion across singleton columns, floating round trips, active-column reorder and resizing through KGlobalAccel, exact restoration, package removal, and slot preservation through fullscreen, minimize, and maximize transitions with native Wayland, Xwayland, and native X11 windows. Native tiling is also covered on Wayland and Xwayland. A separate two-output Wayland session verifies independent contexts, output-local stack insertion and floating round trips, exact geometry, overflow rejection, and safe unload ownership.

The unit suite covers stack mutations, floating placement anchors and transactional ownership, active-column reorder, width constraints and rollback, the two-sample topology barrier, output and dock invalidations, waiting-only and hidden contexts, deterministic structural merges, sticky restore invalidation, capacity eviction and retry, and stale callback cancellation.

The isolated two-output Wayland scenario uses KScreen to verify scale and position changes, output disable and re-enable recovery, and stable reachable frames for native Wayland and Xwayland windows. A native layer-shell panel verifies work-area recovery.

The isolated X11 scenario verifies live RandR mode changes and work-area recovery from a real EWMH dock strut.

The tests do not cover Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. Plasma starts a Wayland session, enables Driftile, and opens labeled test windows. The launcher verifies extension loading, four-way focus, stack editing, direct stack insertion, floating round trips, active-column movement and width shortcuts, and viewport scrolling. Use `Meta+Ctrl+H/J/K/L` to focus, `Meta+Ctrl+Shift+H/L` to move columns, `Meta+Ctrl+Shift+J/K` to reorder stack members, `Meta+Ctrl+Alt+H/L` to merge or extract a window, `Meta+Ctrl+Alt+Shift+H/L` to insert into the nearest stack, `Meta+Ctrl+Space` to toggle floating, and `Meta+Ctrl+-/=/0` to change width.

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest so the visible session stays available for observation. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
