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

Version 1.54.0 lets minimized members of tabbed columns participate in pointer,
keyboard, close, and search paths through their existing tabs. Activating one
restores its exact public KWin minimized state before focusing it. Stacked and
floating minimized windows remain outside this slice.

Version 1.55.0 gives eligible minimized stacked tiled members and tracked
floating windows without a tab one compact caption placeholder.
Each placeholder stays inside the visible intersection of its projected slot or
frame, retains its attention cue, and joins the existing pointer, keyboard,
close, and search paths. Existing minimized tab behavior is unchanged.

Version 1.56.0 adds a static plain-text footer to an ordinary large thumbnail.
The window caption is primary; its exact application identity is used as a
fallback or as a distinct secondary line. Tabs and minimized placeholders use
the same bounded caption and application-identity normalization. Small frames
keep their existing presentation without a footer.

Version 1.57.0 adds live presentation controls for the ordinary thumbnail
footer and application identity. Both preserve the 1.56.0 presentation by
default and change no window target or search result.

Version 1.58.0 adds an optional close button to eligible thumbnails, tabs, and
minimized placeholders. The button is shown only on hover or keyboard
selection and reuses the existing exact close path.

Version 1.59.0 adds static window-state badges to sufficiently large selected
ordinary thumbnails. State terms also join the existing all-term search.

Version 1.60.0 adds bounded desktop names to sufficiently large cards and makes
each owning desktop name available to window search.

Version 1.61.0 adds optional application icons to
eligible window labels without changing their actions or search behavior.

Version 1.62.0 identifies sufficiently large
multi-output scenes and makes each owning output name available to search.

Version 1.63.0 adds exact per-desktop search counts and selected-result
position feedback without changing Overview input or layout ownership.

Version 1.64.0 adds quoted phrases, exclusions, and field scopes to window
search. Invalid structured queries fail closed and are reported in the
Overview instead of being interpreted partially.

Version 1.65.0 adds session-local shortcuts for editing the active Overview
search without adding a global binding or setting.

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

`Enter`, `Return`, and `Space` run the selected target's guarded public KWin
window-focus or desktop-selection path. Activating a minimized member tab or
placeholder first restores that exact window and then focuses it. `Escape`
closes the effect without an action. In a tabbed column, the selected ordinary
member is represented only by its large thumbnail and its duplicate tab remains
inert; each other actionable member is represented by its tab. Exact minimized
member tabs retain that behavior. An eligible minimized stacked tiled member or
tracked floating window without a tab is represented by one compact caption
placeholder. Invalid, ineligible, malformed, tiny, fully clipped, and offscreen
projections are excluded. A partially clipped target remains actionable, and
spatial navigation uses only its visible intersection. The number gutter of
every non-current live desktop, including the shared empty tail, is also a
target; the current desktop's gutter is not.
`Tab` and `Shift+Tab` cycle through targets in visual order, while `Home` and
`End` select the first or last target. Sequential navigation wraps and the
selected desktop gutter uses the same visible keyboard highlight as a window.
`Delete` requests closure of the selected live window, including an exact
closeable minimized tab or placeholder. Desktop targets and stale or
non-closeable windows are no-ops; the overview stays open until KWin actually
removes the window, so an application prompt remains usable. A middle click on
a visible thumbnail, closeable tab, or closeable placeholder uses the same
guarded path without restoring a minimized window.

Typing filters visible windows with a case-insensitive query. Whitespace-
separated terms use AND matching across the window title, application identity,
desktop name, output name, and state. Double quotes require a contiguous phrase
within one searchable field, and a leading `-` excludes windows that match the
following term or phrase.

Five field scopes narrow a term to one source:

- `title:` matches the window title.
- `app:` matches the application identity.
- `desktop:` matches the owning desktop name.
- `output:` matches the owning output name.
- `state:` matches current state terms such as `minimized`, `urgent`, or
  `fullscreen`.

For example, `app:firefox project` requires a Firefox window with `project` in
any searchable field. `title:"build log" -state:minimized` requires that title
phrase and excludes minimized windows. `desktop:"Web 2" output:HDMI` searches
one named desktop on a matching output. Scopes and matching are
case-insensitive.

Unknown prefixes remain ordinary search text. A malformed recognized scope or
quoted phrase, such as `title:` or `app:"firefox`, matches no windows and the
Overview reports an invalid query instead of applying a partial filter.

