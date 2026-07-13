# Overview Companion

The optional overview companion is a separate, read-only KWin effect. It shows
Driftile's current output, desktop, column, stack, viewport, and floating-window
model without changing it. Plasma's built-in Overview remains installed and
unchanged.

The companion is disabled by default and has no default shortcut or screen
edge. It requires the main Driftile KWin script because that script publishes
the authoritative layout snapshot.

## Install from source

Build the versioned packages:

```bash
npm ci
npm run package
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./dist/driftile-overview-1.3.0-dev.0.kwineffect
```

Enable **Driftile Overview** in **System Settings > Window Management > Desktop
Effects**. Assign its toggle action in **System Settings > Keyboard >
Shortcuts** if wanted. The action is deliberately unbound.

Disable the effect before upgrading or removing it. Remove the package with:

```bash
kpackagetool6 --type=KWin/Effect \
  --remove io.github.kontonkara.driftile.overview
```

## Safety boundary

On activation, the effect accepts only two identical reads of a valid current
layout snapshot whose outputs, desktops, and referenced windows match KWin. A
missing, changing, legacy, corrupt, future, oversized, or stale snapshot keeps
the effect closed.

The companion does not write settings, focus or move windows, switch desktops,
change geometry, register a screen edge, or assign a shortcut. It does not
infer columns from window geometry. Disabling or uninstalling it leaves the
main extension and Plasma's built-in Overview unchanged.
