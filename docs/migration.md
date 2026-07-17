# Migration

The latest stable release is 1.56.0. Use the steps below when changing release
generations, and never combine files from different releases.

## Upgrade from 1.55.0 to 1.56.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.56.0 artifacts, or pin the Nix input to `v1.56.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, schemas, actions, default
bindings, layout, and input behavior are unchanged. Upgrade the optional
Overview package to show static labels on ordinary large thumbnails. A
normalized caption is primary; the application identity is its fallback or a
distinct secondary line. Tabs and minimized placeholders share the normalized
text, while small thumbnails keep their existing presentation without a
footer. The main script and transition effect retain their 1.55.0 behavior.

## Roll back from 1.56.0 to 1.55.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.55.0 artifacts or pin the Nix input to
`v1.55.0` and rebuild. Both versions use logical layout state v4 with the same
settings, schemas, actions, default bindings, layout, and input behavior. The
older Overview safely omits the static labels while retaining actionable
minimized tabs and placeholders.

## Upgrade from 1.54.0 to 1.55.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.55.0 artifacts, or pin the Nix input to `v1.55.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, schemas, actions, and default
bindings are unchanged. Upgrade the optional Overview package to show compact
placeholders for eligible minimized stacked tiled members and tracked floating
windows without tabs. Activating a placeholder restores and focuses that exact
window; `Delete` and middle click close it without restoring it. Placeholders
cannot be dragged. The main script and transition effect retain their 1.54.0
behavior.

## Roll back from 1.55.0 to 1.54.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.54.0 artifacts or pin the Nix input to
`v1.54.0` and rebuild. Both versions use logical layout state v4 with the same
settings, schemas, actions, and default bindings. The older Overview retains
actionable minimized member tabs but safely omits stacked and floating
placeholders.

## Upgrade from 1.53.0 to 1.54.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.54.0 artifacts, or pin the Nix input to `v1.54.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, actions, and default bindings
are unchanged. Upgrade the optional Overview package to restore, focus, close,
search, and navigate minimized member tabs; the main script and transition
effect retain their 1.53.0 behavior.

## Roll back from 1.54.0 to 1.53.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.53.0 artifacts or pin the Nix input to
`v1.53.0` and rebuild. Both versions use logical layout state v4 with the same
settings and actions. The older Overview keeps minimized tabs visible but
non-actionable.

## Upgrade from 1.52.0 to 1.53.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.53.0 artifacts, or pin the Nix input to `v1.53.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, actions, and default bindings
are unchanged. Upgrade the optional Overview package for attention cues and
attention-aware search; the main script and transition effect retain their
1.52.0 behavior.

## Roll back from 1.53.0 to 1.52.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.52.0 artifacts or pin the Nix input to
`v1.52.0` and rebuild. Both versions use logical layout state v4 with the same
settings and actions. The older Overview safely omits the newer read-only cues.

## Upgrade from 1.51.0 to 1.52.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.52.0 artifacts, or pin the Nix input to `v1.52.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and action IDs and default bindings are
unchanged. `DefaultInitialLayout` defaults to `tiled`, so existing configuration
keeps its admission behavior. The exact application map is empty by default;
live changes affect only windows first tracked afterward.

## Roll back from 1.52.0 to 1.51.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.51.0 artifacts or pin the Nix input to
`v1.51.0` and rebuild. Both versions use logical layout state v4 with the same
actions. Driftile 1.51.0 ignores the two newer initial-layout KConfig keys;
remove them if the older settings page should show only supported values.

## Upgrade from 1.50.0 to 1.51.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.51.0 artifacts, or pin the Nix input to `v1.51.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and KWin settings, action IDs, and default
bindings are unchanged. The optional native shortcut editor gains registered
default restoration, keyboard operation, launcher metadata, and a command-line
help/version interface.

## Roll back from 1.51.0 to 1.50.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.50.0 artifacts or pin the Nix input to
`v1.50.0` and rebuild. Both versions use logical layout state v4 with the same
KWin settings and action IDs. Reinstall the matching native shortcut editor if
it is managed separately.

## Upgrade from 1.49.0 to 1.50.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.50.0 artifacts, or pin the Nix input to `v1.50.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. The new initial-width policy defaults off. The native shortcut
editor is a separate optional package and does not add GUI dependencies to the
main extension.

## Roll back from 1.50.0 to 1.49.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.49.0 artifacts or pin the Nix input to
`v1.49.0` and rebuild. Both versions use logical layout state v4 with the same
action IDs. Driftile 1.49.0 ignores the newer initial-width KConfig key; remove
the separately installed shortcut editor if it is no longer wanted.

## Upgrade from 1.48.0 to 1.49.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.49.0 artifacts, or pin the Nix input to `v1.49.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, shortcut IDs, default bindings,
and the optional overview are unchanged. Upgrade the main script for expanded
close-focus recovery and immediate post-workspace focus presentation.

## Roll back from 1.49.0 to 1.48.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.48.0 artifacts or pin the Nix input to
`v1.48.0` and rebuild. Both versions use logical layout state v4 with the same
settings and action IDs, so no state conversion or configuration removal is
required. The 1.48.0 overview package remains compatible.

## Upgrade from 1.47.0 to 1.48.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.48.0 artifacts, or pin the Nix input to `v1.48.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, shortcut IDs, and default
bindings are unchanged. Upgrade the main script for adjacent-column focus
reveals and empty-destination pointer previews. Upgrade the optional transition
effect for continuous rapid retargeting. The optional overview is unchanged.

## Roll back from 1.48.0 to 1.47.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.47.0 artifacts or pin the Nix input to
`v1.47.0` and rebuild. Both versions use logical layout state v4 with the same
settings and action IDs, so no state conversion or configuration removal is
required. The 1.47.0 overview package remains compatible.

## Upgrade from 1.46.0 to 1.47.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.47.0 artifacts, or pin the Nix input to `v1.47.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, shortcut IDs, default bindings,
and both optional effects are unchanged. Upgrade the main script to receive
live exact-window and empty-gutter feedback while dragging a tiled window
between visible outputs or virtual desktops. Layout changes still occur only
after the pointer drop is committed.

## Roll back from 1.47.0 to 1.46.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.46.0 artifacts or pin the Nix input to
`v1.46.0` and rebuild. Both versions use logical layout state v4 with the same
settings and action IDs, so no state conversion or configuration removal is
required.

## Upgrade from 1.45.0 to 1.46.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.46.0 artifacts, or pin the Nix input to `v1.46.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4, and settings, shortcut IDs, and default
bindings are unchanged. Upgrade the main script for close-focus recovery,
target-first focus presentation, and bounded borderless-helper retries. Upgrade
the optional transition effect for settling-resize retargeting and reduced
geometry hot-path work. The optional overview is unchanged.

## Roll back from 1.46.0 to 1.45.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.45.0 artifacts or pin the Nix input to
`v1.45.0` and rebuild. Both versions use logical layout state v4 with the same
settings and action IDs, so no state conversion or configuration removal is
required.

## Upgrade from 1.44.0 to 1.45.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.45.0 artifacts, or pin the Nix input to `v1.45.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   helper profile if needed.

Logical layout state remains v4. Existing numbered actions keep positional
targets unless configured otherwise. The new direct desktop-reorder actions are
unbound, and the exact-name target map is empty by default. Upgrade the main
script for close-focus recovery and direct desktop reordering, and upgrade the
optional transition effect for the latest workspace-handoff behavior.

## Roll back from 1.45.0 to 1.44.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.44.0 artifacts. NixOS and Home Manager users
should remove `settings.numberedDesktopTargets` before restoring the input to
`v1.44.0` and rebuilding. Both versions use logical layout state v4; 1.44.0
ignores the additive KConfig value and does not register the new reorder action
IDs.

## Upgrade from 1.43.0 to 1.44.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.44.0 artifacts, or pin the Nix input to `v1.44.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. Upgrade the optional overview to receive pointer-edge activation,
the configurable backdrop, and empty-card desktop selection. Screen-edge
activation remains disabled unless configured. Home Manager can own the new
nullable overview settings without taking package ownership.

## Roll back from 1.44.0 to 1.43.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.43.0 artifacts. NixOS and Home Manager users
should remove `overview.screenEdge` and `overview.backdropColor` before
restoring the input to `v1.43.0` and rebuilding. Both versions use logical
layout state v4; the older overview ignores retained KConfig values for the
new controls.

## Upgrade from 1.42.0 to 1.43.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.43.0 artifacts, or pin the Nix input to `v1.43.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and settings, shortcut IDs, and default
bindings are unchanged. Upgrade the main script for delayed close-focus and
borderless settlement fixes. Upgrade the optional transition effect for
bounded animation state and automatic launcher exclusion.

