# Installation

Driftile requires KDE Plasma with KWin 6.7 or newer and `kpackagetool6`.
Version 1.3.0 targets Wayland, XWayland, and a single-output native X11 session.
Run all commands as the desktop user, not with `sudo`.

## Install a release

Download these files from the same release:

- `driftile-1.3.0.kwinscript`
- `driftile-overview-1.3.0.kwineffect` if using the optional overview
- `SHA256SUMS`
- `LICENSE`
- `driftile-shortcuts-1.3.0.mjs` if using the optional shortcut helper

Verify every downloaded release asset before installing it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

Install the KWin package:

```bash
kpackagetool6 --type=KWin/Script \
  --install ./driftile-1.3.0.kwinscript
```

Open **System Settings > Window Management > KWin Scripts**, enable
**Driftile**, and select **Apply**. The configure button on the same page opens
the layout and presentation settings described in
[Configuration](configuration.md).

## Configure shortcuts

Driftile works without the companion helper. The 1.3.0 helper claims the
bundled defaults and accepts custom profiles. Any action can instead be
assigned manually.

### Reversible helper

The versioned helper needs Node.js 22 or newer, `busctl`, and `flock`. Enable
Driftile before running it, and keep the helper until its saved claim has been
released.

```bash
node ./driftile-shortcuts-1.3.0.mjs claim
node ./driftile-shortcuts-1.3.0.mjs check
```

`claim` transactionally saves and replaces active conflicting assignments.
`release` restores unchanged assignments while preserving shortcuts edited
after the claim:

```bash
node ./driftile-shortcuts-1.3.0.mjs release
```

Do not use `--force` unless replacing later manual edits is intentional. See
[Shortcuts](shortcuts.md) for the complete default profile, custom JSON v1
schema, and recovery details.

Pass the same custom file to `claim` and `check`. `release` reads the saved
transaction and rejects `--profile`:

```bash
node ./driftile-shortcuts-1.3.0.mjs claim --profile ./shortcuts.json
node ./driftile-shortcuts-1.3.0.mjs check --profile ./shortcuts.json
node ./driftile-shortcuts-1.3.0.mjs release
```

Release the current claim before claiming a changed profile.

### Manual assignment

Open **System Settings > Keyboard > Shortcuts**, search for **Driftile**, and
assign the actions you want. Resolve each reported conflict in System Settings.
This path needs no helper and allows a partial shortcut profile, but it cannot
restore displaced assignments automatically.

## Upgrade

1. If the helper owns the profile, release it with the helper from the
   installed version.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Download and verify the new package, checksum manifest, and optional helper.
4. Upgrade the package:

   ```bash
   kpackagetool6 --type=KWin/Script \
     --upgrade ./driftile-<new-version>.kwinscript
   ```

5. Enable Driftile, review its configuration, then claim or assign shortcuts
   for the new version.

## Disable or uninstall

Before disabling Driftile, release a helper-managed shortcut profile. For a
manual profile, restore any assignments you want to keep through System
Settings. Then disable Driftile in **KWin Scripts** and select **Apply**.

After releasing shortcuts and disabling the extension, uninstall it with:

```bash
kpackagetool6 --type=KWin/Script \
  --remove io.github.kontonkara.driftile
```

If `release` reports assignments changed after the claim, it has preserved
those edits. Resolve them before deleting the helper; forcing a release may
overwrite them.

If the saved claim file is lost or corrupt, the helper fails closed because it
cannot reconstruct displaced assignments. Restore shortcuts manually in
System Settings before removing `$XDG_STATE_HOME/driftile/shortcut-claim.json`.
When `XDG_STATE_HOME` is unset, the file is under
`$HOME/.local/state/driftile/shortcut-claim.json`.

Uninstalling the package does not delete configuration or layout data. For an
optional clean removal, first complete the shortcut release and uninstall
steps above, then remove Driftile's stored KConfig values and layout snapshot:

```bash
kwriteconfig6 --file kwinrc --group Plugins \
  --key io.github.kontonkara.driftileEnabled --delete ""
for key in ApplicationColumnWidths ApplicationTilingExclusions BorderlessWindows \
  CenterFocusedColumn ColumnWidthPresets ColumnWidthStepPercent \
  DefaultColumnWidthPercent Gap TouchpadNavigation WindowHeightStepPercent; do
  kwriteconfig6 --file kwinrc \
    --group Script-io.github.kontonkara.driftile \
    --key "$key" --delete ""
done
rm -- "${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini"
```

