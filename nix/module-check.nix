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
  homeManagerTransitionResizeAnimationThresholdMinimum =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.resizeAnimationThreshold = 0;
      }
      { };
  homeManagerTransitionResizeAnimationThresholdMaximum =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.transitions.resizeAnimationThreshold = 64;
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
          easingCurve = "out-quart";
          resizeAnimationThreshold = 12;
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
          easingCurve = null;
          resizeAnimationThreshold = null;
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
          applicationWindowHeights = {
            "org.example.Browser" = "75%";
            "org.example.Editor" = "720px";
            "org.example.Terminal" = 45;
          };
          applicationFocusCentering = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialFloating = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialFocused = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialUnfocused = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialFullscreen = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialMaximized = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialFullWidth = [
            "org.example.Terminal"
            "org.example.Browser"
          ];
          applicationInitialDestinations = {
            "org.example.Browser" = {
              desktop = 2;
              output = "DP-2";
            };
            "org.example.Editor".output = "HDMI-A-1";
            "org.example.Terminal".desktop = 25;
            "org.example.Work" = {
              desktopName = "Work";
              output = "DP-3";
            };
          };
          applicationFloatingPositions = {
            "org.example.Browser" = {
              anchor = "bottom-right";
              x = -24;
              y = 32;
            };
            "org.example.Terminal" = {
              anchor = "top-left";
              x = 12;
              y = -8;
            };
          };
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
          columnWidthStepPixels = 144;
          defaultColumnPresentation = "tabbed";
          defaultColumnWidthPercent = 65;
          defaultColumnWidthPixels = 960;
          defaultWindowHeight = "720px";
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
          windowHeightStepPixels = 96;
          workspaceAutoBackAndForth = true;
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
  homeManagerDefaultWindowHeightValues = map (
    value:
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.defaultWindowHeight = value;
      }
      { }
  ) [
    "auto"
    10
    "10%"
    100
    "100%"
    "1px"
    "16384px"
  ];
  homeManagerMaximumStepPixels =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings = {
          columnWidthStepPixels = 16384;
          windowHeightStepPixels = 16384;
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
  homeManagerMaximumWindowHeights =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationWindowHeights = builtins.listToAttrs (
          builtins.genList (index: {
            name = "org.example.App${toString index}";
            value = 50;
          }) 128
        );
      }
      { };
  homeManagerWindowHeightBounds =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationWindowHeights = {
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
  homeManagerMaximumInitialFullWidth =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialFullWidth = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumInitialFocused =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialFocused = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumInitialUnfocused =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialUnfocused = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumInitialFullscreen =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialFullscreen = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumInitialMaximized =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialMaximized = builtins.genList (
          index: "org.example.App${toString index}"
        ) 128;
      }
      { };
  homeManagerMaximumInitialDestinations =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialDestinations = builtins.listToAttrs (
          builtins.genList (index: {
            name = "org.example.App${toString index}";
            value.desktop = 1;
          }) 128
        );
      }
      { };
  homeManagerInitialDestinationBounds =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialDestinations = {
          "org.example.Maximum".desktop = 25;
          "org.example.Minimum".desktop = 1;
          "org.example.Named".desktopName =
            builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a";
          "org.example.Output".output =
            builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a";
        };
      }
      { };
  homeManagerMaximumInitialDestinationIdentifier =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationInitialDestinations = {
          ${builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a"}.output = "DP-1";
        };
      }
      { };
  homeManagerMaximumFloatingPositions =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationFloatingPositions = builtins.listToAttrs (
          builtins.genList (index: {
            name = "org.example.App${toString index}";
            value = {
              anchor = "top";
              x = 0;
              y = 0;
            };
          }) 128
        );
      }
      { };
  homeManagerFloatingPositionBounds =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationFloatingPositions = {
          "org.example.Maximum" = {
            anchor = "bottom-right";
            x = 16384;
            y = 16384;
          };
          "org.example.Minimum" = {
            anchor = "top-left";
            x = -16384;
            y = -16384;
          };
        };
      }
      { };
  homeManagerMaximumFloatingPositionIdentifier =
    evaluate homeManagerModule
      [
        "home"
        "packages"
      ]
      {
        programs.driftile.settings.applicationFloatingPositions = {
          ${builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a"} = {
            anchor = "left";
            x = 0;
            y = 0;
          };
        };
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
    { applicationInitialDestinations = [ ]; }
    { applicationInitialDestinations."org.example.Editor" = "desktop:1"; }
    { applicationInitialDestinations."org.example.Editor" = { }; }
    {
      applicationInitialDestinations."org.example.Editor" = {
        desktop = null;
        output = null;
      };
    }
    { applicationInitialDestinations."org.example.Editor".desktop = 0; }
    { applicationInitialDestinations."org.example.Editor".desktop = 26; }
    { applicationInitialDestinations."org.example.Editor".desktop = 1.5; }
    { applicationInitialDestinations."org.example.Editor".desktopName = ""; }
    { applicationInitialDestinations."org.example.Editor".desktopName = " Work"; }
    { applicationInitialDestinations."org.example.Editor".desktopName = "Work "; }
    { applicationInitialDestinations."org.example.Editor".desktopName = "Work,Personal"; }
    { applicationInitialDestinations."org.example.Editor".desktopName = "Work\nPersonal"; }
    {
      applicationInitialDestinations."org.example.Editor".desktopName =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 128);
    }
    {
      applicationInitialDestinations."org.example.Editor" = {
        desktop = 1;
        desktopName = "Work";
      };
    }
    { applicationInitialDestinations."org.example.Editor".output = ""; }
    { applicationInitialDestinations."org.example.Editor".output = " DP-1"; }
    { applicationInitialDestinations."org.example.Editor".output = "DP-1 "; }
    { applicationInitialDestinations."org.example.Editor".output = "DP,1"; }
    { applicationInitialDestinations."org.example.Editor".output = "DP\n1"; }
    {
      applicationInitialDestinations."org.example.Editor".output =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 128);
    }
    { applicationInitialDestinations." org.example.Editor".desktop = 1; }
    { applicationInitialDestinations."org.example=Editor".desktop = 1; }
    {
      applicationInitialDestinations = builtins.listToAttrs (
        builtins.genList (index: {
          name = "org.example.App${toString index}";
          value.desktop = 1;
        }) 129
      );
    }
    { applicationFloatingPositions = [ ]; }
    { applicationFloatingPositions."org.example.Editor" = "top-left,0,0"; }
    {
      applicationFloatingPositions."org.example.Editor" = {
        anchor = "center";
        x = 0;
        y = 0;
      };
    }
    {
      applicationFloatingPositions."org.example.Editor" = {
        anchor = "top-left";
        x = -16385;
        y = 0;
      };
    }
    {
      applicationFloatingPositions."org.example.Editor" = {
        anchor = "top-left";
        x = 0;
        y = 16385;
      };
    }
    {
      applicationFloatingPositions."org.example.Editor" = {
        anchor = "top-left";
        x = 0.5;
        y = 0;
      };
    }
    {
      applicationFloatingPositions."org.example.Editor" = {
        anchor = "top-left";
        x = 0;
      };
    }
    {
      applicationFloatingPositions." org.example.Editor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      applicationFloatingPositions."org.example=Editor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      applicationFloatingPositions."org.example\nEditor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      applicationFloatingPositions.${builtins.concatStringsSep "" (builtins.genList (_: "é") 128)} = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      applicationFloatingPositions = builtins.listToAttrs (
        builtins.genList (index: {
          name = "org.example.App${toString index}";
          value = {
            anchor = "top-left";
            x = 0;
            y = 0;
          };
        }) 129
      );
    }
    { applicationInitialFullscreen = "org.example.Editor"; }
    {
      applicationInitialFullscreen = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationInitialFullscreen = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { applicationInitialFocused = "org.example.Editor"; }
    {
      applicationInitialFocused = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationInitialFocused = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { applicationInitialUnfocused = "org.example.Editor"; }
    {
      applicationInitialUnfocused = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationInitialUnfocused = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { applicationInitialMaximized = "org.example.Editor"; }
    {
      applicationInitialMaximized = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationInitialMaximized = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
    { applicationInitialFullWidth = "org.example.Editor"; }
    {
      applicationInitialFullWidth = [
        "org.example.Editor"
        "org.example.Editor"
      ];
    }
    {
      applicationInitialFullWidth = builtins.genList (
        index: "org.example.App${toString index}"
      ) 129;
    }
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
    { workspaceAutoBackAndForth = "true"; }
    { defaultColumnPresentation = "columns"; }
    { gap = -1; }
    { gap = 65; }
    { defaultColumnWidthPercent = 9; }
    { defaultColumnWidthPercent = 101; }
    { defaultColumnWidthPixels = -1; }
    { defaultColumnWidthPixels = 16385; }
    { defaultColumnWidthPixels = 1.5; }
    { defaultColumnWidthPixels = "960"; }
    { defaultWindowHeight = 9; }
    { defaultWindowHeight = 101; }
    { defaultWindowHeight = 10.5; }
    { defaultWindowHeight = "10"; }
    { defaultWindowHeight = "9%"; }
    { defaultWindowHeight = "101%"; }
    { defaultWindowHeight = "0px"; }
    { defaultWindowHeight = "16385px"; }
    { defaultWindowHeight = "010%"; }
    { defaultWindowHeight = "01px"; }
    { defaultWindowHeight = "AUTO"; }
    { defaultWindowHeight = true; }
    { columnWidthStepPercent = 0; }
    { columnWidthStepPercent = 51; }
    { columnWidthStepPixels = -1; }
    { columnWidthStepPixels = 16385; }
    { columnWidthStepPixels = 1.5; }
    { columnWidthStepPixels = "144"; }
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
    { windowHeightStepPixels = -1; }
    { windowHeightStepPixels = 16385; }
    { windowHeightStepPixels = 1.5; }
    { windowHeightStepPixels = "96"; }
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
    { applicationWindowHeights."org.example.Editor" = 9; }
    { applicationWindowHeights."org.example.Editor" = 101; }
    { applicationWindowHeights."org.example.Editor" = "9%"; }
    { applicationWindowHeights."org.example.Editor" = "101%"; }
    { applicationWindowHeights."org.example.Editor" = "0px"; }
    { applicationWindowHeights."org.example.Editor" = "16385px"; }
    { applicationWindowHeights."org.example.Editor" = "80"; }
    { applicationWindowHeights."org.example.Editor" = "080%"; }
    { applicationWindowHeights."org.example.Editor" = "080px"; }
    { applicationWindowHeights."org.example.Editor" = "10PX"; }
    { applicationWindowHeights."" = 50; }
    { applicationWindowHeights." org.example.Editor" = 50; }
    { applicationWindowHeights."org.example.Editor=" = 50; }
    { applicationWindowHeights."org.example\nEditor" = 50; }
    {
      applicationWindowHeights = builtins.listToAttrs [
        {
          name = builtins.fromJSON ''"org.example.\u0080Editor"'';
          value = 50;
        }
      ];
    }
    {
      applicationWindowHeights.${builtins.concatStringsSep "" (builtins.genList (_: "a") 256)} = 50;
    }
    {
      applicationWindowHeights = builtins.listToAttrs (
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
      ApplicationFloatingPositions = ''
        org.example.Browser=bottom-right,-24,32
        org.example.Terminal=top-left,12,-8'';
      ApplicationWindowHeights = ''
        org.example.Browser=75
        org.example.Editor=720px
        org.example.Terminal=45'';
      ApplicationFocusCentering = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFloating = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFocused = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialUnfocused = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFullscreen = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialMaximized = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialFullWidth = ''
        org.example.Browser
        org.example.Terminal'';
      ApplicationInitialDestinations = ''
        org.example.Browser=desktop:2,output:DP-2
        org.example.Editor=output:HDMI-A-1
        org.example.Terminal=desktop:25
        org.example.Work=desktop-name:Work,output:DP-3'';
      ApplicationTilingExclusions = ''
        org.example.Browser
        org.example.Editor=tool'';
      AlwaysCenterSingleColumn = true;
      BorderlessWindows = false;
      CenterFocusedColumn = true;
      CenterFocusedColumnOnOverflow = true;
      ColumnWidthPresets = "20,50%,640px,80,1280px";
      ColumnWidthStepPercent = 13;
      ColumnWidthStepPixels = 144;
      DefaultColumnPresentation = "tabbed";
      DefaultColumnWidthPercent = 65;
      DefaultColumnWidthPixels = 960;
      DefaultWindowHeight = "720px";
      EmptyDesktopAboveFirst = true;
      Gap = 7.5;
      ShowTabIndicator = false;
      TouchpadNavigation = true;
      TouchpadNavigationFingerCount = 4;
      TouchpadNaturalScroll = false;
      TouchpadWorkspaceNavigation = true;
      WindowHeightPresets = "30,480px,60%,720px,90";
      WindowHeightStepPercent = 17;
      WindowHeightStepPixels = 96;
      WorkspaceAutoBackAndForth = true;
    };
  };
  expectedDefaultSettings = {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationBorderlessExclusions = "";
      ApplicationColumnPresentations = "";
      ApplicationColumnWidths = "";
      ApplicationFloatingPositions = "";
      ApplicationWindowHeights = "";
      ApplicationFocusCentering = "";
      ApplicationInitialFloating = "";
      ApplicationInitialFocused = "";
      ApplicationInitialUnfocused = "";
      ApplicationInitialFullscreen = "";
      ApplicationInitialMaximized = "";
      ApplicationInitialFullWidth = "";
      ApplicationInitialDestinations = "";
      ApplicationTilingExclusions = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      ColumnWidthStepPixels = 0;
      DefaultColumnPresentation = "stacked";
      DefaultColumnWidthPercent = 33;
      DefaultColumnWidthPixels = 0;
      DefaultWindowHeight = "auto";
      Gap = 16;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      TouchpadNavigationFingerCount = 5;
      TouchpadNaturalScroll = true;
      TouchpadWorkspaceNavigation = false;
      WindowHeightPresets = "";
      WindowHeightStepPercent = 10;
      WindowHeightStepPixels = 0;
      WorkspaceAutoBackAndForth = false;
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
assert homeManagerOptionSurface.options.programs.driftile.transitions ? easingCurve;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? resizeAnimationThreshold;
assert homeManagerOptionSurface.options.programs.driftile.transitions ? windowClassExclusions;
assert nixosOptionSurface.options.programs.driftile ? transitions;
assert !(nixosOptionSurface.options.programs.driftile.overview ? touchpadGesture);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? duration);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? animatePosition);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? animateSize);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? easingCurve);
assert !(nixosOptionSurface.options.programs.driftile.transitions ? resizeAnimationThreshold);
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
assert
  packagePaths [ "home" "packages" ] homeManagerTransitionResizeAnimationThresholdMinimum == [ ];
assert
  packagePaths [ "home" "packages" ] homeManagerTransitionResizeAnimationThresholdMaximum == [ ];
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
assert
  homeManagerTransitionResizeAnimationThresholdMinimum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".ResizeAnimationThreshold = 0;
  };
