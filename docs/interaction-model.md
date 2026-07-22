# Interaction Model

Driftile arranges eligible application windows in a horizontal strip of
columns. Each output, virtual desktop, and activity has its own layout context.
KWin remains responsible for composition, focus, native window states, outputs,
and virtual desktops.

The default shortcuts follow one grammar and do not wrap at layout boundaries:

- `Meta` plus a direction focuses a column or window.
- Adding `Ctrl` moves the focused column or window.
- Adding `Shift` to an output direction targets another output.
- `Home` and `End` focus the first or last column; adding `Ctrl` moves the
  active column there.
- `U` and `I` select the next or previous desktop; `Page Down` and `Page Up`
  are aliases.
- `1` through `9` select a desktop directly; adding `Ctrl` moves the active
  column there.

See [Shortcuts](shortcuts.md) for the complete default profile and additional
unbound actions.

## Columns and windows

A new tiled window normally starts in its own column. The default width is 33%
of the usable work area; global and per-application settings can choose another
proportional or fixed width, and an opt-in policy can adopt the initial window
frame width. Every member of a column shares that column width. Joining an
existing column adopts the target column's width and presentation.

Columns have two presentations:

- **Stacked** columns divide their height among visible members. Vertical focus
  selects a member, vertical movement reorders it, and height commands adjust
  one member's policy.
- **Tabbed** columns give every non-minimized member the same frame and show the
  selected member. Vertical focus selects a tab, vertical movement reorders it,
  and height commands are inactive until the column returns to stacked mode.

`Meta+W` toggles the active column between stacked and tabbed. Consuming a
window joins it to an adjacent column; expelling or splitting a member creates
a separate column. Whole-column moves preserve width, presentation, selection,
member order, and height policies.

Horizontal focus reveals the destination with the smallest required camera
movement. Optional centering policies can center every selected column, center
only overflowing destinations, or keep a single tiled column centered. The
full-width action changes the active column's layout width; native maximize and
fullscreen remain separate KWin states.

Minimized tiled windows retain their logical slots, while directional focus
skips them without wrapping. Minimized manually floating windows retain their
remembered frames. When the active window closes, Driftile prefers the latest
eligible previously active window in the same visible output, desktop, and
activity; a legitimate focus choice made by KWin or the user is not overridden.

Dialogs, modal or transient windows, fixed-size windows, shell surfaces,
all-desktop windows, and configured application exclusions remain outside
tiling ownership. Windows assigned to several activities are also left to KWin.

## Workspaces and outputs

Adjacent desktop navigation stops at the first and last selectable desktop.
Direct desktop actions can be mapped to exact desktop names. An optional
back-and-forth setting makes a repeated direct selection return to the last
used desktop on that output.

Driftile keeps one shared trailing empty desktop at the end of KWin's desktop
list. Moving a column or window into it turns it into a regular desktop and
creates a new empty tail. An optional leading empty desktop works the same way.
Desktop reordering never moves or crosses either protected boundary.

As that dynamic list changes, Driftile keeps KWin's public virtual-desktop grid
in one column. Plasma's normal desktop-switching effect therefore follows the
same vertical workspace order instead of moving newly added desktops
horizontally.

Default desktop and output transfer shortcuts move the complete active tiled
column. With an eligible floating window active, the same shortcuts move only
that window. Separate unbound actions are available for single-window transfers
and for sending a window or column to another desktop without following it.

Output-local desktop selections are used when KWin exposes them. On backends
with a global desktop selection, every output follows the same selected
desktop. Output movement uses KWin's public output topology; unavailable or
ambiguous destinations are no-ops.

Immediately after a desktop handoff, a short burst of horizontal focus input is
replayed in order once the destination context becomes active. A newer desktop,
activity, output topology, or window-context change discards stale input instead
of redirecting it to another context.

When the optional transition effect is enabled, deferred window geometry motion
resumes after the desktop effect releases presentation. If KWin still reports
the outgoing window as active or current at release, the handoff revalidates
that exact anchor when the later desktop-context signal arrives. The exact
incoming replay remains a handoff candidate only while its animation is active.
Its late activation advances that handoff once, allowing one immediate
geometry-before-activation focus change to retain its baseline. The successor
activation consumes the handoff, so duplicate signals or unrelated later hidden
geometry cannot recreate it. Animation end, visibility-context or
transition-eligibility loss, deletion, configuration reload, or another
fullscreen effect otherwise discards the one-shot continuation.

