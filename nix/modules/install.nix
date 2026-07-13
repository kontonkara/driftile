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
  c1ControlCharacters = map builtins.fromJSON [
    ''"\u0080"''
    ''"\u0081"''
    ''"\u0082"''
    ''"\u0083"''
    ''"\u0084"''
    ''"\u0085"''
    ''"\u0086"''
    ''"\u0087"''
    ''"\u0088"''
    ''"\u0089"''
    ''"\u008a"''
    ''"\u008b"''
    ''"\u008c"''
    ''"\u008d"''
    ''"\u008e"''
    ''"\u008f"''
    ''"\u0090"''
    ''"\u0091"''
    ''"\u0092"''
    ''"\u0093"''
    ''"\u0094"''
    ''"\u0095"''
    ''"\u0096"''
    ''"\u0097"''
    ''"\u0098"''
    ''"\u0099"''
    ''"\u009a"''
    ''"\u009b"''
    ''"\u009c"''
    ''"\u009d"''
    ''"\u009e"''
    ''"\u009f"''
  ];
  hasControlCharacter =
    value:
    builtins.match ".*[[:cntrl:]].*" value != null
    || lib.any (character: lib.hasInfix character value) c1ControlCharacters;
  validDesktopFileName =
    value:
    value != ""
    && builtins.stringLength value <= 255
    && value == lib.strings.trim value
    && !hasControlCharacter value;
  validColumnWidthDesktopFileName = value: validDesktopFileName value && !lib.hasInfix "=" value;
  applicationColumnWidthType =
    lib.types.addCheck (lib.types.attrsOf (lib.types.ints.between 10 100))
      (
        widths:
        builtins.length (builtins.attrNames widths) <= 128
        && lib.all validColumnWidthDesktopFileName (builtins.attrNames widths)
      );
  renderApplicationColumnWidths =
    widths:
    lib.concatStringsSep "\n" (
      map (desktopFileName: "${desktopFileName}=${toString widths.${desktopFileName}}") (
        builtins.sort builtins.lessThan (builtins.attrNames widths)
      )
    );
  applicationTilingExclusionType = lib.types.addCheck (lib.types.listOf lib.types.str) (
    exclusions:
    builtins.length exclusions <= 128
    && builtins.length (lib.unique exclusions) == builtins.length exclusions
    && lib.all (exclusion: builtins.isString exclusion && validDesktopFileName exclusion) exclusions
  );
  renderApplicationTilingExclusions =
    exclusions: lib.concatStringsSep "\n" (builtins.sort builtins.lessThan exclusions);
  strictlyIncreasing =
    values:
    builtins.length values < 2
    || (
      builtins.head values < builtins.head (builtins.tail values)
      && strictlyIncreasing (builtins.tail values)
    );
  columnWidthPresetType = lib.types.addCheck (lib.types.listOf (lib.types.ints.between 10 100)) (
    presets: builtins.length presets <= 16 && strictlyIncreasing presets
  );
  renderColumnWidthPresets = presets: lib.concatStringsSep "," (map toString presets);
  systemMainInstallEnabled = lib.attrByPath [
    "programs"
    "driftile"
    "enable"
  ] false osConfig;
  systemOverviewInstallEnabled = lib.attrByPath [
    "programs"
    "driftile"
    "overview"
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

    overview = {
      enable = lib.mkEnableOption "installation of the Driftile overview effect";

      package = lib.mkOption {
        type = lib.types.package;
        default = self.packages.${system}."driftile-overview";
        defaultText = lib.literalExpression "inputs.driftile.packages.\${pkgs.stdenv.hostPlatform.system}.\"driftile-overview\"";
        description = "The Driftile overview effect package to install.";
      };
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
            applicationColumnWidths = lib.mkOption {
              type = applicationColumnWidthType;
              default = { };
              description = "Initial column widths keyed by exact desktop-file ID.";
            };

            applicationTilingExclusions = lib.mkOption {
              type = applicationTilingExclusionType;
              default = [ ];
              description = "Exact desktop-file IDs excluded from tiling.";
            };

            borderlessWindows = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Whether to hide KWin borders and title bars.";
            };

            centerFocusedColumn = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "Whether horizontal tiled focus navigation centers the destination column.";
            };

            touchpadNavigation = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "Whether five-finger horizontal touchpad swipes navigate tiled columns.";
            };

            columnWidthPresets = lib.mkOption {
              type = columnWidthPresetType;
              default = [ ];
              description = "Strictly increasing column width presets in percent; an empty list uses the built-in thirds.";
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
              assertion = !systemMainInstallEnabled;
              message = "Install Driftile through either NixOS or Home Manager for a user, not both.";
            }
          ];
        })
      ]
    ))
    (lib.mkIf cfg.overview.enable (
      lib.mkMerge [
        (lib.setAttrByPath packageOptionPath [ cfg.overview.package ])
        (lib.optionalAttrs preventSystemInstall {
          assertions = [
            {
              assertion = !systemOverviewInstallEnabled;
              message = "Install the Driftile overview effect through either NixOS or Home Manager for a user, not both.";
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
          ApplicationColumnWidths = renderApplicationColumnWidths cfg.settings.applicationColumnWidths;
          ApplicationTilingExclusions = renderApplicationTilingExclusions cfg.settings.applicationTilingExclusions;
          BorderlessWindows = cfg.settings.borderlessWindows;
          CenterFocusedColumn = cfg.settings.centerFocusedColumn;
          ColumnWidthPresets = renderColumnWidthPresets cfg.settings.columnWidthPresets;
          ColumnWidthStepPercent = cfg.settings.columnWidthStepPercent;
          DefaultColumnWidthPercent = cfg.settings.defaultColumnWidthPercent;
          Gap = cfg.settings.gap;
          TouchpadNavigation = cfg.settings.touchpadNavigation;
          WindowHeightStepPercent = cfg.settings.windowHeightStepPercent;
        };
      }
    ))
  ];
}
