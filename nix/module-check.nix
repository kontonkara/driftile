{
  defaultPackage,
  defaultOverviewPackage,
  defaultTransitionsPackage,
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
          transitions.package = pkgs.hello;
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
      transitionsEnabled = evaluate module packageOptionPath {
        programs.driftile.transitions.enable = true;
      } { };
      transitionsOverridden = evaluate module packageOptionPath {
        programs.driftile.transitions = {
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
      allEnabled = evaluate module packageOptionPath {
        programs.driftile = {
          enable = true;
          overview.enable = true;
          transitions.enable = true;
        };
      } { };
    in
    assert packagePaths packageOptionPath disabled == [ ];
    assert packagePaths packageOptionPath mainEnabled == [ (toString defaultPackage) ];
    assert packagePaths packageOptionPath mainOverridden == [ (toString pkgs.hello) ];
    assert packagePaths packageOptionPath overviewEnabled == [ (toString defaultOverviewPackage) ];
    assert packagePaths packageOptionPath overviewOverridden == [ (toString pkgs.hello) ];
    assert
      packagePaths packageOptionPath transitionsEnabled == [ (toString defaultTransitionsPackage) ];
    assert packagePaths packageOptionPath transitionsOverridden == [ (toString pkgs.hello) ];
    assert
      packagePaths packageOptionPath bothEnabled == [
        (toString defaultPackage)
        (toString defaultOverviewPackage)
      ];
    assert
      packagePaths packageOptionPath allEnabled == [
        (toString defaultPackage)
        (toString defaultOverviewPackage)
        (toString defaultTransitionsPackage)
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
  homeManagerTransitionsCollision =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.enable = true;
      }
      {
        programs.driftile.transitions.enable = true;
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
  homeManagerOverviewTouchpadGesture =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.touchpadGesture = {
          enable = false;
          fingerCount = 5;
        };
      }
      { };
  homeManagerOverviewTouchpadGestureDefaults =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.touchpadGesture = { };
      }
      { };
  homeManagerOverviewTouchpadGestureUnmanaged =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.touchpadGesture = null;
      }
      { };
  homeManagerOverviewTouchpadGestureWithSystemInstall =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.overview.touchpadGesture = {
          enable = true;
          fingerCount = 3;
        };
      }
      {
        programs.driftile.overview.enable = true;
      };
  homeManagerTransitionDurationMinimum =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.duration = 0;
      }
      { };
  homeManagerTransitionDurationMaximum =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.duration = 1000;
      }
      { };
  homeManagerTransitionDurationUnmanaged =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.duration = null;
      }
      { };
  homeManagerTransitionDurationWithSystemInstall =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.duration = 240;
      }
      {
        programs.driftile.transitions.enable = true;
      };
  homeManagerTransitionSettings =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions = {
          animatePosition = false;
          animateSize = true;
          windowClassExclusions = [
            "konsole org.kde.konsole"
            "firefox firefox"
          ];
        };
      }
      { };
  homeManagerTransitionSettingsUnmanaged =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions = {
          animatePosition = null;
          animateSize = null;
          windowClassExclusions = null;
        };
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
            "org.example.Browser" = "80%";
            "org.example.Editor" = "960px";
            "org.example.Terminal" = 60;
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
          alwaysCenterSingleColumn = true;
          borderlessWindows = false;
          centerFocusedColumn = true;
          centerFocusedColumnOnOverflow = true;
          columnWidthPresets = [
            20
            "50%"
            "640px"
            80
            "1280px"
          ];
          columnWidthStepPercent = 13;
          defaultColumnPresentation = "tabbed";
          defaultColumnWidthPercent = 65;
          defaultColumnWidthPixels = 960;
          emptyDesktopAboveFirst = true;
          gap = 7.5;
          showTabIndicator = false;
          touchpadNavigation = true;
          touchpadNavigationFingerCount = 4;
          touchpadNaturalScroll = false;
          touchpadWorkspaceNavigation = true;
          windowHeightPresets = [
            30
            "480px"
            "60%"
            "720px"
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
  homeManagerMaximumDefaultColumnWidthPixels =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.defaultColumnWidthPixels = 16384;
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
  homeManagerColumnWidthBounds =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationColumnWidths = {
          "org.example.A" = "10%";
          "org.example.B" = "100%";
          "org.example.C" = "1px";
          "org.example.D" = "16384px";
        };
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
  homeManagerMixedPresetBounds =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = {
          columnWidthPresets = [
            10
            "1px"
            "100%"
            "16384px"
          ];
          windowHeightPresets = [
            "10%"
            "1px"
            100
            "16384px"
          ];
        };
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
          gap = 1.2;
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
    { alwaysCenterSingleColumn = "true"; }
    { centerFocusedColumn = "true"; }
    { centerFocusedColumnOnOverflow = "true"; }
    { emptyDesktopAboveFirst = "true"; }
    { showTabIndicator = "true"; }
    { touchpadNavigation = "true"; }
    { touchpadNavigationFingerCount = 2; }
    { touchpadNavigationFingerCount = 6; }
    { touchpadNavigationFingerCount = 4.5; }
    { touchpadNaturalScroll = "true"; }
    { touchpadWorkspaceNavigation = "true"; }
    { defaultColumnPresentation = "columns"; }
    { gap = -1; }
    { gap = 65; }
    { defaultColumnWidthPercent = 9; }
    { defaultColumnWidthPercent = 101; }
    { defaultColumnWidthPixels = -1; }
    { defaultColumnWidthPixels = 16385; }
    { defaultColumnWidthPixels = 1.5; }
    { defaultColumnWidthPixels = "960"; }
    { columnWidthStepPercent = 0; }
    { columnWidthStepPercent = 51; }
    { columnWidthPresets = [ 9 ]; }
    { columnWidthPresets = [ 101 ]; }
    { columnWidthPresets = [ 50.5 ]; }
    { columnWidthPresets = [ "50" ]; }
    { columnWidthPresets = [ "9%" ]; }
    { columnWidthPresets = [ "101%" ]; }
    { columnWidthPresets = [ "0px" ]; }
    { columnWidthPresets = [ "16385px" ]; }
    { columnWidthPresets = [ "01%" ]; }
    { columnWidthPresets = [ "01px" ]; }
    {
      columnWidthPresets = [
        20
        "20%"
      ];
    }
    {
      columnWidthPresets = [
        "200px"
        50
        "100px"
      ];
    }
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
    { windowHeightPresets = [ "9%" ]; }
    { windowHeightPresets = [ "101%" ]; }
    { windowHeightPresets = [ "0px" ]; }
    { windowHeightPresets = [ "16385px" ]; }
    { windowHeightPresets = [ "01%" ]; }
    { windowHeightPresets = [ "01px" ]; }
    {
      windowHeightPresets = [
        20
        "20%"
      ];
    }
    {
      windowHeightPresets = [
        "200px"
        50
        "100px"
      ];
    }
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
    { applicationColumnWidths."org.example.Editor" = "9%"; }
    { applicationColumnWidths."org.example.Editor" = "101%"; }
    { applicationColumnWidths."org.example.Editor" = "0px"; }
    { applicationColumnWidths."org.example.Editor" = "16385px"; }
    { applicationColumnWidths."org.example.Editor" = "80"; }
    { applicationColumnWidths."org.example.Editor" = "080%"; }
    { applicationColumnWidths."org.example.Editor" = "080px"; }
    { applicationColumnWidths."org.example.Editor" = "10PX"; }
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
  invalidOverviewTouchpadGestureRejected =
    gesture:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluate homeManagerModule
            [
              "home"
              "packages"
            ]
            {
              programs.driftile.overview.touchpadGesture = gesture;
            }
            { }
          ).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  invalidTransitionDurationRejected =
    duration:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluate homeManagerModule
            [
              "home"
              "packages"
            ]
            {
              programs.driftile.transitions.duration = duration;
            }
            { }
          ).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  invalidTransitionSettingRejected =
    setting:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluate homeManagerModule
            [
              "home"
              "packages"
            ]
            {
              programs.driftile.transitions = setting;
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
        org.example.Editor=960px
        org.example.Terminal=60'';
      ApplicationFocusCentering = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFloating = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationTilingExclusions = ''
        org.example.Browser
        org.example.Editor=tool'';
      AlwaysCenterSingleColumn = true;
      BorderlessWindows = false;
      CenterFocusedColumn = true;
      CenterFocusedColumnOnOverflow = true;
      ColumnWidthPresets = "20,50%,640px,80,1280px";
      ColumnWidthStepPercent = 13;
      DefaultColumnPresentation = "tabbed";
      DefaultColumnWidthPercent = 65;
      DefaultColumnWidthPixels = 960;
      EmptyDesktopAboveFirst = true;
      Gap = 7.5;
      ShowTabIndicator = false;
      TouchpadNavigation = true;
      TouchpadNavigationFingerCount = 4;
      TouchpadNaturalScroll = false;
      TouchpadWorkspaceNavigation = true;
      WindowHeightPresets = "30,480px,60%,720px,90";
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
      DefaultColumnWidthPixels = 0;
      Gap = 16;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      TouchpadNavigationFingerCount = 5;
      TouchpadNaturalScroll = true;
      TouchpadWorkspaceNavigation = false;
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
assert map (entry: entry.assertion) homeManagerTransitionsCollision.config.assertions == [ false ];
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
assert homeManagerOptionSurface.options.programs.driftile.overview ? touchpadGesture;
assert homeManagerOptionSurface.options.programs.driftile ? transitions;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? duration;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? animatePosition;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? animateSize;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? windowClassExclusions;
assert nixosOptionSurface.options.programs.driftile ? transitions;
assert !(nixosOptionSurface.options.programs.driftile.overview ? touchpadGesture);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? duration);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? animatePosition);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? animateSize);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? windowClassExclusions);
assert !(nixosOptionSurface.options.programs.driftile ? settings);
assert packagePaths [ "home" "packages" ] homeManagerOverviewTouchpadGesture == [ ];
assert packagePaths [ "home" "packages" ] homeManagerOverviewTouchpadGestureDefaults == [ ];
assert packagePaths [ "home" "packages" ] homeManagerOverviewTouchpadGestureWithSystemInstall == [ ];
assert
  homeManagerOverviewTouchpadGesture.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = false;
      TouchpadGestureFingerCount = 5;
    };
  };
