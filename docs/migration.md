# Migration

The latest stable release is 1.9.0. Use the steps below when changing release
generations, and never combine files from different releases.

## Upgrade from 1.9.0 to 1.9.1-rc.1

1. Release helper-owned shortcuts with the 1.9.0 helper while it is still
   available.
2. Disable Driftile and the optional overview in System Settings.
3. Upgrade the main package and, if installed, the overview to their matching
   1.9.1-rc.1 archives, or pin the Nix input to `v1.9.1-rc.1` and rebuild the
   NixOS or Home Manager generation that owns each package.
4. Enable Driftile, then assign shortcuts or claim them with the RC helper.
5. If installed, re-enable the overview and review its manually assigned
   shortcut.

The candidate keeps a full-width active column between equal outer gaps and
moves adjacent columns entirely outside the viewport. Toggling back restores
the exact prior width and viewport, including after an extension reload.

The persisted full-width restore may now include an optional viewport. The
candidate accepts existing 1.9.0 documents where that field is absent. Package
IDs, all ten settings, shortcut actions and bindings, gestures, and overview
behavior remain unchanged.

## Roll back from 1.9.1-rc.1 to 1.9.0

Release shortcuts with the RC helper, disable Driftile and the optional
overview, then restore both packages to their verified 1.9.0 archives. For
NixOS or Home Manager, restore the `v1.9.0` input and rebuild the generation
that owns each package. Re-enable the packages and restore the 1.9.0 shortcut
profile.

Version 1.9.0 rejects a layout document containing the candidate's additive
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
