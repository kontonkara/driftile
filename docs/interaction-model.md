# Interaction Model

Driftile uses one keyboard grammar and does not wrap at layout boundaries:

- `Meta` focuses in a direction.
- Adding `Ctrl` moves the focused window or column in that direction.
- Adding `Shift` to a monitor direction targets another output.
- `U/I` address the next and previous virtual desktop.

## Delivery contract

| Area                 | Required behavior                                                                                        | Target    |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| Horizontal strip     | Focus and reorder columns; focus or move to first and last; reveal with minimal scrolling                | MVP       |
| Vertical column      | Focus and reorder members; consume or expel a member on either side                                      | Available |
| Column view          | Cycle `1/3`, `1/2`, and `2/3` widths in both directions; adjust by 10%; toggle full width; center        | Available |
| Advanced column view | Fill available width and center all visible columns                                                      | MVP       |
| Window height        | Adjust by 10%, reset to automatic, and cycle height presets                                              | MVP       |
| Virtual desktops     | Focus adjacent desktops and transfer the whole active column                                             | Available |
| Outputs              | Focus an adjacent output and transfer the whole active column                                            | Available |
| Window state         | Preserve layout participation through fullscreen and maximize; define a separate minimized-window policy | MVP       |
| Floating layer       | Toggle tiled/floating state and switch focus between both layers                                         | MVP       |
| Tabbed columns       | Toggle a column between stacked and tabbed presentation without changing navigation                      | v1        |
| Pointer input        | Provide wheel navigation and mouse rearrangement with the same model as keyboard commands                | v1        |

Single-window transfers will remain available as secondary, unbound actions.
Default desktop and output transfer shortcuts must move the whole active column.

## KWin boundary

KWin owns fullscreen, maximize, minimize, output transfer, and virtual-desktop
mechanisms. Driftile owns their layout semantics.

Plasma exposes one global virtual-desktop list. Driftile keeps independent
layout state per output and uses output-local desktop selection where KWin
supports it, but it cannot create private per-output desktop lists.
