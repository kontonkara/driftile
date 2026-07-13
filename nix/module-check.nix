{
  defaultPackage,
  homeManagerModule,
  lib,
  nixosModule,
  pkgs,
}:

let
  evaluate =
    module: packageOptionPath: configuration: osConfig:
    lib.evalModules {
      specialArgs = {
        inherit osConfig pkgs;
      };
      modules = [
        {
          options.assertions = lib.mkOption {
            type = lib.types.listOf (
              lib.types.submodule {
                options = {
                  assertion = lib.mkOption {
                    type = lib.types.bool;
                  };
                  message = lib.mkOption {
                    type = lib.types.str;
                  };
                };
              }
            );
            default = [ ];
          };
        }
        {
          options = lib.setAttrByPath packageOptionPath (
            lib.mkOption {
              type = lib.types.listOf lib.types.package;
              default = [ ];
            }
          );
        }
        {
          options.xdg.configFile = lib.mkOption {
            type = lib.types.attrsOf (
              lib.types.submodule {
                options.text = lib.mkOption {
                  type = lib.types.str;
                };
              }
            );
            default = { };
          };
        }
        {
          options.qt.kde.settings = lib.mkOption {
            type = lib.types.attrsOf lib.types.anything;
            default = { };
          };
        }
        module
        configuration
      ];
    };

  packagePaths =
    packageOptionPath: evaluation:
    map toString (lib.attrByPath packageOptionPath [ ] evaluation.config);

  verifyModule =
    module: packageOptionPath:
    let
      disabled = evaluate module packageOptionPath {
        programs.driftile.package = pkgs.hello;
      } { };
      enabled = evaluate module packageOptionPath {
        programs.driftile.enable = true;
      } { };
      overridden = evaluate module packageOptionPath {
        programs.driftile = {
          enable = true;
          package = pkgs.hello;
        };
      } { };
    in
    assert packagePaths packageOptionPath disabled == [ ];
    assert packagePaths packageOptionPath enabled == [ (toString defaultPackage) ];
    assert packagePaths packageOptionPath overridden == [ (toString pkgs.hello) ];
    true;

  homeManagerCollision =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.enable = true;
      }
      {
        programs.driftile.enable = true;
      };
  homeManagerEmptyProfile =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.shortcuts = { };
      }
      { };
  homeManagerProfile =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.shortcuts = {
          driftile_focus_column_left = [ "Meta+A" ];
          driftile_reset_column_width = [ ];
        };
      }
      { };
  homeManagerProfileWithSystemInstall =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.shortcuts = {
          driftile_focus_column_left = [ "Meta+A" ];
        };
      }
      {
        programs.driftile.enable = true;
      };
  homeManagerWithoutProfile =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.shortcuts = null;
      }
      { };
  homeManagerWithoutSettings =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = null;
      }
      { };
  homeManagerSettings =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = {
          applicationColumnWidths = {
            "org.example.Browser" = 80;
            "org.example.Editor" = 60;
          };
          borderlessWindows = false;
          centerFocusedColumn = true;
          columnWidthPresets = [ 20 50 80 ];
          columnWidthStepPercent = 13;
          defaultColumnWidthPercent = 65;
          gap = 7;
          windowHeightStepPercent = 17;
        };
      }
      { };
  homeManagerDefaultSettings =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile = {
          enable = true;
          settings = { };
        };
      }
      { };
  homeManagerMaximumOverrides =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationColumnWidths = builtins.listToAttrs (
          builtins.genList (index: {
            name = "org.example.App${toString index}";
            value = 50;
          }) 128
        );
      }
      { };
  homeManagerMaximumPresets =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.columnWidthPresets =
          builtins.genList (index: index + 10) 16;
      }
      { };
  homeManagerSettingsWithSystemInstall =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = {
          gap = 8;
        };
      }
      {
        programs.driftile.enable = true;
      };
  homeManagerSettingsCollision =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile = {
          enable = true;
          settings = { };
        };
      }
      {
        programs.driftile.enable = true;
      };
  invalidSettings = [
    { borderlessWindows = "false"; }
    { centerFocusedColumn = "true"; }
    { gap = -1; }
    { gap = 65; }
    { defaultColumnWidthPercent = 9; }
    { defaultColumnWidthPercent = 101; }
    { columnWidthStepPercent = 0; }
    { columnWidthStepPercent = 51; }
    { columnWidthPresets = [ 9 ]; }
    { columnWidthPresets = [ 101 ]; }
    { columnWidthPresets = [ 50.5 ]; }
    { columnWidthPresets = [ "50" ]; }
    { columnWidthPresets = [ 50 50 ]; }
    { columnWidthPresets = [ 50 40 ]; }
    { columnWidthPresets = builtins.genList (index: index + 10) 17; }
    { windowHeightStepPercent = 0; }
    { windowHeightStepPercent = 51; }
    { applicationColumnWidths."org.example.Editor" = 9; }
    { applicationColumnWidths."org.example.Editor" = 101; }
    { applicationColumnWidths."" = 50; }
    { applicationColumnWidths." org.example.Editor" = 50; }
    { applicationColumnWidths."org.example.Editor=" = 50; }
    { applicationColumnWidths."org.example\nEditor" = 50; }
    {
      applicationColumnWidths = builtins.listToAttrs [
        {
          name = builtins.fromJSON ''"org.example.\u0080Editor"'';
          value = 50;
        }
      ];
    }
    {
      applicationColumnWidths.${builtins.concatStringsSep "" (builtins.genList (_: "a") 256)} = 50;
    }
    {
      applicationColumnWidths = builtins.listToAttrs (
        builtins.genList (index: {
          name = "org.example.App${toString index}";
          value = 50;
        }) 129
      );
    }
  ];
  invalidSettingsRejected =
    settings:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluate homeManagerModule
            [
              "home"
              "packages"
            ]
            {
              programs.driftile.settings = settings;
            }
            { }
          ).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  expectedSettings = {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationColumnWidths = ''
        org.example.Browser=80
        org.example.Editor=60'';
      BorderlessWindows = false;
      CenterFocusedColumn = true;
      ColumnWidthPresets = "20,50,80";
      ColumnWidthStepPercent = 13;
      DefaultColumnWidthPercent = 65;
      Gap = 7;
      WindowHeightStepPercent = 17;
    };
  };
  expectedDefaultSettings = {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationColumnWidths = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      DefaultColumnWidthPercent = 50;
      Gap = 16;
      WindowHeightStepPercent = 10;
    };
  };
  homeManagerValid = verifyModule homeManagerModule [
    "home"
    "packages"
  ];
  nixosValid = verifyModule nixosModule [
    "environment"
    "systemPackages"
  ];