## Roll back from 1.43.0 to 1.42.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.42.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.42.0` and rebuild. Both versions use logical
layout state v4 and the same settings, so no state conversion is required.

## Upgrade from 1.41.0 to 1.42.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.42.0 artifacts, or pin the Nix input to `v1.42.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. The global initial destination remains disabled and initial focus
keeps KWin's behavior unless configured. Both affect only genuinely new normal
windows. Upgrade the optional transition effect to receive the rapid desktop
handoff fix.

## Roll back from 1.42.0 to 1.41.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.41.0 artifacts. NixOS and Home Manager users
should remove `defaultInitialDestination` and `defaultInitialFocus` if
configured, restore the input to `v1.41.0`, and rebuild. Both versions use
logical layout state v4, so no state conversion is required. Version 1.41.0
ignores the additive KConfig keys.

## Upgrade from 1.40.0 to 1.41.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.41.0 artifacts, or pin the Nix input to `v1.41.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. Existing application-rule values remain valid; when
`desktopFileName` is unavailable, the same exact values may now match
`resourceClass`. The new default floating position is disabled unless
configured, and named desktop destinations affect only new matching windows.

## Roll back from 1.41.0 to 1.40.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.40.0 artifacts. NixOS and Home Manager users
should remove `defaultFloatingPosition` if configured, restore the input to
`v1.40.0`, and rebuild. Both versions use logical layout state v4, so no state
conversion is required. Version 1.40.0 ignores named desktop destination syntax
and cannot use `resourceClass` as an application-rule fallback.

## Upgrade from 1.39.0 to 1.40.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.40.0 artifacts, or pin the Nix input to `v1.40.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. Exact initial focus and unfocus rules default to empty and apply
only to fresh matching normal windows. Window-close focus recovery and optional
geometry transitions are hardened without changing stored layout state.

## Roll back from 1.40.0 to 1.39.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.39.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.39.0` and rebuild. The older package ignores
the additive initial focus and unfocus keys. Both versions use logical layout
state v4, so no state conversion is required.

## Upgrade from 1.38.0 to 1.39.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.39.0 artifacts, or pin the Nix input to `v1.39.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. Exact initial destination and native maximize-to-edges rules default
to empty and apply only to fresh matching normal windows. Existing, restored,
related, transferred, and already admitted windows remain unchanged.

## Roll back from 1.39.0 to 1.38.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.38.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.38.0` and rebuild. The older package ignores
the additive destination and initial-maximize keys. Both versions use logical
layout state v4, so no state conversion is required.

## Upgrade from 1.37.0 to 1.38.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.38.0 artifacts, or pin the Nix input to `v1.38.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut IDs and default bindings are
unchanged. Initial full-width, fullscreen, and floating-position application
rules default to empty. Existing, restored, and already floating windows are
not repositioned. Upgrade the optional transition effect too: its current
package contains the desktop-handoff and rapid-retarget animation fixes.

## Roll back from 1.38.0 to 1.37.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.37.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.37.0` and rebuild. The older package ignores
the additive application-rule keys. Both versions use logical layout state v4,
so no state conversion is required.

## Upgrade from 1.36.0 to 1.37.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.37.0 artifacts, or pin the Nix input to `v1.37.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut action IDs and default bindings
are unchanged. The global initial tiled height defaults to `auto`, and numbered
desktop back-and-forth defaults to disabled. Existing columns are not rewritten.
The transition fix needs no configuration change.

## Roll back from 1.37.0 to 1.36.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.36.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.36.0` and rebuild. The older packages ignore
the additive global-height and numbered back-and-forth keys. Both versions use
logical layout state v4, so no state conversion is required.

## Upgrade from 1.35.0 to 1.36.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.36.0 artifacts, or pin the Nix input to `v1.36.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut action IDs and default bindings
are unchanged. Fixed resize steps and application initial tiled heights are
opt-in. The transition effect keeps `out-cubic` easing by default and skips
size interpolation for resize deltas of at most `10` logical pixels; set its
threshold to `0` to animate every nonzero resize as before.

## Roll back from 1.36.0 to 1.35.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.35.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.35.0` and rebuild. The older packages ignore
the additive resize-step, application-height, easing, and resize-threshold
keys. Both versions use logical layout state v4 and understand proportional
and fixed tiled heights, so no state conversion is required.

## Upgrade from 1.34.0 to 1.35.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.35.0 artifacts, or pin the Nix input to `v1.35.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state remains v4, and shortcut action IDs and default bindings
are unchanged. Existing settings retain their behavior. Fixed logical-pixel
widths and heights, fractional gaps, singleton centering, and the leading empty
desktop are opt-in.

## Roll back from 1.35.0 to 1.34.0

Before disabling 1.35.0:

1. Convert fixed `px` and explicit `%` entries in `ColumnWidthPresets`,
   `WindowHeightPresets`, and `ApplicationColumnWidths` to legacy bare
   percentages, or clear those settings. The 1.34.0 parser rejects the new
   forms.
2. If fixed window-height presets were used, reset affected windows to an
   automatic or percentage height and allow the state to flush. Alternatively,
   back up and remove
   `${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini` before
   starting 1.34.0; fixed presets can store indices outside its decoder range.
3. Disable `emptyDesktopAboveFirst` so Driftile can remove an empty leading
   desktop it owns, and set `DefaultColumnWidthPixels` to `0`.

Then release a helper-owned profile, disable Driftile and both optional
effects, and restore matching verified 1.34.0 artifacts. NixOS and Home Manager
users should restore the input to `v1.34.0` and rebuild. The persistence format
remains v4; no schema conversion is otherwise required.

## Upgrade from 1.33.0 to 1.34.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.34.0 artifacts, or pin the Nix input to `v1.34.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Logical layout state and shortcut action IDs remain compatible. The main
script adds an opt-in overflow-centering setting. The transition effect adds
safe-default movement, size, and exact window-class controls; existing users
retain movement and size animation when the new keys are absent.

## Roll back from 1.34.0 to 1.33.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.33.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.33.0` and rebuild. The older packages ignore
the additive KConfig keys; no layout-state conversion is required.

## Upgrade from 1.32.0 to 1.33.0

1. Release a helper-owned shortcut profile with the installed helper.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.33.0 artifacts, or pin the Nix input to `v1.33.0` and
   rebuild.
4. Re-enable Driftile and only the optional effects you use, then reclaim the
   unchanged helper profile if needed.

Configuration, shortcut assignments, and logical layout state remain
compatible. No migration or new setting is required.

## Roll back from 1.33.0 to 1.32.0

Release a helper-owned profile, disable Driftile and both optional effects,
then restore matching verified 1.32.0 artifacts. NixOS and Home Manager users
should restore the input to `v1.32.0` and rebuild. No state conversion is
required.

## Upgrade from 1.31.0 to 1.32.0

1. If the 1.31.0 helper owns the shortcut profile, run its `release` command
   before replacing it. Stop on a preserved manual-edit conflict; do not use
   `--force`.
2. Disable Driftile and both optional effects in System Settings.
3. Install matching 1.32.0 main, overview, transition, and helper artifacts as
   needed, or pin the Nix input to `v1.32.0` and rebuild.
4. Re-enable Driftile and only the optional effects you use.
5. If using the helper, claim the profile with the 1.32.0 helper and run
   `check` with the same optional custom profile.

Logical layout state remains v4 and needs no conversion. Existing KGlobalAccel
assignments and KConfig values remain compatible. New gesture settings are
opt-in, while a fresh shortcut profile uses the updated preset-width mapping.

## Roll back from 1.32.0 to 1.31.0

Release a helper-owned profile with the 1.32.0 helper, disable Driftile and
both optional effects, then restore matching verified 1.31.0 artifacts. For
NixOS or Home Manager, restore the input to `v1.31.0` and rebuild each owning
generation. Logical state remains v4, so no state-file conversion is required.

## Upgrade from 1.30.0 to 1.31.0

1. If the 1.30.0 helper owns the shortcut profile, run its `release` command
   before replacing it. Stop on a preserved manual-edit conflict; do not use
   `--force`.
2. Disable Driftile and the optional overview in System Settings. Disable the
   optional transition effect too if a development package installed it.
3. Install matching 1.31.0 main, overview, transition, and helper artifacts as
   needed, or pin the Nix input to `v1.31.0` and rebuild.
4. Re-enable Driftile and the optional effects you use. The transition effect
   remains disabled by default.
5. If using the helper, claim the unchanged profile with the 1.31.0 helper and
   run `check` with the same optional custom profile.

Logical layout state advances to v4 so each context includes its output,
virtual desktop, and activity. Valid v1 and v3 state migrates after a successful
restore; the bounded topology catalog remains v2. The first successful v4
publication replaces activity-less historical snapshots because their original
activity cannot be recovered safely. Removed or ambiguous activity ownership
fails closed instead of reassigning a layout.

