# Shortcuts

Driftile registers these defaults through KWin. `H/J/K/L` and the matching
arrow keys are interchangeable unless noted otherwise.

| Action                                           | Default                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| Focus column left or right                       | `Meta+H/L` or `Meta+Left/Right`                      |
| Focus first or last column                       | `Meta+Home/End`                                      |
| Focus window down or up in a column              | `Meta+J/K` or `Meta+Down/Up`                         |
| Focus output in a direction                      | `Meta+Shift+H/J/K/L` or `Meta+Shift+Arrow`           |
| Focus next or previous desktop                   | `Meta+U/I` or `Meta+Page Down/Page Up`               |
| Focus desktop 1 through 9                        | `Meta+1..9`                                          |
| Move selected desktop one position down          | `Meta+Shift+U` or `Meta+Shift+Page Down`             |
| Move selected desktop one position up            | `Meta+Shift+I` or `Meta+Shift+Page Up`               |
| Move column; nudge floating left or right        | `Meta+Ctrl+H/L` or `Meta+Ctrl+Left/Right`            |
| Move active column to first or last              | `Meta+Ctrl+Home/End`                                 |
| Move window; nudge floating down or up           | `Meta+Ctrl+J/K` or `Meta+Ctrl+Down/Up`               |
| Consume or expel the active window left or right | `Meta+[` or `Meta+]`                                 |
| Consume the right column's top window            | `Meta+,`                                             |
| Expel the active column's bottom window          | `Meta+.`                                             |
| Move active column to next or previous desktop   | `Meta+Ctrl+U/I` or `Meta+Ctrl+Page Down/Page Up`     |
| Move active column to desktop 1 through 9        | `Meta+Ctrl+1..9`                                     |
| Move active column or floating window to output  | `Meta+Ctrl+Shift+H/J/K/L` or `Meta+Ctrl+Shift+Arrow` |
| Toggle floating                                  | `Meta+V`                                             |
| Switch focus between tiled and floating layers   | `Meta+Shift+V`                                       |
| Toggle stacked or tabbed column presentation     | `Meta+W`                                             |
| Toggle native fullscreen                         | `Meta+Shift+F`                                       |
| Toggle native maximize to work-area edges        | `Meta+M`                                             |
| Close active window                              | `Meta+Q`                                             |
| Cycle preset column or floating width            | `Meta+R` forward, `Meta+Shift+R` backward            |
| Toggle full-width column                         | `Meta+F`                                             |
| Expand active column into available width        | `Meta+Ctrl+F`                                        |
| Center column or active manually floating window | `Meta+C`                                             |
| Center fully visible columns                     | `Meta+Ctrl+C`                                        |
| Decrease or increase column or floating width    | `Meta+-` or `Meta+=`                                 |
| Decrease or increase active window height        | `Meta+Shift+-` or `Meta+Shift+=`                     |
| Cycle preset window height forward               | `Meta+Ctrl+Shift+R`                                  |
| Reset active window height to automatic          | `Meta+Ctrl+R`                                        |

Single-window desktop/output transfer, direct insertion into the nearest
existing stack, one-way tiled/floating layer focus, contextual width reset, and
reverse height preset cycling are registered without default keys.
Assign them in **System Settings > Keyboard > Shortcuts** if needed.

Explicit state actions are also unbound. `driftile_move_window_to_floating`
and `driftile_move_window_to_tiling` move only when the active window is in the
other managed layer. Repeating either action is a no-op. Automatically excluded
windows remain outside both paths.

`driftile_center_window` uses the same contextual centering as `Meta+C`.
`driftile_switch_preset_window_width` and
`driftile_switch_preset_window_width_back` cycle the same configured width
presets; for a tiled member, Driftile's one-width-per-column model resizes its
containing column.

