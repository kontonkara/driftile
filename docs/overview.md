# Spatial Overview

Driftile Overview is an optional KWin effect that shows the layout published by
the main Driftile script as one spatial plane. It does not maintain another
layout model or take layout ownership. Plasma's built-in Overview remains
available and is not replaced or reconfigured.

The effect is disabled by default. After installing it, enable it under
**System Settings > Window Management > Desktop Effects**. A fresh shortcut
record uses `Meta+O`; existing KGlobalAccel assignments, including an explicitly
unbound action, are preserved during upgrades.

`driftile_open_overview` and `driftile_close_overview` are separate unbound
actions for automation. Opening an already active or pending Overview and
closing an inactive Overview are safe no-ops.

## Spatial plane

Each output gets its own output-local plane. Its virtual desktops are continuous
full-width rows stacked vertically, with the current desktop centered when the
effect opens. Neighboring rows remain spatially above and below it instead of
being presented as independent cards. Ordinary visual row rendering stays
within a bounded visible range. Search or an active drag may retain an
off-screen card temporarily for state continuity.

Each instantiated visible-range row shows KWin's public Desktop surface for its
exact output, virtual desktop, and current activity inside the projected output
area. The surface stays behind window thumbnails and every input layer. Missing
or inexact identity, or an unavailable surface, leaves a solid dark fallback
visible. Surface construction is asynchronous. Each load captures the exact
context generation, activity, desktop, screen, and output. Only the newest
matching surface may fade in over 90 ms after it becomes ready; losing that
exact context unloads it immediately. When late public membership makes the
same row exact again, it starts a new load without waiting for another topology
event, and a stale callback cannot clear a newer accepted surface.
Surface admission is independent from card admission, so a search- or
drag-retained off-screen card does not create a Desktop surface. KWin's Desktop
selection excludes panels, docks, and notifications.

Surface residency keeps the last exact bounded range through a transiently
invalid scene geometry. During panning, animated camera movement, zoom, and live
reflow, destination rows load before rows leaving the range are released when
their combined span stays bounded. A distant jump prioritizes its destination.
The range stays contiguous, contains at most 12 rows, and can pin the current
row only within that bound. Residency belongs to one session, output, activity,
and desktop topology and never changes layout or persistence.

If the desktop shell restarts while Overview is open, only resident rows
matching the public output, desktop, and activity identity discard the stale
surface immediately, expose the solid fallback, and reconnect when the
replacement Desktop window appears. One event-loop burst produces one bounded
refresh generation. An exact scoped refresh leaves unrelated resident rows
live. Incomplete or ambiguous public identity safely refreshes every resident
surface; nonresident off-screen surfaces remain untouched. Ordinary wallpaper
damage remains live without polling. Compact neutral backplates keep the
workspace number and optional name readable on arbitrary wallpapers, while a
subtle output-area outline identifies the current row without changing its
geometry.

Every row uses the normal layout solver for its usable work area, pixel grid,
gaps, horizontal camera, columns, and member frames. Captured rows preserve
those exact solved frames. The current row can replace a complete captured
column with guarded public live KWin geometry; an incomplete, stale, or
inconsistent live column fails closed and keeps its solved projection.

Stacked columns show every eligible member in its exact solved or live frame. A
multi-member tabbed column keeps its selected member at the exact full shared
frame and overlays a compact tab rail without shrinking the preview. Every real
member has a tab chip, including minimized members, when the complete rail fits
the visible column; an undersized rail fails closed instead of exposing partial
controls. Floating windows retain their output-local geometry. Eligible
minimized stacked and floating windows use compact placeholders in their
projected slots instead of thumbnails.

The horizontal camera is session-only. It initially matches the authoritative
layout viewport, follows a valid active tiled window, and can be detached by
manual horizontal input. Overview navigation never writes a viewport offset
back to Driftile. Horizontal offsets follow their desktop IDs through a
workspace reflow and are clamped only when the new row bounds require it.