Arrow navigation immediately repairs its selection within the filtered
results. `Backspace` removes one Unicode code point, while `Ctrl+Backspace`
removes the complete trailing structured clause: a bare, scoped, excluded, or
quoted clause. It also removes an unfinished trailing quoted clause, making an
invalid query editable again without closing the Overview. `Ctrl+U` clears a
non-empty query. `Escape` keeps its existing two-step behavior: it clears a
non-empty query before it can close the effect. Desktop-gutter targets stay
hidden while a search query is active. The query is session-only and is
discarded when the effect closes. `Ctrl+Backspace` and `Ctrl+U` act only while
the Overview is open and add no global binding or setting.

One bounded pass over the current navigation targets supplies the unique global
window total, the exact count for each desktop, and one visual-order ordinal for
each unique window. A window projected on several desktops keeps the same
ordinal on every target and contributes once to the global total and once to
each owning desktop. When an exact window target is selected, the plain-text
feedback reports its ordinal and the total; otherwise it falls back to the total
or `No matching windows`.

During a non-whitespace search, a desktop with matches shows its count in the
number gutter and a zero-result desktop is statically deemphasized. Cards are
never hidden or reflowed, and the presentation adds no input target. A
whitespace-only query retains the previous global feedback semantics without
per-desktop badges or deemphasis.

The state terms `urgent` and `attention` match windows with a current public
KWin attention request. `minimized` matches an exact minimized member tab or
placeholder. They work as ordinary terms or through `state:` and combine with
the rest of the query under the same AND rule.

An unmodified vertical mouse wheel cycles the current actionable targets in
visual order. An active search limits the cycle to matching windows; otherwise
non-current desktop gutters also participate. High-resolution deltas accumulate
in a bounded remainder, and one event can advance only a bounded number of
steps. Wheel navigation changes only the selected highlight and performs no
KWin, layout, or persistent-state write.

The interaction adds no timer, animation, KWin request, layout or persistent
state, KConfig value, shortcut, schema, or private API.

A left click on empty content in a non-current desktop card uses the same
guarded desktop-selection path as its number gutter. Visible thumbnails and
tabs, active search results, the current card, gutter reorder, and window drag
or close input remain separate.

## Attention cues

A public KWin attention request adds a static, non-animated accent to the
window's Overview thumbnail, tab, or minimized placeholder. Its desktop card
also shows a marker in the number gutter, so attention remains visible when the
window itself is outside the current card.

The cues follow public KWin events and are read-only. They do not request focus,
change layout, add a setting or action, or write persistent state.

## Desktop names

A sufficiently large desktop card can show its normalized virtual-desktop name
beside the fixed number gutter. The name is plain text, bounded, whitespace
normalized, and elided when needed. Small or narrow cards keep the existing
compact numbered gutter and content area.

Window search includes the owning desktop name for every projected window.
Turning the label off hides only its presentation; desktop-name search remains
available and composes with the existing all-term search fields.

`ShowDesktopNames` is enabled by default and updates live. A malformed or
non-boolean KConfig value falls back to enabled. Home Manager can manage it
with nullable `programs.driftile.overview.showDesktopNames`; `null` leaves the
existing KConfig value untouched. The NixOS option surface is unchanged.

The label reads the public virtual-desktop name and adds no pointer or keyboard
input, timer, animation, action, desktop selection, layout or persistence write.

## Output names

Each sufficiently large multi-output scene can show one bounded output name in
its top-right corner. The passive label is hidden on small scenes and while the
search overlay is active. Single-output scenes retain their existing layout.

Window search includes the owning output name independently of label
visibility and composes it with caption, application, desktop, attention,
minimized, and state terms. The normalized name is computed once per scene only
when presentation or search needs it.

`ShowOutputNames` is enabled by default and updates live. A malformed or
non-boolean KConfig value falls back to enabled. Home Manager can manage it
with nullable `programs.driftile.overview.showOutputNames`; `null` leaves the
existing KConfig value untouched. The NixOS option surface is unchanged.

The label reads only the public output name and adds no pointer or keyboard
input, timer, animation, action, focus, layout or persistence write.

## Window labels

An ordinary large thumbnail can show a static bounded footer. Its normalized
caption is the primary line. The exact captured application identity becomes
the primary fallback when the caption is empty and a secondary line when it is
both present and distinct. Tabs and minimized placeholders derive their text
from the same normalized caption and identity fields.

Control characters and repeated whitespace are removed before display, and QML
elides text that does not fit. A small thumbnail hides the complete footer;
malformed, empty, or inaccessible identity fields fail closed. Labels are
plain text and add no pointer target, input path, animation, timer, action,
binding, layout or persistence write, or private API.