**Focus last-used desktop** (`driftile_focus_last_used_desktop`) is also
unbound. It toggles between the current desktop and the most recently selected
distinct desktop on the active output. Histories stay isolated per output when
KWin exposes per-output desktops; the global-desktop fallback updates every
output together. Removed or stale targets and stopped or blocked operations are
no-ops. The history is session-only and is not persisted.

You may assign `Meta+Tab` manually in System Settings, or add the action with a
supported chord to a custom JSON v1 profile. The bundled defaults remain
unchanged.

Four alternative vertical-boundary actions are also unbound by default:

- **Focus up or previous desktop** and **Focus down or next desktop** navigate
  inside the active column, then change desktop only at its visible boundary.
- **Move window up or to previous desktop** and **Move window down or to next
  desktop** reorder inside the active column, then transfer the window only at
  its structural boundary.

The existing `Meta+J/K`, `Meta+Down/Up`, and matching `Meta+Ctrl` bindings keep
their current behavior. Assign the alternatives manually, or use a custom JSON
v1 profile to replace those four ordinary vertical actions:

```json
{
  "version": 1,
  "bindings": {
    "driftile_focus_window_up_or_previous_desktop": ["Meta+K", "Meta+Up"],
    "driftile_focus_window_down_or_next_desktop": ["Meta+J", "Meta+Down"],
    "driftile_move_window_up_or_to_previous_desktop": [
      "Meta+Ctrl+K",
      "Meta+Ctrl+Up"
    ],
    "driftile_move_window_down_or_to_next_desktop": [
      "Meta+Ctrl+J",
      "Meta+Ctrl+Down"
    ]
  }
}
```

Focus skips minimized peers when deciding whether a visible boundary was
reached. Reordering still counts minimized peers in the column, so it crosses
them before transferring at the true first or last slot. Manual floating focus
and movement remain local, and blocked or stale operations never fall through
to a desktop change.

Eight matching output-boundary actions are unbound by default. Horizontal
column focus and movement can continue onto the output to the left or right;
vertical window focus and movement can continue onto the output above or
below. Focus crosses only at a visible layout boundary, while movement crosses
only at a structural boundary. Manual floating actions remain local, and an
unavailable output or blocked operation is a no-op.

The action IDs are:

- `driftile_focus_column_or_output_left`
- `driftile_focus_column_or_output_right`
- `driftile_focus_window_up_or_output_up`
- `driftile_focus_window_down_or_output_down`
- `driftile_move_column_left_or_to_output_left`
- `driftile_move_column_right_or_to_output_right`
- `driftile_move_window_up_or_to_output_up`
- `driftile_move_window_down_or_to_output_down`

Six output-cycle actions are also unbound. Focus delegates to Plasma's public
previous/next output actions. Window and whole-column movement use the same
top-to-bottom, then left-to-right output order and wrap at either end while
retaining Driftile's transactional transfer behavior:

- `driftile_focus_output_previous`
- `driftile_focus_output_next`
- `driftile_move_window_to_output_previous`
- `driftile_move_window_to_output_next`
- `driftile_move_column_to_output_previous`
- `driftile_move_column_to_output_next`

Ten additional focus-traversal actions are unbound. They provide:

- column wrapping through `driftile_focus_column_right_or_first` and
  `driftile_focus_column_left_or_last`;
- vertical focus followed by the adjacent column through
  `driftile_focus_window_down_or_column_left`,
  `driftile_focus_window_down_or_column_right`,
  `driftile_focus_window_up_or_column_left`, and
  `driftile_focus_window_up_or_column_right`;
- direct and wrapping vertical edges through `driftile_focus_window_top`,
  `driftile_focus_window_bottom`, `driftile_focus_window_down_or_top`, and
  `driftile_focus_window_up_or_bottom`.

Fallback happens only after reaching a visible boundary. A rejected or blocked
target remains a no-op. Floating windows use their frame centers for vertical
edges, stay in the floating layer, and never fall through to a tiled column.

