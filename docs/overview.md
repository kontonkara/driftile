# Overview Companion

Driftile Overview is an optional KWin effect that presents the current
activity's outputs, virtual desktops, columns, stacks, viewport, and floating
windows. It reads the layout published by the main Driftile script; it does not
maintain a second layout model. Plasma's built-in Overview remains available
and is never replaced or configured by the companion.

The companion provides:

- pointer and keyboard focus across current and non-current desktop cards;
- keyboard, wheel, and structured text search across window, desktop, output,
  application, and state fields;
- tab and minimized-window selection, restoration, and closure;
- guarded window transfer and desktop reordering;
- optional labels, application icons, state badges, close buttons, screen-edge
  activation, backdrop color, and touchpad access.

The effect is disabled by default and requires the main Driftile KWin script.
After enabling it under **System Settings > Window Management > Desktop
Effects**, a fresh shortcut record uses `Meta+O`. Existing KGlobalAccel
assignments are preserved across upgrades, including an explicitly unbound
action. The effect reserves no screen edge by default.

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

`F1` opens a compact keyboard reference inside the Overview. The panel adapts
to small scenes and scrolls when needed. While it is open, background window,
desktop, search, pointer, and wheel input stays inactive; `F1` or `Escape`
closes the panel first. A compact `Close` button provides the same action for
pointer users. The panel also summarizes the existing search fields and
operators. Closing and reopening the Overview resets the panel.

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

A standalone unquoted `|` separates up to four alternative groups. Terms remain
AND-connected inside each group, while a window matches when any complete group
matches. For example,
`app:firefox title:"release notes" -state:minimized | app:konsole "build log"`
finds either a non-minimized Firefox release-notes window or a Konsole window
containing the `build log` phrase. `desktop:"Web 2" output:HDMI | state:urgent
-app:telegram` combines desktop and output scopes in one alternative with an
urgent non-Telegram alternative.

A pipe inside a quoted phrase or attached to another token stays literal, as in
`title:"release | notes"` or `title:foo|bar`. Leading, trailing, consecutive, or
fifth alternative groups are invalid and use the existing invalid-query
feedback without exposing partial results. The entire query is capped at 128
Unicode code points, and its shared eight-clause and field limits apply across
all groups rather than separately to each group.

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

## Installation

Install the main package first, then install the overview from the same release.
The [installation guide](installation.md#optional-overview) provides the
verified KPackage commands for ordinary distributions and the matching upgrade
and removal steps.

NixOS and Home Manager keep the companion opt-in:

```nix
programs.driftile.overview.enable = true;
```

Home Manager can manage access and appearance independently of package
ownership. See
[Configuration](configuration.md#optional-overview-access-and-appearance) for
all nullable options. Neither Nix module enables the effect in KWin; enable it
in **Desktop Effects** after rebuilding. Do not install the same package ID
through both NixOS and Home Manager for one user.

## Safety boundary

The effect opens only from a stable current layout snapshot matching KWin's
live activity, outputs, desktops, and windows. Missing, changing, malformed,
future, or stale state keeps it closed.

Every focus, close, desktop-selection, reorder, and transfer action revalidates
its live target before writing through KWin's public API. Invalid or rejected
targets fail safely; a stale effect closes without taking layout ownership.
Late focus failure never rolls back an already confirmed desktop selection.

The main Driftile script remains the only layout owner. Disabling or
uninstalling the companion leaves the main extension and Plasma's built-in
Overview unchanged. See [Compatibility](compatibility.md) for backend limits
and [Architecture](architecture.md) for the full validation boundary.
