# Shortcuts

Driftile registers these defaults through KWin. `H/J/K/L` and the matching
arrow keys are interchangeable unless noted otherwise.

| Action                                           | Default                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| Focus column left or right                       | `Meta+H/L` or `Meta+Left/Right`                      |
| Focus window down or up in a column              | `Meta+J/K` or `Meta+Down/Up`                         |
| Focus output in a direction                      | `Meta+Shift+H/J/K/L` or `Meta+Shift+Arrow`           |
| Focus next or previous desktop                   | `Meta+U/I` or `Meta+Page Down/Page Up`               |
| Move column left or right                        | `Meta+Ctrl+H/L` or `Meta+Ctrl+Left/Right`            |
| Move window down or up in a column               | `Meta+Ctrl+J/K` or `Meta+Ctrl+Down/Up`               |
| Consume or expel the active window left or right | `Meta+[` or `Meta+]`                                 |
| Move active column to next or previous desktop   | `Meta+Ctrl+U/I` or `Meta+Ctrl+Page Down/Page Up`     |
| Move active column to another output             | `Meta+Ctrl+Shift+H/J/K/L` or `Meta+Ctrl+Shift+Arrow` |
| Toggle floating                                  | `Meta+V`                                             |
| Cycle preset column width forward or back        | `Meta+R` or `Meta+Shift+R`                           |
| Toggle full-width column                         | `Meta+F`                                             |
| Center active column                             | `Meta+C`                                             |
| Decrease or increase column width by 10%         | `Meta+-`, `Meta+=`, or `Meta++`                      |

Single-window desktop/output transfer, direct insertion into the nearest
existing stack, and resetting a column width are registered without default
keys. Assign them in **System Settings > Keyboard > Shortcuts** if needed.

Default desktop and output transfers move the whole active column atomically.
They preserve member order, column width, and the active member; a rejected
KWin mechanism or geometry write leaves both contexts unchanged.

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