assert
  homeManagerOverviewTouchpadGestureDefaults.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = true;
      TouchpadGestureFingerCount = 4;
    };
  };
assert homeManagerOverviewTouchpadGestureUnmanaged.config.qt.kde.settings == { };
assert
  homeManagerOverviewTouchpadGestureWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = true;
      TouchpadGestureFingerCount = 3;
    };
  };
assert homeManagerOverviewTouchpadGestureWithSystemInstall.config.assertions == [ ];
assert invalidOverviewTouchpadGestureRejected true;
assert invalidOverviewTouchpadGestureRejected { enable = "true"; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 2; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 6; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 4.5; };
assert packagePaths [ "home" "packages" ] homeManagerTransitionDurationMinimum == [ ];
assert packagePaths [ "home" "packages" ] homeManagerTransitionDurationMaximum == [ ];
assert packagePaths [ "home" "packages" ] homeManagerTransitionDurationWithSystemInstall == [ ];
assert packagePaths [ "home" "packages" ] homeManagerTransitionSettings == [ ];
assert
  homeManagerTransitionDurationMinimum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 0;
  };
assert
  homeManagerTransitionDurationMaximum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 1000;
  };
assert homeManagerTransitionDurationUnmanaged.config.qt.kde.settings == { };
assert
  homeManagerTransitionSettings.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions" = {
      AnimatePosition = false;
      AnimateSize = true;
      WindowClassExclusions = ''
        firefox firefox
        konsole org.kde.konsole'';
    };
  };