Delete the shortcut claim file only after a successful release. Shortcuts
assigned manually remain in KGlobalAccel and must be removed through System
Settings.

## NixOS and Home Manager

The flake exposes packages and installation modules for `x86_64-linux` and
`aarch64-linux`. Add Driftile as an input:

```nix
inputs.driftile.url = "github:kontonkara/driftile/v1.3.0";
```

For a system-wide NixOS installation, import the NixOS module:

```nix
modules = [
  driftile.nixosModules.default
  {
    programs.driftile.enable = true;
  }
];
```

For a per-user installation, import the module into an existing Home Manager
configuration:

```nix
modules = [
  driftile.homeManagerModules.default
  {
    programs.driftile.enable = true;
  }
];
```

The 1.3.0 module exposes the optional overview as a separate package. It remains
disabled unless requested:

```nix
programs.driftile.overview.enable = true;
```

Main-script and overview ownership are independent. NixOS may install one while
Home Manager installs the other, but the modules reject installing the same
package ID in both scopes for one user. The module does not enable the effect
or assign its shortcut; see [Overview companion](overview.md).

The 1.3.0 Home Manager module can also own the complete nine-setting profile:

```nix
programs.driftile.settings = {
  applicationColumnWidths = {
    "org.kde.konsole" = 60;
  };
  applicationTilingExclusions = [ ];
  borderlessWindows = true;
  centerFocusedColumn = false;
  columnWidthPresets = [ 20 50 80 ];
  gap = 16;
  defaultColumnWidthPercent = 50;
  columnWidthStepPercent = 10;
  windowHeightStepPercent = 10;
};
```

The profile is independent of package installation. When the package is
already installed by NixOS or another system module, keep
`programs.driftile.enable = false` and set `programs.driftile.settings` in Home
Manager. See [Configuration](configuration.md#home-manager) for ownership and
reload behavior.

The current Home Manager module can also generate a custom shortcut profile:

```nix
programs.driftile.shortcuts = {
  driftile_focus_column_left = [ "Meta+A" "Meta+Left" ];
  driftile_reset_column_width = [ ];
};
```

This writes JSON v1 to `$XDG_CONFIG_HOME/driftile/shortcuts.json` (normally
`~/.config/driftile/shortcuts.json`). It does not claim shortcuts
automatically. After rebuilding, enable Driftile and run:

```bash
profile="${XDG_CONFIG_HOME:-$HOME/.config}/driftile/shortcuts.json"
driftile-shortcuts claim --profile "$profile"
driftile-shortcuts check --profile "$profile"
```

For a system-wide NixOS installation, import the Home Manager module only for
settings or a shortcut profile and leave Home Manager's
`programs.driftile.enable` false. The system package supplies
`driftile-shortcuts`, while Home Manager manages only the requested user
configuration; this avoids installing the KWin package twice.

`programs.driftile.package` can override the package in either module. Choose
one installation scope for each user instead of also installing the
`.kwinscript`; multiple copies with the same KWin package ID can make package
selection ambiguous. Rebuild the NixOS or Home Manager generation, then enable
and configure Driftile in System Settings.

The Nix package provides the shortcut helper as `driftile-shortcuts` with its
Node.js, `busctl`, and `flock` runtime dependencies wrapped:

```bash
driftile-shortcuts claim
driftile-shortcuts check
driftile-shortcuts release
```

Release the profile before upgrading or removing the Nix package so the
recovery command remains available. Before a removal rebuild, also disable
Driftile in **KWin Scripts** and select **Apply**. Then remove the relevant
module declaration or set `programs.driftile.enable = false` and rebuild. Nix
removal retains the same `kwinrc`, layout snapshot, and manually assigned
shortcut state described above. Remove `programs.driftile.settings` before
cleaning its KConfig values so a later Home Manager activation cannot restore
them.

Source builds use `nix build`; the development shell is available through
`nix develop`.

## Compatibility and migration

See [Compatibility](compatibility.md) for current platform, geometry, toolkit,
and hardware limits. Read [Migration](migration.md) before changing release or
installation generations. Release details are in the
[1.3.0 release notes](release-notes-1.3.0.md).
