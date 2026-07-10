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
