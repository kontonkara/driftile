# Interaction Model

Driftile uses one keyboard grammar and does not wrap at layout boundaries:

- `Meta` focuses in a direction.
- Adding `Ctrl` moves the focused window or column in that direction.
- Adding `Shift` to a monitor direction targets another output.
- `Home/End` focus the first or last column; adding `Ctrl` moves the active column to that edge.
- `U/I` address the next and previous virtual desktop; `Page Down/Page Up` are aliases.
- Adding `Shift` reorders the currently selected desktop one global position down or up.
- `1..9` address a virtual desktop directly; adding `Ctrl` moves the active column there.
- `W` toggles the active tiled column between stacked and tabbed presentation.

Optional numbered back-and-forth changes only a repeated direct `1..9`
selection whose resolved and clamped target is already current. With a valid,
distinct output-local last-used desktop, the repeated action selects that
desktop instead. Missing history, stale targets, and rejected selection are
no-ops. Adjacent navigation and the explicit **Focus last-used desktop** action
are unchanged. Toggling the setting does not switch desktops, mutate selection
history, or alter layout.

Optional `3`–`5`-finger touchpad navigation reuses horizontal column focus and
adjacent-desktop selection. Horizontal and vertical gesture pairs can be
enabled independently. With natural direction, completed left and up swipes
focus right and select the next desktop; right and down select the previous
column and desktop. The gestures add no shortcut actions, and partial or
cancelled gestures perform no command. Vertical gestures use the single output
under the pointer; output gaps, overlapping output geometry, and invalid pointer
coordinates are no-ops. Keyboard desktop navigation still uses the active
output.

The optional overview's current-card path accepts left clicks only on valid
thumbnails. It revalidates the direct live window against that output, desktop,
current activity, and input eligibility, then retains or requests
`KWin.Workspace.activeWindow`. Only confirmed focus closes the effect; an
invalid, stale, or rejected request leaves it open. Ordinary KWin activation
may raise the window, and existing Driftile focus handling may reveal its tiled
column.

In 1.8.0, the number gutter of a non-current card also accepts a left click. The
effect revalidates the live screen, projected output, and desktop object and ID,
requests selection through a public KWin property, and closes only after exact
confirmation. The current gutter and every rejected request remain inert. The
effect never switches activities or writes window output, membership, geometry,
or settings.

In 1.9.0, a valid non-current thumbnail first revalidates the exact effect,
model, screen, projected output, desktop, window, and activity while allowing
the window's off-desktop hidden state. It selects and confirms that desktop
through the existing public path, then revalidates the same window as visible,
requests the exact active window, and confirms focus. Pre-selection rejection
leaves the effect open. A late invalidation or focus failure after confirmed
selection keeps the selected desktop and closes the stale effect without
rollback. This adds no action, binding, setting, schema, private API, timer,
move, geometry write, or membership write, and performs no window,
stacking-order, or layout scan.

In 1.21.0, opening the optional overview selects the active window's actionable
target when available, then falls back to the current desktop and visual order.
Arrow keys move spatially without wrapping. `Enter`, `Return`, and `Space`
reuse the selected thumbnail or tab's guarded public KWin activation path;
`Escape` closes without acting. A selected tabbed member appears only as its
large thumbnail, other actionable members appear as tabs, and minimized,
invalid, or fully clipped items are skipped. A partially clipped target uses
its visible intersection for spatial navigation. The interaction changes no
layout or persistent state, setting, shortcut, schema, or pointer path.

In 1.22.0, a plain left drag from a desktop card's number gutter previews one
vertical insertion point without moving the cards. The shared trailing empty
desktop cannot be dragged, targeted, or crossed. Release revalidates the exact
effect, model, output, selected desktop, scene geometry, and complete desktop
object and ID order before one public KWin reorder request. A click keeps the
existing selection path; cancellation, no-op, stale, and unsupported paths are
write-free and leave the effect open. The interaction changes no window state
or Driftile layout, settings, shortcuts, or persistence; only KWin's global
desktop order changes after a valid release.

