{
  homeSettings ? false,
  self,
  packageOptionPath,
  preventSystemInstall ? false,
  shortcutConfigFile ? false,
}:

{
  config,
  lib,
  osConfig ? { },
  pkgs,
  ...
}:

let
  cfg = config.programs.driftile;
  pluginId = "io.github.kontonkara.driftile";
  system = pkgs.stdenv.hostPlatform.system;
  systemInstallEnabled = lib.attrByPath [
    "programs"
    "driftile"
    "enable"
  ] false osConfig;
in
{
  options.programs.driftile = {
    enable = lib.mkEnableOption "installation of the Driftile KWin extension";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${system}.driftile;
      defaultText = lib.literalExpression "inputs.driftile.packages.\${pkgs.stdenv.hostPlatform.system}.driftile";
      description = "The Driftile package to install.";
    };
  }
  // lib.optionalAttrs shortcutConfigFile {
    shortcuts = lib.mkOption {
      type = lib.types.nullOr (lib.types.attrsOf (lib.types.listOf lib.types.str));
      default = null;
      description = "Exact per-action shortcut lists written as a portable profile.";
    };
  }
  // lib.optionalAttrs homeSettings {
    settings = lib.mkOption {
      type = lib.types.nullOr (
        lib.types.submodule {
          options = {
            borderlessWindows = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Whether to hide KWin borders and title bars.";
            };

            gap = lib.mkOption {
              type = lib.types.ints.between 0 64;
              default = 16;
              description = "Window gap in logical pixels.";
            };

            defaultColumnWidthPercent = lib.mkOption {
              type = lib.types.ints.between 10 100;
              default = 50;
              description = "Default column width as a percentage.";
            };

            columnWidthStepPercent = lib.mkOption {
              type = lib.types.ints.between 1 50;
              default = 10;
              description = "Column width adjustment in percentage points.";
            };

            windowHeightStepPercent = lib.mkOption {
              type = lib.types.ints.between 1 50;
              default = 10;
              description = "Window height adjustment in percentage points.";
            };
          };
        }
      );
      default = null;
      description = "Complete user-level Driftile settings written through KConfig.";
    };
  };

  config = lib.mkMerge [
    (lib.mkIf cfg.enable (
      lib.mkMerge [
        (lib.setAttrByPath packageOptionPath [ cfg.package ])
        (lib.optionalAttrs preventSystemInstall {
          assertions = [
            {
              assertion = !systemInstallEnabled;
              message = "Install Driftile through either NixOS or Home Manager for a user, not both.";
            }
          ];
        })
      ]
    ))
    (lib.optionalAttrs shortcutConfigFile (
      lib.mkIf (cfg.shortcuts != null) {
        assertions = [
          {
            assertion = cfg.shortcuts != { };
            message = "programs.driftile.shortcuts must contain at least one action.";
          }
        ];
        xdg.configFile."driftile/shortcuts.json".text =
          builtins.toJSON {
            version = 1;
            bindings = cfg.shortcuts;
          }
          + "\n";
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.settings != null) {
        qt.kde.settings.kwinrc."Script-${pluginId}" = {
          BorderlessWindows = cfg.settings.borderlessWindows;
          ColumnWidthStepPercent = cfg.settings.columnWidthStepPercent;
          DefaultColumnWidthPercent = cfg.settings.defaultColumnWidthPercent;
          Gap = cfg.settings.gap;
          WindowHeightStepPercent = cfg.settings.windowHeightStepPercent;
        };
      }
    ))
  ];
}
