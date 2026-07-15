# Overview Companion

The optional overview companion is a separate KWin effect. It presents
Driftile's current output, desktop, column, stack, viewport, and floating-window
model. In 1.7.0, a left click on a valid thumbnail in the current desktop card
focuses that live window through KWin and closes the effect. Plasma's built-in
Overview remains installed and unchanged.

In 1.8.0, a left click on a non-current desktop card's number gutter selects
that desktop. The current desktop's gutter remains inert.

In 1.9.0, a left click on a valid non-current thumbnail selects its desktop
and then focuses that exact window. Current-card focus remains direct.

The 1.20.0 development line keeps one large selected thumbnail for a tabbed
column and adds a compact ordered strip for its live members. A left click on a
different valid tab uses the same guarded focus path. The main script remains
the sole owner of layout state and records the resulting selection.

The companion is disabled by default. When enabled with a fresh shortcut
record, `Meta+O` toggles it. KGlobalAccel preserves an existing assignment
across upgrades, including an explicitly unbound action, so review it in
**System Settings > Keyboard > Shortcuts** after upgrading. The effect has no
screen edge and requires the main Driftile KWin script because that script
publishes the authoritative layout snapshot.

## Install a release

Download `driftile-overview-1.19.0.kwineffect` and `SHA256SUMS` from the stable
[1.19.0 release](release-notes-1.19.0.md), then verify the archive:

```console
$ sha256sum --check --ignore-missing SHA256SUMS
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.19.0.kwineffect
```

To build the same versioned archive from source, run `npm ci` followed by
`npm run package`; the archive is written to `dist/`.

Enable **Driftile Overview** in **System Settings > Window Management > Desktop
Effects**. Change `Meta+O` in **System Settings > Keyboard > Shortcuts** if
another assignment is preferred.

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

The 1.19.0 flake exposes the effect separately as
`packages.<system>.driftile-overview`. The NixOS and Home Manager modules keep
it opt-in:

```nix
programs.driftile.overview.enable = true;
```

The main script and overview can be installed independently. For example, a
system-wide main package can be combined with a per-user overview. Do not
install the same package ID through both NixOS and Home Manager for one user.
Neither module enables the effect in KWin; enable it in Desktop Effects and
adjust its shortcut only if needed.

## Safety boundary

On activation, the effect accepts only two identical reads of a valid current
v2 catalog with canonical logical state whose outputs, desktops, and referenced
windows match KWin. A missing, changing, legacy, corrupt, future, oversized, or
stale snapshot keeps the effect closed.

Current-card thumbnail focus is unchanged: the effect revalidates the direct
live window object, exact internal ID, output, desktop and activity memberships,
visibility, minimized and deleted state, and input eligibility. It retains or
requests `KWin.Workspace.activeWindow` and closes only after confirmed focus.
An invalid, stale, or rejected request leaves the effect open.

Tab selection uses that same live-window path. Only the selected non-minimized
member has a large thumbnail. Every live member keeps one non-overlapping tab;
minimized members remain visible but disabled, and the selected tab is inert.
Deleted, minimized, explicitly hidden, stale, or non-input targets are rejected
without a layout or settings write.

A non-current thumbnail first revalidates the exact active effect, model, live
screen, projected output, direct desktop object and ID, direct window object and
ID, current activity, memberships, state, and input eligibility. The window may
still be hidden because its desktop is not selected. The effect then uses the
existing desktop-selection path and requires exact confirmation before
revalidating the same candidate, now including visible state, requesting the
exact active window, and confirming focus.

Desktop selection revalidates the active effect, exact live screen and output,
the desktop's direct object and ID, and its non-current state immediately before
the write. Wayland uses public `KWin.SceneView.currentDesktop`. If that property
is unavailable, `KWin.Workspace.currentDesktop` is permitted only with exactly
one live screen. The effect closes only after an exact read confirms the
selection; invalid, stale, raced, or rejected requests leave it open.

Any rejection before desktop selection leaves the effect open. Once selection
is confirmed, a late invalidation or focus failure keeps the selected desktop,
closes the stale effect, and performs no rollback.

Ordinary KWin activation may raise the window, and Driftile's existing focus
handling may reveal its tiled column. Beyond a confirmed desktop request, the
effect does not switch activities, move windows, write memberships, outputs,
geometry, or settings, register a screen edge, assign a shortcut, or provide
drag, rearrangement, or keyboard navigation. The interaction adds no action,
binding, setting, schema, private API, second window model, or timer and
performs no window, stacking-order, or layout scan. It does not infer columns
from window geometry or add animation or settings UI.
Disabling or uninstalling it leaves the main extension and Plasma's built-in
Overview unchanged.

Packaged lifecycle checks cover native Wayland, XWayland, two-output Wayland,
and single-output native X11. The two-output Wayland scenario additionally
routes physical left clicks through the compositor for native Wayland and
XWayland passes. It verifies current-card focus, per-output desktop selection,
and cross-desktop thumbnail activation against an exact target plus a
last-active decoy while preserving the other output, frames, memberships,
settings, persisted layout, and Plasma's built-in Overview. Native X11 retains
lifecycle and static fallback coverage; the harness does not claim an
end-to-end X11 selection or cross-desktop activation click.
