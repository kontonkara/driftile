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
nix develop
npm ci
npm run test:integration
```

Without Nix, install Bash, Node.js and npm, KWin 6, Xwayland, KPackage and KConfig tools, D-Bus, `busctl` from systemd, GNU `timeout`, `xterm`, `xwininfo`, and `xprop`. Then run the same npm command.

The smoke test uses temporary user and XDG directories plus a private D-Bus session. It starts a headless virtual KWin, installs and enables Driftile there, tiles two Xwayland windows, disables Driftile, verifies exact geometry restoration, and removes the package. It does not connect to the current display or session bus.

This test does not cover a native KWin X11 session, native Wayland clients, Plasma panels, input, shortcuts, or output hot-plugging.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.
