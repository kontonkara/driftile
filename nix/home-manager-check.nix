{
  defaultPackage,
  defaultOverviewPackage,
  defaultTransitionsPackage,
  home-manager,
  homeManagerModule,
  lib,
  nixosModule,
  pkgs,
  system,
}:

let
  homeBase = {
    home = {
      homeDirectory = "/home/driftile-test";
      stateVersion = "26.05";
      username = "driftile-test";
    };
  };
  evaluateHome =
    configuration: osConfig:
    home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      extraSpecialArgs = { inherit osConfig; };
      modules = [
        homeManagerModule
        homeBase
        configuration
      ];
    };
  standalone = evaluateHome {
    programs.driftile = {
      enable = true;
      settings = {
        applicationBorderlessExclusions = [
          "org.example.Terminal"
          "org.example.Browser"
        ];
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
        applicationColumnPresentations = {
          "org.example.Browser" = "tabbed";
          "org.example.Editor" = "stacked";
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
      shortcuts = {
        driftile_focus_column_left = [ "Meta+A" ];
        driftile_reset_column_width = [ ];
      };
    };
  } { };
  overviewOnly = evaluateHome {
    programs.driftile.overview.enable = true;
  } { };
  transitionsOnly = evaluateHome {
    programs.driftile.transitions.enable = true;
  } { };
  bothPackages = evaluateHome {
    programs.driftile = {
      enable = true;
      overview.enable = true;
    };
  } { };
  allPackages = evaluateHome {
    programs.driftile = {
      enable = true;
      overview.enable = true;
      transitions.enable = true;
    };
  } { };
  overviewOverride = evaluateHome {
    programs.driftile.overview = {
      enable = true;
      package = pkgs.hello;
    };
  } { };
  overviewDisabled = evaluateHome {
    programs.driftile.overview.package = pkgs.hello;
  } { };
  overviewTouchpadGesture = evaluateHome {
    programs.driftile.overview.touchpadGesture = {
      enable = false;
      fingerCount = 5;
    };
  } { };
  overviewTouchpadGestureDefaults = evaluateHome {
    programs.driftile.overview.touchpadGesture = { };
  } { };
  overviewTouchpadGestureUnmanaged = evaluateHome {
    programs.driftile.overview.touchpadGesture = null;
  } { };
  overviewTouchpadGestureWithSystemInstall = evaluateHome {
    programs.driftile.overview.touchpadGesture = {
      enable = true;
      fingerCount = 3;
    };
  } systemOverviewConfiguration.config;
  invalidOverviewTouchpadGestureRejected =
    gesture:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.overview.touchpadGesture = gesture;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  transitionsOverride = evaluateHome {
    programs.driftile.transitions = {
      enable = true;
      package = pkgs.hello;
    };
  } { };
  transitionsDisabled = evaluateHome {
    programs.driftile.transitions.package = pkgs.hello;
  } { };
  transitionDurationMinimum = evaluateHome {
    programs.driftile.transitions.duration = 0;
  } { };
  transitionDurationMaximum = evaluateHome {
    programs.driftile.transitions.duration = 1000;
  } { };
  transitionResizeAnimationThresholdMinimum = evaluateHome {
    programs.driftile.transitions.resizeAnimationThreshold = 0;
  } { };
  transitionResizeAnimationThresholdMaximum = evaluateHome {
    programs.driftile.transitions.resizeAnimationThreshold = 64;
  } { };
  transitionDurationUnmanaged = evaluateHome {
    programs.driftile.transitions.duration = null;
  } { };
  transitionSettings = evaluateHome {
    programs.driftile.transitions = {
      animatePosition = false;
      animateSize = true;
      easingCurve = "out-expo";
      resizeAnimationThreshold = 16;
      windowClassExclusions = [
        "konsole org.kde.konsole"
        "firefox firefox"
      ];
    };
  } { };
  transitionSettingsUnmanaged = evaluateHome {
    programs.driftile.transitions = {
      animatePosition = null;
      animateSize = null;
      easingCurve = null;
      resizeAnimationThreshold = null;
      windowClassExclusions = null;
    };
  } { };
  invalidTransitionDurationRejected =
    duration:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.transitions.duration = duration;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  invalidTransitionSettingRejected =
    setting:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.transitions = setting;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  initialDestinationBounds = evaluateHome {
    programs.driftile.settings.applicationInitialDestinations = {
      "org.example.Maximum".desktop = 25;
      "org.example.Minimum".desktop = 1;
      "org.example.Output".output =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a";
    };
  } { };
  maximumInitialDestinations = evaluateHome {
    programs.driftile.settings.applicationInitialDestinations = builtins.listToAttrs (
      builtins.genList (index: {
        name = "org.example.App${toString index}";
        value.desktop = 1;
      }) 128
    );
  } { };
  maximumInitialDestinationIdentifier = evaluateHome {
    programs.driftile.settings.applicationInitialDestinations = {
      ${builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a"}.output = "DP-1";
    };
  } { };
  invalidInitialDestinationsRejected =
    destinations:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings.applicationInitialDestinations = destinations;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  floatingPositionBounds = evaluateHome {
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
  } { };
  maximumFloatingPositions = evaluateHome {
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
  } { };
  maximumFloatingPositionIdentifier = evaluateHome {
    programs.driftile.settings.applicationFloatingPositions = {
      ${builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a"} = {
        anchor = "left";
        x = 0;
        y = 0;
      };
    };
  } { };
  invalidFloatingPositionsRejected =
    positions:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings.applicationFloatingPositions = positions;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  systemConfiguration = lib.nixosSystem {
    inherit system;
    modules = [
      nixosModule
      {
        programs.driftile.enable = true;
        system.stateVersion = "26.05";
      }
    ];
  };
  systemOverviewConfiguration = lib.nixosSystem {
    inherit system;
    modules = [
      nixosModule
      {
        programs.driftile.overview.enable = true;
        system.stateVersion = "26.05";
      }
    ];
  };
  systemTransitionsConfiguration = lib.nixosSystem {
    inherit system;
    modules = [
      nixosModule
      {
        programs.driftile.transitions.enable = true;
        system.stateVersion = "26.05";
      }
    ];
  };
  settingsOnly = evaluateHome {
    programs.driftile = {
      settings.gap = 1.2;
      shortcuts.driftile_focus_column_left = [ "Meta+A" ];
    };
  } systemConfiguration.config;
  collision = evaluateHome {
    programs.driftile.enable = true;
  } systemConfiguration.config;
  collisionEvaluation = builtins.tryEval (builtins.deepSeq collision.activationPackage true);
  overviewCollision = evaluateHome {
    programs.driftile.overview.enable = true;
  } systemOverviewConfiguration.config;
  overviewCollisionEvaluation = builtins.tryEval (
    builtins.deepSeq overviewCollision.activationPackage true
  );
  transitionsCollision = evaluateHome {
    programs.driftile.transitions.enable = true;
  } systemTransitionsConfiguration.config;
  transitionsCollisionEvaluation = builtins.tryEval (
    builtins.deepSeq transitionsCollision.activationPackage true
  );
  mainWithSystemOverview = evaluateHome {
    programs.driftile.enable = true;
  } systemOverviewConfiguration.config;
  overviewWithSystemMain = evaluateHome {
    programs.driftile.overview.enable = true;
  } systemConfiguration.config;
  packagePath = toString defaultPackage;
  overviewPackagePath = toString defaultOverviewPackage;
  transitionsPackagePath = toString defaultTransitionsPackage;
  homePackagePaths = configuration: map toString configuration.config.home.packages;
  systemPackagePaths = map toString systemConfiguration.config.environment.systemPackages;
  systemOverviewPackagePaths = map toString systemOverviewConfiguration.config.environment.systemPackages;
  systemTransitionsPackagePaths =
    map toString systemTransitionsConfiguration.config.environment.systemPackages;
  packageCount =
    configuration: lib.count (path: path == packagePath) (homePackagePaths configuration);
  overviewPackageCount =
    configuration: lib.count (path: path == overviewPackagePath) (homePackagePaths configuration);
  transitionsPackageCount =
    configuration: lib.count (path: path == transitionsPackagePath) (homePackagePaths configuration);
in
assert packageCount standalone == 1;
assert overviewPackageCount standalone == 0;
assert transitionsPackageCount standalone == 0;
assert packageCount overviewOnly == 0;
assert overviewPackageCount overviewOnly == 1;
assert transitionsPackageCount overviewOnly == 0;
assert packageCount transitionsOnly == 0;
assert overviewPackageCount transitionsOnly == 0;
assert transitionsPackageCount transitionsOnly == 1;
assert packageCount bothPackages == 1;
assert overviewPackageCount bothPackages == 1;
assert transitionsPackageCount bothPackages == 0;
assert packageCount allPackages == 1;
assert overviewPackageCount allPackages == 1;
assert transitionsPackageCount allPackages == 1;
assert packageCount overviewOverride == 0;
assert overviewPackageCount overviewOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths overviewOverride);
assert packageCount overviewDisabled == 0;
assert overviewPackageCount overviewDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths overviewDisabled);
assert overviewPackageCount overviewTouchpadGesture == 0;
assert overviewPackageCount overviewTouchpadGestureDefaults == 0;
assert overviewPackageCount overviewTouchpadGestureWithSystemInstall == 0;
assert
  overviewTouchpadGesture.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = false;
      TouchpadGestureFingerCount = 5;
    };
  };
