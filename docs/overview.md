# Overview Companion

The optional overview companion is a separate KWin effect. It presents
Driftile's current activity, output, desktop, column, stack, viewport, and
floating-window model. In 1.7.0, a left click on a valid thumbnail in the
current desktop card focuses that live window through KWin and closes the
effect. Plasma's built-in Overview remains the baseline: the companion never
opens over it, silently cancels a loading attempt if it becomes active, and
never activates, deactivates, or configures the Plasma effect.

In 1.8.0, a left click on a non-current desktop card's number gutter selects
that desktop. The current desktop's gutter remains inert.

In 1.9.0, a left click on a valid non-current thumbnail selects its desktop
and then focuses that exact window. Current-card focus remains direct.

Version 1.20.0 keeps one large selected thumbnail for a tabbed column and adds
a compact ordered strip for its live members. A left click on a different
valid tab uses the same guarded focus path. The main script remains the sole
owner of layout state and records the resulting selection.

Version 1.21.0 adds keyboard selection without changing the pointer paths or
layout ownership.

Version 1.22.0 adds guarded desktop-card reordering from the number gutter
without changing layout ownership.

Version 1.23.0 adds one read-only active-column layout badge to each desktop
card without adding input or layout behavior.

Version 1.24.0 adds one best-effort Plasma OSD after the current activation
attempt is rejected. The user-facing message is generic; the exact technical
reason remains in the KWin journal. A canceled attempt, stale callback,
successful activation, or normal close is silent.

Version 1.25.0 leaves overview behavior unchanged.

Version 1.26.0 leaves overview behavior unchanged.

Version 1.27.0 leaves overview behavior unchanged.

Version 1.28.0 leaves overview behavior unchanged.

Version 1.29.0 leaves overview behavior unchanged.

Version 1.30.0 leaves overview behavior unchanged.

Version 1.31.0 projects only the current activity. Changing the current
activity or available activity set closes an open companion before it can act
on stale delegates.

Version 1.32.0 adds an optional four-finger vertical touchpad gesture. An up
swipe opens the companion and a down swipe closes an active or pending
activation. The gesture can be disabled or changed to `3`–`5` fingers in the
effect settings.

Version 1.32.0 also lets a visible thumbnail or non-minimized tab be
dragged onto another desktop card on the same output. A successful drop moves
that one window and closes the companion; invalid or stale drops leave both the
window and companion unchanged.

Version 1.33.0 extends the same gesture to another output. The destination card
selects both the output and desktop; the existing same-output path is unchanged.

Version 1.44.0 adds optional pointer screen-edge activation, a
configurable backdrop color with opacity, and desktop selection from empty
content in a non-current card. Window, tab, gutter, reorder, and drop targets
retain their existing priority.

Version 1.45.0 leaves overview behavior unchanged.

Version 1.47.0 leaves overview behavior unchanged.

Version 1.48.0 leaves overview behavior unchanged.

Version 1.49.0 leaves overview behavior unchanged.

Version 1.52.0 leaves overview behavior unchanged.

Version 1.53.0 adds read-only attention cues and attention-aware search without
changing Overview input or layout ownership.

The companion is disabled by default. When enabled with a fresh shortcut
record, `Meta+O` toggles it. KGlobalAccel preserves an existing assignment
across upgrades, including an explicitly unbound action, so review it in
**System Settings > Keyboard > Shortcuts** after upgrading. The effect has no
screen edge by default and requires the main Driftile KWin script because that
script publishes the authoritative layout snapshot.

`driftile_open_overview` and `driftile_close_overview` are separate unbound
actions for one-way automation. Opening an active or pending overview and
closing an inactive overview are no-ops; `Meta+O` keeps its toggle behavior.

## Touchpad gesture

The overview effect registers one up/down touchpad pair while its gesture
setting is enabled. The default is four fingers: up opens the overview and down
closes an open or still-loading activation. Partial and cancelled gestures do
nothing, and changing the setting recreates the pair without restarting KWin.

The gesture uses KWin's native Wayland API and is a safe no-op on native X11.
Plasma's built-in Overview also uses four-finger vertical gestures. Disable
one overview gesture or choose a free count; vertical desktop navigation must
also use a different count so each global direction has one owner.

## Pointer screen edge and backdrop

