{
  defaultPackage,
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
        borderlessWindows = false;
        centerFocusedColumn = true;
        columnWidthPresets = [ 20 50 80 ];
        columnWidthStepPercent = 13;
        defaultColumnWidthPercent = 65;
        gap = 7;
        windowHeightStepPercent = 17;
      };
      shortcuts = {
        driftile_focus_column_left = [ "Meta+A" ];
        driftile_reset_column_width = [ ];
      };
    };
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
  settingsOnly = evaluateHome {
    programs.driftile = {
      settings.gap = 8;
      shortcuts.driftile_focus_column_left = [ "Meta+A" ];
    };
  } systemConfiguration.config;
  collision = evaluateHome {
    programs.driftile.enable = true;
  } systemConfiguration.config;
  collisionEvaluation = builtins.tryEval (
    builtins.deepSeq collision.activationPackage true
  );
  packagePath = toString defaultPackage;
  homePackagePaths =
    configuration: map toString configuration.config.home.packages;
  systemPackagePaths =
    map toString systemConfiguration.config.environment.systemPackages;
  packageCount =
    configuration:
    lib.count (path: path == packagePath) (homePackagePaths configuration);
in
assert packageCount standalone == 1;
assert standalone.config.qt.kde.settings == {
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
assert standalone.config.xdg.configFile."driftile/shortcuts.json".text == ''
  {"bindings":{"driftile_focus_column_left":["Meta+A"],"driftile_reset_column_width":[]},"version":1}
'';
assert lib.all (assertion: assertion.assertion) standalone.config.assertions;
assert lib.elem packagePath systemPackagePaths;
assert packageCount settingsOnly == 0;
assert lib.all (assertion: assertion.assertion) settingsOnly.config.assertions;
assert settingsOnly.config.qt.kde.settings == {
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
assert settingsOnly.config.xdg.configFile."driftile/shortcuts.json".text == ''
  {"bindings":{"driftile_focus_column_left":["Meta+A"]},"version":1}
'';
assert !collisionEvaluation.success;
pkgs.runCommand "driftile-home-manager-check" { } ''
  touch "$out"
''
