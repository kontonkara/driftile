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
  ecmaScriptNonAsciiTrimCharacters = map builtins.fromJSON [
    ''"\u00a0"''
    ''"\u1680"''
    ''"\u2000"''
    ''"\u2001"''
    ''"\u2002"''
    ''"\u2003"''
    ''"\u2004"''
    ''"\u2005"''
    ''"\u2006"''
    ''"\u2007"''
    ''"\u2008"''
    ''"\u2009"''
    ''"\u200a"''
    ''"\u2028"''
    ''"\u2029"''
    ''"\u202f"''
    ''"\u205f"''
    ''"\u3000"''
    ''"\ufeff"''
  ];
  hasControlCharacter =
    value:
    builtins.match ".*[[:cntrl:]].*" value != null
    || lib.any (character: lib.hasInfix character value) c1ControlCharacters;
  hasEcmaScriptNonAsciiPadding =
    value:
    lib.any (
      character: lib.hasPrefix character value || lib.hasSuffix character value
    ) ecmaScriptNonAsciiTrimCharacters;
  validDesktopFileName =
    value:
    value != ""
    && builtins.stringLength value <= 255
    && value == lib.strings.trim value
    && !hasEcmaScriptNonAsciiPadding value
    && !hasControlCharacter value;
  validMappedDesktopFileName = value: validDesktopFileName value && !lib.hasInfix "=" value;
  parsePresetToken =
    preset:
    if builtins.isInt preset then
      {
        unit = "percent";
        value = preset;
      }
    else if !builtins.isString preset then
      null
    else if builtins.stringLength preset > 7 then
      null
    else
      let
        percentMatch = builtins.match "([1-9][0-9]*)%" preset;
        pixelMatch = builtins.match "([1-9][0-9]*)px" preset;
      in
      if percentMatch != null then
        let
          value = builtins.fromJSON (builtins.head percentMatch);
        in
        if value >= 10 && value <= 100 then
          {
            unit = "percent";
            inherit value;
          }
        else
          null
      else if pixelMatch != null then
        let
          value = builtins.fromJSON (builtins.head pixelMatch);
        in
        if value >= 1 && value <= 16384 then
          {
            unit = "pixels";
            inherit value;
          }
        else
          null
      else
        null;
  presetTokenType = lib.types.either (lib.types.ints.between 10 100) lib.types.str;
  applicationColumnWidthType = lib.types.addCheck (lib.types.attrsOf presetTokenType) (
    widths:
    builtins.length (builtins.attrNames widths) <= 128
    && lib.all validMappedDesktopFileName (builtins.attrNames widths)
    && lib.all (width: parsePresetToken width != null) (builtins.attrValues widths)
  );
  renderApplicationColumnWidth =
    width:
    let
      parsed = parsePresetToken width;
    in
    if parsed == null then
      ""
    else if parsed.unit == "percent" then
      toString parsed.value
    else
      "${toString parsed.value}px";
  renderApplicationColumnWidths =
    widths:
    lib.concatStringsSep "\n" (
      map (
        desktopFileName: "${desktopFileName}=${renderApplicationColumnWidth widths.${desktopFileName}}"
      ) (builtins.sort builtins.lessThan (builtins.attrNames widths))
    );
  applicationWindowHeightType = applicationColumnWidthType;
  renderApplicationWindowHeights = renderApplicationColumnWidths;
  defaultWindowHeightType = lib.types.addCheck presetTokenType (
    height: height == "auto" || parsePresetToken height != null
  );
  renderDefaultWindowHeight =
    height: if height == "auto" then "auto" else renderApplicationColumnWidth height;
  applicationColumnPresentationType =
    lib.types.addCheck (lib.types.attrsOf (lib.types.enum [
      "stacked"
      "tabbed"
    ]))
      (
        presentations:
        builtins.length (builtins.attrNames presentations) <= 128
        && lib.all validMappedDesktopFileName (builtins.attrNames presentations)
      );
  renderApplicationColumnPresentations =
    presentations:
    lib.concatStringsSep "\n" (
      map (desktopFileName: "${desktopFileName}=${presentations.${desktopFileName}}") (
        builtins.sort builtins.lessThan (builtins.attrNames presentations)
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
  applicationBorderlessExclusionType = applicationTilingExclusionType;
  renderApplicationBorderlessExclusions = renderApplicationTilingExclusions;
  applicationFocusCenteringType = applicationTilingExclusionType;
  renderApplicationFocusCentering = renderApplicationTilingExclusions;
  applicationInitialFloatingType = applicationTilingExclusionType;
  renderApplicationInitialFloating = renderApplicationTilingExclusions;
  transitionWindowClassExclusionType = applicationTilingExclusionType;
  renderTransitionWindowClassExclusions = renderApplicationTilingExclusions;
  validPresetSequence =
    presets:
    let
      result =
        lib.foldl'
          (
            state: preset:
            let
              parsed = parsePresetToken preset;
            in
            if !state.valid || parsed == null then
              state // { valid = false; }
            else if parsed.unit == "percent" then
              {
                inherit (state) pixels;
                percent = parsed.value;
                valid = parsed.value > state.percent;
              }
            else
              {
                inherit (state) percent;
                pixels = parsed.value;
                valid = parsed.value > state.pixels;
              }
          )
          {
            percent = 9;
            pixels = 0;
            valid = true;
          }
          presets;
    in
    builtins.length presets <= 16 && result.valid;
  columnWidthPresetType = lib.types.addCheck (lib.types.listOf presetTokenType) validPresetSequence;
  renderColumnWidthPresets = presets: lib.concatStringsSep "," (map toString presets);
  windowHeightPresetType = lib.types.addCheck (lib.types.listOf presetTokenType) validPresetSequence;
  renderWindowHeightPresets = presets: lib.concatStringsSep "," (map toString presets);
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
  systemTransitionsInstallEnabled = lib.attrByPath [
    "programs"
    "driftile"
    "transitions"
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

    overview =
      {
        enable = lib.mkEnableOption "installation of the Driftile overview effect";

        package = lib.mkOption {
          type = lib.types.package;
          default = self.packages.${system}."driftile-overview";
          defaultText = lib.literalExpression "inputs.driftile.packages.\${pkgs.stdenv.hostPlatform.system}.\"driftile-overview\"";
          description = "The Driftile overview effect package to install.";
        };
      }
      // lib.optionalAttrs homeSettings {
        touchpadGesture = lib.mkOption {
          type = lib.types.nullOr (
            lib.types.submodule {
              options = {
                enable = lib.mkOption {
                  type = lib.types.bool;
                  default = true;
                  description = "Whether the overview touchpad gesture is enabled.";
                };

                fingerCount = lib.mkOption {
                  type = lib.types.ints.between 3 5;
                  default = 4;
                  description = "Number of fingers required for the overview touchpad gesture.";
                };
              };
            }
          );
          default = null;
          description = "Complete overview touchpad gesture profile; null leaves its KConfig values unmanaged.";
        };
      };

    transitions =
      {
        enable = lib.mkEnableOption "installation of the Driftile transition effect";

        package = lib.mkOption {
          type = lib.types.package;
          default = self.packages.${system}."driftile-transitions";
          defaultText = lib.literalExpression "inputs.driftile.packages.\${pkgs.stdenv.hostPlatform.system}.\"driftile-transitions\"";
          description = "The Driftile transition effect package to install.";
        };
      }
      // lib.optionalAttrs homeSettings {
        duration = lib.mkOption {
          type = lib.types.nullOr (lib.types.ints.between 0 1000);
          default = null;
          description = "Transition duration in milliseconds; null leaves the KConfig value unmanaged.";
        };

        animatePosition = lib.mkOption {
          type = lib.types.nullOr lib.types.bool;
          default = null;
          description = "Whether to animate window movement; null leaves the KConfig value unmanaged.";
        };

        animateSize = lib.mkOption {
          type = lib.types.nullOr lib.types.bool;
          default = null;
          description = "Whether to animate window size changes; null leaves the KConfig value unmanaged.";
        };

        easingCurve = lib.mkOption {
          type = lib.types.nullOr (lib.types.enum [
            "linear"
            "out-quad"
            "out-cubic"
            "out-quart"
            "out-quint"
            "out-expo"
          ]);
          default = null;
          description = "Transition easing curve; null leaves the KConfig value unmanaged.";
        };

        resizeAnimationThreshold = lib.mkOption {
          type = lib.types.nullOr (lib.types.ints.between 0 64);
          default = null;
          description = "Maximum logical-pixel size delta to suppress; null leaves the KConfig value unmanaged.";
        };

        windowClassExclusions = lib.mkOption {
          type = lib.types.nullOr transitionWindowClassExclusionType;
          default = null;
          description = "Up to 128 exact KWin windowClass strings excluded from transitions; null leaves the KConfig value unmanaged.";
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
            applicationBorderlessExclusions = lib.mkOption {
              type = applicationBorderlessExclusionType;
              default = [ ];
              description = "Exact desktop-file IDs keeping KWin borders and title bars.";
            };

            applicationColumnPresentations = lib.mkOption {
              type = applicationColumnPresentationType;
              default = { };
              description = "Default stacked or tabbed column presentations keyed by exact desktop-file ID.";
            };

            applicationColumnWidths = lib.mkOption {
              type = applicationColumnWidthType;
              default = { };
              description = "Initial column widths keyed by exact desktop-file ID. Integers are percentages from 10 to 100; strings must use canonical 10% to 100% or 1px to 16384px forms.";
            };

            applicationWindowHeights = lib.mkOption {
              type = applicationWindowHeightType;
              default = { };
              description = "Initial tiled client heights keyed by exact desktop-file ID. Integers are percentages from 10 to 100; strings must use canonical 10% to 100% or 1px to 16384px client-height forms.";
            };

            applicationFocusCentering = lib.mkOption {
              type = applicationFocusCenteringType;
              default = [ ];
              description = "Exact KWin desktopFileNames centered after horizontal focus navigation.";
            };

            applicationInitialFloating = lib.mkOption {
              type = applicationInitialFloatingType;
              default = [ ];
              description = "Exact desktop-file IDs whose newly admitted windows start manually floating.";
            };

            applicationTilingExclusions = lib.mkOption {
              type = applicationTilingExclusionType;
              default = [ ];
              description = "Exact desktop-file IDs excluded from tiling.";
            };

            alwaysCenterSingleColumn = lib.mkOption {
              type = lib.types.nullOr lib.types.bool;
              default = null;
              description = "Whether a lone tiled column stays centered; null leaves the KConfig value unmanaged.";
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

            centerFocusedColumnOnOverflow = lib.mkOption {
              type = lib.types.nullOr lib.types.bool;
              default = null;
              description = "Whether horizontal focus centers the destination only when the old and new columns do not both fit; null leaves the KConfig value unmanaged.";
            };

            emptyDesktopAboveFirst = lib.mkOption {
              type = lib.types.nullOr lib.types.bool;
              default = null;
              description = "Whether one empty virtual desktop is maintained before the first occupied desktop; null leaves the KConfig value unmanaged.";
            };

            workspaceAutoBackAndForth = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "Whether repeated numbered desktop selection toggles to the output-local last-used desktop.";
            };

            showTabIndicator = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Whether tab selection shows a transient Plasma OSD.";
            };

            touchpadNavigation = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "Whether horizontal touchpad swipes navigate tiled columns.";
            };

            touchpadWorkspaceNavigation = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "Whether vertical touchpad swipes navigate virtual desktops.";
            };

            touchpadNavigationFingerCount = lib.mkOption {
              type = lib.types.ints.between 3 5;
              default = 5;
              description = "Number of fingers required for touchpad navigation gestures.";
            };

            touchpadNaturalScroll = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Whether touchpad navigation follows the natural scrolling direction.";
            };

            columnWidthPresets = lib.mkOption {
              type = columnWidthPresetType;
              default = [ ];
              description = "Up to 16 mixed column width presets. Integers are percentages from 10 to 100; strings must use canonical 10% to 100% or 1px to 16384px forms. Values must increase within each unit; an empty list uses the built-in thirds.";
            };

            gap = lib.mkOption {
              type = lib.types.numbers.between 0 64;
              default = 16;
              description = "Window gap in logical pixels.";
            };

            defaultColumnWidthPercent = lib.mkOption {
              type = lib.types.ints.between 10 100;
              default = 33;
              description = "Default column width as a percentage.";
            };

            defaultColumnWidthPixels = lib.mkOption {
              type = lib.types.ints.between 0 16384;
              default = 0;
              description = "Fixed default column width in logical pixels; zero uses defaultColumnWidthPercent.";
            };

            defaultWindowHeight = lib.mkOption {
              type = defaultWindowHeightType;
              default = "auto";
              description = "Initial tiled client height. Use auto, an integer percentage from 10 to 100, or a canonical 10% to 100% or 1px to 16384px client-height string.";
            };

            defaultColumnPresentation = lib.mkOption {
              type = lib.types.enum [
                "stacked"
                "tabbed"
              ];
              default = "stacked";
              description = "Default presentation for newly created columns.";
            };

            columnWidthStepPercent = lib.mkOption {
              type = lib.types.ints.between 1 50;
              default = 10;
              description = "Column width adjustment in percentage points.";
            };

            columnWidthStepPixels = lib.mkOption {
              type = lib.types.ints.between 0 16384;
              default = 0;
              description = "Column width adjustment in fixed logical pixels; zero uses columnWidthStepPercent.";
            };

            windowHeightPresets = lib.mkOption {
              type = windowHeightPresetType;
              default = [ ];
              description = "Up to 16 mixed window height presets. Integers are percentages from 10 to 100; strings must use canonical 10% to 100% or 1px to 16384px forms. Values must increase within each unit; an empty list uses the built-in thirds.";
            };

            windowHeightStepPercent = lib.mkOption {
              type = lib.types.ints.between 1 50;
              default = 10;
              description = "Window height adjustment in percentage points.";
            };

            windowHeightStepPixels = lib.mkOption {
              type = lib.types.ints.between 0 16384;
              default = 0;
              description = "Window height adjustment in fixed logical pixels; zero uses windowHeightStepPercent.";
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
    (lib.mkIf cfg.transitions.enable (
      lib.mkMerge [
        (lib.setAttrByPath packageOptionPath [ cfg.transitions.package ])
        (lib.optionalAttrs preventSystemInstall {
          assertions = [
            {
              assertion = !systemTransitionsInstallEnabled;
              message = "Install the Driftile transition effect through either NixOS or Home Manager for a user, not both.";
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
          ApplicationBorderlessExclusions =
            renderApplicationBorderlessExclusions cfg.settings.applicationBorderlessExclusions;
          ApplicationColumnPresentations =
            renderApplicationColumnPresentations cfg.settings.applicationColumnPresentations;
          ApplicationColumnWidths = renderApplicationColumnWidths cfg.settings.applicationColumnWidths;
          ApplicationWindowHeights = renderApplicationWindowHeights cfg.settings.applicationWindowHeights;
          ApplicationFocusCentering =
            renderApplicationFocusCentering cfg.settings.applicationFocusCentering;
          ApplicationInitialFloating =
            renderApplicationInitialFloating cfg.settings.applicationInitialFloating;
          ApplicationTilingExclusions = renderApplicationTilingExclusions cfg.settings.applicationTilingExclusions;
          BorderlessWindows = cfg.settings.borderlessWindows;
          CenterFocusedColumn = cfg.settings.centerFocusedColumn;
          ColumnWidthPresets = renderColumnWidthPresets cfg.settings.columnWidthPresets;
          ColumnWidthStepPercent = cfg.settings.columnWidthStepPercent;
          ColumnWidthStepPixels = cfg.settings.columnWidthStepPixels;
          DefaultColumnPresentation = cfg.settings.defaultColumnPresentation;
          DefaultColumnWidthPercent = cfg.settings.defaultColumnWidthPercent;
          DefaultColumnWidthPixels = cfg.settings.defaultColumnWidthPixels;
          DefaultWindowHeight = renderDefaultWindowHeight cfg.settings.defaultWindowHeight;
          Gap = cfg.settings.gap;
          ShowTabIndicator = cfg.settings.showTabIndicator;
          TouchpadNavigation = cfg.settings.touchpadNavigation;
          TouchpadNavigationFingerCount = cfg.settings.touchpadNavigationFingerCount;
          TouchpadNaturalScroll = cfg.settings.touchpadNaturalScroll;
          TouchpadWorkspaceNavigation = cfg.settings.touchpadWorkspaceNavigation;
          WindowHeightPresets = renderWindowHeightPresets cfg.settings.windowHeightPresets;
          WindowHeightStepPercent = cfg.settings.windowHeightStepPercent;
          WindowHeightStepPixels = cfg.settings.windowHeightStepPixels;
          WorkspaceAutoBackAndForth = cfg.settings.workspaceAutoBackAndForth;
        }
        // lib.optionalAttrs (cfg.settings.alwaysCenterSingleColumn != null) {
          AlwaysCenterSingleColumn = cfg.settings.alwaysCenterSingleColumn;
        }
        // lib.optionalAttrs (cfg.settings.centerFocusedColumnOnOverflow != null) {
          CenterFocusedColumnOnOverflow = cfg.settings.centerFocusedColumnOnOverflow;
        }
        // lib.optionalAttrs (cfg.settings.emptyDesktopAboveFirst != null) {
          EmptyDesktopAboveFirst = cfg.settings.emptyDesktopAboveFirst;
        };
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.overview.touchpadGesture != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.overview" = {
          TouchpadGesture = cfg.overview.touchpadGesture.enable;
          TouchpadGestureFingerCount = cfg.overview.touchpadGesture.fingerCount;
        };
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.duration != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".Duration =
          cfg.transitions.duration;
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.animatePosition != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".AnimatePosition =
          cfg.transitions.animatePosition;
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.animateSize != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".AnimateSize =
          cfg.transitions.animateSize;
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.easingCurve != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".EasingCurve =
          cfg.transitions.easingCurve;
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.resizeAnimationThreshold != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".ResizeAnimationThreshold =
          cfg.transitions.resizeAnimationThreshold;
      }
    ))
    (lib.optionalAttrs homeSettings (
      lib.mkIf (cfg.transitions.windowClassExclusions != null) {
        qt.kde.settings.kwinrc."Effect-${pluginId}.transitions".WindowClassExclusions =
          renderTransitionWindowClassExclusions cfg.transitions.windowClassExclusions;
      }
    ))
  ];
}
