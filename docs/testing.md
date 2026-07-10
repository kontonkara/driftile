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

Without Nix, install Bash, Node.js and npm, KWin 6.7 or newer for Wayland and X11, KGlobalAccelD, KScreen tools, LayerShellQt QML, Xwayland, Xvfb, `xrandr`, `xprop`, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, `flock`, GNU `timeout`, and `jq`. Set `DRIFTILE_SMOKE_KGLOBALACCELD` to the `kglobalacceld` executable for X11. If LayerShellQt is outside Qt's standard import path, set `DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT` to the directory containing `org/kde/layershell`. Then run the same npm command.

The test uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Single-output sessions cover shortcut ownership, tiling and scrolling, stack edits, floating, sizing, whole-column and secondary desktop transfers, dynamic desktop cleanup, KWin-owned window states, exact unload restoration, and native Wayland, XWayland, and native X11 clients. A two-output Wayland session covers independent desktop selection, whole-column and secondary output transfers, focus preservation, exact geometry, capacity limits, topology recovery, and unload ownership.

The unit suite also covers shortcut manifests, immutable whole-column previews, batch transfer commits and rollback, trailing-desktop ownership, stack mutations, deterministic output routing, floating ownership, optional borderless ownership, reclassification, decorated frame constraints, column sizing rollback, topology barriers, capacity recovery, and stale callback cancellation.

The isolated two-output Wayland scenario uses KScreen to verify scale and position changes, output disable and re-enable recovery, and stable reachable frames for native Wayland and Xwayland windows. A native layer-shell panel verifies work-area recovery.

The isolated X11 scenario verifies live RandR mode changes and work-area recovery from a real EWMH dock strut.

The isolated backend tests do not cover application-driven live constraint-hint changes, size increments, aspect-ratio policies, Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. Plasma starts a Wayland session, enables Driftile, claims its shortcut profile, and runs the acceptance pool. The pool includes labeled QML fixtures plus offline Firefox and KDE Calculator windows on Wayland and an xterm window on XWayland. It requires borderless state for tiled, fixed-size, manually floating, and real-application windows. Each real application is focused, resized, closed, and checked for exact layout reflow.

The host injects real `Meta+-`, `Meta+=`, and `Meta++` key sequences through QEMU QMP so Plasma shortcut conflicts cannot hide behind direct invocation. The remaining checks cover dynamic desktops, transfer boundaries, four-way focus, stack editing, direct insertion, floating round trips, column movement and sizing, and viewport scrolling. See [Shortcuts](shortcuts.md).

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest. The launcher closes the VM immediately after the visible checks report success or failure. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