`driftile_focus_window_in_column_1` through
`driftile_focus_window_in_column_9` are unbound direct selectors. Their
one-based index counts non-minimized members of the active tiled column. An
index past the end selects the last visible member. Floating focus, the already
selected member, and blocked or rejected targets are no-ops.

`driftile_focus_column_1` through `driftile_focus_column_9` are also unbound.
Their one-based index counts columns with a visible member and clamps past the
end. A floating source switches directly to the selected tiled column; a
rejected target leaves the previous focus layer unchanged.

`driftile_move_column_to_index_1` through
`driftile_move_column_to_index_9` move the active tiled column to a one-based
structural position. An oversized position clamps to the last column. The
current position, floating focus, and rejected geometry remain no-ops.

Five further actions are unbound. `driftile_focus_window_previous` returns to
the most recently focused tiled or manually floating window; repeated use
toggles between the latest pair. Minimized windows and automatic popups are
skipped, and the history lasts only for the current session.

`driftile_swap_window_left` and `driftile_swap_window_right` exchange the
active window with the selected member of an adjacent column. Two singleton
columns move as complete columns. `driftile_set_column_stacked_display` and
`driftile_set_column_tabbed_display` select a presentation explicitly; choosing
the current presentation is a no-op.

The four preset actions retain the IDs
`driftile_switch_preset_column_width`,
`driftile_switch_preset_column_width_back`,
`driftile_switch_preset_window_height`, and
`driftile_switch_preset_window_height_back`. KGlobalAccel preserves existing
assignments. Fresh records use `Meta+R` and `Meta+Shift+R` for width, and
`Meta+Ctrl+Shift+R` for forward height; reverse height remains unbound.

`driftile_move_window_to_desktop_1` through
`driftile_move_window_to_desktop_9` directly transfer one active window to a
numbered desktop and are also unbound by default. They do not change the
helper-owned default profile.

`driftile_insert_window_into_stack_left` and
`driftile_insert_window_into_stack_right` remain unbound. With one active
relation-free manually floating window, direction compares its frame center
with solved column centers in the current output and desktop. Off-screen
columns participate, singleton columns are skipped, and selection does not
wrap. The nearest structural multi-window stack is the only candidate; an
unsafe candidate makes the command a no-op instead of routing farther.

A successful contextual insertion appends and selects the active window. The
target width and stacked or tabbed presentation win, the inserted height is
automatic, and focus is retained. Floating ownership and the tiled layout stay
unchanged while guarded geometry writes are staged. Failure compensates frames
that still have valid write ownership and otherwise schedules dirty-context
recovery. Automatic, related, minimized, native-state, pending, stale, or
otherwise unsafe active windows fail closed without tiled fallback. This adds no
action, default binding, setting, schema, persistence field, helper, overview,
or KWin API.

On a fresh shortcut record, the separately installed overview effect offers
`Meta+O` when enabled. KGlobalAccel preserves the current assignment across
effect unloads and upgrades; the retained action is inert while unloaded. Its
assignment is managed through the same Shortcuts page.

Version 1.19.0 adds `Meta+W` and `Meta+Q`. `Meta+W` toggles the active tiled
column between stacked and tabbed presentation and has no alias. In tabbed
presentation, `Meta+J/K` selects the next or previous member and
`Meta+Ctrl+J/K` reorders the selected member, both without wrapping. Height
adjustment, reset, and preset actions are no-ops until stacked presentation is
restored. `Meta+Q` delegates closing the active window to KWin. `Meta+C`
remains the contextual centering action.

Layer focus is context-local. It restores the last focused non-minimized window
in the other layer. Minimized slots are skipped, but any other blocker on the
selected remembered or ordered target makes the command a no-op instead of
choosing a different window. A tiled fallback in another column is selected and
revealed with the normal minimal scroll before KWin receives focus.

