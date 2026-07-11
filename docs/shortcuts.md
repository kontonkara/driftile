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
| Move column left or right                        | `Meta+Ctrl+H/L` or `Meta+Ctrl+Left/Right`            |
| Move active column to first or last              | `Meta+Ctrl+Home/End`                                 |
| Move window down or up in a column               | `Meta+Ctrl+J/K` or `Meta+Ctrl+Down/Up`               |
| Consume or expel the active window left or right | `Meta+[` or `Meta+]`                                 |
| Consume the right column's top window            | `Meta+,`                                             |
| Expel the active column's bottom window          | `Meta+.`                                             |
| Move active column to next or previous desktop   | `Meta+Ctrl+U/I` or `Meta+Ctrl+Page Down/Page Up`     |
| Move active column to desktop 1 through 9        | `Meta+Ctrl+1..9`                                     |
| Move active column to another output             | `Meta+Ctrl+Shift+H/J/K/L` or `Meta+Ctrl+Shift+Arrow` |
| Toggle floating                                  | `Meta+V`                                             |
| Switch focus between tiled and floating layers   | `Meta+Shift+V`                                       |
| Toggle native fullscreen                         | `Meta+Shift+F`                                       |
| Toggle native maximize to work-area edges        | `Meta+M`                                             |
| Cycle preset column width forward or back        | `Meta+R` or `Meta+Shift+R`                           |
| Toggle full-width column                         | `Meta+F`                                             |
| Expand active column into available width        | `Meta+Ctrl+F`                                        |
| Center active column                             | `Meta+C`                                             |
| Center fully visible columns                     | `Meta+Ctrl+C`                                        |
| Decrease or increase column width by 10%         | `Meta+-` or `Meta+=`                                 |
| Decrease or increase active window height by 10% | `Meta+Shift+-` or `Meta+Shift+=`                     |
| Cycle preset window height forward               | `Meta+Ctrl+Shift+R`                                  |
| Reset active window height to automatic          | `Meta+Ctrl+R`                                        |

Single-window desktop/output transfer, direct insertion into the nearest
existing stack, one-way tiled/floating layer focus, resetting a column width,
and reverse window-height preset cycling are registered without default keys.
Assign them in **System Settings > Keyboard > Shortcuts** if needed.

Layer focus is context-local. It restores the last focused non-minimized window
in the other layer. Minimized slots are skipped, but any other blocker on the
selected remembered or ordered target makes the command a no-op instead of
choosing a different window. A tiled fallback in another column is selected and
revealed with the normal minimal scroll before KWin receives focus.

When a floating window is active, `H/J/K/L` select the nearest floating-window
center on the requested axis. `Home/End` select the leftmost or rightmost
floating frame. Navigation stays inside the current output and desktop, does
not wrap, skips minimized windows, and leaves every frame unchanged.

Driftile does not register a minimize action or default shortcut; KWin owns the
mechanism. A minimized tiled window retains its exact logical slot, and a
minimized manually floating window retains its exact frame for restoration.
Directional, edge, and layer focus skip minimized slots and fully minimized
columns without wrapping. They do not skip other suspension blockers. Commands
may reorder or extract a visible stack member past settled minimized peers.
Consume may also move the visible top member of the immediate-right column past
settled minimized passive peers in either column. Hidden frames remain
untouched. Expel and whole-column transfers still require every participant to
be writable; other hidden-member edit semantics remain MVP work.

Window-height presets are `1/3`, `1/2`, and `2/3` of the work area, with gaps
included in the calculation.

Native maximize extracts an active member of a regular vertical stack into a
new singleton column immediately to the right. The column remains separate
after unmaximize. Maximizing an existing singleton or floating window does not
change its layout ownership.

Native fullscreen uses the same extraction rule for a regular vertical stack.
The singleton remains separate after leaving fullscreen. Existing singleton
and floating ownership is unchanged.

Available-width expansion grows the active column into the unused horizontal
space, up to its shared window constraints, without hiding any currently fully
visible column. Visible-column centering changes only the viewport position.

Default desktop and output transfers move the whole active column atomically.
They preserve member order, column width, and the active member; a rejected
KWin mechanism or geometry write leaves both contexts unchanged.

When the floating layer is active, desktop transfer shortcuts move only the
active floating window and preserve its frame. Modal and transient families
are left in place because KWin moves those relationships as a group.

Numbered desktop actions use one-based positions. A number beyond the current
desktop count selects the shared trailing empty desktop; moving a column there
causes Driftile to append a new empty tail through KWin.

`Meta+,` appends the immediate right column's top window to the active column.
`Meta+.` creates a new right column from the active column's bottom window.
Both keep focus in the active column and stop at an unavailable boundary.

Plasma already owns some listed sequences. During development, enable Driftile
and claim the complete profile explicitly:

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

Release before removing the Nix package because its recovery command is shipped
with that package.

If the current source no longer builds, run the last built recovery helper
directly: `node dist/bin/driftile-shortcuts.mjs release`.
