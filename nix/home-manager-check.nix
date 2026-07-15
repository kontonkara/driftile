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
          "org.example.Browser" = 80;
          "org.example.Editor" = 60;
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
        touchpadNavigationFingerCount = 4;
        touchpadNaturalScroll = false;
        windowHeightPresets = [
          30
          60
          90
        ];
        windowHeightStepPercent = 17;
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
  transitionDurationUnmanaged = evaluateHome {
    programs.driftile.transitions.duration = null;
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
      settings.gap = 8;
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
assert packageCount transitionsOverride == 0;
assert overviewPackageCount transitionsOverride == 0;
assert transitionsPackageCount transitionsOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths transitionsOverride);
assert transitionsPackageCount transitionsDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths transitionsDisabled);
assert transitionsPackageCount transitionDurationMinimum == 0;
assert transitionsPackageCount transitionDurationMaximum == 0;
assert
  transitionDurationMinimum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 0;
  };
assert
  transitionDurationMaximum.config.qt.kde.settings == {
    kwinrc."Effect-io.github.kontonkara.driftile.transitions".Duration = 1000;
  };
assert transitionDurationUnmanaged.config.qt.kde.settings == { };
assert invalidTransitionDurationRejected (-1);
assert invalidTransitionDurationRejected 1001;
assert invalidTransitionDurationRejected 1.5;
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
      TouchpadNavigationFingerCount = 4;
      TouchpadNaturalScroll = false;
      WindowHeightPresets = "30,60,90";
      WindowHeightStepPercent = 17;
    };
  };
assert
  builtins.length (
    builtins.attrNames standalone.config.qt.kde.settings.kwinrc."Script-io.github.kontonkara.driftile"
  ) == 19;
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
      TouchpadNavigationFingerCount = 5;
      TouchpadNaturalScroll = true;
      WindowHeightPresets = "";
      WindowHeightStepPercent = 10;
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