The configured zoom is the starting scale for each fresh Overview session.
Interactive changes belong only to that session and are never written back to
configuration. Reopening while the close animation is still running resumes
the same session and its current zoom; opening after a completed close starts
again from the configured value.

## Motion and input

When the persisted layout is unchanged and the projection-relevant live
snapshot is equivalent, a later opening can reuse the last accepted projection
synchronously and show Overview immediately. The reuse still creates a fresh
session wrapper. A definite raw-document miss is rejected before the live
projection snapshot is built. After a newly validated projection is accepted,
the active scene becomes available before its guarded deep cache copy runs on a
later event-loop turn. A changed layout or live projection identity takes the
existing validation path of two matching reads 120 ms apart, while malformed
state fails closed and is never replaced with a stale projection.

Changing the current activity, the available activity set, or the output
topology and geometry refreshes an open Overview in place. The search query,
keyboard reference, settled session zoom, vertical viewport, and per-desktop
horizontal cameras remain in the same session. The refresh adopts the current
visual camera position and cancels transient window or column dragging,
workspace reordering and hover, wheel and boundary navigation, panning, and any
unfinished zoom preview. While the exact replacement model is pending, the old
plane remains visible but pointer input and action or navigation keys are
blocked. `Escape` and the registered global close or toggle action remain
available.

The replacement must still match the active session, prior model, refresh
attempt, and newest topology generation. It becomes visible before the barrier
is released; the projection then reflows without an extra transition, Desktop
surface residency restarts, and keyboard selection is repaired. A late or
otherwise stale callback cannot replace the model or release input, and the
activation cache is copied only afterward on a deferred event-loop turn.

Ordinary opening animates from the current full-size row into the spatial plane.
The projected canvas fades with presentation progress, so neither asynchronous
Desktop surfaces nor window thumbnails can expose a full-size intermediate
flash. The controller eases presentation progress once, and the scene consumes
that bounded progress directly. Interactive gestures continue to drive progress
and settle on completion. Closing uses the same motion in reverse while retaining
an opaque canvas until an exact desktop bridge has rendered twice. A manually
panned current row returns to its live camera during the close motion; reopening
during that motion reverses the same visible session from its current progress
without discarding the current session zoom.

Discrete vertical navigation moves a bounded camera smoothly between workspace
rows. Precise wheel or touchpad input moves the camera directly, without being
converted into delayed steps. Precise horizontal input similarly pans only the
row under the pointer. Holding `Shift` maps a conventional vertical wheel to
horizontal row movement. Vertical, native horizontal, and `Shift`-remapped
precise input all normalize KWin's system-inversion flag, so their physical
direction stays consistent when natural scrolling is enabled.

With an ordinary vertical wheel, scrolling down selects the next desktop and
scrolling up selects the previous desktop, without wrapping. The physical
direction remains the same when natural scrolling is enabled. Horizontal
discrete input selects and reveals the previous or next column. Rapid discrete
input is coalesced, while a direction reversal cancels pending movement in the
old direction.

Hold `Ctrl` while using a vertical wheel to zoom around the pointer. Physical
wheel up zooms in and physical wheel down zooms out, independently of the
system's natural-scrolling setting. Precise pixel input previews continuously;
discrete angle input advances in bounded steps. `Ctrl++` and `Ctrl+-` zoom
around the current workspace row, and `Ctrl+0` restores the configured scale
for this session.

When touchpad gesture support is enabled, the effect's configured `3`- to
`5`-finger count also controls KWin's pinch-to-zoom gesture on supported
backends. A two-finger touchscreen pinch uses public Qt Pointer Handlers. Both
preserve the workspace position under the gesture; keyboard and global
touchpad zoom preserve the centered current-row position. Horizontal row
offsets remain attached to desktop IDs and are clamped to their new finite
bounds after each scale change.

