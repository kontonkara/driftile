# Migration

The latest stable release is 0.1.0; `main` currently builds the 1.0.0-rc.1
candidate. Use the steps below for source testing and tagged 1.x releases.
Never combine files from different releases.

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