This release also adds cross-context gutter drops, exact and gutter targets for
manually floating windows, vertical pointer-resize adoption, right-side
full-width successor visibility, focus recovery after closing the active
window, and optional geometry transitions. Fresh columns use 33% when the
default-width setting is absent; explicit settings and existing column widths
remain unchanged. No shortcut profile conversion is required.

## Roll back from 1.31.0 to 1.30.0

Release a helper-owned profile with the 1.31.0 helper, then disable Driftile and
both optional effects. A 1.30.0 runtime does not understand logical state v4
and keeps that store write-locked. Before installing 1.30.0, move the v4 state
file aside as described in
[Troubleshooting](troubleshooting.md#a-layout-does-not-restore), or restore a
saved v3 state file from before the upgrade.

Restore matching verified 1.30.0 main, overview, and helper artifacts. For
NixOS or Home Manager, restore the input to `v1.30.0` and rebuild each owning
generation. Configuration and shortcut profiles remain compatible, but 1.30.0
must start from v3 state or a fresh layout snapshot. The 1.31.0 transition
effect is independent and should remain removed or disabled after rollback.

## Upgrade from 1.29.0 to 1.30.0

1. If the 1.29.0 helper owns the shortcut profile, run its `release` command
   before replacing it. Stop on a preserved manual-edit conflict; do not use
   `--force`.
2. Disable Driftile and the optional overview in System Settings.
3. Install the matching 1.30.0 main package, optional overview, and helper, or
   pin the Nix input to `v1.30.0` and rebuild.
4. Re-enable Driftile and the optional overview.
5. If using the helper, claim the unchanged profile with the 1.30.0 helper and
   run `check` with the same optional custom profile.

This release adds no setting, action, helper profile, persistence, schema,
overview, or API change. Existing configuration, shortcuts, and layout state
remain compatible; no layout conversion or KConfig edit is required. Matching
1.30.0 artifacts are still required.

## Roll back from 1.30.0 to 1.29.0

Release a helper-owned profile with the 1.30.0 helper, disable Driftile and the
optional overview, then restore their matching verified 1.29.0 artifacts. For
NixOS or Home Manager, restore the input to `v1.29.0` and rebuild each owning
generation. Re-enable the installed packages and reclaim the unchanged helper
profile if used. Existing configuration, shortcuts, and layout state need no
conversion.

## Upgrade from 1.28.0 to 1.29.0

1. If the 1.28.0 helper owns the shortcut profile, run its `release` command
   before replacing it. If release reports assignments edited after the claim,
   stop and resolve those edits in System Settings; do not use `--force`. If the
   old helper was already replaced, the 1.29.0 helper can release its saved v1
   transaction.
2. Disable Driftile and the optional overview in System Settings.
3. Install the matching 1.29.0 main package, optional overview, and helper, or
   pin the Nix input to `v1.29.0` and rebuild.
4. Re-enable the main Driftile script.
5. If using the helper, claim the 1.29.0 profile and run `check` with the same
   optional custom profile.
6. Re-enable the optional overview.

The shortcut action IDs remain compatible. Manually assigned KGlobalAccel
shortcuts remain unchanged; edit them in System Settings only if the fresh
1.29.0 defaults are wanted. The additive `WindowHeightPresets` setting uses the
exact built-in `1/3`, `1/2`, and `2/3` cycle when missing or blank. Existing
layout state needs no conversion, and archive users need no KConfig edit.

## Roll back from 1.29.0 to 1.28.0

1. If the 1.29.0 helper owns the shortcut profile, run its `release` command
   before replacing it. Stop and resolve any preserved manual-edit conflict in
   System Settings; do not use `--force`.
2. Disable Driftile and the optional overview in System Settings.
3. Restore the matching verified 1.28.0 main package, optional overview, and
   helper. For NixOS or Home Manager, first remove
   `programs.driftile.settings.windowHeightPresets` from the Home Manager
   profile, then restore the input to `v1.28.0` and rebuild each owning
   generation.
4. Re-enable the main Driftile script.
5. If using the helper, claim the 1.28.0 profile and run `check` with the same
   optional custom profile.
6. Re-enable the optional overview.

The raw `WindowHeightPresets` KConfig key may remain because 1.28.0 ignores it.
Existing layout state and manually assigned KGlobalAccel shortcuts remain
compatible; no conversion or manual KConfig edit is required.

## Upgrade from 1.27.0 to 1.28.0

1. Release helper-owned shortcuts with the 1.27.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.28.0 artifacts, or pin the Nix input to `v1.28.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The existing unbound insert-left and insert-right actions now operate
contextually on one active relation-free manually floating window. The helper
profile, overview, settings schema, layouts, and existing assignments remain
compatible. No data conversion, Plasma session restart, KConfig edit, new
action, default binding, setting, or persistence migration is required.

## Roll back from 1.28.0 to 1.27.0

Release shortcuts with the 1.28.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.27.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.27.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.27.0 shortcut
profile. Existing settings and layout state remain compatible. The same
actions remain registered but return to tiled-only direct insertion; no
conversion is required.

## Upgrade from 1.26.0 to 1.27.0

1. Release helper-owned shortcuts with the 1.26.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.27.0 artifacts, or pin the Nix input to `v1.27.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The existing width-preset actions and unbound width-reset action now operate
contextually on one relation-free manually floating window. They continue to
use `ColumnWidthPresets` and `DefaultColumnWidthPercent`. The helper profile,
overview, settings schema, layouts, and existing assignments remain compatible.
No data conversion, Plasma session restart, KConfig edit, new action, default
binding, setting, or persistence migration is required.

## Roll back from 1.27.0 to 1.26.0

Release shortcuts with the 1.27.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.26.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.26.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.26.0 shortcut
profile. Existing settings and layout state remain compatible. The same actions
remain registered but return to tiled-only width behavior; no conversion is
required.

## Upgrade from 1.25.0 to 1.26.0

1. Release helper-owned shortcuts with the 1.25.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.26.0 artifacts, or pin the Nix input to `v1.26.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release adds nine optional numbered single-window desktop actions. They are
unbound by default, and the helper-owned 88-action default profile remains
unchanged. Overview behavior, settings, layouts, and existing assignments remain
compatible. No data conversion, Plasma session restart, KConfig edit, setting,
default binding, or persistence-schema migration is required.

## Roll back from 1.26.0 to 1.25.0

Release shortcuts with the 1.26.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.25.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.25.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.25.0 shortcut
profile. Existing settings and layout state remain compatible. Remove any
manually assigned 1.26-only action before rollback if its inert KGlobalAccel
record is not wanted.

## Upgrade from 1.24.0 to 1.25.0

1. Release helper-owned shortcuts with the 1.24.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.25.0 artifacts, or pin the Nix input to `v1.25.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release makes existing output-transfer actions contextual for one active
relation-free floating window. Overview and helper behavior remain unchanged.
No data conversion, Plasma session restart, KConfig edit, setting, action,
binding, shortcut default, or persistence-schema migration is required.

## Roll back from 1.25.0 to 1.24.0

Release shortcuts with the 1.25.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.24.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.24.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.24.0 shortcut
profile. Existing settings and layout state remain compatible; no data
conversion, Plasma session restart, KConfig edit, shortcut change, or
persistence migration is required.

## Upgrade from 1.23.0 to 1.24.0

1. Release helper-owned shortcuts with the 1.23.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.24.0 artifacts, or pin the Nix input to `v1.24.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release adds rejection-only feedback to the optional overview. It needs no
data conversion or Plasma session restart and adds no setting, shortcut action,
shortcut default, or persistence schema. Existing layout data and shortcut
assignments remain unchanged.

## Roll back from 1.24.0 to 1.23.0

Release shortcuts with the 1.24.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.23.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.23.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.23.0 shortcut
profile. No data conversion, Plasma session restart, KConfig edit, shortcut
change, or persistence migration is required.

## Upgrade from 1.22.0 to 1.23.0

1. Release helper-owned shortcuts with the 1.22.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.23.0 artifacts, or pin the Nix input to `v1.23.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release adds one passive active-column badge to each overview desktop card.
It needs no data conversion or Plasma session restart and adds no KConfig value,
shortcut action, shortcut default, or persistence schema. Existing layout data
and shortcut assignments remain unchanged.

## Roll back from 1.23.0 to 1.22.0

Release shortcuts with the 1.23.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.22.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.22.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.22.0 shortcut
profile. No data conversion, Plasma session restart, KConfig edit, shortcut
change, or persistence migration is required.

## Upgrade from 1.21.0 to 1.22.0

1. Release helper-owned shortcuts with the 1.21.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.22.0 artifacts, or pin the Nix input to `v1.22.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release adds guarded desktop-card reordering only inside the overview
effect. It needs no data conversion or Plasma session restart and adds no
KConfig value, shortcut action, shortcut default, or persistence schema.
Existing layout data and shortcut assignments remain unchanged.

## Roll back from 1.22.0 to 1.21.0

Release shortcuts with the 1.22.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.21.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.21.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.21.0 shortcut
profile. KWin keeps the current global desktop order; no data conversion,
Plasma session restart, KConfig edit, shortcut change, or persistence migration
is required.

## Upgrade from 1.20.0 to 1.21.0

1. Release helper-owned shortcuts with the 1.20.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.21.0 artifacts, or pin the Nix input to `v1.21.0` and rebuild.
4. Re-enable Driftile and, if installed, the optional overview.

The release changes only keyboard interaction inside the overview effect. It
needs no data conversion or Plasma session restart and adds no KConfig value,
shortcut action, shortcut default, or persistence schema. Existing layout data
and shortcut assignments remain unchanged.

## Roll back from 1.21.0 to 1.20.0

Release shortcuts with the 1.21.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.20.0 packages and helper. For
NixOS or Home Manager, restore the input to `v1.20.0` and rebuild each owning
generation. Re-enable the installed packages and restore the 1.20.0 shortcut
profile. No data conversion, Plasma session restart, KConfig edit, shortcut
change, or persistence migration is required.

## Upgrade from 1.19.0 to 1.20.0

1. Release helper-owned shortcuts with the 1.19.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.20.0 artifacts, or pin the Nix input to `v1.20.0` and rebuild.
4. Enable Driftile and review the default column presentation, application
   presentation rules, and tab indicator setting.
5. If installed, re-enable the overview. A fresh shortcut record receives
   `Meta+O`; an existing assignment, including an unbound action, is preserved.

The release adds three safe-default KConfig values:

- `DefaultColumnPresentation="stacked"` preserves the existing fresh-column
  behavior.
- `ApplicationColumnPresentations=""` adds no application override.
- `ShowTabIndicator=true` enables passive Plasma OSD feedback for confirmed
  multi-tab activation or entry into tabbed presentation.

Application presentation rules match the exact, case-sensitive KWin
`desktopFileName` and override the global default for fresh columns. Existing
and restored columns remain unchanged when either policy changes. Tabbed
singletons are durable, so a later insertion immediately uses their selected
presentation.

The optional overview adds an ordered strip for every live tabbed member.
Minimized members remain visible but disabled; valid tabs reuse the guarded
window-focus path. The package IDs and logical v3 persistence format remain
unchanged, so no layout conversion or Plasma session restart is required.

## Roll back from 1.20.0 to 1.19.0

Before disabling 1.20.0, toggle every tabbed singleton column back to stacked
presentation. Version 1.19.0 rejects a persisted tabbed column with fewer than
two members.

Release shortcuts with the 1.20.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.19.0 packages and helper. For
NixOS or Home Manager, remove `defaultColumnPresentation`,
`applicationColumnPresentations`, and `showTabIndicator` from the settings
profile before restoring the `v1.19.0` input, then rebuild the generation that
owns each package.

The additive KConfig keys may remain because 1.19.0 ignores them. Multi-window
tabbed columns and logical v3 state remain compatible. Re-enable the installed
packages and restore the 1.19.0 shortcut profile; the older overview returns
to selected-thumbnail-only projection.

## Upgrade from 1.18.0 to 1.19.0

1. Release helper-owned shortcuts with the 1.18.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Back up
   `${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini` before starting
   1.19.0.
4. Upgrade the main package, optional overview, and helper to their matching
   1.19.0 archives, or pin the Nix input to `v1.19.0` and rebuild.
5. Restart the Plasma session once so KWin loads the new stable package
   bootstraps instead of an entrypoint cached from 1.18.0.
6. Enable Driftile and restore the shortcut profile. The release adds
   `Meta+W` for toggling the active tiled column's presentation and `Meta+Q`
   for closing the active window.
7. If installed, re-enable the matching overview package and review its
   manually assigned shortcut.

The release accepts existing bare and catalog-nested logical v1 state, then
publishes canonical v3 state with each column's presentation and selected
member. The bounded topology catalog remains v2. This migration happens on the
first successful publication even if no column has been made tabbed.

Tabbed presentation overlays every non-minimized member at one column frame.
Vertical focus selects members without wrapping, vertical move reorders them,
and height commands remain inactive until stacked presentation returns. The
optional overview projects only the selected member. The immediate normal
successor of an inactive full-width column now starts at the left work-area
gap.

The release adds no setting or settings field. Package IDs remain unchanged.
The 1.19.0 shortcut helper adds `Meta+W` and `Meta+Q`; its transactional release
restores unchanged prior assignments. `Meta+C` remains the contextual centering
action.

## Upgrade from 1.19.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.19.0 artifacts. For Nix, update the input from `v1.19.0-rc.1` to `v1.19.0`
and rebuild. Restart the Plasma session once, then re-enable the installed
packages and restore the shortcut profile.

Stable 1.19.0 adds one action and default binding after RC.1: `Meta+Q` delegates
closing the active window to KWin. Restore the stable helper profile to claim
this binding. `Meta+C` remains the contextual centering action. Layout behavior,
configuration, persistence, package IDs, logical v3 state, and overview
behavior remain unchanged; no reset or conversion is required.

## Roll back from 1.19.0 to 1.18.0

Release shortcuts with the 1.19.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.18.0 packages and helper. For
NixOS or Home Manager, restore the `v1.18.0` input and rebuild the generation
that owns each package.

Restart the Plasma session once after restoring the packages so KWin does not
reuse the 1.19.0 bootstrap or runtime from memory.

The 1.18.0 runtime cannot read logical v3 state. Restore the layout-state backup
made before 1.19.0 was first enabled. If no backup is available, remove
the state file while Driftile is disabled and accept a fresh layout on the next
start. Re-enable the installed packages and restore the 1.18.0 shortcut
profile.

## Upgrade from 1.17.0 to 1.18.0

1. Release helper-owned shortcuts with the 1.17.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.18.0 archives, or pin the Nix input to `v1.18.0` and rebuild.
4. Enable Driftile, review **Applications centered during horizontal focus**,
   then restore the shortcut profile.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release adds one safe-default KConfig value:

- `ApplicationFocusCentering=""` preserves 1.17.0 focus behavior.

Each nonblank line matches one exact, case-sensitive KWin `desktopFileName`.
A successful left, right, first, or last tiled-focus action centers a matching
selected destination when a center preview can be prepared. The global
centering option still centers every destination, and a stacked column checks
only the member selected by that action. Unmatched targets and failed center
previews retain normal minimal reveal. Replacing the list does not immediately
move windows, change the viewport or focus, or write layout state.

The package IDs, actions, bindings, shortcut helper, overview behavior, and
persisted layout format remain unchanged. No layout-state migration is
required. A non-null Home Manager profile now writes thirteen settings and uses
`applicationFocusCentering = [ ];` when omitted; pin the package and module to
the same tag.

## Upgrade from 1.18.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.18.0 artifacts. For Nix, update the input from `v1.18.0-rc.1` to `v1.18.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Stable 1.18.0 adds no behavior or data change after RC.1. Configuration, helper
profiles, package IDs, actions, bindings, persisted layouts, and overview
behavior remain compatible; no reset or conversion is required.

## Roll back from 1.18.0 to 1.17.0

Release shortcuts with the 1.18.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.17.0 packages and helper. For
NixOS or Home Manager, remove
`programs.driftile.settings.applicationFocusCentering` before restoring the
`v1.17.0` input because that module does not expose the attribute, then rebuild
the generation that owns each package.

The 1.17.0 extension ignores a remaining `ApplicationFocusCentering` KConfig
key; it may be deleted without resetting layout state. Re-enable the installed
packages and restore the 1.17.0 shortcut profile. Persisted layouts, actions,
bindings, and overview behavior require no conversion.

## Upgrade from 1.16.0 to 1.17.0

1. Release helper-owned shortcuts with the 1.16.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.17.0 archives, or pin the Nix input to `v1.17.0` and rebuild.
4. Enable Driftile and review its existing settings under the **General** and
   **Applications** tabs, then restore the shortcut profile.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release only groups the existing twelve KWin settings into eight
**General** controls and four **Applications** controls. Every KConfig key,
twelve-setting snapshot rule, and live runtime behavior remains unchanged. It
adds no setting, action, binding, persistence field, overview behavior, or
helper behavior. No configuration or layout-state migration is required.

## Upgrade from 1.17.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.17.0 artifacts. For Nix, update the input from `v1.17.0-rc.1` to `v1.17.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Stable 1.17.0 adds no behavior or data change after RC.1. Configuration, helper
profiles, package IDs, actions, bindings, persisted layouts, and overview
behavior remain compatible; no reset or conversion is required.

## Roll back from 1.17.0 to 1.16.0

Release shortcuts with the 1.17.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.16.0 packages and helper. For
NixOS or Home Manager, restore the `v1.16.0` input and rebuild the generation
that owns each package. Re-enable the installed packages and restore the 1.16.0
shortcut profile.

Rollback returns the twelve controls to one settings page. KConfig values,
persisted layouts, and shortcut assignments require no cleanup, reset, or
conversion.

## Upgrade from 1.15.1 to 1.16.0

1. Release helper-owned shortcuts with the 1.15.1 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.16.0 archives, or pin the Nix input to `v1.16.0` and rebuild.
4. Enable Driftile, review **Applications initially floating**, then assign
   shortcuts or claim them with the 1.16.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release adds one safe-default KConfig value:

- `ApplicationInitialFloating=""` preserves 1.15.1 admission behavior.

Each nonblank line matches one exact, case-sensitive KWin `desktopFileName`.
The policy affects only fresh admissions. Existing windows and restored tiled
or floating ownership remain unchanged, while tiling exclusions and automatic
floating roles take priority. A matching window uses ordinary manual-floating
ownership and can be tiled with **Toggle floating**. No layout-state migration
or reset is required.

Same-context tiled pointer moves outline the exact valid before-or-after target
half. The feedback is best-effort because KWin's outline is shared;
cross-context moves remain finish-only.

Toggling full-width mode off restores the prior column width while retaining
the current viewport and horizontal anchor. This corrects the RC behavior
without adding a setting, action, binding, or persisted layout field.

With Home Manager, `programs.driftile.settings = null` still writes nothing. A
non-null 1.16.0 profile writes all twelve settings and uses
`applicationInitialFloating = [ ];` when omitted. Pin the package and module
to the same tag.

## Upgrade from 1.16.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.16.0 artifacts. For Nix, update the input from `v1.16.0-rc.1` to `v1.16.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Stable 1.16.0 changes only the full-width toggle-off behavior described above.
Configuration, helper profiles, package IDs, and persisted layouts remain
compatible with RC.1; no reset or conversion is required.

## Roll back from 1.16.0 to 1.15.1

Release shortcuts with the 1.16.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.15.1 packages and helper. For
NixOS or Home Manager, remove
`programs.driftile.settings.applicationInitialFloating` before restoring the
`v1.15.1` input, because that module does not expose the attribute, then rebuild
the generation that owns each package.

The 1.15.1 extension ignores a remaining `ApplicationInitialFloating` KConfig
key; it may be deleted without resetting layout state. Same-context pointer
previews disappear after rollback. Re-enable the installed packages and restore
the 1.15.1 shortcut profile. Persisted layouts and shortcut assignments require
no conversion.

## Upgrade from 1.15.1 to 1.16.0-rc.1 (historical)

Do not use the candidate for new installations. To reproduce the historical RC
path, release helper-owned shortcuts, disable Driftile and the optional
overview, then install their matching 1.16.0-rc.1 artifacts or pin the Nix input
to `v1.16.0-rc.1`. Re-enable the installed packages, review **Applications
initially floating**, and restore the shortcut profile.

The candidate introduced same-context pointer previews and
`ApplicationInitialFloating`. It retained the previous exact viewport restore
when full-width mode was toggled off; stable 1.16.0 supersedes that behavior.

## Roll back from 1.16.0-rc.1 to 1.15.1 (historical)

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then restore their matching verified 1.15.1 packages and helper. For
NixOS or Home Manager, remove
`programs.driftile.settings.applicationInitialFloating` before restoring the
`v1.15.1` input, because that module does not expose the attribute, then rebuild
the generation that owns each package.

The 1.15.1 extension ignores a remaining `ApplicationInitialFloating` KConfig
key; it may be deleted without resetting layout state. The pointer preview
disappears when the candidate package is removed. Re-enable the installed
packages and restore the 1.15.1 shortcut profile. Persisted layouts and shortcut
assignments require no conversion.

## Upgrade from 1.15.0 to 1.15.1

1. Release helper-owned shortcuts with the 1.15.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.15.1 archives, or pin the Nix input to `v1.15.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.15.1 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The patch keeps focus-revealed columns inside dynamic outer gaps and parks an
inactive full-width frame completely beyond the opposite viewport edge. The
clearance uses the assigned output's current work area, configured gap, and
device-pixel ratio.

Configuration, persisted layout state, actions, bindings, helper profiles, and
shortcut assignments remain compatible with 1.15.0. No reset or migration is
required.

## Roll back from 1.15.1 to 1.15.0

Release shortcuts with the 1.15.1 helper, disable Driftile and the optional
overview, then restore their matching verified 1.15.0 packages and helper. For
NixOS or Home Manager, restore the `v1.15.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.15.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.14.0 to 1.15.0

1. Release helper-owned shortcuts with the 1.14.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.15.0 archives, or pin the Nix input to `v1.15.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.15.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release refines the existing full-width mode. The active frame remains
inside equal configured outer gaps, while adjacent frames stay at least one
physically aligned configured gap beyond the corresponding viewport edge. A
zero gap adds no clearance. Toggling the mode again restores the exact prior
column width and viewport position, and rejected geometry retains the existing
transactional rollback.

It adds no state, action, binding, setting, configuration or persistence schema,
helper profile, overview behavior, or application policy. Package IDs, the
complete eleven-setting profile, stored layouts, and existing shortcut
assignments remain compatible with 1.14.0. No setting or layout-state migration
is required.

## Upgrade from 1.15.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.15.0 artifacts. For Nix, update the input from `v1.15.0-rc.1` to `v1.15.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.15.0 has no runtime, configuration, persistence, action, binding,
gesture, helper profile, overview behavior, or application-policy changes from
RC.1.

## Upgrade from 1.14.0 to 1.15.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.14.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.15.0-rc.1 archives, or pin the Nix input to `v1.15.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate introduced the same refined full-width geometry as 1.15.0. Its
package IDs, complete eleven-setting profile, stored layouts, and existing
shortcut assignments remain compatible with 1.14.0. Use 1.15.0 for new
installations.

## Roll back from 1.15.0 to 1.14.0

Release shortcuts with the 1.15.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.14.0 packages and helper. For
NixOS or Home Manager, restore the `v1.14.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.14.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.13.0 to 1.14.0

1. Release helper-owned shortcuts with the 1.13.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.14.0 archives, or pin the Nix input to `v1.14.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.14.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release contextually reuses the existing window-height decrease and increase
actions and `WindowHeightStepPercent` for an active manually floating frame.
Tiled targets retain their existing stack-reflow behavior; reset and
height-preset actions remain tiled-only. An existing custom height step now also
applies to manually floating frames.

It adds no action, binding, setting, configuration or persistence schema,
helper profile, overview behavior, or application policy. Package IDs, the
complete eleven-setting profile, stored layouts, and existing shortcut
assignments remain compatible with 1.13.0. No setting or layout-state migration
is required.

## Upgrade from 1.14.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.14.0 artifacts. For Nix, update the input from `v1.14.0-rc.1` to `v1.14.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.14.0 has no runtime, configuration, persistence, action, binding,
gesture, helper profile, overview behavior, or application-policy changes from
RC.1.

## Upgrade from 1.13.0 to 1.14.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.13.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.14.0-rc.1 archives, or pin the Nix input to `v1.14.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate introduced the same contextual manually floating height behavior
as 1.14.0. Its package IDs, complete eleven-setting profile, stored layouts,
and existing shortcut assignments remain compatible with 1.13.0. Use 1.14.0
for new installations.

## Roll back from 1.14.0 to 1.13.0

Release shortcuts with the 1.14.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.13.0 packages and helper. For
NixOS or Home Manager, restore the `v1.13.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.13.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.12.0 to 1.13.0

1. Release helper-owned shortcuts with the 1.12.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.13.0 archives, or pin the Nix input to `v1.13.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.13.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release contextually reuses the existing width decrease and increase
actions to resize an active manually floating frame. Tiled targets retain their
existing whole-column behavior. It adds no action, binding, setting,
configuration schema, persistence format, gesture, helper profile, or overview
behavior and does not expand the application matrix. Package IDs, the complete
eleven-setting profile, stored layouts, and existing shortcut assignments remain
compatible with 1.12.0.

## Upgrade from 1.13.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.13.0 artifacts. For Nix, update the input from `v1.13.0-rc.1` to `v1.13.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.13.0 has no runtime, configuration, persistence, action, binding,
gesture, helper profile, overview behavior, or application-matrix changes from
RC.1.

## Upgrade from 1.12.0 to 1.13.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.12.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.13.0-rc.1 archives, or pin the Nix input to `v1.13.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate introduced the same contextual manually floating width behavior
as 1.13.0. Its package IDs, complete eleven-setting profile, stored layouts,
and existing shortcut assignments remain compatible with 1.12.0. Use 1.13.0
for new installations.

## Roll back from 1.13.0 to 1.12.0

Release shortcuts with the 1.13.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.12.0 packages and helper. For
NixOS or Home Manager, restore the `v1.12.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.12.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.11.0 to 1.12.0

1. Release helper-owned shortcuts with the 1.11.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.12.0 archives, or pin the Nix input to `v1.12.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.12.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release reuses the existing center-column action and `Meta+C` default to
center an active manually floating frame in its assigned output and desktop
work area. It adds no action, binding, setting, configuration schema,
persistence format, gesture, helper profile, or overview behavior. Package IDs,
the complete eleven-setting profile, stored layouts, and existing shortcut
assignments remain compatible with 1.11.0.

## Upgrade from 1.12.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.12.0 artifacts. For Nix, update the input from `v1.12.0-rc.1` to `v1.12.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.12.0 has no runtime, configuration, persistence, action, binding,
gesture, helper profile, or overview behavior changes from RC.1.

## Upgrade from 1.11.0 to 1.12.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.11.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.12.0-rc.1 archives, or pin the Nix input to `v1.12.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate introduced the same manually floating centering behavior as
1.12.0. Its package IDs, complete eleven-setting profile, stored layouts, and
existing shortcut assignments remain compatible with 1.11.0. Use 1.12.0 for
new installations.

## Roll back from 1.12.0 to 1.11.0

Release shortcuts with the 1.12.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.11.0 packages and helper. For
NixOS or Home Manager, restore the `v1.11.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.11.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.10.0 to 1.11.0

1. Release helper-owned shortcuts with the 1.10.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.11.0 archives, or pin the Nix input to `v1.11.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.11.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release reuses the existing column-left, column-right, window-up, and
window-down actions to move an active manually floating window by 50 logical
pixels with bounded partial visibility. It adds no action, binding, setting,
configuration schema, persistence format, gesture, or overview behavior.
Package IDs, the complete eleven-setting profile, stored layouts, and existing
shortcut assignments remain compatible with 1.10.0.

## Upgrade from 1.11.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.11.0 artifacts. For Nix, update the input from `v1.11.0-rc.1` to `v1.11.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.11.0 has no runtime, configuration, persistence, action, binding,
gesture, or overview behavior changes from RC.1.

## Upgrade from 1.10.0 to 1.11.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.10.0 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.11.0-rc.1 archives, or pin the Nix input to `v1.11.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate introduced the same manually floating movement behavior as
1.11.0. Its package IDs, complete eleven-setting profile, stored layouts, and
existing shortcut assignments remain compatible with 1.10.0. Use 1.11.0 for
new installations.

## Roll back from 1.11.0 to 1.10.0

Release shortcuts with the 1.11.0 helper, disable Driftile and the optional
overview, then restore their matching verified 1.10.0 packages and helper. For
NixOS or Home Manager, restore the `v1.10.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.10.0 shortcut
profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.9.1 to 1.10.0

1. Release helper-owned shortcuts with the 1.9.1 helper while it remains
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package, optional overview, and helper to their matching
   1.10.0 archives, or pin the Nix input to `v1.10.0` and rebuild.
4. Enable Driftile, review **Applications keeping KWin borders and title
   bars**, then assign shortcuts or claim them with the matching helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release adds one safe-default KConfig value:

- `ApplicationBorderlessExclusions=""` keeps the existing global borderless
  behavior.

The QML bridge reads a missing key as the same empty default. The runtime now
validates one complete eleven-setting snapshot; an incomplete ten-field bridge
snapshot is rejected without changing the active settings. The package IDs,
shortcut actions and bindings, gestures, overview behavior, layout model, and
persistence format are unchanged.

With Home Manager, `programs.driftile.settings = null` still writes nothing. A
non-null 1.10.0 profile writes
`applicationBorderlessExclusions = [ ];` when omitted. Pin the package and
module to the same tag.

## Upgrade from 1.10.0-rc.1

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then upgrade the main package, overview, and helper to their matching
1.10.0 artifacts. For Nix, update the input from `v1.10.0-rc.1` to `v1.10.0`
and rebuild. Re-enable the installed packages and restore the shortcut profile.

Version 1.10.0 has no runtime, configuration, persistence, action, binding,
gesture, or overview behavior changes from RC.1.

## Upgrade from 1.9.1 to 1.10.0-rc.1 (historical)

The RC introduced the same additive borderless-exclusion setting and behavior
as 1.10.0. Its artifacts and original migration boundary remain documented in
the [1.10.0-rc.1 release notes](release-notes-1.10.0-rc.1.md). Use 1.10.0 for
new installations.

## Roll back from 1.10.0 to 1.9.1

Release shortcuts with the 1.10.0 helper, disable Driftile and the
optional overview, then restore their verified 1.9.1 packages and helper. For
Nix, remove `programs.driftile.settings.applicationBorderlessExclusions` if
declared, restore the `v1.9.1` input, and rebuild. The additive KConfig key may
remain because 1.9.1 ignores it. Re-enable the packages and restore the 1.9.1
shortcut profile. No layout-state reset is required.

## Upgrade from 1.9.1-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade both installed archives to their matching 1.9.1 versions, or update
   the pinned Nix input to `v1.9.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.9.1 has no runtime or persistence behavior changes from RC.1. Both
package IDs, all ten settings, shortcut action IDs and bindings, gestures,
overview behavior, the platform boundary, and stored layouts remain compatible.

## Upgrade from 1.9.0 to 1.9.1

1. Release helper-owned shortcuts with the 1.9.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.1 archives, or pin the Nix input to `v1.9.1` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the 1.9.1 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The release keeps a full-width active column between equal configured outer
gaps and moves adjacent columns entirely outside the viewport. Toggling back
restores the exact prior width and viewport, including after an extension
reload.

The persisted full-width restore may now include an optional viewport. Version
1.9.1 accepts existing 1.9.0 documents where that field is absent. Package IDs,
all ten settings, shortcut actions and bindings, gestures, overview behavior,
and the KWin 6.7 platform boundary remain unchanged.

## Upgrade from 1.9.0 to 1.9.1-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.9.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.1-rc.1 archives, or pin the Nix input to `v1.9.1-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate keeps a full-width active column between equal configured outer
gaps and moves adjacent columns entirely outside the viewport. Toggling back
restores the exact prior width and viewport, including after an extension
reload.

The persisted full-width restore may now include an optional viewport. The
candidate accepts existing 1.9.0 documents where that field is absent. Package
IDs, all ten settings, shortcut actions and bindings, gestures, and overview
behavior remain unchanged.

## Roll back from 1.9.1 to 1.9.0

Release shortcuts with the 1.9.1 helper, disable Driftile and the optional
overview, then restore both packages to their verified 1.9.0 archives. For
NixOS or Home Manager, restore the `v1.9.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.9.0 shortcut
profile.

Version 1.9.0 rejects a layout document containing the release's additive
restore-viewport field atomically. It therefore starts safely through normal
window admission instead of restoring the newer full-width toggle metadata.
No setting cleanup is required.

## Upgrade from 1.9.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.0 archives, or update the Nix input to `v1.9.0` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.9.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, all ten settings, shortcut action IDs and bindings, gesture and
overview behavior, the persistence format, and stored layouts remain
compatible.

## Upgrade from 1.8.0 to 1.9.0

1. Release helper-owned shortcuts with the 1.8.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.0 archives, or pin the Nix input to `v1.9.0` and rebuild the NixOS or Home
   Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the 1.9.0 helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.9.0 adds guarded left-click activation to valid thumbnails in
non-current desktop cards. The current-card focus path is unchanged. Before
selection, the effect revalidates the exact active effect, model, live screen,
projected output, desktop object and ID, window object and ID, current activity,
memberships, deletion and minimization state, and input eligibility while
accepting the expected off-desktop hidden state. It selects and confirms the
desktop through public `KWin.SceneView.currentDesktop` on Wayland, or through
the guarded `KWin.Workspace.currentDesktop` fallback only with one live screen.
It then revalidates the same window as visible before requesting and confirming
exact `KWin.Workspace.activeWindow` focus.

A failure before confirmed selection leaves the effect open and performs no
focus write. A late invalidation or focus failure keeps the confirmed desktop,
closes the stale effect, and performs no rollback. The release changes no
main-script runtime, setting, shortcut action ID, binding, gesture, or
persistence format. Both package IDs, all ten settings, shortcut action IDs and
bindings, gestures, and stored layouts remain compatible with 1.8.0.

## Upgrade from 1.8.0 to 1.9.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.8.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.0-rc.1 archives, or pin the Nix input to `v1.9.0-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.9.0-rc.1 adds the same guarded non-current thumbnail activation as
1.9.0. The candidate changes no main-script runtime, setting, shortcut action
ID, binding, gesture, or persistence format. Both package IDs, all ten settings,
shortcut action IDs and bindings, gestures, and stored layouts remain compatible
with 1.8.0.

## Roll back from 1.9.0 to 1.8.0

Release shortcuts with the 1.9.0 helper, disable Driftile and the optional
overview, then restore the main package and any installed overview to their
verified 1.8.0 archives. For NixOS or Home Manager, restore the `v1.8.0` input
and rebuild the generation that owns each package. Re-enable the packages and
restore the 1.8.0 shortcut profile. No setting cleanup or layout-state reset is
required.

## Upgrade from 1.8.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.8.0 archives, or update the Nix input to `v1.8.0` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.8.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the ten settings, shortcut action IDs, bindings, gesture and
overview behavior, and stored layouts remain compatible.

## Upgrade from 1.7.0 to 1.8.0

1. Release helper-owned shortcuts with the 1.7.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.8.0 archives, or pin the Nix input to `v1.8.0` and rebuild the NixOS or Home
   Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.8.0 adds guarded left-click selection to non-current desktop number
gutters in the optional overview. The current gutter and every invalid, stale,
raced, or rejected request remain inert. Native X11 uses the guarded global
fallback only in a single-output session.

The release changes no main-script runtime, setting, shortcut action ID,
binding, gesture, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.7.0.

## Upgrade from 1.7.0 to 1.8.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.7.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.8.0-rc.1 archives, or pin the Nix input to `v1.8.0-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.8.0-rc.1 adds guarded left-click selection to non-current desktop
number gutters in the optional overview. The current gutter and every invalid,
stale, raced, or rejected request remain inert. Native X11 uses the guarded
global fallback only in a single-output session.

The candidate changes no main-script runtime, setting, shortcut action ID,
binding, gesture, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.7.0.

## Roll back from 1.8.0 to 1.7.0

Release shortcuts with the 1.8.0 helper, disable Driftile and the optional
overview, then restore the main package and any installed overview to their
verified 1.7.0 archives. For NixOS or Home Manager, restore the `v1.7.0` input
and rebuild the generation that owns each package. Re-enable the packages and
restore the 1.7.0 shortcut profile. No setting cleanup or layout-state reset is
required.

## Upgrade from 1.7.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.7.0 archives, or update the Nix input to `v1.7.0` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.7.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the ten settings, shortcut action IDs, bindings, gesture and
overview behavior, and stored layouts remain compatible.

## Upgrade from 1.6.0 to 1.7.0

1. Release helper-owned shortcuts with the 1.6.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.7.0 archives, or pin the Nix input to `v1.7.0` and rebuild the NixOS or Home
   Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.7.0 adds guarded left-click focus to valid thumbnails in the
optional overview's current desktop card. Invalid, stale, or rejected focus
requests leave the effect open without changing the workspace.

The release changes no main-script runtime, settings, shortcut action IDs,
bindings, gestures, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.6.0.

## Upgrade from 1.6.0 to 1.7.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.6.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.7.0-rc.1 archives, or pin the Nix input to `v1.7.0-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.7.0-rc.1 adds guarded left-click focus to valid thumbnails in the
optional overview's current desktop card. Invalid, stale, or rejected focus
requests leave the effect open without changing the workspace.

The candidate changes no main-script runtime, settings, shortcut action IDs,
bindings, gestures, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.6.0.

## Roll back from 1.7.0 to 1.6.0

Release shortcuts with the 1.7.0 helper, disable Driftile and the optional
overview, then restore the main package and any installed overview to their
verified 1.6.0 archives. For NixOS or Home Manager, restore the `v1.6.0` input
and rebuild the generation that owns each package. Re-enable the packages and
restore the 1.6.0 shortcut profile. No setting cleanup or layout-state reset is
required.

## Upgrade from 1.6.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade both installed archives to their matching 1.6.0 versions, or update
   the Nix input to `v1.6.0` and rebuild the NixOS or Home Manager generation
   that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.6.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the ten settings, shortcut action IDs, bindings, gesture and
overview behavior, and stored layouts remain compatible.

## Upgrade from 1.5.0 to 1.6.0

1. Release helper-owned shortcuts with the 1.5.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.6.0 archives, or pin the Nix input to `v1.6.0` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.6.0 adds finish-only horizontal pointer-resize adoption for the
active normal tiled window. KWin continues to own the interactive resize. An
unambiguous width-only left- or right-edge finish in the same settled, visible,
unchanged output and desktop can become the active column's fixed width after
every same-context target settles. Races, rejected geometry, and late configure
delivery retain or restore the prior width policy and frames through bounded
recovery.

The release changes no settings, shortcut action IDs, bindings, gestures,
overview behavior, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.5.0.

## Upgrade from 1.5.0 to 1.6.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.5.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.6.0-rc.1 archives, or pin the Nix input to `v1.6.0-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.6.0-rc.1 adds finish-only horizontal pointer-resize adoption for the
active normal tiled window. KWin continues to own the interactive resize. An
unambiguous width-only left- or right-edge finish in the same settled, visible,
unchanged output and desktop can become the active column's fixed width after
every same-context target settles. Races, rejected geometry, and late configure
delivery retain or restore the prior width policy and frames through bounded
recovery.

The candidate changes no settings, shortcut action IDs, bindings, gestures,
overview behavior, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.5.0.

## Roll back from 1.6.0 to 1.5.0

Release shortcuts with the 1.6.0 helper, disable Driftile and the optional
overview, then restore both installed packages to their verified 1.5.0
archives. For NixOS or Home Manager, restore the `v1.5.0` input and rebuild the
generation that owns each package. Re-enable the packages and restore the
1.5.0 shortcut profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.5.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade both installed archives to their matching 1.5.0 versions, or update
   the Nix input to `v1.5.0` and rebuild the NixOS or Home Manager generation
   that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.5.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the ten settings, shortcut action IDs, bindings, gesture and
overview behavior, and stored layouts remain compatible.

## Upgrade from 1.4.0 to 1.5.0

1. Release helper-owned shortcuts with the 1.4.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.5.0 archives, or pin the Nix input to `v1.5.0` and rebuild the NixOS or
   Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.5.0 adds finish-only adoption after KWin selects another visible
desktop on the same output and moves the active normal tiled window there.
KWin continues to own desktop selection and window membership. Driftile only
inserts the window around one exact eligible tiled target under the release
point; otherwise the completed move remains and normal singleton admission
applies.

The release changes no settings, shortcut action IDs, bindings, gestures,
overview behavior, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.4.0.

## Upgrade from 1.4.0 to 1.5.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.4.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.5.0-rc.1 archives, or pin the Nix input to `v1.5.0-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.5.0-rc.1 adds finish-only adoption after KWin selects another
visible desktop on the same output and moves the active normal tiled window
there. KWin continues to own desktop selection and window membership. Driftile
only inserts the window around one exact eligible tiled target under the
release point; otherwise the completed move remains and normal singleton
admission applies.

The candidate changes no settings, shortcut action IDs, bindings, gestures,
overview behavior, or persistence format. Both package IDs, the ten settings,
and stored layouts remain compatible with 1.4.0.

## Roll back from 1.5.0 to 1.4.0

Release shortcuts with the 1.5.0 helper, disable Driftile and the optional
overview, then restore both installed packages to their verified 1.4.0
archives. For NixOS or Home Manager, restore the `v1.4.0` input and rebuild the
generation that owns each package. Re-enable the packages and restore the
1.4.0 shortcut profile. No setting cleanup or layout-state reset is required.

## Upgrade from 1.4.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the installed archives to their matching 1.4.0 versions, or update
   the pinned Nix input to `v1.4.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.4.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the ten settings, shortcut action IDs, overview behavior, and
stored layouts remain compatible.

## Upgrade from 1.3.0 to 1.4.0

1. Release helper-owned shortcuts with the 1.3.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.4.0 archives, or pin the Nix input to `v1.4.0` and rebuild.
4. Enable Driftile, review the new touchpad setting, then assign shortcuts or
   claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The new five-finger horizontal touchpad setting defaults to disabled. Enabling
it adds column-focus gestures on native Wayland and is a safe no-op on native
X11. The package IDs, shortcut action IDs, overview behavior, and stored-layout
format remain compatible with 1.3.0.

## Upgrade from 1.3.0 to 1.4.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.3.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main script and, if installed, the overview to their matching
   1.4.0-rc.1 archives, or pin the Nix input to `v1.4.0-rc.1` and rebuild.
4. Enable Driftile, review the new touchpad setting, then assign shortcuts or
   claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The new five-finger horizontal touchpad setting defaults to disabled. Enabling
it adds column-focus gestures on native Wayland and is a safe no-op on native
X11. The package IDs, shortcut action IDs, overview behavior, and stored-layout
format remain compatible with 1.3.0.

## Roll back from 1.4.0 to 1.3.0

Release shortcuts with the 1.4.0 helper, disable Driftile and the optional
overview, then restore archive installations to their verified 1.3.0 packages.
For Nix, remove a declared
`programs.driftile.settings.touchpadNavigation` attribute if present, restore
the `v1.3.0` input, and rebuild because that module does not expose the option.
Re-enable the packages and restore the 1.3.0 shortcut profile. A persisted
KConfig key may remain because 1.3.0 ignores it. No layout-state reset is
required.

## Upgrade from 1.3.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the installed archives to their matching 1.3.0 versions, or update
   the pinned Nix input to `v1.3.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

Version 1.3.0 has no runtime or persistence behavior changes from RC.1. Both
package IDs, the nine settings, shortcut action IDs, and stored layouts remain
compatible.

## Upgrade from 1.2.0 to 1.3.0

1. Release helper-owned shortcuts with the 1.2.0 helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade to `driftile-1.3.0.kwinscript` and use the matching helper, or pin
   the Nix input to `v1.3.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the 1.3.0 helper.
5. Optionally install `driftile-overview-1.3.0.kwineffect`, or set
   `programs.driftile.overview.enable = true` and rebuild. Enable the effect and
   assign its shortcut explicitly.

The main script keeps the 1.2.0 behavior, package ID, nine settings, shortcut
action IDs, and persisted-layout format. The overview is a separate, read-only
package that is disabled and unbound by default.

## Upgrade from 1.2.0 to 1.3.0-rc.1 (historical)

1. Release helper-owned shortcuts with the 1.2.0 helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade to `driftile-1.3.0-rc.1.kwinscript` and use the matching helper, or
   pin the Nix input to `v1.3.0-rc.1` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. Optionally install `driftile-overview-1.3.0-rc.1.kwineffect`, or set
   `programs.driftile.overview.enable = true` and rebuild. Enable the effect and
   assign its shortcut explicitly.

The candidate keeps the 1.2.0 main-script behavior, package ID, nine settings,
shortcut action IDs, and persisted-layout format. The overview is a separate,
read-only package that is disabled and unbound by default.

## Roll back from 1.3.0 to 1.2.0

Disable the overview and remove its archive package. For Nix, remove
`programs.driftile.overview.enable` before restoring the `v1.2.0` input and
rebuilding. Release shortcuts with the 1.3.0 helper, disable Driftile, then
install the verified 1.2.0 package and matching helper or complete the Nix
rollback. Re-enable Driftile and restore its shortcut profile. No settings or
layout-state reset is required.

## Upgrade from 1.2.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade the archive to `driftile-1.2.0.kwinscript`, or update the pinned Nix
   input to `v1.2.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.

Version 1.2.0 has no runtime behavior or persistence-format changes from RC.1.
The package ID, nine settings, shortcut action IDs, and stored layouts remain
compatible.

## Upgrade from 1.1.0

1. Release helper-owned shortcuts with the 1.1.0 helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade the archive to `driftile-1.2.0.kwinscript`, or update the pinned Nix
   input to `v1.2.0` and rebuild.
4. Enable Driftile, review the new setting, then assign shortcuts or claim them
   with the 1.2.0 helper.

The package ID, shortcut action IDs, KConfig group, and stored-layout format
remain compatible. Version 1.2.0 adds one safe-default KConfig value:

- `ApplicationTilingExclusions=""` keeps every application eligible for
  tiling.

Missing this key uses the same default. Invalid external values reject the full
nine-setting snapshot without changing active settings or layout.

With Home Manager, `programs.driftile.settings = null` continues to write
nothing. A non-null value is a complete profile, so the 1.2.0 module writes
`applicationTilingExclusions = [];` when it is omitted. Pin the package and
module to the same release generation.

## Roll back to 1.1.0

Release shortcuts with the 1.2.0 helper, disable Driftile, and install the
verified 1.1.0 archive. For Nix, restore the 1.1.0 package and module input
together and rebuild. The additive exclusion key may remain: 1.1.0 ignores it.
Existing settings, shortcut action IDs, and stored layouts remain compatible,
so no layout-state reset is required.

## Upgrade from 1.1.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade the archive to `driftile-1.1.0.kwinscript`, or update the pinned Nix
   input to `v1.1.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.

Version 1.1.0 has no runtime behavior or persistence-format changes from RC.1.
The package ID, eight settings, shortcut action IDs, and stored layouts remain
compatible.

## Upgrade from 1.0.0

1. Release helper-owned shortcuts with the 1.0.0 helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade the archive to `driftile-1.1.0.kwinscript`, or update the pinned Nix
   input to `v1.1.0` and rebuild.
4. Enable Driftile, review the three new settings, then assign shortcuts or
   claim them with the 1.1.0 helper.

The package ID, shortcut action IDs, KConfig group, and stored-layout format
remain compatible. The five 1.0.0 settings keep their existing values. Version
1.1.0 adds these safe-default KConfig values:

- `ApplicationColumnWidths=""` keeps the global initial-width policy.
- `ColumnWidthPresets=""` keeps the built-in exact-thirds cycle.
- `CenterFocusedColumn=false` keeps minimal-reveal focus navigation.

Missing new keys use those defaults. Invalid external values reject the full
eight-setting snapshot without changing the active settings or layout.

With Home Manager, `programs.driftile.settings = null` continues to write
nothing. A non-null value is a complete profile, so updating the module writes
the three new defaults when they are omitted. Pin the package and module to the
same release generation.

## Upgrade from 1.0.0-rc.1

1. Release helper-owned shortcuts with the RC helper while it is still
   available.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Upgrade the archive to `driftile-1.0.0.kwinscript`, or update the pinned Nix
   input to `v1.0.0` and rebuild.
4. Enable Driftile, then assign shortcuts or claim them with the final helper.

Version 1.0.0 has no runtime behavior or persistence-format changes from RC.1.
The package ID, settings, shortcut action IDs, and stored layouts remain
compatible.

## Upgrade from 0.1.0

1. Verify the new `.kwinscript`, checksum manifest, and optional helper as
   described in [Installation](installation.md#install-a-release).
2. If the 0.1.0 helper owns shortcuts, release them with that helper while it
   is still available.
3. Disable Driftile in **KWin Scripts** and select **Apply**. Do not continue
   while System Settings still shows it enabled.
4. Upgrade the package:

   ```bash
   kpackagetool6 --type=KWin/Script \
     --upgrade ./driftile-<new-version>.kwinscript
   ```

5. Enable Driftile, review its settings, and assign or claim shortcuts with
   the new version's helper.

The package ID, five KConfig keys, and shortcut action IDs remain stable.
Version 0.1.0 does not restore runtime layout order across reloads; the first
1.x start safely admits the windows KWin currently exposes. After its first
successful stable state publication, 1.x writes
`${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini`. Catalog
snapshots require the exact current output topology and unique matches for every
stored window; additional live windows are admitted normally. Invalid or
ambiguous logical state is rejected atomically, while unsafe per-window
restore baselines are discarded. Legacy bare-v1 documents remain accepted and
migrate on the next successful publication.

## Roll back to 1.0.0

Release shortcuts with the 1.2.0 helper, disable Driftile, and install the
verified 1.0.0 archive. For Nix, restore the 1.0.0 package and module input
together and rebuild. The four additive KConfig keys may remain: 1.0.0 ignores
them. Existing settings, shortcut action IDs, and stored layouts remain
compatible, so no layout-state reset is required.

## NixOS and Home Manager

Update the locked Driftile input, rebuild, and keep exactly one package owner
for each user. A NixOS-installed package can use the Home Manager module for
settings and a shortcut profile with
`programs.driftile.enable = false`. Review module and state ownership in
[Installation](installation.md#nixos-and-home-manager) before switching the
installation scope.

## Roll back to 0.1.0

Roll back through the same package owner used for the upgrade. Release
shortcuts with the current helper and disable Driftile first. For an archive
installation, remove 1.x and install the verified 0.1.0 archive. For Nix,
restore the previous locked input or generation and rebuild; do not add the
archive beside the declarative package. Settings remain in the same KConfig
group. Version 0.1.0 does not use the 1.x layout-state file; keep it as a backup
or move it aside only while the script is disabled.