In 1.23.0, each overview desktop card passively reports its active column's
validated `stacked` or `tabbed` presentation and logical width. The badge stays
inside the visible column span and hides when the complete label cannot fit or
its source state is invalid. It accepts no input and changes no window, layout,
setting, shortcut, persistence, or KWin state.

Inside the optional overview, an unmodified vertical mouse wheel cycles the
current actionable targets in visual order. Search limits the set to matching
windows; without a query, non-current desktop gutters also participate.
High-resolution deltas use bounded accumulation and a bounded step count. The
search overlay reports the unique window-result count or an explicit no-match
message as plain text. These interactions change only overview selection and
perform no KWin, layout, configuration, or persistence write.

A thumbnail or non-minimized tab can be dropped on an exact desktop card on the
same or another output. Cross-output completion confirms the public output move
and desktop membership separately. A partial result is compensated only while
the captured source remains exact; stale or ambiguous state closes the overview
without another write.

## Delivery contract

| Area                 | Required behavior                                                                               | Target    |
| -------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| Horizontal strip     | Focus and reorder columns; focus or move to first and last; reveal with minimal scrolling       | Available |
| Vertical column      | Focus and reorder members; consume or expel active, top, or bottom members                      | Available |
| Column view          | Cycle configured widths in both directions; adjust by 10%; toggle full width; center            | Available |
| Advanced column view | Fill available width and center all fully visible columns                                       | Available |
| Window height        | Adjust one window by 10%; reset to automatic; cycle configured presets                          | Available |
| Virtual desktops     | Focus adjacent or numbered desktops; reorder when KWin supports it; transfer a column or window | Available |
| Outputs              | Focus an adjacent output and transfer the active column or floating window                      | Available |
| Fullscreen           | Extract a regular stack member, then toggle native fullscreen through KWin                      | Available |
| Native maximize      | Extract a regular stack member, then toggle it to work-area edges through KWin                  | Available |
| Minimize focus       | Preserve tiled slots and floating frames; skip minimized windows without wrapping               | Available |
| Hidden-member edits  | Preserve documented passive peers; reject every other minimized-member structural edit          | Available |
| Floating layer       | Toggle state, switch layers, navigate geometrically, nudge, center, and resize contextually     | Available |
| Pointer drop         | Reinsert a tiled window or tile a manual floating window at an exact window or empty gutter     | Available |
| Pointer resize       | Adopt one completed horizontal column resize or vertical stacked-window resize                  | Available |
| Overview companion   | Filter or activate windows; select or reorder desktops; move windows between desktop cards      | Available |
| Tabbed columns       | Toggle presentation; select or reorder members with the existing vertical grammar               | 1.19.0    |
| Pointer navigation   | Cycle the overview's shared actionable target model with vertical mouse wheel input             | Available |

Adjacent and numbered single-window transfers remain secondary, unbound
actions. Default desktop and output transfer shortcuts must move the whole
active column. An active floating layer changes either transfer to the active
window only.

Fresh application destination rules run before ordinary admission. An exact
rule may assign the new normal window to a one-based virtual desktop, a named
output, or both, while leaving the selected desktops intact. The destination
policy itself leaves the active window intact.
Initial floating, sizing, presentation, and native-state rules then resolve in
the confirmed destination context. Missing, stale, related, or rejected
targets fall back once to the window's existing KWin context.

An exact fresh-window focus rule requests activation after tiled or floating
admission only when that context is already visible. It never selects a
desktop or output, and a rejected request is not retried. Native maximize and
fullscreen requests run afterward.

An exact fresh-window maximize rule requests KWin's native work-area-edge
state after the tiled or floating underlay is admitted. Initial
fullscreen runs afterward when both policies match. Unsupported and rejected
requests are one-shot; startup, restored, and already tracked windows are not
changed.

Horizontal focus normally reveals the destination with the smallest required
viewport change. Optional overflow centering keeps that behavior while the
destination and its nearest neighbor toward the previous focus both fit the
work area; otherwise it centers the destination. Always-center and exact
application policies retain priority.