When a floating window is active, `H/J/K/L` select the nearest floating-window
center on the requested axis. `Home/End` select the leftmost or rightmost
floating frame. Navigation stays inside the current output and desktop, does
not wrap, skips minimized windows, and leaves every frame unchanged.

`Meta+Ctrl+H/J/K/L` and the matching arrows move an active manually floating
window by 50 logical pixels. The frame may move partly outside the work area,
but 10–75 pixels remain visible on each axis depending on its size; a frame
smaller than 10 pixels stays fully visible. The action preserves frame size,
focus, output, desktop, and every tiled layout. Automatic layout exclusions
remain under KWin geometry ownership.

`Meta+C`, `Meta+-`, and `Meta+=` act contextually on an active manually
floating window. `Meta+C` centers its frame in the assigned output and desktop
work area: each smaller dimension uses its exact logical midpoint, while an
oversized dimension starts at the work-area origin. The width keys change the
decorated frame width by the configured step percentage of the assigned
work-area width, excluding the gap. Height and top-left stay unchanged unless
the partial-visibility bounds require the minimal origin clamp that keeps 10–75
logical pixels visible. Both preserve focus, context, reinsertion placement,
and every tiled layout; centering also preserves size. An already centered,
automatically excluded, or stale center target is a no-op. Width state commits
only after an exact synchronous or asynchronous acknowledgement. Pending,
blocked, or native-state width targets are no-ops and never fall through to
tiled behavior. Existing tiled behavior is unchanged.

`Meta+R`, `Meta+Shift+R`, and the unbound **Reset column width** action are also
contextual. A relation-free manually floating target
reads the configured column-width presets or global default. Each percentage
uses the same gap-adjusted singleton resolution, live decorated constraints,
assigned-output pixel grid, and partial-visibility bounds as tiled width
resolution. Height, focus, context, reinsertion placement, and every tiled
layout stay unchanged. Only exact acknowledgement commits the frame.
Automatic, related, pending, or otherwise blocked floating targets are no-ops
without tiled fallback. The geometry path adds no persistence or helper
behavior.

Fixed `px` width presets resolve directly in logical pixels; mixed fixed and
proportional presets retain their configured cycle order.

`Meta+Shift+-` and `Meta+Shift+=` are also contextual. On an active manually
floating window, they change the decorated frame height by
`WindowHeightStepPercent` of the assigned work-area height, excluding the gap.
Width and top-left stay unchanged unless the partial-visibility bounds require
the minimal origin clamp. The height snaps with the assigned output's
device-pixel ratio and is clamped to live decorated constraints. Tiled stack
behavior is unchanged; height state commits only after exact acknowledgement,
and a blocked or pending floating target never falls through to stack resizing.

`Meta+Ctrl+Shift+R` and the unbound reverse window-height preset action are
also contextual for one active relation-free manually floating window.
`WindowHeightPresets` accepts up to 16 mixed percentages and fixed `px` client
heights; a blank value uses the exact `1/3`, `1/2`, and `2/3` proportions.
Proportional targets resolve as
`percentage / 100 * (workArea.height - gap) - gap`. The canonical start at
`workArea.y + gap` and the end at `start + rawHeight` are snapped to the
assigned output's pixel grid for both cycles.

The shared one-request transaction applies decorated constraints and partial
reachability while preserving width, focus, context, reinsertion anchor, and
every tiled layout; top-left changes only for the minimal reachability clamp.
Only exact acknowledgement commits. A blocked active floating target fails
closed without tiled fallback. Changing `WindowHeightPresets` performs no
immediate geometry, layout, viewport, or focus write. Window-height reset
remains tiled-only.

