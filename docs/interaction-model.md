# Interaction Model

Driftile uses one keyboard grammar and does not wrap at layout boundaries:

- `Meta` focuses in a direction.
- Adding `Ctrl` moves the focused window or column in that direction.
- Adding `Shift` to a monitor direction targets another output.
- `Home/End` focus the first or last column; adding `Ctrl` moves the active column to that edge.
- `U/I` address the next and previous virtual desktop; `Page Down/Page Up` are aliases.
- Adding `Shift` reorders the currently selected desktop one global position down or up.
- `1..9` address a virtual desktop directly; adding `Ctrl` moves the active column there.

Optional five-finger touchpad navigation reuses horizontal column focus: a
completed left swipe focuses right, and a completed right swipe focuses left.
It does not add shortcut actions, and partial or cancelled gestures perform no
command.

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

## Delivery contract

| Area                 | Required behavior                                                                                 | Target    |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| Horizontal strip     | Focus and reorder columns; focus or move to first and last; reveal with minimal scrolling         | Available |
| Vertical column      | Focus and reorder members; consume or expel active, top, or bottom members                        | Available |
| Column view          | Cycle `1/3`, `1/2`, and `2/3` widths in both directions; adjust by 10%; toggle full width; center | Available |
| Advanced column view | Fill available width and center all fully visible columns                                         | Available |
| Window height        | Adjust one window by 10%; reset to automatic; cycle `1/3`, `1/2`, and `2/3` presets               | Available |
| Virtual desktops     | Focus adjacent or numbered desktops; reorder when KWin supports it; transfer a column or window   | Available |
| Outputs              | Focus an adjacent output and transfer the whole active column                                     | Available |
| Fullscreen           | Extract a regular stack member, then toggle native fullscreen through KWin                        | Available |
| Native maximize      | Extract a regular stack member, then toggle it to work-area edges through KWin                    | Available |
| Minimize focus       | Preserve tiled slots and floating frames; skip minimized windows without wrapping                 | Available |
| Hidden-member edits  | Preserve documented passive peers; reject every other minimized-member structural edit            | Available |
| Floating layer       | Toggle state, switch layers, navigate geometrically, nudge, center, and resize width contextually | Available |
| Pointer drop         | Reinsert or adopt one active tiled window at one exact visible target                             | Available |
| Pointer resize       | Adopt one completed horizontal resize as the active column's fixed width                          | Available |
| Overview companion   | Focus an exact current or non-current thumbnail, or select a non-current number gutter            | Available |
| Tabbed columns       | Toggle a column between stacked and tabbed presentation without changing navigation               | Future    |
| Pointer navigation   | Provide wheel navigation through the shared layout model                                          | Future    |

Single-window transfers will remain available as secondary, unbound actions.
Default desktop and output transfer shortcuts must move the whole active column.
An active floating layer changes desktop transfer to the active window only.

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
Pending, blocked, or native-state targets fail closed without falling through
to tiled width changes. This adds no action, binding, setting, or schema.

A tiled drag commits on release over exactly one visible tiled target in the
same context. The target midpoint selects insertion before or after it. Moving
within a stack retains the window-height policy; moving into another column
retains the destination width and gives the moved window automatic height.

KWin owns desktop selection and window membership. After KWin moves the active
window to a selected visible desktop on the same output, Driftile can adopt it
before or after the exact tiled target under the release point. A pending
destination settles through bounded probes. The hidden source receives no
geometry writes. An unavailable, invalidated, ambiguous, stale, or raced target
keeps KWin's move and uses ordinary singleton admission.

Cross-output behavior is unchanged: KWin owns physical output and any required
desktop movement, and Driftile adopts only when the cursor still identifies one
valid destination target. An empty, invalidated, ambiguous, or raced target
uses ordinary destination admission rather than moving the window back.

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
cleanup. Pointer adoption is finish-only and adds no visual feedback, setting,
action, binding, or persistence schema. Planning, validation, reflow, and
compensation use `O(V)` work in the visible context without scanning the
workspace.

A stack has at most one fixed or preset window height. Changing a different
member converts the other members to weighted automatic heights that preserve
their visible proportions while sharing the remaining work-area height. Reset
returns the active member to automatic sizing.

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

Plasma exposes one global virtual-desktop list, and KWin owns its reorder
mechanism. Driftile can request a one-position move of the desktop currently
selected on the active output. It never wraps; desktop IDs, per-output
selections, and window memberships stay unchanged. The shared empty tail stays
pinned at the end, so neither it nor another desktop can cross that boundary.
If the active KWin scripting backend does not expose the mechanism, the request
is a no-op.
Driftile keeps independent layout state per output and uses output-local desktop
selection where KWin supports it, but it cannot create private per-output lists.