assert homeManagerTransitionSettingsUnmanaged.config.qt.kde.settings == { };
assert
  homeManagerTransitionDurationWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 240;
  };
assert invalidTransitionDurationRejected (-1);
assert invalidTransitionDurationRejected 1001;
assert invalidTransitionDurationRejected 1.5;
assert invalidTransitionSettingRejected { animatePosition = "false"; };
assert invalidTransitionSettingRejected { animateSize = "true"; };
assert invalidTransitionSettingRejected { windowClassExclusions = "editor example.Editor"; };
assert invalidTransitionSettingRejected { windowClassExclusions = [ " konsole org.kde.konsole" ]; };
assert
  invalidTransitionSettingRejected {
    windowClassExclusions = [
      (builtins.concatStringsSep "" (builtins.genList (_: "é") 128))
    ];
  };
assert
  invalidTransitionSettingRejected {
    windowClassExclusions = builtins.genList (index: "app${toString index} example.App${toString index}") 129;
  };
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
  == 24;
assert
  builtins.length (
    builtins.attrNames expectedDefaultSettings.kwinrc."Script-io.github.kontonkara.driftile"
  ) == 21;
assert
  homeManagerMaximumDefaultColumnWidthPixels.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultColumnWidthPixels
  == 16384;
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
  homeManagerColumnWidthBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationColumnWidths
  == ''
    org.example.A=10
    org.example.B=100
    org.example.C=1px
    org.example.D=16384px'';
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
  homeManagerMixedPresetBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ColumnWidthPresets
  == "10,1px,100%,16384px";
assert
  homeManagerMixedPresetBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".WindowHeightPresets
  == "10%,1px,100,16384px";
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
      DefaultColumnWidthPixels = 0;
      Gap = 1.2;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      TouchpadNavigationFingerCount = 5;
      TouchpadNaturalScroll = true;
      TouchpadWorkspaceNavigation = false;
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
