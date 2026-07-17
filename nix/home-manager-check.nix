{
  defaultPackage,
  defaultOverviewPackage,
  defaultShortcutEditorPackage,
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
        applicationInitialLayouts = {
          "org.example.Browser" = "floating";
          "org.example.Editor" = "tiled";
        };
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
        defaultInitialDestination = {
          desktop = 4;
          output = "DP-4";
        };
        defaultInitialFocus = "unfocused";
        defaultInitialLayout = "floating";
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
        useInitialWindowWidth = true;
        defaultFloatingPosition = {
          anchor = "right";
          x = -36;
          y = 48;
        };
        defaultWindowHeight = "720px";
        emptyDesktopAboveFirst = true;
        gap = 7.5;
        numberedDesktopTargets = {
          "9" = "Archive";
          "1" = "Work";
          "4" = "Chat";
        };
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
  shortcutEditorOnly = evaluateHome {
    programs.driftile.shortcutEditor.enable = true;
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
      shortcutEditor.enable = true;
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
  shortcutEditorOverride = evaluateHome {
    programs.driftile.shortcutEditor = {
      enable = true;
      package = pkgs.hello;
    };
  } { };
  shortcutEditorDisabled = evaluateHome {
    programs.driftile.shortcutEditor.package = pkgs.hello;
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
  overviewSettings = evaluateHome {
    programs.driftile.overview = {
      screenEdge = "bottom-right";
      backdropColor = "#CC112233";
      showWindowLabels = false;
      showApplicationIdentity = true;
    };
  } { };
  overviewSettingsUnmanaged = evaluateHome {
    programs.driftile.overview = {
      screenEdge = null;
      backdropColor = null;
      showWindowLabels = null;
      showApplicationIdentity = null;
    };
  } { };
  overviewSettingsWithSystemInstall = evaluateHome {
    programs.driftile.overview = {
      screenEdge = "top-left";
      backdropColor = "#80aBcD01";
      showWindowLabels = true;
      showApplicationIdentity = false;
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
  invalidOverviewSettingRejected =
    setting:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.overview = setting;
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
  maximumNumberedDesktopTargetName = evaluateHome {
    programs.driftile.settings.numberedDesktopTargets."9" =
      builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a";
  } { };
  invalidNumberedDesktopTargetsRejected =
    targets:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings.numberedDesktopTargets = targets;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  initialDestinationBounds = evaluateHome {
    programs.driftile.settings.applicationInitialDestinations = {
      "org.example.Maximum".desktop = 25;
      "org.example.Minimum".desktop = 1;
      "org.example.Named".desktopName =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 127) + "a";
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
  defaultInitialDestinationDisabled = evaluateHome {
    programs.driftile.settings.defaultInitialDestination = null;
  } { };
  defaultInitialDestinationNamed = evaluateHome {
    programs.driftile.settings.defaultInitialDestination = {
      desktopName = "Work";
      output = "DP-3";
    };
  } { };
  defaultInitialDestinationOutputOnly = evaluateHome {
    programs.driftile.settings.defaultInitialDestination.output = "HDMI-A-1";
  } { };
  defaultInitialFocusValues = map (
    value:
    evaluateHome {
      programs.driftile.settings.defaultInitialFocus = value;
    } { }
  ) [
    "default"
    "focused"
    "unfocused"
  ];
  invalidDefaultInitialFocusRejected =
    value:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings.defaultInitialFocus = value;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  maximumInitialLayouts = evaluateHome {
    programs.driftile.settings.applicationInitialLayouts = builtins.listToAttrs (
      builtins.genList (index: {
        name = "org.example.App${toString index}";
        value = if index == 0 then "floating" else "tiled";
      }) 128
    );
  } { };
  invalidInitialLayoutSettingRejected =
    setting:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings = setting;
          } { }).config.qt.kde.settings
          true
      );
    in
    !evaluated.success;
  invalidDefaultInitialDestinationRejected =
    destination:
    let
      evaluated = builtins.tryEval (
        builtins.deepSeq
          (evaluateHome {
            programs.driftile.settings.defaultInitialDestination = destination;
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
  systemShortcutEditorConfiguration = lib.nixosSystem {
    inherit system;
    modules = [
      nixosModule
      {
        programs.driftile.shortcutEditor.enable = true;
        system.stateVersion = "26.05";
      }
    ];
  };
  settingsOnly = evaluateHome {
    programs.driftile = {
      settings = {
        defaultFloatingPosition = null;
        gap = 1.2;
      };
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
  shortcutEditorCollision = evaluateHome {
    programs.driftile.shortcutEditor.enable = true;
  } systemShortcutEditorConfiguration.config;
  shortcutEditorCollisionEvaluation = builtins.tryEval (
    builtins.deepSeq shortcutEditorCollision.activationPackage true
  );
  mainWithSystemOverview = evaluateHome {
    programs.driftile.enable = true;
  } systemOverviewConfiguration.config;
  overviewWithSystemMain = evaluateHome {
    programs.driftile.overview.enable = true;
  } systemConfiguration.config;
  packagePath = toString defaultPackage;
  overviewPackagePath = toString defaultOverviewPackage;
  shortcutEditorPackagePath = toString defaultShortcutEditorPackage;
  transitionsPackagePath = toString defaultTransitionsPackage;
  homePackagePaths = configuration: map toString configuration.config.home.packages;
  systemPackagePaths = map toString systemConfiguration.config.environment.systemPackages;
  systemOverviewPackagePaths = map toString systemOverviewConfiguration.config.environment.systemPackages;
  systemTransitionsPackagePaths =
    map toString systemTransitionsConfiguration.config.environment.systemPackages;
  systemShortcutEditorPackagePaths =
    map toString systemShortcutEditorConfiguration.config.environment.systemPackages;
  packageCount =
    configuration: lib.count (path: path == packagePath) (homePackagePaths configuration);
  overviewPackageCount =
    configuration: lib.count (path: path == overviewPackagePath) (homePackagePaths configuration);
  shortcutEditorPackageCount =
    configuration: lib.count (path: path == shortcutEditorPackagePath) (homePackagePaths configuration);
  transitionsPackageCount =
    configuration: lib.count (path: path == transitionsPackagePath) (homePackagePaths configuration);
in
assert packageCount standalone == 1;
assert overviewPackageCount standalone == 0;
assert shortcutEditorPackageCount standalone == 0;
assert transitionsPackageCount standalone == 0;
assert packageCount overviewOnly == 0;
assert overviewPackageCount overviewOnly == 1;
assert transitionsPackageCount overviewOnly == 0;
assert packageCount transitionsOnly == 0;
assert overviewPackageCount transitionsOnly == 0;
assert transitionsPackageCount transitionsOnly == 1;
assert packageCount shortcutEditorOnly == 0;
assert overviewPackageCount shortcutEditorOnly == 0;
assert shortcutEditorPackageCount shortcutEditorOnly == 1;
assert transitionsPackageCount shortcutEditorOnly == 0;
assert packageCount bothPackages == 1;
assert overviewPackageCount bothPackages == 1;
assert transitionsPackageCount bothPackages == 0;
assert packageCount allPackages == 1;
assert overviewPackageCount allPackages == 1;
assert shortcutEditorPackageCount allPackages == 1;
assert transitionsPackageCount allPackages == 1;
assert packageCount overviewOverride == 0;
assert overviewPackageCount overviewOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths overviewOverride);
assert packageCount overviewDisabled == 0;
assert overviewPackageCount overviewDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths overviewDisabled);
assert shortcutEditorPackageCount shortcutEditorOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths shortcutEditorOverride);
assert shortcutEditorPackageCount shortcutEditorDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths shortcutEditorDisabled);
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
assert
  lib.all
    (
      configuration:
      packageCount configuration == 0
      && overviewPackageCount configuration == 0
      && transitionsPackageCount configuration == 0
    )
    [
      overviewSettings
      overviewSettingsUnmanaged
      overviewSettingsWithSystemInstall
    ];
assert
  overviewSettings.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      ScreenEdge = "bottom-right";
      BackdropColor = "#CC112233";
      ShowWindowLabels = false;
      ShowApplicationIdentity = true;
    };
  };
assert overviewSettingsUnmanaged.config.qt.kde.settings == { };
assert
  overviewSettingsWithSystemInstall.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.overview" = {
      ScreenEdge = "top-left";
      BackdropColor = "#80aBcD01";
      ShowWindowLabels = true;
      ShowApplicationIdentity = false;
    };
  };