The effect can reserve one pointer edge or corner through KWin's public screen
edge handler. `none` is the default and reserves nothing. Changing the setting
live releases the old edge before reserving the new one. Activation only opens
the effect; reaching the edge again cannot close an active or loading overview.

Backdrop color and opacity are configurable through the same effect settings.
Invalid external edge or color values fall back to no edge and the built-in
backdrop without changing layout state.

## Keyboard navigation

On opening, the overview selects the actionable target for the active window
when available. It falls back to the first actionable target on the current
desktop, then the first actionable target in visual order. Arrow keys move
spatially in the requested direction without wrapping.

`Enter`, `Return`, and `Space` run the selected target's existing guarded
public KWin window-focus or desktop-selection path. `Escape` closes the effect
without an action. In a tabbed column, the selected member is represented only
by its large thumbnail; each other actionable member is represented by its
tab. Minimized, invalid, and fully clipped items are excluded. A partially
clipped target remains actionable, and spatial navigation uses only its visible
intersection. The number gutter of every non-current live desktop, including
the shared empty tail, is also a target; the current desktop's gutter is not.
`Tab` and `Shift+Tab` cycle through targets in visual order, while `Home` and
`End` select the first or last target. Sequential navigation wraps and the
selected desktop gutter uses the same visible keyboard highlight as a window.
`Delete` requests closure of the selected live window. Desktop targets and
stale or non-closeable windows are no-ops; the overview stays open until KWin
actually removes the window, so an application prompt remains usable. A middle
click on a visible thumbnail or non-minimized tab uses the same guarded path.

Typing filters visible windows by title and application identity. Matching is
case-insensitive and every typed term must match. Arrow navigation immediately
repairs its selection within the filtered results; `Backspace` removes one
Unicode code point and `Escape` clears a non-empty query before it can close the
effect. Desktop-gutter targets stay hidden while a search query is active. The
query is session-only and is discarded when the effect closes. Its plain-text
feedback reports the unique matching-window count or `No matching windows`.

The special search terms `urgent` and `attention` match windows with a current
public KWin attention request. They combine with title and application terms
under the same every-term rule.

An unmodified vertical mouse wheel cycles the current actionable targets in
visual order. An active search limits the cycle to matching windows; otherwise
non-current desktop gutters also participate. High-resolution deltas accumulate
in a bounded remainder, and one event can advance only a bounded number of
steps. Wheel navigation changes only the selected highlight and performs no
KWin, layout, or persistent-state write.

The interaction adds no layout or persistent state, KConfig value, shortcut,
schema, or private API.

A left click on empty content in a non-current desktop card uses the same
guarded desktop-selection path as its number gutter. Visible thumbnails and
tabs, active search results, the current card, gutter reorder, and window drag
or close input remain separate.

## Attention cues

A public KWin attention request adds a static, non-animated accent to the
window's Overview thumbnail or tab. Its desktop card also shows a marker in the
number gutter, so attention remains visible when the window itself is outside
the current card.

The cues follow public KWin events and are read-only. They do not request focus,
change layout, add a setting or action, or write persistent state.

## Desktop reordering

Drag a desktop card vertically by its number gutter. Cards stay fixed while the
source is tinted and one line shows the valid insertion point. A click without a
drag keeps the existing desktop-selection behavior.

The final shared empty desktop is protected: it cannot be dragged, targeted, or
crossed. A no-op, out-of-bounds, canceled, stale, or concurrently invalidated
drag performs no write and leaves the effect open. A valid release rechecks the
complete desktop object and ID order, scene geometry, output, model, and current
desktop before calling KWin's public reorder method once. KWin's confirmed
desktop-change signal then closes the effect on every output.

The interaction adds no setting, shortcut, persistence field, private API,
window move, timer, or workspace window scan. Pointer updates are constant time;
validation scans only the bounded desktop and output lists at grab and release.

## Window transfer

Drag a selected thumbnail or a non-minimized tab onto another desktop card.
The final empty desktop is a valid target. A card on another output moves the
window to that output and desktop while preserving its activity. Same-card
drops, all-desktop windows, transients, modal windows, and ambiguous model
ownership are rejected.

Release revalidates the active effect, immutable overview model, output,
source and target desktop objects, current activity, and exact live window.
Same-output transfers assign the target through KWin's public desktop property.
Cross-output transfers use the public screen move first and then the desktop
membership when needed. The effect confirms both results; a partial result is
compensated only while the captured source state remains exact, otherwise the
stale overview closes without another write. Driftile's main script observes
the external move and remains the sole layout owner.