assert
  homeManagerTransitionResizeAnimationThresholdMaximum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".ResizeAnimationThreshold = 64;
  };
assert homeManagerTransitionDurationUnmanaged.config.qt.kde.settings == { };
assert
  homeManagerTransitionSettings.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions" = {
      AnimatePosition = false;
      AnimateSize = true;
      EasingCurve = "out-quart";
      ResizeAnimationThreshold = 12;
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
assert invalidTransitionSettingRejected { easingCurve = "in-cubic"; };
assert invalidTransitionSettingRejected { resizeAnimationThreshold = -1; };
assert invalidTransitionSettingRejected { resizeAnimationThreshold = 65; };
assert invalidTransitionSettingRejected { resizeAnimationThreshold = 1.5; };
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
  == 36;
assert
  builtins.length (
    builtins.attrNames expectedDefaultSettings.kwinrc."Script-io.github.kontonkara.driftile"
  ) == 33;
assert
  homeManagerMaximumDefaultColumnWidthPixels.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultColumnWidthPixels
  == 16384;
assert
  map (
    evaluation:
    evaluation.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultWindowHeight
  ) homeManagerDefaultWindowHeightValues
  == [
    "auto"
    "10"
    "10"
    "100"
    "100"
    "1px"
    "16384px"
  ];
