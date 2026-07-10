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

The test uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Its single-output sessions verify shortcut claiming and restoration, three-window tiling, viewport reveal, vertical stack focus and editing, direct insertion across singleton columns, desktop focus and transfer, trailing-desktop creation and guarded cleanup, output-transfer boundaries, floating round trips, automatic KWin ownership, column reorder and resizing, exact restoration, package removal, and window-state transitions with native Wayland, Xwayland, and native X11 windows. A separate two-output Wayland session enables KWin's independent desktop mode and verifies desktop and directional output transfers, shared-tail cleanup, output-local stack insertion and floating, exact geometry, overflow rejection, and safe unload ownership.

The unit suite also covers the shortcut manifest and transactional ownership, trailing-desktop policy and ownership, silent desktop-mutation rejection, stack mutations, deterministic output routing, transfer commits and rollback, floating ownership, reclassification, decorated frame constraints, column reorder and width rollback, topology barriers, output and dock invalidations, capacity recovery, and stale callback cancellation.

The isolated two-output Wayland scenario uses KScreen to verify scale and position changes, output disable and re-enable recovery, and stable reachable frames for native Wayland and Xwayland windows. A native layer-shell panel verifies work-area recovery.

The isolated X11 scenario verifies live RandR mode changes and work-area recovery from a real EWMH dock strut.

The isolated backend tests do not cover application-driven live constraint-hint changes, size increments, aspect-ratio policies, Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. Plasma starts a Wayland session, enables Driftile, claims and verifies its shortcut profile, and opens labeled test windows. The host injects a real `Meta+-` key sequence through QEMU QMP; the guest must observe a narrower active column instead of Plasma's zoom action. The launcher also verifies extension loading, desktop focus and transfer, dynamic tail creation and cleanup, one-output transfer boundaries, four-way focus, stack editing, direct insertion, floating round trips, active-column movement and width actions, and viewport scrolling. See [Shortcuts](shortcuts.md) for the default keys.

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest so the visible session stays available for observation. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