Optional single-column centering is a geometry invariant rather than a focus
action. When a context contains exactly one tiled column, including a
multi-window stack, it keeps that column centered through reflow. Floating
windows and contexts with two or more tiled columns are unchanged. Enabling the
policy reflows visible singleton contexts; disabling it leaves the current
viewport in place and stops enforcing the centered result.

The tiled gap is a `0`–`64` logical-pixel value and may be fractional. Solved
window edges are snapped to each output's physical-pixel grid, so scales that
cannot represent a requested subpixel gap exactly may distribute one physical
pixel unevenly between adjacent gaps.

Floating output transfer selects the same deterministic adjacent output as the
tiled command and adopts that output's selected desktop without switching any
desktop. It accepts only one relation-free manual or automatic floating window.
KWin owns the resulting frame; Driftile changes no tiled layout or frame
geometry. Blocked targets fail closed instead of entering the tiled path.

Previous/next output actions traverse the public output cycle and wrap at both
ends. Direct focus remains owned by Plasma. Tiled, whole-column, and eligible
floating transfers resolve the same target before entering the existing atomic
transfer path, so rejected targets leave ownership, focus, and layout intact.

Unbound boundary alternatives combine local navigation with output movement.
They focus or reorder locally first, then cross an available output only at the
corresponding visible or structural boundary. Manual floating behavior remains
local. Pending, stale, blocked, or rejected local work never falls through to
another output.

Unbound traversal alternatives can wrap first/last columns, continue from a
vertical edge into one adjacent column, or select and wrap the visible top and
bottom members. A local candidate is always attempted first. Rejected or
blocked candidates stop the command instead of activating its fallback.
Floating traversal remains geometric and layer-local.

Nine unbound direct selectors address the first through ninth visible member of
the active tiled column. Indexing is one-based, skips minimized members, and
clamps to the last visible member. Tabbed selection commits only after KWin
accepts focus; rejection restores the previous tab.

Nine matching column selectors count only columns with a visible member and
clamp an oversized one-based index to the last such column. They enter the
tiled layer directly from floating focus. Focus rejection restores the prior
layer and tab selection.

Nine unbound move actions place the active tiled column at a one-based
structural index, clamped to the last column. The transaction retains the
column's members, presentation, width, and focus; rejected geometry restores
the previous order.

Adjacent-window swap exchanges the focused member with the selected member of
the neighboring column while keeping focus on the same window. A
singleton-to-singleton swap moves both complete columns. Explicit stacked and
tabbed actions complement the existing presentation toggle.

Previous-window focus keeps an in-memory MRU order for tiled and manually
floating windows across layout contexts. It skips minimized windows and
automatic popups. Committing the current entry before activation makes
repeated use toggle between the latest pair.

The existing center-column action is contextual. With an active manually
floating window, it centers each non-oversized dimension at the exact logical
midpoint of the assigned output and desktop work area; an oversized dimension
starts at the work-area origin. The command does not resize, change focus or
membership, or modify a tiled layout. Automatic exclusions and native-state,
interactive, minimized, stale, or otherwise blocked manual-floating targets do
not fall through to tiled centering.

The existing decrease/increase column-width actions are also contextual. With
an active manually floating window, they change the decorated frame width by
the configured step percentage of its assigned work-area width; the gap is
excluded. Height and top-left stay unchanged unless the partial-visibility
bounds require a minimal origin clamp that keeps 10–75 logical pixels visible.
Only an exact synchronous or asynchronous acknowledgement commits state.

The existing preset forward/back and reset-width actions use that contextual
path for one relation-free manually floating window. Presets read
`ColumnWidthPresets`; reset reads `DefaultColumnWidthPixels` when it is positive
and otherwise falls back to `DefaultColumnWidthPercent`. A fixed value is a
logical-pixel width; a percentage resolves as
`percentage / 100 * (workArea.width - gap) - gap`. Both use the assigned
output's pixel grid, live decorated constraints, and established
partial-visibility clamp. Automatic, related, pending, native-state, or
otherwise blocked floating targets fail closed without reaching tiled width
changes. Tiled behavior is unchanged. The geometry path adds no persistence or
helper behavior and requires no additional KWin API.

