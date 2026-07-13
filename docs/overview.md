# Overview Companion

The optional overview companion is a separate, read-only KWin effect. It shows
Driftile's current output, desktop, column, stack, viewport, and floating-window
model without changing it. Plasma's built-in Overview remains installed and
unchanged.

The companion is disabled by default and has no default shortcut or screen
edge. It requires the main Driftile KWin script because that script publishes
the authoritative layout snapshot.

## Install a release

Download `driftile-overview-1.5.0.kwineffect` and `SHA256SUMS` from the same
release, then verify the archive:

```console
$ sha256sum --check --ignore-missing SHA256SUMS
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.5.0.kwineffect
```

To build the same versioned archive from source, run `npm ci` followed by
`npm run package`; the archive is written to `dist/`.

Enable **Driftile Overview** in **System Settings > Window Management > Desktop
Effects**. Assign its toggle action in **System Settings > Keyboard >
Shortcuts** if wanted. The action is deliberately unbound.

Disable the effect before upgrading or removing it. Remove the package with:

```bash
kpackagetool6 --type=KWin/Effect \
  --remove io.github.kontonkara.driftile.overview
```

KGlobalAccel preserves shortcut metadata and later manual assignments across
effect unloads. The retained action is inert while the effect is unloaded. If
the assignment should also be removed, clear it in System Settings before
uninstalling the package.

## NixOS and Home Manager

The 1.5.0 flake exposes the effect separately as
`packages.<system>.driftile-overview`. The NixOS and Home Manager modules keep
it opt-in:

```nix
programs.driftile.overview.enable = true;
```

The main script and overview can be installed independently. For example, a
system-wide main package can be combined with a per-user overview. Do not
install the same package ID through both NixOS and Home Manager for one user.
Neither module enables the effect in KWin; enable it in Desktop Effects and
assign its shortcut explicitly.

## Safety boundary

On activation, the effect accepts only two identical reads of a valid current
layout snapshot whose outputs, desktops, and referenced windows match KWin. A
missing, changing, legacy, corrupt, future, oversized, or stale snapshot keeps
the effect closed.

The companion does not write settings, focus or move windows, switch desktops,
change geometry, register a screen edge, or assign a shortcut. It does not
infer columns from window geometry. Disabling or uninstalling it leaves the
main extension and Plasma's built-in Overview unchanged.

Packaged lifecycle checks cover native Wayland, XWayland, two-output Wayland,
and single-output native X11. They require exact layout bytes, window frames,
focus, desktop state, and built-in Overview state before and after activation.
