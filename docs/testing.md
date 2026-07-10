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

Use `npm run test:integration -- wayland` or `npm run test:integration -- x11` to select a KWin backend. The Wayland selection runs separate single-output and two-output sessions.

Without Nix, install Bash, Node.js and npm, KWin 6 for Wayland and X11, Xwayland, Xvfb, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, GNU `timeout`, and `jq`. Then run the same npm command.

The test uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Its single-output sessions verify three-window tiling, viewport reveal in both directions, exact geometry restoration, and package removal with native Wayland, Xwayland, and native X11 windows. A separate two-output Wayland session verifies independent native Wayland and Xwayland contexts, exact output-local geometry, rejection of a third overflow window on each output, and exact restoration.

This test does not cover Plasma panels, real GPUs, input, shortcuts, output hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. Plasma starts a Wayland session, enables Driftile, and opens three labeled test windows. The launcher verifies extension loading, both horizontal focus shortcuts, and left-to-right viewport scrolling. Use `Meta+Ctrl+H` and `Meta+Ctrl+L` for manual verification.

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The test account and password are both `driftile`. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