A width preset ending in `px` resolves directly in logical pixels. Mixed fixed
and proportional presets retain their configured cycle order.

The existing decrease/increase window-height actions are contextual in the
same way. With an active manually floating window, they change the decorated
frame height by `WindowHeightStepPercent` of the assigned work-area height;
the gap is excluded. Width and top-left stay unchanged unless the established
partial-visibility bounds require a minimal origin clamp. The target respects
live decorated constraints and snaps with the assigned output's device-pixel
ratio. It uses the same exact-acknowledgement and fail-closed ownership path as
contextual width, so a blocked or pending floating target never reaches tiled
stack resizing. Tiled semantics are otherwise unchanged.

The existing forward and reverse window-height preset actions are contextual
for one active relation-free manually floating window. Blank
`WindowHeightPresets` uses the exact `1/3`, `1/2`, and `2/3` proportions. A
custom value contains up to 16 mixed proportional or fixed logical-pixel
entries. Each proportional raw frame height is
`percentage / 100 * (workArea.height - gap) - gap`. Driftile snaps the
canonical start at `workArea.y + gap` and the end at `start + rawHeight` to the
assigned output's pixel grid before subtracting them. Forward selects the first
resolved height more than one logical pixel above the current frame and wraps
to the first preset; reverse selects the last resolved height more than one
logical pixel below the current frame and wraps to the last. A fixed `px` entry
sets client height, with the live decoration extent added to the frame target.

The shared manual-floating size transaction applies live decorated constraints
and the established partial-reachability clamp. It preserves width, focus,
context, reinsertion anchor, and every tiled layout; top-left changes only for
the minimal reachability clamp. One frame request commits only after exact
acknowledgement. A blocked active floating target fails closed without reaching
the tiled path. Replacing the configured cycle schedules no geometry, layout,
viewport, or focus write; only later explicit preset actions read it.
Window-height reset remains tiled-only.

The existing unbound insert-left and insert-right actions are also contextual
for one active relation-free manually floating window. Direction compares the
floating frame's horizontal center with every solved column center in the
current output and desktop scrollable strip. Off-screen columns participate,
singleton columns are skipped, and selection does not wrap. Only the nearest
structural multi-window stack is considered; if it or the context is unsafe,
the command fails closed instead of routing to a farther stack or the tiled
path.

Insertion appends and selects the active window while retaining focus. The
target column's width and stacked or tabbed presentation win, and the inserted
height becomes automatic. Floating ownership and the tiled layout stay
unchanged while guarded geometry writes are staged. Failure compensates frames
that still have valid write ownership and otherwise schedules dirty-context
recovery. Automatic, related, minimized, native-state, pending, or stale active
windows are no-ops. The path adds no action, default binding, setting, schema,
persistence field, helper, overview, KWin API, or private API.

A tiled drag commits on release over either one exact visible window or an
empty horizontal gutter in the same context. An exact-window drop uses its
vertical midpoint to insert or reorder inside a stack. A gutter before, between,
or after visible columns keeps the dragged window in a separate column.

For a gutter drop, a singleton moves as one complete column, retaining its ID,
width, presentation, selected member, and height state. A stack member is
extracted into a new singleton with the source width, automatic height, and
configured application or global initial presentation; passive members retain
their order, heights, presentation, and successor-or-predecessor selection. The
viewport follows the existing active-column reveal rules. Ineffective
boundaries are no-ops.

During that same-context drag, Driftile outlines either the target window half
or the selected horizontal gutter. Cursor events are coalesced and the
immutable layout snapshot is not rewritten. KWin exposes one shared outline
without an ownership token, so Driftile checks it before target changes and
cleanup, then disables feedback for the drag if another outline conflicts. The
coexistence check is necessarily best-effort. Empty-gutter drops across outputs
or desktops remain finish-only without a preview.