## Floating windows and native states

`Meta+V` toggles an eligible normal window between tiled and manually floating.
Driftile remembers the floating frame and a tiled reinsertion anchor. Returning
to tiling is explicit through `Meta+V` or the direct tiling action. It restores
a valid anchor when possible and otherwise inserts a new column through the
normal admission path.

Tiled and floating windows form separate focus layers. `Meta+Shift+V` switches
between them. Directional movement nudges a manually floating window; width,
height, preset, reset, and center actions operate on its frame when applicable.
The frame remains constrained enough to stay reachable. KWin owns the final
frame after an output transfer.

Automatically floating popups, utilities, transient windows, and configured
tiling exclusions are not manually floating windows. They stay under KWin
ownership and do not enter tiled or manual-floating commands.

Once a window is confirmed as picture-in-picture, that automatic-floating
ownership lasts for the lifetime of the window. Temporary role changes during
an interactive drag do not admit it into the tiled layout; Driftile leaves its
frame under KWin ownership. If the exact role arrives only after the user has
manually floated and started moving the window, the same lifetime ownership
takes over without changing KWin's accepted frame.

If a member of a multi-window column enters native fullscreen or maximize,
Driftile extracts it into a singleton column immediately to the right. Leaving
the native state keeps that separate column. A singleton or floating window
retains its existing layout ownership.

Fresh-window rules can choose an initial desktop or output, focus policy,
layout layer, floating position, column width and presentation, tiled client
height, full-width state, maximize, or fullscreen. Exact application rules
override global defaults and affect only windows admitted after the setting
changes. See [Configuration](configuration.md) for accepted values and matching
rules.

## Pointer, wheel, and touchpad input

A tiled window can be dragged within its current layout:

- dropping on the upper or lower half of a window inserts it at that position
  in the target stack;
- dropping in an empty gutter before, between, or after columns keeps it in a
  separate column.

A manually floating window stays in its floating layer during an ordinary
pointer move. Driftile shows no tiled drop target and accepts no implicit
reinsertion; KWin owns the moved frame. Use `Meta+V` or the direct tiling action
to return it to the layout. Cross-desktop and cross-output exact placement
remains limited to tiled sources.

Cross-desktop and cross-output drags preview the exact destination before
release. A window target keeps the destination stack's width and presentation;
a gutter creates a separate column using the source width. If the exact target
becomes stale after KWin completes the desktop or output move, the window is
admitted as an ordinary singleton instead of being moved back.

KWin owns interactive pointer resize. When a settled tiled window finishes an
unambiguous horizontal resize and every column member remains valid, Driftile
adopts the result as the column's fixed width. A top or bottom resize of a
member in a multi-window stacked column can similarly become that member's
fixed height. Corner, ambiguous, blocked, or raced resizes retain the previous
layout policy.