The effect settings can hide ordinary thumbnail footers while retaining the
labels needed by tabs and minimized placeholders. Application identity can be
disabled independently; captions remain normalized, and a missing caption then
uses the existing tab or placeholder fallback. Both settings update live and
do not alter search matching.

## Application icons

Sufficiently large ordinary label footers, tabs, and minimized placeholders
can show the owning application's public KWin window icon. Icons are loaded
lazily and rendered through Kirigami only after the complete surface is
eligible. A missing or inaccessible icon leaves the existing text alignment in
place.

`ShowApplicationIcons` is enabled by default and updates live. A malformed or
non-boolean KConfig value falls back to enabled. Home Manager can manage it
with nullable `programs.driftile.overview.showApplicationIcons`; `null` leaves
the existing KConfig value untouched. The NixOS option surface is unchanged.

Disabling icons, or projecting an ineligible surface, prevents the Loader
payload and its Kirigami icon from being instantiated and prevents an icon
read. Icons add no input, focus, search, timer, animation, layout or persistence
behavior.

## Window close buttons

An eligible closeable window preview can show one compact close button when it
is hovered or selected from the keyboard. Small surfaces hide the complete
button rather than clipping it. Attention cues and label text reserve their own
space while the button is visible.

A left click requests closure through the same exact live-window validation as
`Delete` and middle click. It does not focus, activate, restore, or begin a drag
on the window first; a minimized window therefore stays minimized while its
close request is delivered. The button holds the pointer press exclusively, and
the parent preview independently rejects a tap inside its bounds.

The effect setting enables close buttons by default and updates live. Home
Manager can manage the same value with
`programs.driftile.overview.showWindowCloseButtons`; `null` leaves KConfig
untouched. Buttons add no action, binding, timer, animation, layout or
persistence write, private API, or KWin fork.

## Window state badges

A sufficiently large selected ordinary thumbnail shows one static badge when
its live normal window is fullscreen, fully maximized on both axes, or tracked
as floating. The badge reads `Fullscreen`, `Maximized`, or `Floating` in
that precedence order. A partial horizontal or vertical maximize state does
not produce a `Maximized` badge; an independent floating state can still
produce `Floating`. Tabs and minimized placeholders never show a badge.

Search includes every true lowercase state term, so combined queries such as
`fullscreen floating` remain exact even though only the highest-priority badge
is visible. Hiding badges does not remove state terms from search.

`ShowWindowStateBadges` is enabled by default and updates live. A malformed or
non-boolean value falls back to enabled. Home Manager can manage it with the
nullable `programs.driftile.overview.showWindowStateBadges`; `null` leaves the
existing KConfig value untouched. Badges are read-only and add no input,
animation, timer, action, layout or persistence write.

## Minimized placeholders

A minimized stacked tiled member uses the visible intersection of its projected
slot, while a tracked floating window without a tab uses the visible
intersection of its projected frame. Each eligible window gets at most one
compact caption placeholder. A current attention request remains visible on
that placeholder.

A left click, `Enter`, `Return`, or `Space` restores the exact window and then
focuses it through the existing guarded public KWin path. `Delete` and middle
click use the existing guarded close path without restoring it. Placeholders
participate in title, application, attention, and `minimized` search, but cannot
start or receive minimized drag and drop.

The projection is read-only. Malformed, tiny, fully clipped, or offscreen frames
produce no placeholder and no action. The interaction adds no geometry, layout,
setting, persistence, action, binding, or private API write.

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
ownership are rejected. Minimized tabs and placeholders remain visible but
cannot start a drag or otherwise participate in drag and drop.

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