Driftile does not register a minimize action or default shortcut; KWin owns the
mechanism. A minimized tiled window retains its exact logical slot, and a
minimized manually floating window retains its exact frame for restoration.
Directional, edge, and layer focus skip minimized slots and fully minimized
columns without wrapping. They do not skip other suspension blockers. Commands
may reorder or extract a visible stack member past settled minimized peers.
Direct insertion may also cross settled minimized peers in its participating
source and target columns, including a fully minimized target stack; skipped
singleton columns are nonparticipants. Passive order, height state, minimized
state, and externally changed hidden frames remain authoritative without
geometry writes. Fullscreen, maximized, native-tiled, restore- or
toggle-settling, and other blockers in either participating column make the
action a no-op. A state round trip during reflow cancels and rolls back the
edit.
Consume may also move the visible top member of the immediate-right column past
settled minimized passive peers in either column. Hidden frames remain
untouched. Expel may move a visible bottom member past minimized passive peers
when its retained focus target is visible. An active bottom member hands focus
only to its immediate predecessor; a minimized predecessor makes the command a
no-op. The structural edit waits for KWin to confirm that handoff and is
discarded if the original layout or participants change. Whole-column desktop
and output transfers may carry settled minimized passive members without layout
geometry writes. A secondary single-window desktop or output transfer may
extract the visible active member while settled minimized passive members in
the same source column remain untouched. Those retained members keep their
logical slots, height state, minimized state, and frames, and receive no
desktop, output, or geometry writes. Minimized windows elsewhere in the source
or target context and other undocumented hidden-member edits remain
fail-closed. These secondary actions remain unbound by default.

Native maximize extracts an active member of a regular vertical stack into a
new singleton column immediately to the right. The column remains separate
after unmaximize. Maximizing an existing singleton or floating window does not
change its layout ownership.

Native fullscreen uses the same extraction rule for a regular vertical stack.
The singleton remains separate after leaving fullscreen. Existing singleton
and floating ownership is unchanged.

Full-width mode keeps the active frame inside equal configured outer gaps.
Adjacent frames stay at least one physically aligned configured gap beyond the
corresponding viewport edge; a zero gap adds no clearance. When focus moves to
a normal predecessor, a full-width successor keeps its natural strip position
and can remain partially visible. Toggling full width again restores the prior
column width while retaining the current viewport and horizontal anchor. This
geometry rule adds no state, schema, or binding. The immediate normal successor
of an inactive full-width column starts at the left work-area gap while the
predecessor stays beyond the left viewport edge.

Available-width expansion grows the active column into the unused horizontal
space, up to its shared window constraints, without hiding any currently fully
visible column. Visible-column centering changes only the viewport position.

Default desktop and output transfers move the whole active column atomically.
They preserve member order, column width, and the active member; a rejected
KWin mechanism or geometry write leaves both contexts unchanged.

Desktop reordering asks KWin to move the currently selected desktop by exactly
one position in its global list. It does not wrap. Desktop IDs, per-output
selections, and window memberships remain unchanged. The shared empty tail is
pinned at the end. When the optional leading empty desktop is enabled, it is
pinned at the beginning. Neither boundary nor another desktop can cross a
pinned boundary. On KWin X11 builds without the reorder method, these actions
leave the desktop list and all window state unchanged.

`driftile_move_desktop_to_index_1` through
`driftile_move_desktop_to_index_9` are unbound direct reorder actions. Their
one-based positions count only movable desktops, an oversized position clamps
to the last movable desktop, and the protected empty boundaries remain pinned.
The current position and an unavailable or rejected KWin reorder are no-ops.

When the floating layer is active, desktop transfer shortcuts move only the
active floating window and preserve its frame. Modal and transient families
are left in place because KWin moves those relationships as a group.

Output transfer shortcuts are contextual in the same way. They move only one
relation-free active floating window to the deterministic adjacent output and
adopt that output's selected desktop without switching desktops. KWin chooses
the destination frame; Driftile does not write geometry or either tiled layout.
Blocked floating targets do not fall through to whole-column transfer.

Numbered desktop actions use one-based positions by default. A number beyond
the current desktop count selects the shared trailing empty desktop; moving a
column or one window there causes Driftile to append a new empty tail through
KWin. The optional numbered-target map redirects an existing slot to one exact,
unique live desktop name for focus and both transfer variants. Unconfigured
slots keep positional behavior; missing or ambiguous configured names are
no-ops.

