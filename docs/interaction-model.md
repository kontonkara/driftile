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
resumes after the desktop effect releases presentation. An incoming window that
is still reported hidden receives one same-context successor transition after
the initial animation completes while the later focus handoff settles.
Visibility or a desktop or activity change discards that one-shot continuity
before use.

## Floating windows and native states

`Meta+V` toggles an eligible normal window between tiled and manually floating.
Driftile remembers the floating frame and a tiled reinsertion anchor. Returning
to tiling restores a valid anchor when possible and otherwise inserts a new
column through the normal admission path.

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
frame under KWin ownership.

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

An eligible manually floating window can use the same exact targets in its
current context to return to tiling. Cross-desktop and cross-output exact
placement remains limited to tiled sources.

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
the normal layout.

Each instantiated visible-range row renders KWin's public Desktop surface for
its exact output, virtual desktop, and current activity behind windows and input
layers. An unavailable or inexact surface keeps a solid dark fallback. Ordinary
visual row rendering stays within a bounded visible range, while search or drag
state may retain an off-screen card without creating its Desktop surface.
Panels, docks, and notifications are excluded from Desktop surface selection.
A desktop-shell lifecycle burst clears only visible surfaces matching its exact
public output, desktop, and activity scope, then reacquires each replacement
Desktop window once. Empty public desktop or activity membership means all in
that dimension. Incomplete or ambiguous identity falls back to one global
visible refresh; unrelated exact rows and every off-screen surface stay
untouched. No polling is added. Normal wallpaper damage continues to update
live. Neutral workspace-label backplates remain readable over the wallpaper,
and a subtle output-area outline identifies the current row without changing
its geometry.

Vertical input moves between workspace rows, while horizontal input pans or
selects within a row. Precise wheel or touchpad input drives the camera
directly; a discrete vertical wheel selects the next row when scrolling down
and the previous row when scrolling up, independent of the system's natural
scrolling inversion. Horizontal discrete input selects columns. Empty-space
dragging pans the plane, and a right-button drag pans the row under the pointer.

Ordinary Overview opening settles directly into the spatial plane, avoiding an
intermediate full-size projection. Closing remains animated, while interactive
gestures continue to drive presentation progress directly.

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

A short mouse, touchpad, or touchscreen tap on empty row space or its workspace
marker selects an exact non-current workspace and closes Overview on the
current one. Movement beyond the tap threshold remains a pan or drag, and
workspace-surface taps are disabled during search.

A short touchscreen tap on a visible window follows the same exact activation
path as a click, including an exact desktop switch or minimized-window restore.
Holding an eligible thumbnail before moving remains the touchscreen drag
gesture. Movement before the hold cancels the tap, a long press never also
activates the window, and the visible close region cannot fall through to
activation or drag.

The optional close-button setting keeps close controls visible on eligible,
sufficiently large previews and minimized placeholders. They accept mouse,
touchpad, and touchscreen input. Their touch target is modestly enlarged
without changing layout, release outside cancels, and an exact guarded close
cannot activate or drag the window.

A visible window can be dragged to another workspace or output, into an exact
stack position, or into a separate-column gutter. Dropping an eligible tiled
window on the insertion line between two workspace rows creates a desktop at
that position and moves the window there. Dragging a workspace number marker
reorders eligible desktops; the protected empty tail cannot be moved.

Tabbed columns expose only their selected member in the spatial plane.
Minimized windows use compact actionable placeholders instead of draggable
thumbnails. Window and desktop changes refresh the active scene. Activity or
output-topology changes close a stale scene so later input cannot target an
outdated layout.

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