assert
  overviewTouchpadGestureDefaults.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = true;
      TouchpadGestureFingerCount = 4;
    };
  };
assert overviewTouchpadGestureUnmanaged.config.qt.kde.settings == { };
assert
  overviewTouchpadGestureWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      TouchpadGesture = true;
      TouchpadGestureFingerCount = 3;
    };
  };
assert lib.all (assertion: assertion.assertion) overviewTouchpadGestureWithSystemInstall.config.assertions;
assert invalidOverviewTouchpadGestureRejected true;
assert invalidOverviewTouchpadGestureRejected { enable = "true"; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 2; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 6; };
assert invalidOverviewTouchpadGestureRejected { fingerCount = 4.5; };
assert packageCount transitionsOverride == 0;
assert overviewPackageCount transitionsOverride == 0;
assert transitionsPackageCount transitionsOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths transitionsOverride);
assert transitionsPackageCount transitionsDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths transitionsDisabled);
assert transitionsPackageCount transitionDurationMinimum == 0;
assert transitionsPackageCount transitionDurationMaximum == 0;
assert transitionsPackageCount transitionResizeAnimationThresholdMinimum == 0;
assert transitionsPackageCount transitionResizeAnimationThresholdMaximum == 0;
assert transitionsPackageCount transitionSettings == 0;
assert
  transitionDurationMinimum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 0;
  };
