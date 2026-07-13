{
  defaultPackage,
  defaultOverviewPackage,
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
        applicationColumnWidths = {
          "org.example.Browser" = 80;
          "org.example.Editor" = 60;
        };
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
        defaultColumnWidthPercent = 65;
        gap = 7;
        touchpadNavigation = true;
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
  bothPackages = evaluateHome {
    programs.driftile = {
      enable = true;
      overview.enable = true;
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
  mainWithSystemOverview = evaluateHome {
    programs.driftile.enable = true;
  } systemOverviewConfiguration.config;
  overviewWithSystemMain = evaluateHome {
    programs.driftile.overview.enable = true;
  } systemConfiguration.config;
  packagePath = toString defaultPackage;
  overviewPackagePath = toString defaultOverviewPackage;
  homePackagePaths = configuration: map toString configuration.config.home.packages;
  systemPackagePaths = map toString systemConfiguration.config.environment.systemPackages;
  systemOverviewPackagePaths = map toString systemOverviewConfiguration.config.environment.systemPackages;
  packageCount =
    configuration: lib.count (path: path == packagePath) (homePackagePaths configuration);
  overviewPackageCount =
    configuration: lib.count (path: path == overviewPackagePath) (homePackagePaths configuration);
in
assert packageCount standalone == 1;
assert overviewPackageCount standalone == 0;
assert packageCount overviewOnly == 0;
assert overviewPackageCount overviewOnly == 1;
assert packageCount bothPackages == 1;
assert overviewPackageCount bothPackages == 1;
assert packageCount overviewOverride == 0;
assert overviewPackageCount overviewOverride == 0;
assert lib.elem (toString pkgs.hello) (homePackagePaths overviewOverride);
assert packageCount overviewDisabled == 0;
assert overviewPackageCount overviewDisabled == 0;
assert !lib.elem (toString pkgs.hello) (homePackagePaths overviewDisabled);
assert
  standalone.config.qt.kde.settings == {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationColumnWidths = ''
        org.example.Browser=80
        org.example.Editor=60'';
      ApplicationTilingExclusions = ''
        org.example.Browser
        org.example.Editor=tool'';
      BorderlessWindows = false;
      CenterFocusedColumn = true;
      ColumnWidthPresets = "20,50,80";
      ColumnWidthStepPercent = 13;
      DefaultColumnWidthPercent = 65;
      Gap = 7;
      TouchpadNavigation = true;
      WindowHeightStepPercent = 17;
    };
  };
assert
  standalone.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"],"driftile_reset_column_width":[]},"version":1}
  '';
assert lib.all (assertion: assertion.assertion) standalone.config.assertions;
assert lib.elem packagePath systemPackagePaths;
assert !lib.elem overviewPackagePath systemPackagePaths;
assert lib.elem overviewPackagePath systemOverviewPackagePaths;
assert !lib.elem packagePath systemOverviewPackagePaths;
assert packageCount settingsOnly == 0;
assert lib.all (assertion: assertion.assertion) settingsOnly.config.assertions;
assert
  settingsOnly.config.qt.kde.settings == {
    kwinrc."Script-io.github.kontonkara.driftile" = {
      ApplicationColumnWidths = "";
      ApplicationTilingExclusions = "";
      BorderlessWindows = true;
      CenterFocusedColumn = false;
      ColumnWidthPresets = "";
      ColumnWidthStepPercent = 10;
      DefaultColumnWidthPercent = 50;
      Gap = 8;
      TouchpadNavigation = false;
      WindowHeightStepPercent = 10;
    };
  };
assert
  settingsOnly.config.xdg.configFile."driftile/shortcuts.json".text == ''
    {"bindings":{"driftile_focus_column_left":["Meta+A"]},"version":1}
  '';
assert !collisionEvaluation.success;
assert !overviewCollisionEvaluation.success;
assert lib.all (assertion: assertion.assertion) mainWithSystemOverview.config.assertions;
assert lib.all (assertion: assertion.assertion) overviewWithSystemMain.config.assertions;
assert packageCount mainWithSystemOverview == 1;
assert overviewPackageCount mainWithSystemOverview == 0;
assert packageCount overviewWithSystemMain == 0;
assert overviewPackageCount overviewWithSystemMain == 1;
pkgs.runCommand "driftile-home-manager-check" { } ''
  touch "$out"
''