assert lib.all (assertion: assertion.assertion) overviewSettingsWithSystemInstall.config.assertions;
assert invalidOverviewSettingRejected { screenEdge = "upper-left"; };
assert invalidOverviewSettingRejected { screenEdge = 1; };
assert invalidOverviewSettingRejected { backdropColor = "80112233"; };
assert invalidOverviewSettingRejected { backdropColor = "#FF11223"; };
assert invalidOverviewSettingRejected { backdropColor = "#FF1122334"; };
assert invalidOverviewSettingRejected { backdropColor = "#GG112233"; };
assert invalidOverviewSettingRejected { backdropColor = 4279312947; };
assert invalidOverviewSettingRejected { showWindowLabels = "true"; };
assert invalidOverviewSettingRejected { showApplicationIdentity = 1; };
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
  maximumNumberedDesktopTargetName.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".NumberedDesktopTargets
  == "9=${builtins.concatStringsSep "" (builtins.genList (_: "é") 127)}a";
assert
  lib.all invalidNumberedDesktopTargetsRejected [
    [ ]
    { "0" = "Work"; }
    { "01" = "Work"; }
    { "10" = "Work"; }
    { "1" = 1; }
    { "1" = ""; }
    { "1" = " Work"; }
    { "1" = "Work "; }
    { "1" = "Work=Main"; }
    { "1" = "Work\nMain"; }
    { "1" = builtins.fromJSON ''"\u00a0Work"''; }
    { "1" = builtins.concatStringsSep "" (builtins.genList (_: "é") 128); }
    {
      "1" = "Work";
      "9" = "Work";
    }
  ];