Zoom preview is transactional. Cancellation restores the exact scale and
camera position from the start of the gesture. A changed session, model,
output, workspace order, viewport size, or topology cancels stale input instead
of applying it to a new context. Zoom does not take input ownership during a
window drag, desktop reorder, viewport pan, close transition, topology refresh,
or open `F1` help panel. Search remains compatible with the zoom controls.

A passive percentage indicator appears while zoom is being changed or differs
from the configured starting scale. It accepts no input and adds no timer.

Adding, removing, or reordering desktops updates the visible workspace order
from KWin's public desktop-list signal before later pointer or gesture input is
accepted.

Dragging empty space pans the workspace plane vertically. Dragging empty space
inside a row pans that row horizontally within its finite bounds. Window and
desktop drags can continue navigation through the matching edge zones. A
right-button drag pans the row under the pointer horizontally, including when
the drag starts over a window thumbnail. No pan, wheel, gesture, or reveal
operation changes persisted layout state.

A one-finger touchscreen drag can begin across the visible Overview canvas,
outside controls and overlays, when the vertical camera or touched row has
range. Once movement has a clear dominant direction, that direction stays
latched for the gesture: vertical movement pans the workspace rows, while
horizontal movement pans only the touched row and only when that row has
horizontal range. Ambiguous diagonal movement changes neither camera. Short
taps retain window activation and desktop selection, while a long press on an
eligible thumbnail still takes ownership for window dragging. Stale or inexact
output or camera context cancels the gesture; horizontal panning also requires
the exact row and desktop context. Mouse, touchpad, and right-button behavior is
unchanged. The gesture uses only public Qt Pointer Handlers and adds no polling,
private API, layout write, or persistent state.

The optional touchpad activation gesture uses KWin's native Wayland API. It is a
safe no-op on native X11. Four fingers are used by default when the gesture is
enabled; choose a different count or disable a conflicting Plasma gesture so
one global direction has one owner.

## Window and workspace interaction

On opening, keyboard selection prefers the active actionable window, then the
first actionable window on the current desktop, then the first target in visual
order. Every workspace marker, including the current one, is an actionable
target. Arrow keys move spatially without wrapping. `Tab` and `Shift+Tab` cycle
visible targets; `Home` and `End` select the first or last target.

Once Overview has settled, a compact `Type to search · F1 help` control is
visible while neither search nor the keyboard reference is open. Hover signals
that it is clickable, and a click or touch opens the reference. The control
hides during opening, closing, search, and help; typing still starts search
directly.

`Enter` or `Return`, plus `Space` outside search, activates the selected live
window or workspace through guarded public KWin APIs. If the initial
asynchronous selection repair has not run, these keys first establish the same
preferred selection synchronously, then activate it exactly once through the
existing guarded path. `Delete` requests closure of a selected closeable window.
`Escape` clears a non-empty search first and otherwise closes the effect.

When a workspace marker is selected, `Insert` creates a retained empty
workspace in the exact eligible gap below it, `F2` opens its inline name editor,
and `Delete` requests removal instead of closing a window. The row controls
offer the same Rename and Remove actions, and a compact `+` appears in each
eligible gap between rows. The protected boundary rows cannot be renamed or
removed. Remove is available only when the desktop is globally empty and is not
selected on any output.

The inline editor accepts a bounded plain Unicode name. `Enter` or `Return`
submits it and `Escape` cancels it. While editing, search, navigation, panning,
zoom, reorder, and window or column dragging do not receive the typed input. A
changed session, model, activity, output, desktop topology, object, or prior
name cancels the stale edit without applying it.

Window activation captures an immutable handoff before any desktop, focus, or
minimized-state write. It includes the target identity, desktop, output, exact
Overview rectangle, target frame, and session cameras and zoom. The visible
scene then stays frozen while an exact public `KWin.WindowThumbnail` preloads in
the captured target output's render path at sub-visible opacity. In parallel, an
exact public Desktop surface for the target desktop, activity, and output is
staged for two rendered frames. If promotion arrives first, two bounded promoted
frames choose the thumbnail or monochrome shell once; stale window identity
chooses the desktop-only path. The committed window mode may only downgrade. The
Desktop surface expands from its row to the output and replaces the fading
spatial canvas only after it is ready and has reached exact full-output geometry.
Its immutable source is the projected Desktop surface, not the surrounding
workspace card. Until terminal coverage is complete, the canvas stays opaque.
The target thumbnail morphs from its Overview rectangle to the native frame
above that surface, so neither a uniform row rectangle nor a transparent
terminal frame is presented.