in
assert homeManagerValid;
assert map (entry: entry.assertion) homeManagerCollision.config.assertions == [ false ];
assert map (entry: entry.assertion) homeManagerEmptyProfile.config.assertions == [ false ];
assert packagePaths [ "home" "packages" ] homeManagerProfile == [ ];
assert packagePaths [ "home" "packages" ] homeManagerProfileWithSystemInstall == [ ];
assert homeManagerProfileWithSystemInstall.config.xdg.configFile ? "driftile/shortcuts.json";
assert homeManagerWithoutProfile.config.xdg.configFile == { };
assert homeManagerWithoutSettings.config.qt.kde.settings == { };
assert packagePaths [ "home" "packages" ] homeManagerSettings == [ ];
assert
  packagePaths [ "home" "packages" ] homeManagerDefaultSettings == [ (toString defaultPackage) ];
assert packagePaths [ "home" "packages" ] homeManagerSettingsWithSystemInstall == [ ];
assert homeManagerSettingsWithSystemInstall.config.assertions == [ ];
assert map (entry: entry.assertion) homeManagerSettingsCollision.config.assertions == [ false ];
assert homeManagerSettings.config.qt.kde.settings == expectedSettings;
assert homeManagerDefaultSettings.config.qt.kde.settings == expectedDefaultSettings;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumOverrides.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationColumnWidths
  ) == 128;
assert
  homeManagerMaximumPresets.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ColumnWidthPresets
  == "10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25";
assert
  homeManagerSettingsWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationColumnWidths = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      DefaultColumnWidthPercent = 50;
      Gap = 8;
      WindowHeightStepPercent = 10;
    };
  };
assert lib.all invalidSettingsRejected invalidSettings;
assert
  homeManagerProfile.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"],"driftile_reset_column_width":[]},"version":1}
  '';
assert nixosValid;
pkgs.runCommand "driftile-module-check" { } ''
  touch "$out"
''