assert
  homeManagerMaximumStepPixels.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ColumnWidthStepPixels
  == 16384;
assert
  homeManagerMaximumStepPixels.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".WindowHeightStepPixels
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
      homeManagerMaximumWindowHeights.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationWindowHeights
  ) == 128;
assert
  homeManagerWindowHeightBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationWindowHeights
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
      homeManagerMaximumInitialFullWidth.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialFullWidth
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumInitialFocused.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialFocused
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumInitialUnfocused.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialUnfocused
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumInitialFullscreen.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialFullscreen
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumInitialMaximized.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialMaximized
  ) == 128;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumInitialDestinations.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations
  ) == 128;
assert
  let
    rendered =
      homeManagerInitialDestinationBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations;
    lines = lib.splitString "\n" rendered;
    desktopNamePrefix = "org.example.Named=desktop-name:";
    desktopNameLine = builtins.elemAt lines 2;
    outputPrefix = "org.example.Output=output:";
    outputLine = builtins.elemAt lines 3;
  in
  builtins.elem "org.example.Maximum=desktop:25" lines
  && builtins.elem "org.example.Minimum=desktop:1" lines
  && lib.hasPrefix desktopNamePrefix desktopNameLine
  && builtins.stringLength (lib.removePrefix desktopNamePrefix desktopNameLine) == 255
  && lib.hasPrefix outputPrefix outputLine
  && builtins.stringLength (lib.removePrefix outputPrefix outputLine) == 255;