assert
  transitionDurationMaximum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 1000;
  };
assert
  transitionResizeAnimationThresholdMinimum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".ResizeAnimationThreshold = 0;
  };
assert
  transitionResizeAnimationThresholdMaximum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".ResizeAnimationThreshold = 64;
  };
assert transitionDurationUnmanaged.config.qt.kde.settings == { };
assert
  transitionSettings.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions" = {
      AnimatePosition = false;
      AnimateSize = true;
      EasingCurve = "out-expo";
      ResizeAnimationThreshold = 16;
      WindowClassExclusions = ''
        firefox firefox
        konsole org.kde.konsole'';
    };
  };
assert transitionSettingsUnmanaged.config.qt.kde.settings == { };
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
assert invalidTransitionSettingRejected { windowClassExclusions = [ "konsole org.kde.konsole " ]; };
assert
  invalidTransitionSettingRejected {
    windowClassExclusions = [
      (builtins.concatStringsSep "" (builtins.genList (_: "a") 256))
    ];
  };
assert
  invalidTransitionSettingRejected {
    windowClassExclusions = builtins.genList (index: "app${toString index} example.App${toString index}") 129;
  };
assert
  let
    rendered =
      initialDestinationBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations;
    lines = lib.splitString "\n" rendered;
    outputPrefix = "org.example.Output=output:";
    outputLine = builtins.elemAt lines 2;
  in
  builtins.elem "org.example.Maximum=desktop:25" lines
  && builtins.elem "org.example.Minimum=desktop:1" lines
  && lib.hasPrefix outputPrefix outputLine
  && builtins.stringLength (lib.removePrefix outputPrefix outputLine) == 255;
assert
  builtins.length (
    lib.splitString "\n"
      maximumInitialDestinations.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations
  ) == 128;
assert
  builtins.stringLength (
    builtins.head (
      lib.splitString "="
        maximumInitialDestinationIdentifier.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations
    )
  ) == 255;