## Active-column layout badge

Each desktop card shows one compact badge over the visible part of its active
column. The badge reports `stacked` or `tabbed` followed by the logical width as
a percentage or logical pixels, for example `stacked · 50%` or
`tabbed · 720 px`.

The badge is read-only and does not capture pointer input. It is hidden when the
active column, presentation, width, or visible area cannot be validated, or
when the card is too small to show the complete label. Its lookup is constant
time and adds no window scan, setting, persistence field, animation, or KWin
write.

## Rejected activation feedback

The effect requests one passive Plasma OSD only after the current activation
attempt is rejected. The request is best-effort: missing OSD services do not
change effect behavior. The technical rejection reason is written only to the
KWin journal.

The added feedback handler is constant time. It adds no setting, shortcut,
input handler, KWin or layout write, persistence field, or scan beyond the
existing activation snapshot. Cancellation, a stale callback, successful
activation, and normal close remain silent.

## Install a release

Download `driftile-overview-1.52.0.kwineffect` and `SHA256SUMS` from the stable
[1.52.0 release](release-notes-1.52.0.md), then verify the archive:

```console
$ sha256sum --check --ignore-missing SHA256SUMS
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.52.0.kwineffect
```

To build the same versioned archive from source, run `npm ci` followed by
`npm run package`; the archive is written to `dist/`.

Enable **Driftile Overview** in **System Settings > Window Management > Desktop
Effects**. Change `Meta+O` in **System Settings > Keyboard > Shortcuts** if
another assignment is preferred. Use the effect's configure button to change
or disable its touchpad gesture.

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

The 1.52.0 flake exposes the effect separately as
`packages.<system>.driftile-overview`. The NixOS and Home Manager modules keep
it opt-in:

```nix
programs.driftile.overview.enable = true;
```

Home Manager can additionally manage access and appearance independently of
package ownership:

```nix
programs.driftile.overview.screenEdge = "top-left";
programs.driftile.overview.backdropColor = "#E60B0F17";
programs.driftile.overview.touchpadGesture = {
  enable = true;
  fingerCount = 4;
};
```

The main script and overview can be installed independently. For example, a
system-wide main package can be combined with a per-user overview. Do not
install the same package ID through both NixOS and Home Manager for one user.
Neither module enables the effect in KWin; enable it in Desktop Effects and
adjust its shortcut, screen edge, backdrop, or touchpad gesture only if needed.
The Home Manager-only nullable overview options can manage an effect installed
in another scope; `null` leaves their KConfig values untouched.

## Validation

Version 1.52.0 validates its gesture, same- and cross-output transfer, search,
keyboard, pointer, and close paths without giving the companion ownership of
layout state.

## Safety boundary

On activation, the effect accepts only two identical reads of a valid current
v2 catalog with canonical v4 logical state whose activity, outputs, desktops,
and referenced windows match KWin. It projects only the current activity. A
missing, changing, legacy, corrupt, future, oversized, or stale snapshot keeps
the effect closed.

Current-card thumbnail focus is unchanged: the effect revalidates the direct
live window object, exact internal ID, output, desktop and activity memberships,
visibility, minimized and deleted state, and input eligibility. It retains or
requests `KWin.Workspace.activeWindow` and closes only after confirmed focus.
An invalid, stale, or rejected request leaves the effect open.

Tab selection uses that same live-window path. Only the selected non-minimized
member has a large thumbnail. Every live member keeps one non-overlapping tab;
minimized members remain visible but disabled, and the selected tab remains
inert for pointer input. Keyboard navigation represents that member with its
thumbnail instead of a duplicate tab target.
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
geometry, or settings, or assign another shortcut. Its optional public screen
edge only requests activation and owns no layout state.
Desktop-card drag may change only the global desktop order through the guarded
public path above. Keyboard activation reuses the existing guarded paths. The
overview gesture adds no shortcut action, input grab, persistence field,
private API, second window model, timer, or KWin write. Ordinary pointer and
keyboard interaction still perform no window, stacking-order, or layout scan;
an empty-card click performs one bounded visible-delegate hit test before the
existing desktop action. The effect does not infer columns from window geometry
or add animation.
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