assert
  let
    rendered =
      initialDestinationBounds.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialDestinations;
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
    {
      "org.example.Editor" = {
        desktop = null;
        desktopName = null;
        output = null;
      };
    }
    { "org.example.Editor".desktop = 0; }
    { "org.example.Editor".desktop = 26; }
    { "org.example.Editor".desktopName = ""; }
    { "org.example.Editor".desktopName = " Work"; }
    { "org.example.Editor".desktopName = "Work "; }
    { "org.example.Editor".desktopName = "Work,Personal"; }
    { "org.example.Editor".desktopName = "Work\nPersonal"; }
    {
      "org.example.Editor".desktopName =
        builtins.concatStringsSep "" (builtins.genList (_: "é") 128);
    }
    {
      "org.example.Editor" = {
        desktop = 1;
        desktopName = "Work";
      };
    }
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
  defaultInitialDestinationDisabled.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultInitialDestination
  == "";
assert
  defaultInitialDestinationNamed.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultInitialDestination
  == "desktop-name:Work,output:DP-3";
assert
  defaultInitialDestinationOutputOnly.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultInitialDestination
  == "output:HDMI-A-1";
assert
  map (
    evaluation:
    evaluation.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".DefaultInitialFocus
  ) defaultInitialFocusValues
  == [
    "default"
    "focused"
    "unfocused"
  ];
assert invalidDefaultInitialFocusRejected "invalid";
assert
  builtins.length (
    lib.splitString "\n"
      maximumInitialLayouts.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile".ApplicationInitialLayouts
  ) == 128;
assert invalidInitialLayoutSettingRejected { defaultInitialLayout = "automatic"; };
assert
  invalidInitialLayoutSettingRejected {
    applicationInitialLayouts."org.example.Editor" = "automatic";
  };
assert invalidInitialLayoutSettingRejected { applicationInitialLayouts."" = "tiled"; };
assert
  invalidInitialLayoutSettingRejected {
    applicationInitialLayouts = builtins.listToAttrs (
      builtins.genList (index: {
        name = "org.example.App${toString index}";
        value = "tiled";
      }) 129
    );
  };
assert
  lib.all invalidDefaultInitialDestinationRejected [
    { }
    { desktop = 0; }
    { desktop = 26; }
    {
      desktop = 1;
      desktopName = "Work";
    }
    { desktopName = ""; }
    { output = "DP,1"; }
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
      ApplicationInitialLayouts = ''
        org.example.Browser=floating
        org.example.Editor=tiled'';
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
      UseInitialWindowWidth = true;
      DefaultFloatingPosition = "right,-36,48";
      DefaultInitialDestination = "desktop:4,output:DP-4";
      DefaultInitialFocus = "unfocused";
      DefaultInitialLayout = "floating";
      DefaultWindowHeight = "720px";
      EmptyDesktopAboveFirst = true;
      Gap = 7.5;
      NumberedDesktopTargets = ''
        1=Work
        4=Chat
        9=Archive'';
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
  ) == 43;
assert
  standalone.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"],"driftile_reset_column_width":[]},"version":1}
  '';
assert lib.all (assertion: assertion.assertion) standalone.config.assertions;
assert lib.elem packagePath systemPackagePaths;
assert !lib.elem overviewPackagePath systemPackagePaths;
assert !lib.elem shortcutEditorPackagePath systemPackagePaths;
assert !lib.elem transitionsPackagePath systemPackagePaths;
assert lib.elem overviewPackagePath systemOverviewPackagePaths;
assert !lib.elem packagePath systemOverviewPackagePaths;
assert !lib.elem transitionsPackagePath systemOverviewPackagePaths;
assert lib.elem shortcutEditorPackagePath systemShortcutEditorPackagePaths;
assert !lib.elem packagePath systemShortcutEditorPackagePaths;
assert !lib.elem overviewPackagePath systemShortcutEditorPackagePaths;
assert !lib.elem transitionsPackagePath systemShortcutEditorPackagePaths;
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
      ApplicationInitialLayouts = "";
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
      UseInitialWindowWidth = false;
      DefaultFloatingPosition = "";
      DefaultInitialDestination = "";
      DefaultInitialFocus = "default";
      DefaultInitialLayout = "tiled";
      DefaultWindowHeight = "auto";
      Gap = 1.2;
      NumberedDesktopTargets = "";
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
assert !shortcutEditorCollisionEvaluation.success;
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