KWin owns desktop selection and window membership. After KWin moves the active
window to a selected visible desktop on the same output, Driftile first checks
for one exact tiled target under the release point, then an empty horizontal
gutter. An exact target retains destination-column stack behavior and width. A
gutter creates a separate singleton with the source width, automatic height,
and current application or global initial presentation. A pending destination
settles through bounded probes. The hidden source receives no geometry writes.
An unavailable, invalidated, ambiguous, stale, or raced target keeps KWin's move
and uses ordinary singleton admission.

The same target priority and column semantics apply after KWin moves the window
to another visible output. KWin remains the sole owner of physical output and
any required desktop movement. A failed target uses ordinary destination
admission rather than moving the window back.

Finish-only horizontal resize adoption starts with the active normal tiled
window in one settled visible context. KWin owns the interactive-resize lease,
so Driftile performs no geometry write until it finishes. An unambiguous
width-only left- or right-edge finish becomes the existing fixed width of the
active column only when every member remains visible, writable, unsuspended,
unchanged, and in the same output and desktop. Driftile then stages every
writable target in that context while keeping the prior logical layout. Two
successive delayed samples must match every target exactly; target mismatches
time out after 20 probes. Competing layout mutations remain blocked until
settlement finishes. Success then commits the fixed width, preserves order,
heights, focus, and unrelated contexts, and publishes once.

Corner or vertical resizing, an ambiguous edge, any participant, state,
context, topology, or constraint race, a rejected write, or target timeout
restores the prior column policy and tiled frames. Rollback supersedes every
attempted target request and releases after 20 exact samples. If rollback is
not confirmed within 40 probes, ordinary deferred recovery runs; when KWin has
taken native-state geometry ownership, it receives no competing frame write.
Late configure delivery is rechecked, and focus changes are replayed after
cleanup. Pointer adoption adds no setting, action, binding, or persistence
schema. Planning, validation, reflow, and compensation use `O(V)` work in the
visible context. A changed preview target also performs one stacking-order
guard because KWin's outline is shared.

A stack has at most one fixed or preset window height. Changing a different
member converts the other members to weighted automatic heights that preserve
their visible proportions while sharing the remaining work-area height. Reset
returns the active tiled member to automatic sizing. These stack policies do
not apply to a manually floating frame.

In 1.19.0, `Meta+W` toggles the active tiled column between stacked and tabbed
presentation. A tabbed column gives every non-minimized member the same frame,
using the normal configured outer gaps. Focus down or up selects the next or
previous member without wrapping; move down or up reorders that member and
keeps it selected. Height commands are no-ops while tabbed, and the dormant
height policies return unchanged when stacked presentation is restored.

When a window joins an existing column, the target presentation wins. A split
or extraction creates a stacked singleton. If the selected member leaves, its
successor is selected when present, otherwise its predecessor. Whole-column
moves preserve presentation and selection. This slice adds no persistent tab
strip, pointer tab selection, animation, setting, settings UI, or private API.

In 1.20.0, a fresh column reads the global `stacked` or `tabbed` default and
then applies an exact application override when present. A tabbed singleton
retains that state across removal, extraction, transfer, floating reinsertion,
and persistence; it has the same frame as a stacked singleton until another
member joins. Existing target columns still keep their own presentation.
Confirmed selection in a multi-window tabbed column may show a passive Plasma
OSD, controlled by one setting and implemented without an input-grabbing
effect or managed window. The optional overview keeps minimized members as
visible disabled tabs rather than offering invalid focus targets.

## KWin boundary

KWin owns fullscreen, maximize, minimize, interactive pointer move and resize,
output transfer, and virtual-desktop mechanisms. Driftile owns their layout
semantics.

