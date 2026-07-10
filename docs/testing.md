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

Use `npm run test:integration -- wayland` or `npm run test:integration -- x11` to run one KWin backend.

Without Nix, install Bash, Node.js and npm, KWin 6 for Wayland and X11, Xwayland, Xvfb, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, GNU `timeout`, and `jq`. Then run the same npm command.

The test uses temporary user and XDG directories, private D-Bus sessions, a virtual Wayland output, and an Xvfb display. It installs Driftile and verifies the enable, exact tiling, disable, geometry restoration, and package removal lifecycle with native Wayland, Xwayland, and native X11 windows. It does not connect to the current display or session bus.

This test does not cover Plasma panels, real GPUs, input, shortcuts, multi-output layouts, or output hot-plugging.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. Plasma starts a Wayland session, enables Driftile, and opens two labeled test windows. The launcher reports whether KWin loaded the extension and whether both horizontal focus shortcuts worked. Use `Meta+Ctrl+H` and `Meta+Ctrl+L` for manual verification.

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The test account and password are both `driftile`. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