`Meta+,` appends the immediate right column's top window to the active column.
`Meta+.` creates a new right column from the active column's bottom window.
Both keep focus in the active column and stop at an unavailable boundary.

## Shortcut ownership

KGlobalAccel is the live source of truth for shortcuts. Assignments changed in
**System Settings > Keyboard > Shortcuts** take effect immediately. The
optional helper performs one explicit transaction; it does not watch a profile
file or override later System Settings changes.

Plasma already owns some default sequences. Plasma normally assigns `Meta+W`
to its Overview and may assign `Meta+Q` to the Activity Switcher. Claiming the
1.19.0 default profile temporarily transfers those chords to Driftile;
releasing the profile restores the unchanged Plasma assignments. A release
provides the optional versioned helper documented in
[Installation](installation.md). From a source checkout, enable Driftile and
claim the complete default profile explicitly:

```bash
npm run shortcuts:claim
npm run shortcuts:check
```

Claiming saves every displaced active assignment under `$XDG_STATE_HOME` before
changing KGlobalAccel. Release restores unchanged assignments and preserves
shortcuts edited after the claim:

```bash
npm run shortcuts:release
```

`npm run uninstall:dev` releases a saved profile before removing the package.
`npm run upgrade:dev` releases the old profile before installing an updated
package; claim the current profile again after enabling the script.
Release it manually before disabling Driftile or uninstalling through another
tool. Use `-- --force` with a claim or release only when replacing later manual
edits is intentional.

## Custom profiles

A custom profile is strict JSON with exactly `version` and `bindings` at the
root:

```json
{
  "version": 1,
  "bindings": {
    "driftile_focus_column_left": ["Meta+A", "Meta+Left"],
    "driftile_reset_column_width": []
  }
}
```

`bindings` must contain at least one registered Driftile action ID. Each listed
action is replaced with exactly the normalized alternatives in its array;
`[]` unbinds the action. Omitted action lists remain untouched unless they own a
chord requested by a listed action, in which case only that chord is displaced.
Unknown fields, action IDs, and duplicate normalized shortcuts are rejected.
The [shortcut action catalog](../src/shortcut-actions.ts) contains the action
IDs accepted by the current source.

Each string must be one chord. It may use the case-sensitive modifiers `Meta`,
`Ctrl`, `Alt`, and `Shift` in any order, followed by one character or one of
`Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PgUp`, and `PgDown`. Letter keys
normalize to uppercase. Multi-step sequences and duplicate modifiers are not
supported. With a shifted digit or punctuation key, write the produced
character without `Shift`, such as `Meta+_` or `Meta++`; layout-dependent
spellings such as `Meta+Shift+-` are rejected.

Pass the same file to `claim` and `check`. Release uses the saved transaction,
so it takes no profile argument:

```bash
npm run shortcuts:claim -- --profile ./shortcuts.json
npm run shortcuts:check -- --profile ./shortcuts.json
npm run shortcuts:release
```

`check --profile` compares the listed arrays with live KGlobalAccel state; it
does not require or inspect a saved claim.

The helper parses the file and validates the replacement plan before applying
that plan. It removes requested chords from their current owners, preserves
those owners' other chords, and rolls back a failed claim. A reassignment cycle
is rejected before the claim writes shortcuts; first unbind one participating
action in System Settings, then claim again.

A claimed profile is identified by its normalized contents. To change it,
release the saved claim first, then claim the new file. Normal release restores
unchanged displaced assignments and preserves later System Settings edits;
`--force` is the explicit overwrite path.

Release before removing the Nix package because its recovery command is shipped
with that package.

If the current source no longer builds, run the last built recovery helper
directly: `node dist/bin/driftile-shortcuts.mjs release`.