Input remains locked throughout the close. At terminal progress, either the
two-frame Desktop bridge or the retained spatial canvas still covers every
output. The frozen scene then retires only after every exact output has rendered
two matching frame callbacks for the same session, model, topology, and handoff.
Reopening clears that barrier and reverses the same visible session from its
current progress; any deferred model refresh resumes after the opening settles.
Identity drift or scene destruction rejects stale callbacks and fails closed.
This handoff adds no private API, geometry write, persistence, or auxiliary
timer.

Every represented eligible window contributes exactly one navigation target. A
selected non-minimized tabbed member uses its full preview, hidden tabbed
members use their tab chips when the complete rail fits, and a selected
minimized member uses its compact placeholder. Eligible minimized stacked and
floating windows similarly use placeholders. Off-screen targets in an
instantiated row remain navigable and are revealed when selected.

A short mouse, touchpad, or touchscreen tap on an empty row surface or its
number marker selects an exact non-current workspace. The same action on the
current workspace closes Overview without a desktop write. Moving beyond the
tap threshold yields to the existing pan or drag owner, and workspace-surface
taps stay disabled while search is active. A left click still activates a
visible window. A short touchscreen tap uses the same guarded activation path,
including desktop selection for an exact off-desktop window and restoration of
an actionable minimized placeholder. Holding an eligible thumbnail before
moving remains the touchscreen drag gesture; early movement cancels the tap,
and a long press never also activates the window. A touch over a visible close
region does not fall through to activation or drag. Dragging a visible window
can transfer it to another desktop or output after the source and destination
are revalidated. Holding the dragged window over another workspace activates
that workspace after a bounded dwell while keeping the drag active. A
scene-level proxy keeps the exact thumbnail under the pointer even while it
crosses clipped rows. On the same output, the central area of a populated
target column resolves to its nearest visible stack member, whose upper or
lower half selects the insertion side. Releasing at a column boundary keeps a
separate column, and an empty row accepts a new column. Bounded snap zones at
column seams and outer edges remain reachable even with a zero or tiny layout
gap. A small hysteresis margin holds the displayed target while the pointer
rests near a boundary.

The active target preview uses the same solved row geometry as the commit, so
its highlighted frames represent the resulting window positions and sizes
rather than only the hit zone. Release applies that cached preview and never
performs a second hit test. The command carries a digest of the exact source and
target layouts, work areas, output geometry and scale, relevant layout settings,
and desktop order. The main script recomputes that digest from current public
state before changing focus, desktop selection, topology, or layout. A changed
scene therefore cancels the drop without applying a different target or leaving
a partial mutation. The same exact targets work across outputs for tiled
windows; floating and non-exact sources retain Plasma's native output transfer.
A rejected exact placement restores the prior output, desktop, focus, and layout
state. Dragging the compact workspace number marker reorders eligible desktops.
The protected final empty desktop is never reordered or crossed.

An eligible tiled column exposes a compact top-center handle. Dragging it moves
the complete column under one single-color proxy rather than extracting the
selected window. Every affected visible member receives an exact preview.
Same-output column boundaries, empty rows, and workspace insertion gaps accept
the group while preserving member order, selection, stacked or tabbed
presentation, width, and per-member height state. Whole-column cross-output
placement remains unavailable and fails without changing the layout.

Dropping an eligible tiled window on the insertion line between two workspace
rows creates one virtual desktop at that exact position and moves the window
onto it. The operation works on the same output or across outputs, keeps the
Overview open after success, and removes the newly created desktop again if the
transfer is rejected while the captured state is still safe to restore.