Download `driftile-overview-1.64.0.kwineffect` and `SHA256SUMS` from the stable
[1.64.0 release](https://github.com/kontonkara/driftile/releases/tag/v1.64.0),
then verify the archive:

```console
$ sha256sum --check --ignore-missing SHA256SUMS
```

Install the overview package as the desktop user:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.64.0.kwineffect
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

The 1.64.0 flake exposes the effect separately as
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
programs.driftile.overview.showWindowLabels = true;
programs.driftile.overview.showApplicationIdentity = true;
programs.driftile.overview.showWindowCloseButtons = true;
programs.driftile.overview.showWindowStateBadges = true;
programs.driftile.overview.touchpadGesture = {
  enable = true;
  fingerCount = 4;
};
```

The module also accepts:

```nix
programs.driftile.overview.showDesktopNames = true;
programs.driftile.overview.showApplicationIcons = true;
programs.driftile.overview.showOutputNames = true;
```

The main script and overview can be installed independently. For example, a
system-wide main package can be combined with a per-user overview. Do not
install the same package ID through both NixOS and Home Manager for one user.
Neither module enables the effect in KWin; enable it in Desktop Effects and
adjust its shortcut, screen edge, backdrop, or touchpad gesture only if needed.
The Home Manager-only nullable overview options can manage an effect installed
in another scope; `null` leaves their KConfig values untouched. Desktop-name,
application-icon, and output-name presentation do not add corresponding NixOS
options.

## Validation

Version 1.55.0 validates its gesture, same- and cross-output transfer, search,
keyboard, pointer, and close paths without giving the companion ownership of
layout state.

Version 1.54.0 adds focused restore-and-focus, close, keyboard, pointer, and
search coverage for minimized member tabs without changing layout ownership.

Version 1.55.0 extends those guarded paths to eligible minimized stacked tiled
and tracked floating placeholders without adding drag or layout ownership.

Version 1.56.0 adds focused normalization and QML contract coverage for static
thumbnail, tab, and minimized-placeholder labels without changing their input
or layout behavior.

Version 1.57.0 adds focused KConfig, QML, normalization, NixOS-surface, and Home
Manager coverage for live label presentation preferences without changing
window targets or search behavior.

Version 1.58.0 adds focused pointer-arbitration, close-path, package-content,
KConfig, NixOS-surface, and Home Manager coverage for close buttons without
changing the existing `Delete` or middle-click paths.

Version 1.60.0 adds focused normalization, adaptive-gutter, search, KConfig,
NixOS-surface, and Home Manager coverage for desktop names without changing
window targets or layout ownership.

Version 1.61.0 adds focused lazy-loading, public icon access, KConfig,
NixOS-surface, and Home Manager coverage for application icons without changing
window targets, input, or layout ownership.

Version 1.62.0 adds focused normalization, adaptive multi-output presentation,
search, KConfig, NixOS-surface, and Home Manager coverage for output names
without changing window targets or layout ownership.

## Safety boundary

On activation, the effect accepts only two identical reads of a valid current
v2 catalog with canonical v4 logical state whose activity, outputs, desktops,
and referenced windows match KWin. It projects only the current activity. A
missing, changing, legacy, corrupt, future, oversized, or stale snapshot keeps
the effect closed.

Desktop names are a bounded read-only projection of each direct public desktop
object. Missing, malformed, empty, hostile, or inaccessible names fail closed
without changing selection, geometry, focus, input, layout, or persistence.

Application icons are a lazy read-only presentation of each direct public
window icon. Missing or inaccessible icons fail closed, while disabled and
ineligible surfaces do not instantiate the Kirigami icon or read the KWin
property.

Output names are a bounded read-only projection of each scene's public output.
Missing, malformed, hostile, single-output, or geometry-constrained
presentation fails closed without changing focus, input, layout, or persistence.

Current-card thumbnail focus is unchanged: the effect revalidates the direct
live window object, exact internal ID, output, desktop and activity memberships,
visibility, minimized and deleted state, and input eligibility. It retains or
requests `KWin.Workspace.activeWindow` and closes only after confirmed focus.
An invalid, stale, or rejected request leaves the effect open.

Tab selection uses that same live-window path. Only the selected non-minimized
member has a large thumbnail. Every live member keeps one non-overlapping tab,
and the selected ordinary tab remains inert while keyboard navigation uses its
thumbnail instead of a duplicate target.

An eligible minimized member tab captures the exact public KWin window, output,
desktop, activity, input, managed, and minimized state.
Activation revalidates that snapshot, writes only the public minimized state,
confirms restoration, and then focuses the same exact window. The effect closes
only after focus is confirmed. `Delete` and middle click instead revalidate the
exact closeable window and request its public close path without restoring it.
Existing minimized member tabs retain this behavior unchanged.

An eligible minimized placeholder additionally requires an exact tracked
stacked tiled member or tracked floating window without a tab. Its caption is
clipped to the visible intersection of the validated projected slot or frame;
malformed, tiny, fully clipped, or offscreen projections fail closed. Activation
and closure reuse the same exact restore, focus, and close paths as minimized
tabs. Minimized drag and drop, deleted or stale windows, and ineligible targets
remain outside both paths. The interaction retains public attention cues and
adds no geometry, layout, setting, action, binding, persistence field, or
private API write.

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