Driftile provides no minimize action or default shortcut. A minimized tiled
window retains its exact logical slot, and a minimized manually floating window
retains its exact frame. Directional, edge, and layer focus skip minimized
slots and fully minimized columns without wrapping. Focus does not skip other
suspension blockers. Native fullscreen and maximize may extract the active
member past settled minimized peers without writing their frames. A visible
active member may move vertically across settled minimized slots or extract
horizontally from that stack. Direct insertion may cross settled minimized
passive peers in its participating source and target columns, including a fully
minimized target stack; skipped singleton columns are nonparticipants. Passive
logical order, height state, minimized state, and externally changed hidden
frames remain authoritative without geometry writes. Fullscreen, maximized,
native-tiled, restore- or toggle-settling, and other blockers in either column
make insertion fail closed. A state round trip during reflow cancels and rolls
back the edit. Consume may pull the visible top member of the
immediate-right column past settled minimized passive members in either column
without writing hidden frames. Expel may move a visible bottom member past
settled minimized passive peers. When that bottom member is active, its
immediate predecessor must be visible and receives focus before the layout
changes; the command does not search past a minimized predecessor. If KWin does
not confirm the handoff, the layout and frames remain unchanged. Whole-column
desktop and output transfers may carry settled minimized passive members
without layout geometry writes. A secondary single-window desktop or output
transfer may extract the visible active member while settled minimized passive
members in the same source column remain untouched. Those members keep their
logical slots, height state, minimized state, and frames, and receive no
desktop, output, or geometry writes. Minimized windows elsewhere in the source
or target context and other undocumented hidden-member edits remain
fail-closed.

When a member of a regular vertical stack enters fullscreen or is maximized,
Driftile extracts it into a singleton column immediately to the right. Leaving
the native state keeps that column separate. A singleton or floating window
keeps its existing layout ownership.

An application can also be excluded by exact `desktopFileName` in Driftile's
settings. A match uses the same automatic-exclusion ownership as dialogs and
other KWin-owned roles: tiling commands are no-ops and Driftile does not write
its frame. Clearing the rule admits an otherwise eligible window as a fresh
singleton after native-state and interactive-move blockers settle.

An exact application initial-width rule is read only for fresh singleton
admission. Bare `10`–`100` and explicit `10%`–`100%` values are proportional;
`1px`–`16384px` values request a fixed logical width. The admitted window's
live constraints and assigned output's pixel grid determine the final width.
Rule changes do not rewrite existing or restored columns, windows joining a
column, or the explicit reset policy.

An exact application policy can instead make a newly admitted normal window an
ordinary manually floating window while preserving its KWin frame. The policy
is fresh-only: existing and hydrated tiled or floating ownership is
authoritative, and live changes affect only windows first tracked later. Tiling
exclusions and automatic floating roles take priority. **Toggle floating**
returns the window to tiling through the normal reinsertion path, using its
configured application initial column width. No separate persisted state is
introduced.

An exact floating-position rule can place that fresh manual-floating window,
or a fresh tiled window the first time it enters manual floating, at one of
eight work-area anchors plus signed logical-pixel offsets. The accepted frame
is snapped to the output pixel grid and its origin is clamped without resizing.
Later floating toggles restore the remembered frame; startup-existing, restored,
automatic, related, and already manually floating windows are not repositioned.
Transfers preserve their current frame, and live rule changes affect only a
future first manual-floating placement.

Two other fresh-only exact application policies can admit a normal tiled window
as a full-width singleton or request native fullscreen after its underlying
tiled or floating state is established. Full-width admission retains the
application or global width as its toggle restore value. Leaving fullscreen
returns to the admitted underlying state. Startup, restored, transferred, and
re-admitted windows remain authoritative, and live policy changes affect only
windows first tracked later.

Plasma exposes one global virtual-desktop list, and KWin owns its reorder
mechanism. Driftile can request a one-position move of the desktop currently
selected on the active output. It never wraps; desktop IDs, per-output
selections, and window memberships stay unchanged. The shared empty tail stays
pinned at the end, so neither it nor another desktop can cross that boundary.
If the active KWin scripting backend does not expose the mechanism, the request
is a no-op.
Driftile keeps independent layout state per output and uses output-local desktop
selection where KWin supports it, but it cannot create private per-output lists.