assert
  builtins.stringLength (
    builtins.head (
      lib.splitString "="
        homeManagerMaximumInitialDestinationIdentifier.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations
    )
  ) == 255;
assert
  builtins.length (
    lib.splitString "\n"
      homeManagerMaximumFloatingPositions.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
  ) == 128;
assert
  homeManagerFloatingPositionBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
  == ''
    org.example.Maximum=bottom-right,16384,16384
    org.example.Minimum=top-left,-16384,-16384'';
assert
  builtins.stringLength (
    builtins.head (
      lib.splitString "="
        homeManagerMaximumFloatingPositionIdentifier.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
    )
  ) == 255;
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
      ApplicationFloatingPositions = "";
      ApplicationWindowHeights = "";
      ApplicationFocusCentering = "";
      ApplicationInitialFloating = "";
      ApplicationInitialFocused = "";
      ApplicationInitialUnfocused = "";
      ApplicationInitialFullscreen = "";
      ApplicationInitialMaximized = "";
      ApplicationInitialFullWidth = "";
      ApplicationInitialDestinations = "";
      ApplicationTilingExclusions = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      ColumnWidthStepPixels = 0;
      DefaultColumnPresentation = "stacked";
      DefaultColumnWidthPercent = 33;
      DefaultColumnWidthPixels = 0;
      DefaultWindowHeight = "auto";
      Gap = 1.2;
      ShowTabIndicator = true;
      TouchpadNavigation = false;
      TouchpadNavigationFingerCount = 5;
      TouchpadNaturalScroll = true;
      TouchpadWorkspaceNavigation = false;
      WindowHeightPresets = "";
      WindowHeightStepPercent = 10;
      WindowHeightStepPixels = 0;
      WorkspaceAutoBackAndForth = false;
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
