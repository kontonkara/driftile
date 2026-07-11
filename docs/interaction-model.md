# Interaction Model

Driftile uses one keyboard grammar and does not wrap at layout boundaries:

- `Meta` focuses in a direction.
- Adding `Ctrl` moves the focused window or column in that direction.
- Adding `Shift` to a monitor direction targets another output.
- `Home/End` focus the first or last column; adding `Ctrl` moves the active column to that edge.
- `U/I` address the next and previous virtual desktop.
- `1..9` address a virtual desktop directly; adding `Ctrl` moves the active column there.

## Delivery contract

| Area                 | Required behavior                                                                                 | Target    |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| Horizontal strip     | Focus and reorder columns; focus or move to first and last; reveal with minimal scrolling         | Available |
| Vertical column      | Focus and reorder members; consume or expel active, top, or bottom members                        | Available |
| Column view          | Cycle `1/3`, `1/2`, and `2/3` widths in both directions; adjust by 10%; toggle full width; center | Available |
| Advanced column view | Fill available width and center all fully visible columns                                         | Available |
| Window height        | Adjust one window by 10%; reset to automatic; cycle `1/3`, `1/2`, and `2/3` presets               | Available |
| Virtual desktops     | Focus adjacent or numbered desktops; transfer a tiled column or one active floating window        | Available |
| Outputs              | Focus an adjacent output and transfer the whole active column                                     | Available |
| Fullscreen           | Extract a regular stack member, then toggle native fullscreen through KWin                        | Available |
| Native maximize      | Extract a regular stack member, then toggle it to work-area edges through KWin                    | Available |
| Window state         | Complete minimized-window policies                                                                | MVP       |
| Floating layer       | Toggle state, switch layers, and navigate floating windows geometrically                          | Available |
| Tabbed columns       | Toggle a column between stacked and tabbed presentation without changing navigation               | v1        |
| Pointer input        | Provide wheel navigation and mouse rearrangement with the same model as keyboard commands         | v1        |

Single-window transfers will remain available as secondary, unbound actions.
Default desktop and output transfer shortcuts must move the whole active column.
An active floating layer changes desktop transfer to the active window only.

A stack has at most one fixed or preset window height. Changing a different
member converts the other members to weighted automatic heights that preserve
their visible proportions while sharing the remaining work-area height. Reset
returns the active member to automatic sizing.

## KWin boundary

KWin owns fullscreen, maximize, minimize, output transfer, and virtual-desktop
mechanisms. Driftile owns their layout semantics.

When a member of a regular vertical stack enters fullscreen or is maximized,
Driftile extracts it into a singleton column immediately to the right. Leaving
the native state keeps that column separate. A singleton or floating window
keeps its existing layout ownership.

Plasma exposes one global virtual-desktop list. Driftile keeps independent
layout state per output and uses output-local desktop selection where KWin
supports it, but it cannot create private per-output desktop lists.