Explicit workspace actions use a separate one-way command channel to the main
KWin script. Every command carries the current activity, output, complete
ordered desktop snapshot, monotonic request identity, and exact action
preconditions. The script consumes the document before applying it, rejects
expired or replayed requests, then independently revalidates the public KWin
objects. A manually created blank is retained instead of being reclaimed by
dynamic-workspace cleanup. Removal requires a second exact global occupancy and
selection check immediately before the public mutation.

Adding, removing, or reordering virtual desktops refreshes an active Overview
in place. Activity and output topology changes use a generation-bound in-place
refresh barrier, so uncertain targets never become actionable during
replacement.

## Search

Typing filters eligible projected windows with case-insensitive AND matching
across title, application identity, desktop name, output name, and live state.
The supported scopes are:

- `title:`
- `app:`
- `desktop:`
- `output:`
- `state:`

Double quotes match a phrase, a leading `-` excludes a clause, and a standalone
`|` separates up to four alternative groups. For example:

```text
app:firefox title:"release notes" | app:konsole "build log"
```

Malformed recognized syntax fails closed and exposes no partial result.
`Backspace` removes one Unicode code point, `Ctrl+Backspace` removes the
trailing structured clause, and `Ctrl+U` clears the query. The query is
session-only.

`F1` opens the compact keyboard reference. While it is open, background input
is inactive; `F1` or `Escape` closes the panel first. The discoverability
control and synchronous selection repair add no layout write, persistence, or
private API.

## Optional appearance

The spatial plane starts without decorative overlays. These settings are all
disabled by default and can be enabled independently:

- desktop names;
- output names;
- large-thumbnail label footers;
- application identity and icons;
- window close buttons;
- window state badges.

Invalid or non-boolean values fall back to disabled. Search fields remain
available when their visual labels are hidden. The `ShowWindowLabels` setting
controls only large-thumbnail footers; tab chips and minimized placeholders
always keep their compact bounded labels. When window close buttons are enabled, eligible
sufficiently large previews, tab chips, and minimized placeholders keep their
close controls visible for mouse, touchpad, and touchscreen input. The touch
target is modestly enlarged without changing layout. Releasing outside cancels;
an exact guarded close is consumed without activating or dragging the window.
Appearance options do not alter layout geometry or persistence, and the setting
remains disabled by default.

Backdrop color and the fresh-session zoom are configurable. Zoom accepts values
from `0.2` through `0.75` and defaults to `0.5`; interactive session changes do
not update it. The pointer screen edge defaults to `none`, so the effect
reserves no edge unless one is explicitly configured.

## Installation and configuration

Install the main package before the optional Overview package. The
[installation guide](installation.md#optional-overview) contains KPackage,
upgrade, and removal commands for ordinary distributions.

NixOS and Home Manager keep the effect opt-in:

```nix
programs.driftile.overview.enable = true;
```

Home Manager can manage access and appearance with nullable options. A `null`
value leaves the existing KConfig entry untouched. See
[Configuration](configuration.md#optional-overview-access-and-appearance).
Neither Nix module enables the effect inside KWin; enable it in **Desktop
Effects** after rebuilding. Do not install the same package ID through both
NixOS and Home Manager for one user.

## Safety boundary

The effect opens only from a stable layout snapshot matching KWin's current
activity, outputs, desktops, and windows. Missing, future, malformed, changing,
or stale state keeps it closed.

Every focus, close, desktop selection, reorder, and transfer revalidates its
live target before using a public KWin API. Invalid targets fail safely. An
inexact context replacement keeps the visible scene behind its input barrier,
and stale asynchronous callbacks cannot unlock it. The user can still close the
effect without taking layout ownership. Disabling or uninstalling the effect
leaves the main extension and Plasma's built-in Overview unchanged.

See [Compatibility](compatibility.md) for backend limits and
[Architecture](architecture.md) for the validation boundary.
