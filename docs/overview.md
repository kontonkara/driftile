# Overview Companion

The optional overview companion is a separate KWin effect. It presents
Driftile's current output, desktop, column, stack, viewport, and floating-window
model. In 1.7.0, a left click on a valid thumbnail in the current desktop card
focuses that live window through KWin and closes the effect. Plasma's built-in
Overview remains installed and unchanged.

In 1.8.0-rc.1, a left click on a non-current desktop card's number gutter
selects that desktop. The current desktop's gutter remains inert.

The released 1.6.0 package remains presentation-only.

The companion is disabled by default and has no default shortcut or screen
edge. It requires the main Driftile KWin script because that script publishes
the authoritative layout snapshot.

## Install a release

Download `driftile-overview-1.8.0-rc.1.kwineffect` and `SHA256SUMS` from the
same release, then verify the archive:

```console
$ sha256sum --check --ignore-missing SHA256SUMS
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.8.0-rc.1.kwineffect
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

The 1.8.0-rc.1 flake exposes the effect separately as
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

Only thumbnails in a `SceneView` current-desktop card accept left clicks. The
effect revalidates the direct live window object, exact internal ID, output,
desktop and activity memberships, visibility, minimized and deleted state, and
input eligibility. A valid candidate retains or requests
`KWin.Workspace.activeWindow`; the effect closes only after KWin confirms focus.
An invalid or stale candidate performs no write, and rejected focus leaves the
effect open.

Desktop selection revalidates the active effect, exact live screen and output,
the desktop's direct object and ID, and its non-current state immediately before
the write. Wayland uses public `KWin.SceneView.currentDesktop`. If that property
is unavailable, `KWin.Workspace.currentDesktop` is permitted only with exactly
one live screen. The effect closes only after an exact read confirms the
selection; invalid, stale, raced, or rejected requests leave it open.

Ordinary KWin activation may raise the window, and Driftile's existing focus
handling may reveal its tiled column. Beyond a confirmed desktop request, the
effect does not switch activities, move windows, write memberships, outputs,
geometry, or settings, register a screen edge, assign a shortcut, or provide
drag, rearrangement, or keyboard navigation. It does not infer columns from
window geometry. Disabling or uninstalling it leaves the main extension and
Plasma's built-in Overview unchanged.

Packaged lifecycle checks cover native Wayland, XWayland, two-output Wayland,
and single-output native X11. The two-output Wayland scenario additionally
routes physical left clicks through the compositor for native Wayland and
XWayland passes. It verifies both current-card focus and per-output desktop
selection while preserving the other output, frames, memberships, settings,
persisted layout, and Plasma's built-in Overview. Native X11 retains lifecycle
and static fallback coverage; the harness does not claim an end-to-end X11
selection click.
