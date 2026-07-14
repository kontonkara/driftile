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
| Move active column to another output             | `Meta+Ctrl+Shift+H/J/K/L` or `Meta+Ctrl+Shift+Arrow` |
| Toggle floating                                  | `Meta+V`                                             |
| Switch focus between tiled and floating layers   | `Meta+Shift+V`                                       |
| Toggle stacked or tabbed column presentation     | `Meta+W`                                             |
| Toggle native fullscreen                         | `Meta+Shift+F`                                       |
| Toggle native maximize to work-area edges        | `Meta+M`                                             |
| Cycle preset column width forward or back        | `Meta+R` or `Meta+Shift+R`                           |
| Toggle full-width column                         | `Meta+F`                                             |
| Expand active column into available width        | `Meta+Ctrl+F`                                        |
| Center column or active manually floating window | `Meta+C`                                             |
| Center fully visible columns                     | `Meta+Ctrl+C`                                        |
| Decrease or increase column or floating width    | `Meta+-` or `Meta+=`                                 |
| Decrease or increase active window height        | `Meta+Shift+-` or `Meta+Shift+=`                     |
| Cycle preset window height forward               | `Meta+Ctrl+Shift+R`                                  |
| Reset active window height to automatic          | `Meta+Ctrl+R`                                        |

Single-window desktop/output transfer, direct insertion into the nearest
existing stack, one-way tiled/floating layer focus, resetting a column width,
and reverse window-height preset cycling are registered without default keys.
Assign them in **System Settings > Keyboard > Shortcuts** if needed.

Version 1.19.0 adds only `Meta+W`. It toggles the active tiled column between
stacked and tabbed presentation and has no alias. In tabbed presentation,
`Meta+J/K` selects the next or previous member and `Meta+Ctrl+J/K` reorders the
selected member, both without wrapping. Height adjustment, reset, and preset
actions are no-ops until stacked presentation is restored.

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
tiled behavior. Existing tiled behavior is unchanged; no action, binding,
setting, or schema is added.

`Meta+Shift+-` and `Meta+Shift+=` are also contextual. On an active manually
floating window, they change the decorated frame height by
`WindowHeightStepPercent` of the assigned work-area height, excluding the gap.
Width and top-left stay unchanged unless the partial-visibility bounds require
the minimal origin clamp. The height snaps with the assigned output's
device-pixel ratio and is clamped to live decorated constraints. Tiled stack
behavior is unchanged; height state commits only after exact acknowledgement,
and a blocked or pending floating target never falls through to stack resizing.
Reset and height-preset actions remain tiled-only. No action, binding, setting,
or schema is added.

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

Window-height presets are `1/3`, `1/2`, and `2/3` of the work area, with gaps
included in the calculation.

Native maximize extracts an active member of a regular vertical stack into a
new singleton column immediately to the right. The column remains separate
after unmaximize. Maximizing an existing singleton or floating window does not
change its layout ownership.

Native fullscreen uses the same extraction rule for a regular vertical stack.
The singleton remains separate after leaving fullscreen. Existing singleton
and floating ownership is unchanged.

Full-width mode keeps the active frame inside equal configured outer gaps.
Adjacent frames stay at least one physically aligned configured gap beyond the
corresponding viewport edge. A full-width frame remains outside that edge when
focus moves to a neighboring column; a zero gap adds no clearance. Toggling it
again restores the prior column width while retaining the current viewport and
horizontal anchor. This geometry rule adds no state, schema, or binding.
The immediate normal successor of an inactive full-width column starts at the
left work-area gap while the predecessor stays beyond the left viewport edge.

Available-width expansion grows the active column into the unused horizontal
space, up to its shared window constraints, without hiding any currently fully
visible column. Visible-column centering changes only the viewport position.

Default desktop and output transfers move the whole active column atomically.
They preserve member order, column width, and the active member; a rejected
KWin mechanism or geometry write leaves both contexts unchanged.

Desktop reordering asks KWin to move the currently selected desktop by exactly
one position in its global list. It does not wrap. Desktop IDs, per-output
selections, and window memberships remain unchanged. The shared empty tail is
pinned at the end, so neither it nor another desktop can cross it. On KWin X11
builds without the reorder method, these actions leave the desktop list and all
window state unchanged.

When the floating layer is active, desktop transfer shortcuts move only the
active floating window and preserve its frame. Modal and transient families
are left in place because KWin moves those relationships as a group.

Numbered desktop actions use one-based positions. A number beyond the current
desktop count selects the shared trailing empty desktop; moving a column there
causes Driftile to append a new empty tail through KWin.

`Meta+,` appends the immediate right column's top window to the active column.
`Meta+.` creates a new right column from the active column's bottom window.
Both keep focus in the active column and stop at an unavailable boundary.

## Shortcut ownership

KGlobalAccel is the live source of truth for shortcuts. Assignments changed in
**System Settings > Keyboard > Shortcuts** take effect immediately. The
optional helper performs one explicit transaction; it does not watch a profile
file or override later System Settings changes.

Plasma already owns some default sequences. Plasma normally assigns `Meta+W`
to its Overview. Claiming the 1.19.0 default profile temporarily transfers that
chord to Driftile; releasing the profile restores the unchanged Overview
assignment. A release provides the optional versioned helper documented in
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