The optional **Driftile Wheel Control** effect provides global modifier-and-
wheel actions for desktop focus and transfer plus column focus and movement.
It is installed and enabled separately from the main script. See
[Shortcuts](shortcuts.md#optional-wheel-controls).

Optional `3`- to `5`-finger touchpad gestures reuse column and desktop
navigation. Horizontal and vertical gestures can be enabled independently;
partial or cancelled gestures perform no action. Desktop gestures use the
single output under the pointer. Native touchpad gestures require Wayland and
are safe no-ops on native X11.

## Spatial Overview

The optional Overview effect presents each output as continuous workspace rows
in one spatial plane. It consumes the layout published by the main script and
does not replace Plasma's built-in Overview or maintain a second layout model.
See [Spatial Overview](overview.md) for installation, search syntax, and the
complete control reference.

Each row uses Driftile's normal work area, output scale, gaps, column geometry,
and horizontal camera. The current row can use guarded live KWin geometry for a
complete column. Its session camera starts from the authoritative layout
viewport, follows an eligible active tiled window, and retains local offsets
across live refreshes. Manual horizontal input detaches that row for the
remainder of the session; Overview navigation never writes the offset back to
the normal layout. Offsets remain associated with desktop IDs through a reflow
and are clamped only to the resulting finite row bounds.

Every fresh Overview session starts at the configured scale. Wheel, keyboard,
touchpad, and touchscreen zoom changes are session-only and never update that
setting. Reopening during the animated close resumes the same session scale;
opening after the effect has fully closed starts from the configured scale.

Each instantiated visible-range row renders KWin's public Desktop surface for
its exact output, virtual desktop, and current activity behind windows and input
layers. After Overview has opened, an unavailable or inexact surface keeps a
solid dark fallback. A surface captures its exact Overview session, context
generation, activity, desktop, screen, and output. It is shown only at
`Loader.Ready` while that complete token is still newest and exact. During
preparation, the exact current row bootstraps synchronously before residency
settles. Once exact residency exists, every surface in the complete bounded
range that opening can reveal becomes synchronous. Resident surfaces outside
that opening-critical range remain asynchronous and fade in over 90 ms; context
loss unloads them immediately and
leaves the solid fallback through replacement. A later `invalid` to exact public
membership transition schedules its own replacement, while stale completion
cannot clear a newer accepted token. The last exact surface range survives
transient invalid geometry. Panning, animated camera movement, zoom, and live
reflow preload destination rows before releasing their sources when the combined
span stays bounded; a distant jump prioritizes its destination. This per-session,
output, activity, and topology range is contiguous and limited to 12 rows,
including any bounded current-row pin.
Search or drag may retain an off-screen card without creating its Desktop
surface. Surface residency never writes layout or persistence.

Panels, docks, and notifications are excluded from Desktop surface selection. A
desktop-shell lifecycle burst clears only resident surfaces matching its exact
public output, desktop, and activity scope, then reacquires each replacement
Desktop window once. Empty public desktop or activity membership means all in
that dimension. An exact scoped refresh leaves unrelated resident rows
untouched. Incomplete or ambiguous identity falls back to one global resident
refresh; nonresident off-screen surfaces stay untouched. No polling is added.
Normal wallpaper damage continues to update live. Neutral workspace-label
backplates remain readable over the wallpaper, and a subtle output-area outline
identifies the current row without changing its geometry.

Vertical input moves between workspace rows, while horizontal input pans or
selects within a row. Precise wheel or touchpad input drives the camera
directly; a discrete vertical wheel selects the next row when scrolling down
and the previous row when scrolling up, independent of the system's natural
scrolling inversion. Horizontal discrete input selects columns. Empty-space
dragging pans the plane, and a right-button drag pans the row under the pointer.

`Ctrl` plus a physical vertical wheel zooms at the pointer: up zooms in and down
zooms out even when natural scrolling is enabled. Precise pixel deltas preview
continuously, while discrete angle deltas advance in bounded steps. `Ctrl++`
and `Ctrl+-` zoom around the current row; `Ctrl+0` restores the configured scale
for the current session. When touchpad gesture support is enabled, its
configured `3`- to `5`-finger KWin pinch on supported backends uses the centered
current row, while a public two-finger touchscreen pinch anchors the workspace
position under its centroid.

Each preview is a transaction against one exact session, model, output,
workspace order, topology, and viewport size. Cancellation restores its exact
starting scale and camera. Zoom ownership is unavailable during a window drag,
desktop reorder, viewport pan, closing transition, topology refresh, or open
help panel; a context change cancels an active transaction. Search remains
usable with zoom. A passive, non-interactive percentage indicator is visible
while zoom changes or differs from the configured session start.

Preparation builds an opaque full-size current-row canvas while synchronously
composing every Desktop surface in the bounded range that opening can reveal.
Every member must reach `Loader.Ready` for its exact residency owner or its exact
terminal `Loader.Error` fallback before the surface barrier may release;
`Loader.Null`, `Loader.Loading`, and stale or inexact contexts cannot. Two
compositor-frame callbacks must then observe the same session, output, topology,
card epoch, and complete ordered surface-token set before readiness is published;
member drift resets the frame barrier. No time delay participates. Overview
therefore starts with a complete first visible frame and moves continuously from
the native desktop into the spatial plane while its canvas stays opaque through
opening. Closing uses the same bounded motion in reverse, but never fades its
last complete canvas before replacement coverage exists. The controller applies
easing once and the scene consumes that progress directly. Exact public exit
thumbnail and Desktop surface bridges preload in the captured output's render
path. Two matching frames latch each ready bridge; otherwise the spatial canvas
remains opaque.
Two bounded promoted frames still choose the thumbnail or desktop-only path
once, and that window mode can only downgrade. An unavailable or late thumbnail
does not draw a synthetic window rectangle. The Desktop bridge tracks the exact
projected surface of the target row, reaches full-output geometry, then replaces
the canvas at terminal progress; one-color fallbacks are not part of the normal
close path.
Interactive gestures continue to drive presentation progress directly.
Reopening during that close motion reverses the same visible session from its
current progress and keeps the current session zoom.

An unchanged persisted layout with an equivalent projection-relevant live
snapshot can reuse the last accepted projection synchronously, so a warm
Overview opens immediately with a fresh session wrapper. Changed identity stays
on the existing fail-closed path of two matching reads 120 ms apart, and
malformed input never revives a stale projection.

A one-finger touchscreen drag can start across the visible Overview canvas,
outside controls and overlays, when the vertical camera or touched row has
range. A clear dominant direction latches for that gesture: vertical movement
pans the workspace rows, while horizontal movement pans only the touched row
when it has horizontal range. Ambiguous diagonal movement changes neither
camera. Short taps keep their activation or desktop-selection meaning, and a
long press on an eligible thumbnail still owns window dragging. An inexact or
stale output or camera context cancels safely; horizontal panning also requires
the exact row and desktop context. Mouse, touchpad, and right-button behavior
remains unchanged. The gesture uses public Qt Pointer Handlers without polling,
private APIs, layout writes, or persistence.

Keyboard selection starts from the active actionable window when possible.
Every workspace marker, including the current one, is also actionable. Arrow
keys move spatially and `Tab` cycles visible targets. In a settled scene with
neither search nor help open, a compact `Type to search · F1 help` control
advertises both entry points. Hover signals clickability, while click or touch
opens the keyboard reference. It hides during opening, closing, search, and
help; typing still starts search directly.

`Enter` or `Return`, plus `Space` outside search, activates the selection. If
the initial asynchronous repair has not run, the key establishes the same
preferred selection synchronously and activates it exactly once through the
existing guarded path. Activating the current marker closes Overview without a
desktop write. Typing filters windows by title, application, desktop, output,
or state. `F1` opens the compact keyboard and search reference. The hint and
repair add no persistence, layout write, or private API.

For a selected workspace marker, `Insert` creates an exact retained blank in
the next eligible row gap, `F2` starts inline rename, and `Delete` requests an
exact safe removal. Pointer and touch users get the same `+`, Rename, and Remove
controls next to the spatial rows. Protected boundaries cannot be renamed or
removed, and removal remains disabled for a globally occupied desktop or one
selected on any output. `Delete` keeps its window-close meaning when a window
target is selected.

The rename editor owns text input until `Enter` or `Return` submits it or
`Escape` cancels it. Search, navigation, wheel or touch panning, zoom, reorder,
and spatial dragging remain blocked during that edit. Any activity, output,
model, topology, desktop-object, or expected-name drift cancels the editor.
Create and remove refresh the existing Overview session in place and repair the
selection instead of replaying the opening transition.

Activating a window captures an immutable pre-write handoff with its target,
desktop, output, exact Overview rectangle, target frame, and session cameras and
zoom. The scene remains frozen while a public `KWin.WindowThumbnail` morphs on
only the target output while an exact public Desktop surface expands from the
target row beneath it. Rows and chrome fade without live reflow only after that
surface has rendered twice; otherwise the complete spatial canvas is retained.
Desktop selection uses the same surface bridge, while minimized, deleted,
stale, late-thumbnail, or topology-invalid window targets use a safe
desktop-only close without an extra window-shaped shell. Input
stays locked during the close. At terminal progress an opaque bridge or retained
canvas remains rendered until every exact output has supplied two matching
frame callbacks for the frozen session, model, topology, and handoff. Reopening
clears that retirement barrier before reversing the same session; identity
drift, stale callbacks, or scene destruction fail closed. The handoff adds no
private API, geometry write, persistence, or auxiliary timer.

A short mouse, touchpad, or touchscreen tap on empty row space or its workspace
marker selects an exact non-current workspace and closes Overview on the
current one. Movement beyond the tap threshold remains a pan or drag, and
workspace-surface taps are disabled during search.

A short touchscreen tap on a visible window follows the same exact activation
path as a click, including an exact desktop switch or minimized-window restore.
Holding an eligible thumbnail or rendered non-selected, non-minimized tab chip
before moving remains the touchscreen drag gesture. Movement before the hold
cancels the tap, a long press never also activates the window, and the visible
close region cannot fall through to activation or drag.

The optional close-button setting keeps close controls visible on eligible,
sufficiently large previews and minimized placeholders. They accept mouse,
touchpad, and touchscreen input. Their touch target is modestly enlarged
without changing layout, release outside cancels, and an exact guarded close
cannot activate or drag the window.

A visible tiled window can be dragged by its full window body or an eligible
rendered tab chip to another workspace or output, into an exact stack position,
or into a separate-column gutter. This remains an individual-window operation.
Its scene proxy follows the pointer across row clipping, and the active zone
previews the solved final position and size before release. Within a populated
target column, the central body routes
to the nearest visible stack member, whose upper or lower half selects the
insertion side. Bounded seam and outer-edge zones remain usable as
separate-column targets even with a zero or tiny layout gap. Target hysteresis
prevents a pointer resting at a boundary from making the preview alternate
between placements. Dropping an eligible tiled window on the insertion line
between two workspace rows creates a desktop at that position and moves the
window there. Dragging a workspace number marker reorders eligible desktops;
the protected empty tail cannot be moved.

An eligible exact tiled column or stack exposes a compact top-center handle
over its window content. Dragging this handle moves the complete column rather
than extracting the selected member. The scene uses a single-color proxy for
the group, while the active target previews every member's exact solved
position and size before release. An exact boundary in the same row reorders
the column; dropping on itself or on an adjacent boundary that would preserve
the existing order is a safe no-op. On the same output, a handle can transfer
the complete column to an exact boundary or empty gutter in another visible
workspace row. An eligible insertion gap between workspace rows creates the
destination at that exact position and moves the complete column there.

Workspace creation, rename, and removal never mutate KWin from the effect. The
effect writes one bounded immutable command and invokes an unbound main-script
action. The main script consumes it destructively, rejects stale or replayed
request IDs, revalidates the complete ordered topology and public objects, and
uses only public virtual-desktop APIs. An explicitly created empty desktop is
retained by the dynamic lifecycle until the user safely removes it.

Whole-column Overview placement preserves member order, the selected member,
stacked or tabbed presentation, column width, and per-member height state. A
settled minimized non-selected member remains a passive part of the group, so
it does not disable the column handle or receive a geometry write; restoring
or otherwise changing that member during the gesture cancels the stale drag. A
cancelled drag, stale source or target, invalid context, or unsupported target
clears the preview and leaves the layout unchanged. This slice deliberately
does not offer whole-column placement across outputs; window-body dragging
retains its existing individual-window cross-output path.

Window and whole-column drops commit the exact cached preview shown for the
last accepted pointer sample; release never replans against a different hit
zone. The effect fingerprints the complete relevant layout contexts, output and
work-area geometry, scale, gap and centering policy, plus desktop order for a
workspace-gap target. The main script independently reconstructs that basis
from current public state before focus, selection, topology, or layout writes.
Any drift rejects the command without substituting another placement or
partially mutating the session.

Stable window presentations reflow with one coordinated motion when an exact
layout update moves or resizes a column, changes the selected tab, or moves a
member between thumbnail, tab, and minimized-placeholder presentation. Rapid
accepted updates retarget from the currently rendered geometry and visual
state instead of restarting from a stale position. Starting a direct window or
whole-column drag or activating a window or workspace to leave Overview first
settles that motion so input and exit capture use exact geometry. A removed
window disappears immediately; its surviving neighbors animate into their
updated frames without a retained exit ghost.

Multi-member tabbed columns keep the selected member at its full projected
size and add a compact tab rail over the column; the controls do not shrink or
reflow the selected preview. The rail shows the largest safe contiguous chip
window that fits the visible column, with at least one 28-pixel chip. Keyboard
selection, an active search match, attention, and the selected member anchor
that window in deterministic priority order. Choosing an overflow member
reveals it through the existing presentation motion when motion is eligible;
search updates reveal their match immediately under the existing search input
barrier. Overflow members retain one logical keyboard and search target each
but no invisible pointer hit area. If even one safe chip cannot fit, the rail
fails closed. Thin edge cues identify hidden members before or after the
rendered chip window. Each rendered tab shows selected, minimized, and attention state.
Its bounded plain-text label uses the available application or window identity
and falls back to `Tab N` when no safe label is available. Tab labels remain
readable independently of the optional `ShowWindowLabels` large-thumbnail
footer setting.
Actionable chips expose hover and pressed feedback without changing their
geometry.

An unmodified vertical or horizontal mouse or touchpad wheel gesture that
starts inside an exact rendered rail stays owned by that rail for the complete
gesture. Physical deltas are normalized once; high-resolution input accumulates
at 120 angle units or 40 pixels per member, with at most four target steps per
event. Navigation changes the keyboard selection among the column's exact
actionable members, and the bounded rail reveals the destination without
recentering either workspace camera. Partial or boundary steps, invalid later
samples, and a `Shift` modifier change during
ownership are consumed without reaching workspace or camera navigation.
`Ctrl`-wheel zoom remains separate. Search disables rail ownership and retains
the existing global search-result wheel behavior. No rail paging buttons are
added. Tab-chip dragging reuses the existing spatial placement planner and
targets.

An exact rendered chip for a non-selected, non-minimized tab can start the
existing individual-window drag through mouse or touchpad movement or a
touchscreen long press. It carries the real window and retains the same exact
preview, cached placement, and guarded drop semantics as a full thumbnail.
Once drag ownership is accepted, the chip cannot also activate the tab. The
selected member remains draggable only through its full thumbnail; its chip is
still an activation and close control. A minimized chip remains restore-only
rather than a drag source, and an overflow member without a rendered chip has
no drag surface. Close-button presses never begin a drag. Selection or
minimization drift, a changed captured rail frame or visibility, or topology,
activity, output, or context drift cancels the gesture without replacing its
source.

Windows that were already minimized when Overview opened remain represented,
and minimized windows use compact actionable placeholders instead of draggable
thumbnails. Hidden tab members and minimized windows participate in search and
keyboard navigation. Each window contributes exactly one navigation target:
its selected preview, minimized placeholder, rendered tab control, or bounded
logical position in an overflowed tab rail. A logical overflow target becomes a
rendered chip before pointer interaction and never creates a hidden hit region.
`Enter`, `Return`, and `Space` activate that target through the same guarded
path. Actionable placeholders expose the same hover and pressed feedback as tab
chips while remaining excluded from every drag path.

A primary mouse click, touchpad tap, or touchscreen tap on a tab control
activates its exact window. A sufficiently wide closeable tab chip exposes the
same optional close button as other window surfaces. Its exclusive guarded
release cannot reach the selected preview behind the rail or begin a drag. A
middle mouse or touchpad click closes any eligible visible tab only while the
same exact close checks still pass, including the chip for the selected member.
Stale column membership, geometry, output, desktop, activity, or window
identity disables the control instead of falling through to another action.

Window and desktop changes refresh the active scene. Changing the current
activity, the activity set, or output topology and geometry also refreshes the
open scene in place. Search, the keyboard reference, settled session zoom, the
vertical viewport, and per-desktop horizontal cameras remain in the same
session. A refresh cancels transient window or column dragging, workspace
reordering and hover, wheel and boundary navigation, panning, and any unfinished
zoom preview; a cancelled zoom returns to its exact transaction origin.

The existing plane remains visible while its generation-bound replacement is
pending, but stale pointer actions and action or navigation keys are blocked.
`Escape` and the global close or toggle action remain available. Admission
revalidates the refresh attempt, active session, prior model, and newest
topology generation before replacing the model and releasing input. Stale
callbacks fail closed. Resident Desktop surfaces return to the solid fallback
for their changed context and fade in only when the newest exact surface is
ready.

The Overview is an optional preview under active development. Its search,
labels, help, and appearance controls support the spatial interaction but do
not change layout ownership or persistence.

## Persistence and safety boundaries

Driftile stores layout state per output, desktop, and activity. Restore is
conservative: corrupt, incompatible, incomplete, or ambiguous state is rejected
instead of becoming partial layout authority. Existing KWin configuration and
window state remain the fallback.

Commands revalidate their windows, context, and topology before committing.
Blocked, stale, unsupported, or ambiguous operations fail without falling
through to a different action. Geometry transactions either commit the intended
layout or retain and recover the previous valid state when KWin rejects a
request.

KWin remains the authority for focus, stacking, fullscreen, maximize,
minimize, interactive move and resize, output membership, and virtual-desktop
mechanisms. Driftile adds layout policy through public Plasma 6.7 or newer APIs;
it is not a compositor. See [Compatibility](compatibility.md) for backend and
hardware limits, and [Troubleshooting](troubleshooting.md) for recovery steps.