assert
  lib.all invalidInitialDestinationsRejected [
    [ ]
    { "org.example.Editor" = "desktop:1"; }
    { "org.example.Editor" = { }; }
    { "org.example.Editor".desktop = 0; }
    { "org.example.Editor".desktop = 26; }
    { "org.example.Editor".output = ""; }
    { "org.example.Editor".output = " DP-1"; }
    { "org.example.Editor".output = "DP,1"; }
    {
      "org.example.Editor".output =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 128);
    }
    { "org.example=Editor".desktop = 1; }
    (builtins.listToAttrs (
      builtins.genList (index: {
        name = "org.example.App${toString index}";
        value.desktop = 1;
      }) 129
    ))
  ];
assert
  floatingPositionBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
  == ''
    org.example.Maximum=bottom-right,16384,16384
    org.example.Minimum=top-left,-16384,-16384'';
assert
  builtins.length (
    lib.splitString "\n"
      maximumFloatingPositions.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
  ) == 128;
assert
  builtins.stringLength (
    builtins.head (
      lib.splitString "="
        maximumFloatingPositionIdentifier.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationFloatingPositions
    )
  ) == 255;
assert
  lib.all invalidFloatingPositionsRejected [
    [ ]
    { "org.example.Editor" = "top-left,0,0"; }
    {
      "org.example.Editor" = {
        anchor = "center";
        x = 0;
        y = 0;
      };
    }
    {
      "org.example.Editor" = {
        anchor = "top-left";
        x = -16385;
        y = 0;
      };
    }
    {
      "org.example.Editor" = {
        anchor = "top-left";
        x = 0;
        y = 16385;
      };
    }
    {
      "org.example.Editor" = {
        anchor = "top-left";
        x = 0;
      };
    }
    {
      " org.example.Editor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      "org.example=Editor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      "org.example\nEditor" = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    {
      ${builtins.concatStringsSep "" (builtins.genList (_: "é") 128)} = {
        anchor = "top-left";
        x = 0;
        y = 0;
      };
    }
    (builtins.listToAttrs (
      builtins.genList (index: {
        name = "org.example.App${toString index}";
        value = {
          anchor = "top-left";
          x = 0;
          y = 0;
        };
      }) 129
    ))
  ];
assert
  standalone.config.qt.kde.settings == {
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
        org.example.Terminal=desktop:25'';
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
assert
  builtins.length (
    builtins.attrNames standalone.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile"
  ) == 35;
assert
  standalone.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"],"driftile_reset_column_width":[]},"version":1}
  '';
assert lib.all (assertion: assertion.assertion) standalone.config.assertions;
assert lib.elem packagePath systemPackagePaths;
assert !lib.elem overviewPackagePath systemPackagePaths;
assert !lib.elem transitionsPackagePath systemPackagePaths;
assert lib.elem overviewPackagePath systemOverviewPackagePaths;
assert !lib.elem packagePath systemOverviewPackagePaths;
assert !lib.elem transitionsPackagePath systemOverviewPackagePaths;
assert lib.elem transitionsPackagePath systemTransitionsPackagePaths;
assert !lib.elem packagePath systemTransitionsPackagePaths;
assert !lib.elem overviewPackagePath systemTransitionsPackagePaths;
assert packageCount settingsOnly == 0;
assert lib.all (assertion: assertion.assertion) settingsOnly.config.assertions;
assert
  settingsOnly.config.qt.kde.settings == {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationBorderlessExclusions = "";
      ApplicationColumnPresentations = "";
      ApplicationColumnWidths = "";
      ApplicationFloatingPositions = "";
      ApplicationWindowHeights = "";
      ApplicationFocusCentering = "";
      ApplicationInitialFloating = "";
      ApplicationInitialFocused = "";
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
assert
  settingsOnly.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"]},"version":1}
  '';
assert !collisionEvaluation.success;
assert !overviewCollisionEvaluation.success;
assert !transitionsCollisionEvaluation.success;
assert lib.all (assertion: assertion.assertion) mainWithSystemOverview.config.assertions;
assert lib.all (assertion: assertion.assertion) overviewWithSystemMain.config.assertions;
assert packageCount mainWithSystemOverview == 1;
assert overviewPackageCount mainWithSystemOverview == 0;
assert packageCount overviewWithSystemMain == 0;
assert overviewPackageCount overviewWithSystemMain == 1;
pkgs.runCommand "driftile-home-manager-check" { } ''
  touch "$out"
''
