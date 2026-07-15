{
  defaultPackage,
  defaultOverviewPackage,
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
        programs.driftile = {
          package = pkgs.hello;
          overview.package = pkgs.hello;
        };
      } { };
      mainEnabled = evaluate module packageOptionPath {
        programs.driftile.enable = true;
      } { };
      mainOverridden = evaluate module packageOptionPath {
        programs.driftile = {
          enable = true;
          package = pkgs.hello;
        };
      } { };
      overviewEnabled = evaluate module packageOptionPath {
        programs.driftile.overview.enable = true;
      } { };
      overviewOverridden = evaluate module packageOptionPath {
        programs.driftile.overview = {
          enable = true;
          package = pkgs.hello;
        };
      } { };
      bothEnabled = evaluate module packageOptionPath {
        programs.driftile = {
          enable = true;
          overview.enable = true;
        };
      } { };
    in
    assert packagePaths packageOptionPath disabled == [ ];
    assert packagePaths packageOptionPath mainEnabled == [ (toString defaultPackage) ];
    assert packagePaths packageOptionPath mainOverridden == [ (toString pkgs.hello) ];
    assert packagePaths packageOptionPath overviewEnabled == [ (toString defaultOverviewPackage) ];
    assert packagePaths packageOptionPath overviewOverridden == [ (toString pkgs.hello) ];
    assert
      packagePaths packageOptionPath bothEnabled == [
        (toString defaultPackage)
        (toString defaultOverviewPackage)
      ];
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
  homeManagerOverviewCollision =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.enable = true;
      }
      {
        programs.driftile.overview.enable = true;
      };
  homeManagerMainWithSystemOverview =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.enable = true;
      }
      {
        programs.driftile.overview.enable = true;
      };
  homeManagerOverviewWithSystemMain =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.enable = true;
      }
      {
        programs.driftile.enable = true;
      };
  homeManagerBothCollisions =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile = {
          enable = true;
          overview.enable = true;
        };
      }
      {
        programs.driftile = {
          enable = true;
          overview.enable = true;
        };
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
  homeManagerOptionSurface =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      { }
      { };
  nixosOptionSurface =
    evaluate nixosModule
      [
        "environment"
        "systemPackages"
      ]
      { }
      { };
  homeManagerSettings =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = {
          applicationBorderlessExclusions = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationColumnPresentations = {
            "org.example.Browser" = "tabbed";
            "org.example.Editor" = "stacked";
          };
          applicationColumnWidths = {
            "org.example.Browser" = 80;
            "org.example.Editor" = 60;
          };
          applicationFocusCentering = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialFloating = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationTilingExclusions = [
            "org.example.Editor=tool"
            "org.example.Browser"
          ];
          borderlessWindows = false;
          centerFocusedColumn = true;
          columnWidthPresets = [
            20
            50
            80
          ];
          columnWidthStepPercent = 13;
          defaultColumnPresentation = "tabbed";
          defaultColumnWidthPercent = 65;
          gap = 7;
          showTabIndicator = false;
          touchpadNavigation = true;
          windowHeightPresets = [
            30
            60
            90
          ];
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
  homeManagerMaximumPresentations =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationColumnPresentations = builtins.listToAttrs (
          builtins.genList (index: {
            name = "org.example.App${toString index}";
            value = if index == 0 then "tabbed" else "stacked";
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
        programs.driftile.settings.columnWidthPresets = builtins.genList (index: index + 10) 16;
      }
      { };
  homeManagerMaximumHeightPresets =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.windowHeightPresets = builtins.genList (index: index + 10) 16;
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
  homeManagerMaximumExclusions =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationTilingExclusions = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumFocusCentering =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationFocusCentering = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumBorderlessExclusions =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationBorderlessExclusions = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumBorderlessIdentifier =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationBorderlessExclusions = [
          (builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a")
        ];
      }
      { };
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
    { applicationFocusCentering = "org.example.Editor"; }
    { applicationFocusCentering = [ " org.example.Editor" ]; }
    {
      applicationFocusCentering = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { applicationBorderlessExclusions = "org.example.Editor"; }
    { applicationBorderlessExclusions = [ 1 ]; }
    { applicationBorderlessExclusions = [ "" ]; }
    { applicationBorderlessExclusions = [ " org.example.Editor" ]; }
    { applicationBorderlessExclusions = [ "org.example.Editor " ]; }
    {
      applicationBorderlessExclusions = [
        (builtins.fromJSON ''"\u00a0org.example.Editor"'')
      ];
    }
    { applicationBorderlessExclusions = [ "org.example\nEditor" ]; }
    {
      applicationBorderlessExclusions = [
        (builtins.fromJSON ''"org.example.\u0080Editor"'')
      ];
    }
    {
      applicationBorderlessExclusions = [
        (builtins.concatStringsSep "" (builtins.genList (_: "a") 256))
      ];
    }
    {
      applicationBorderlessExclusions = [
        (builtins.concatStringsSep "" (builtins.genList (_: "é") 128))
      ];
    }
    {
      applicationBorderlessExclusions = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationBorderlessExclusions = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { borderlessWindows = "false"; }
    { centerFocusedColumn = "true"; }
    { showTabIndicator = "true"; }
    { touchpadNavigation = "true"; }
    { defaultColumnPresentation = "columns"; }
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
    {
      columnWidthPresets = [
        50
        50
      ];
    }
    {
      columnWidthPresets = [
        50
        40
      ];
    }
    { columnWidthPresets = builtins.genList (index: index + 10) 17; }
    { windowHeightPresets = [ 9 ]; }
    { windowHeightPresets = [ 101 ]; }
    { windowHeightPresets = [ 50.5 ]; }
    { windowHeightPresets = [ "50" ]; }
    {
      windowHeightPresets = [
        50
        50
      ];
    }
    {
      windowHeightPresets = [
        50
        40
      ];
    }
    { windowHeightPresets = builtins.genList (index: index + 10) 17; }
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
    { applicationColumnPresentations."org.example.Editor" = "split"; }
    { applicationColumnPresentations."" = "tabbed"; }
    { applicationColumnPresentations." org.example.Editor" = "tabbed"; }
    { applicationColumnPresentations."org.example.Editor=" = "tabbed"; }
    { applicationColumnPresentations."org.example\nEditor" = "tabbed"; }
    {
      applicationColumnPresentations = builtins.listToAttrs (
        builtins.genList (index: {
          name = "org.example.App${toString index}";
          value = "stacked";
        }) 129
      );
    }
    { applicationTilingExclusions = "org.example.Editor"; }
    { applicationTilingExclusions = [ 1 ]; }
    { applicationTilingExclusions = [ "" ]; }
    { applicationTilingExclusions = [ " org.example.Editor" ]; }
    { applicationTilingExclusions = [ "org.example.Editor " ]; }
    { applicationTilingExclusions = [ "org.example\nEditor" ]; }
    {
      applicationTilingExclusions = [
        (builtins.fromJSON ''"org.example.\u0080Editor"'')
      ];
    }
    {
      applicationTilingExclusions = [
        (builtins.concatStringsSep "" (builtins.genList (_: "a") 256))
      ];
    }
    {
      applicationTilingExclusions = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationTilingExclusions = builtins.genList (index: "org.example.App${toString index}") 129;
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
      ApplicationBorderlessExclusions = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationColumnPresentations = ''
        org.example.Browser=tabbed
        org.example.Editor=stacked'';
      ApplicationColumnWidths = ''
        org.example.Browser=80
        org.example.Editor=60'';
      ApplicationFocusCentering = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFloating = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationTilingExclusions = ''
        org.example.Browser
        org.example.Editor=tool'';
      BorderlessWindows = false;
      CenterFocusedColumn = true;
      ColumnWidthPresets = "20,50,80";
      ColumnWidthStepPercent = 13;
      DefaultColumnPresentation = "tabbed";
      DefaultColumnWidthPercent = 65;
      Gap = 7;
      ShowTabIndicator = false;
      TouchpadNavigation = true;
      WindowHeightPresets = "30,60,90";
      WindowHeightStepPercent = 17;
    };
  };
  expectedDefaultSettings = {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationBorderlessExclusions = "";
      ApplicationColumnPresentations = "";
      ApplicationColumnWidths = "";
      ApplicationFocusCentering = "";
      ApplicationInitialFloating = "";
      ApplicationTilingExclusions = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      DefaultColumnPresentation = "stacked";
      DefaultColumnWidthPercent = 33;
      Gap = 16;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      WindowHeightPresets = "";
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
assert map (entry: entry.assertion) homeManagerOverviewCollision.config.assertions == [ false ];
assert map (entry: entry.assertion) homeManagerMainWithSystemOverview.config.assertions == [ true ];
assert map (entry: entry.assertion) homeManagerOverviewWithSystemMain.config.assertions == [ true ];
assert
  map (entry: entry.assertion) homeManagerBothCollisions.config.assertions == [
    false
    false
  ];
assert map (entry: entry.assertion) homeManagerEmptyProfile.config.assertions == [ false ];
assert packagePaths [ "home" "packages" ] homeManagerProfile == [ ];
assert packagePaths [ "home" "packages" ] homeManagerProfileWithSystemInstall == [ ];
assert homeManagerProfileWithSystemInstall.config.xdg.configFile ? "driftile/shortcuts.json";
assert homeManagerWithoutProfile.config.xdg.configFile == { };
assert homeManagerWithoutSettings.config.qt.kde.settings == { };
assert homeManagerOptionSurface.options.programs.driftile ? settings;
assert !(nixosOptionSurface.options.programs.driftile ? settings);
assert packagePaths [ "home" "packages" ] homeManagerSettings == [ ];
assert
  packagePaths [ "home" "packages" ] homeManagerDefaultSettings == [ (toString defaultPackage) ];
assert packagePaths [ "home" "packages" ] homeManagerSettingsWithSystemInstall == [ ];
assert homeManagerSettingsWithSystemInstall.config.assertions == [ ];
assert map (entry: entry.assertion) homeManagerSettingsCollision.config.assertions == [ false ];
assert homeManagerSettings.config.qt.kde.settings == expectedSettings;
assert homeManagerDefaultSettings.config.qt.kde.settings == expectedDefaultSettings;
assert
  builtins.length (builtins.attrNames expectedSettings.kwinrc."Script-io.github.kontonkara.driftile")
  == 17;
assert
  builtins.length (
    builtins.attrNames expectedDefaultSettings.kwinrc."Script-io.github.kontonkara.driftile"
  ) == 17;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumPresentations.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationColumnPresentations
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumOverrides.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationColumnWidths
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumExclusions.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationTilingExclusions
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumFocusCentering.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFocusCentering
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumBorderlessExclusions.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationBorderlessExclusions
  ) == 128;
assert
  builtins.stringLength homeManagerMaximumBorderlessIdentifier.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationBorderlessExclusions
  == 255;
assert
  homeManagerMaximumPresets.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ColumnWidthPresets
  == "10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25";
assert
  homeManagerMaximumHeightPresets.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".WindowHeightPresets
  == "10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25";
assert
  homeManagerSettingsWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationBorderlessExclusions = "";
      ApplicationColumnPresentations = "";
      ApplicationColumnWidths = "";
      ApplicationFocusCentering = "";
      ApplicationInitialFloating = "";
      ApplicationTilingExclusions = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      DefaultColumnPresentation = "stacked";
      DefaultColumnWidthPercent = 33;
      Gap = 8;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      WindowHeightPresets = "";
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
