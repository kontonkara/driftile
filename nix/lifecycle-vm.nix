{
  driftileCurrentOverviewPackage,
  driftileCurrentPackage,
  pkgs,
  ...
}:

let
  pluginId = "io.github.kontonkara.driftile";
  overviewPluginId = "io.github.kontonkara.driftile.overview";
  overviewShortcut = "driftile_toggle_overview";
  overviewShortcutText = "Driftile: Toggle overview";
  pluginMetadata = builtins.fromJSON (builtins.readFile ../packaging/kwin-script/metadata.json);
  overviewPluginMetadata = builtins.fromJSON (
    builtins.readFile ../packaging/kwin-effect/metadata.json
  );
  currentVersion = pluginMetadata.KPlugin.Version;
  currentOverviewVersion = overviewPluginMetadata.KPlugin.Version;
  publishedVersion = "1.19.0";
  publishedArchive = pkgs.fetchurl {
    name = "driftile-${publishedVersion}.kwinscript";
    url = "https://github.com/kontonkara/driftile/releases/download/v${publishedVersion}/driftile-${publishedVersion}.kwinscript";
    hash = "sha256-IfUkofqq+HDhV9HQXfkxaGl39WOC+bpMvuRuFCzqxxw=";
  };
  publishedOverviewArchive = pkgs.fetchurl {
    name = "driftile-overview-${publishedVersion}.kwineffect";
    url = "https://github.com/kontonkara/driftile/releases/download/v${publishedVersion}/driftile-overview-${publishedVersion}.kwineffect";
    hash = "sha256-kw5L6qzsglBmaGU6DKNbJWCvqJkYQuaYKginwMZkAgA=";
  };
  currentArchive =
    pkgs.runCommand "driftile-${currentVersion}.kwinscript"
      {
        nativeBuildInputs = [
          pkgs.coreutils
          pkgs.findutils
          pkgs.jq
          pkgs.zip
        ];
      }
      ''
        mkdir package
        cp -R \
          ${driftileCurrentPackage}/share/kwin/scripts/${pluginId}/. \
          package/
        chmod -R u+w package

        test "$(jq -er '.KPlugin.Id' package/metadata.json)" = ${pluginId}
        test "$(jq -er '.KPlugin.Version' package/metadata.json)" = ${currentVersion}
        test "$(jq -er '."X-Plasma-MainScript"' package/metadata.json)" = ui/main.qml
        test -f package/contents/ui/main.qml
        test -f package/contents/runtime/selector.qml
        runtime_main=$(find \
          package/contents/runtime \
          -mindepth 3 \
          -maxdepth 3 \
          -type f \
          -path '*/ui/main.qml' \
          -printf '%P\n' \
          | LC_ALL=C sort)
        [[ "$runtime_main" =~ ^[0-9a-f]{64}/ui/main\.qml$ ]]
        runtime_root="''${runtime_main%/ui/main.qml}"
        test -f "package/contents/runtime/$runtime_root/code/main.js"
        test -z "$(find package -type l -print -quit)"

        find package -exec touch -h -d @315532800 {} +
        find package -type f -printf '%P\n' | LC_ALL=C sort > entries
        (cd package && zip -0Xq "$out" -@ < ../entries)
      '';
  currentOverviewArchive =
    pkgs.runCommand "driftile-overview-${currentOverviewVersion}.kwineffect"
      {
        nativeBuildInputs = [
          pkgs.coreutils
          pkgs.findutils
          pkgs.jq
          pkgs.zip
        ];
      }
      ''
        mkdir package
        cp -R \
          ${driftileCurrentOverviewPackage}/share/kwin/effects/${overviewPluginId}/. \
          package/
        chmod -R u+w package

        test "$(jq -er '.KPackageStructure' package/metadata.json)" = KWin/Effect
        test "$(jq -er '.KPlugin.Id' package/metadata.json)" = ${overviewPluginId}
        test "$(jq -er '.KPlugin.Version' package/metadata.json)" = ${currentOverviewVersion}
        test "$(jq -er '.KPlugin.EnabledByDefault' package/metadata.json)" = false
        test "$(jq -er '."X-Plasma-MainScript"' package/metadata.json)" = ui/main.qml
        test -f package/contents/ui/main.qml
        test -f package/contents/runtime/selector.qml
        runtime_main=$(find \
          package/contents/runtime \
          -mindepth 3 \
          -maxdepth 3 \
          -type f \
          -path '*/ui/main.qml' \
          -printf '%P\n' \
          | LC_ALL=C sort)
        [[ "$runtime_main" =~ ^[0-9a-f]{64}/ui/main\.qml$ ]]
        runtime_root="''${runtime_main%/ui/main.qml}"
        test -f "package/contents/runtime/$runtime_root/code/main.js"
        test -z "$(find package -type l -print -quit)"

        find package -exec touch -h -d @315532800 {} +
        find package -type f -printf '%P\n' | LC_ALL=C sort > entries
        (cd package && zip -0Xq "$out" -@ < ../entries)
      '';
  lifecycleCheck = pkgs.writeShellApplication {
    name = "driftile-lifecycle-check";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.findutils
      pkgs.gnugrep
      pkgs.jq
      pkgs.kdePackages.kcalc
      pkgs.kdePackages.kconfig
      pkgs.kdePackages.konsole
      pkgs.kdePackages.kpackage
      pkgs.libxml2
      pkgs.systemd
      pkgs.unzip
    ];
    text = ''
      readonly diagnostics_file=/tmp/shared/driftile-lifecycle-diagnostics
      readonly result_file=/tmp/shared/driftile-lifecycle-verified
      readonly command_log=/tmp/driftile-lifecycle-commands.log
      readonly plugin_id=${pluginId}
      readonly overview_plugin_id=${overviewPluginId}
      readonly overview_shortcut=${overviewShortcut}
      readonly overview_shortcut_text="${overviewShortcutText}"
      readonly close_shortcut=driftile_close_window
      readonly published_archive=${publishedArchive}
      readonly published_overview_archive=${publishedOverviewArchive}
      readonly current_archive=${currentArchive}
      readonly current_overview_archive=${currentOverviewArchive}
      readonly published_version=${publishedVersion}
      readonly current_version=${currentVersion}
      readonly current_overview_version=${currentOverviewVersion}
      readonly data_home="''${XDG_DATA_HOME:-$HOME/.local/share}"
      readonly installed_package="$data_home/kwin/scripts/$plugin_id"
      readonly installed_metadata="$installed_package/metadata.json"
      readonly installed_overview_package="$data_home/kwin/effects/$overview_plugin_id"
      readonly installed_overview_metadata="$installed_overview_package/metadata.json"
      readonly runner_title="Driftile release lifecycle"
      result_written=false
      test_kcalc_pid=""
      test_konsole_pid=""

      write_result() {
        local temporary_file="$result_file.tmp"

        printf '%s\n' "$1" > "$temporary_file"
        mv "$temporary_file" "$result_file"
        result_written=true
      }

      progress() {
        printf '%s\n' "$1" | tee -a "$diagnostics_file"
      }

      fail_test() {
        progress "failed: $1"
        exit 1
      }

      run_checked() {
        local description=$1

        shift
        "$@" >> "$command_log" 2>&1 || fail_test "$description"
      }

      script_state() {
        busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          isScriptLoaded \
          s "$plugin_id" \
          2>/dev/null || true
      }

      wait_for_script_state() {
        local expected=$1
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if [[ "$(script_state)" == "b $expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_kwin() {
        local attempt

        for ((attempt = 0; attempt < 300; attempt += 1)); do
          case "$(script_state)" in
            "b true" | "b false") return 0 ;;
          esac

          sleep 0.1
        done

        return 1
      }

      set_enabled() {
        run_checked \
          "could not update the enabled state" \
          kwriteconfig6 \
          --file kwinrc \
          --group Plugins \
          --key "''${plugin_id}Enabled" \
          --type bool \
          "$1"
      }

      metadata_uses_fixed_main() {
        [[ "$(jq --exit-status --raw-output '."X-Plasma-MainScript"' "$1")" == ui/main.qml ]]
      }

      unique_hashed_main_path() {
        local package_root=$1
        local relative_path

        relative_path=$(find \
          "$package_root/contents/runtime" \
          -mindepth 3 \
          -maxdepth 3 \
          -type f \
          -path '*/ui/main.qml' \
          -printf '%P\n' \
          | LC_ALL=C sort) || return 1
        [[ "$relative_path" =~ ^[0-9a-f]{64}/ui/main\.qml$ ]] || return 1
        printf '%s/contents/runtime/%s' "$package_root" "$relative_path"
      }

      runtime_path_for_hashed_main() {
        local hashed_main=$1
        local runtime_root

        runtime_root="''${hashed_main%/ui/main.qml}"
        printf '%s/code/main.js' "$runtime_root"
      }

      installed_main_path() {
        printf '%s/contents/ui/main.qml' "$installed_package"
      }

      installed_hashed_main_path() {
        unique_hashed_main_path "$installed_package"
      }

      installed_runtime_path() {
        local hashed_main

        case "$(installed_version)" in
          "$published_version" | "$current_version")
            hashed_main=$(installed_hashed_main_path) || return 1
            runtime_path_for_hashed_main "$hashed_main"
            ;;
          *)
            return 1
            ;;
        esac
      }

      installed_package_has_runtime() {
        local runtime_path

        metadata_uses_fixed_main "$installed_metadata" || return 1
        runtime_path=$(installed_runtime_path) || return 1
        [[ -f "$(installed_main_path)" && -f "$runtime_path" ]]
      }

      installed_package_has_content_addressed_layout() {
        local expected_version=$1
        local hashed_main

        [[ "$(installed_version)" == "$expected_version" ]] || return 1
        installed_package_has_runtime || return 1
        hashed_main=$(installed_hashed_main_path) || return 1
        [[ -f "$hashed_main" && -f "$installed_package/contents/runtime/selector.qml" ]]
      }

      installed_overview_main_path() {
        printf '%s/contents/ui/main.qml' "$installed_overview_package"
      }

      installed_overview_hashed_main_path() {
        unique_hashed_main_path "$installed_overview_package"
      }

      installed_overview_runtime_path() {
        local hashed_main

        case "$(overview_installed_version)" in
          "$published_version" | "$current_overview_version")
            hashed_main=$(installed_overview_hashed_main_path) || return 1
            runtime_path_for_hashed_main "$hashed_main"
            ;;
          *)
            return 1
            ;;
        esac
      }

      installed_overview_has_runtime() {
        local runtime_path

        metadata_uses_fixed_main "$installed_overview_metadata" || return 1
        runtime_path=$(installed_overview_runtime_path) || return 1
        [[ -f "$(installed_overview_main_path)" && -f "$runtime_path" ]]
      }

      installed_overview_has_content_addressed_layout() {
        local expected_version=$1
        local hashed_main

        [[ "$(overview_installed_version)" == "$expected_version" ]] || return 1
        installed_overview_has_runtime || return 1
        hashed_main=$(installed_overview_hashed_main_path) || return 1
        [[ -f "$hashed_main" && -f "$installed_overview_package/contents/runtime/selector.qml" ]]
      }

      load_script_path() {
        local script_path=$1
        local load_result

        [[ -f "$script_path" ]] \
          || fail_test "the requested script entry point is missing"
        load_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          loadDeclarativeScript \
          ss "$script_path" "$plugin_id" \
          2>> "$command_log") \
          || fail_test "KWin rejected the script load request"
        [[ "$load_result" =~ ^i\ [0-9]+$ ]] \
          || fail_test "KWin returned an invalid script identifier"
        run_checked \
          "KWin could not start loaded scripts" \
          busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          start
        wait_for_script_state true \
          || fail_test "the script did not reach the loaded state"
      }

      load_installed_script() {
        load_script_path "$(installed_main_path)"
      }

      unload_installed_script() {
        local unload_result

        unload_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$plugin_id" \
          2>> "$command_log") \
          || fail_test "KWin rejected the unload request"
        [[ "$unload_result" == "b true" ]] \
          || fail_test "KWin did not accept the unload request"
        wait_for_script_state false \
          || fail_test "the script did not reach the unloaded state"
      }

      archive_version() {
        unzip -p "$1" metadata.json \
          | jq --exit-status --raw-output '.KPlugin.Version'
      }

      archive_plugin_id() {
        unzip -p "$1" metadata.json \
          | jq --exit-status --raw-output '.KPlugin.Id'
      }

      archive_enabled_by_default() {
        unzip -p "$1" metadata.json \
          | jq --exit-status --raw-output '.KPlugin.EnabledByDefault'
      }

      archive_main_path() {
        local main_script

        main_script=$(unzip -p "$1" metadata.json \
          | jq --exit-status --raw-output '."X-Plasma-MainScript"') \
          || return 1
        [[ "$main_script" == ui/main.qml ]] || return 1
        printf '%s' contents/ui/main.qml
      }

      archive_hashed_main_path() {
        local hashed_main

        hashed_main=$(unzip \
          -Z1 \
          "$1" \
          'contents/runtime/*/ui/main.qml' \
          2>/dev/null) || return 1
        [[ "$hashed_main" =~ ^contents/runtime/[0-9a-f]{64}/ui/main\.qml$ ]] \
          || return 1
        printf '%s' "$hashed_main"
      }

      archive_hashed_runtime_path() {
        local hashed_main

        hashed_main=$(archive_hashed_main_path "$1") || return 1
        runtime_path_for_hashed_main "$hashed_main"
      }

      archive_runtime_path() {
        case "$(archive_version "$1")" in
          "$published_version" | "$current_version")
            archive_hashed_runtime_path "$1"
            ;;
          *)
            return 1
            ;;
        esac
      }

      archive_contains_entry() {
        [[ "$(unzip -Z1 "$1" "$2")" == "$2" ]]
      }

      archive_contains_main() {
        local main_path

        main_path=$(archive_main_path "$1") || return 1
        archive_contains_entry "$1" "$main_path"
      }

      archive_contains_runtime() {
        local runtime_path

        runtime_path=$(archive_runtime_path "$1") || return 1
        archive_contains_entry "$1" "$runtime_path"
      }

      archive_has_content_addressed_layout() {
        local expected_version=$2
        local hashed_main

        [[ "$(archive_version "$1")" == "$expected_version" ]] || return 1
        archive_contains_main "$1" || return 1
        archive_contains_entry "$1" contents/runtime/selector.qml || return 1
        hashed_main=$(archive_hashed_main_path "$1") || return 1
        archive_contains_entry "$1" "$hashed_main" || return 1
        archive_contains_runtime "$1"
      }

      config_default() {
        local config_file=$1
        local entry_name=$2
        local entry_path
        local entry_count

        entry_path="/*[local-name()='kcfg']/*[local-name()='group']/*[local-name()='entry'][@name='$entry_name']"
        entry_count=$(xmllint \
          --xpath "count($entry_path)" \
          "$config_file") || return 1
        [[ "$entry_count" == "1" ]] || return 1
        xmllint \
          --xpath "string($entry_path/*[local-name()='default'])" \
          "$config_file"
      }

      archive_config_default() {
        local archive=$1
        local entry_name=$2
        local temporary_config
        local result

        temporary_config=$(mktemp)
        if ! unzip -p "$archive" contents/config/main.xml > "$temporary_config"; then
          rm -f -- "$temporary_config"
          return 1
        fi
        result=$(config_default "$temporary_config" "$entry_name") || {
          rm -f -- "$temporary_config"
          return 1
        }
        rm -f -- "$temporary_config"
        printf '%s' "$result"
      }

      archive_runtime_digest() {
        local digest
        local runtime_path

        runtime_path=$(archive_runtime_path "$1") || return 1
        digest=$(unzip -p "$1" "$runtime_path" | sha256sum) || return 1
        printf '%s' "''${digest%% *}"
      }

      installed_version() {
        jq --exit-status --raw-output '.KPlugin.Version' \
          "$installed_package/metadata.json"
      }

      installed_plugin_id() {
        jq --exit-status --raw-output '.KPlugin.Id' \
          "$installed_package/metadata.json"
      }

      installed_config_default() {
        config_default \
          "$installed_package/contents/config/main.xml" \
          "$1"
      }

      runtime_digest() {
        local digest
        local runtime_path

        runtime_path=$(installed_runtime_path) || return 1
        digest=$(sha256sum "$runtime_path") || return 1
        printf '%s' "''${digest%% *}"
      }

      package_is_listed() {
        kpackagetool6 --type=KWin/Script --list 2>/dev/null \
          | grep --fixed-strings --quiet "$plugin_id"
      }

      overview_package_is_listed() {
        kpackagetool6 --type=KWin/Effect --list 2>/dev/null \
          | grep --fixed-strings --quiet "$overview_plugin_id"
      }

      overview_installed_version() {
        jq --exit-status --raw-output '.KPlugin.Version' \
          "$installed_overview_package/metadata.json"
      }

      overview_installed_plugin_id() {
        jq --exit-status --raw-output '.KPlugin.Id' \
          "$installed_overview_package/metadata.json"
      }

      overview_installed_enabled_by_default() {
        jq --exit-status --raw-output '.KPlugin.EnabledByDefault' \
          "$installed_overview_package/metadata.json"
      }

      touchpad_navigation_override() {
        kreadconfig6 \
          --file kwinrc \
          --group "Script-$plugin_id" \
          --key TouchpadNavigation \
          --default missing
      }

      overview_runtime_digest() {
        local digest
        local runtime_path

        runtime_path=$(installed_overview_runtime_path) || return 1
        digest=$(sha256sum "$runtime_path") || return 1
        printf '%s' "''${digest%% *}"
      }

      effect_available_state() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          listOfEffects 2>/dev/null \
          | jq --exit-status --raw-output \
            --arg effectId "$1" \
            '.data | any(. == $effectId) | tostring'
      }

      effect_is_available() {
        [[ "$(effect_available_state "$1")" == true ]]
      }

      wait_for_effect_available_state() {
        local effect_id=$1
        local expected=$2
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if [[ "$(effect_available_state "$effect_id" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      request_kwin_reconfigure() {
        run_checked \
          "KWin rejected the effect discovery refresh" \
          busctl --user --expect-reply=no call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure
      }

      effect_loaded_state() {
        local state

        state=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          isEffectLoaded \
          s "$1" \
          2>/dev/null) || return 1

        case "$state" in
          "b true") printf '%s' true ;;
          "b false") printf '%s' false ;;
          *) return 1 ;;
        esac
      }

      wait_for_effect_loaded_state() {
        local effect_id=$1
        local expected=$2
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if [[ "$(effect_loaded_state "$effect_id" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      shortcut_is_registered() {
        busctl --user call \
          org.kde.kglobalaccel \
          /component/kwin \
          org.kde.kglobalaccel.Component \
          shortcutNames 2>/dev/null \
          | grep --fixed-strings --quiet "$1"
      }

      wait_for_shortcut_registration_state() {
        local shortcut=$1
        local expected=$2
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if shortcut_is_registered "$shortcut"; then
            [[ "$expected" == true ]] && return 0
          elif [[ "$expected" == false ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      shortcut_keys() {
        local shortcut_name=$1
        local shortcut_text=$2

        busctl --user --json=short call \
          org.kde.kglobalaccel \
          /kglobalaccel \
          org.kde.KGlobalAccel \
          shortcutKeys \
          as \
          4 kwin "$shortcut_name" KWin "$shortcut_text" \
          2>/dev/null \
          | jq --compact-output \
            '.data[0] | map(.[0]) | map(select(. != [0, 0, 0, 0])) | sort'
      }

      load_overview_effect() {
        local result

        result=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          loadEffect \
          s "$overview_plugin_id" \
          2>> "$command_log") \
          || fail_test "KWin rejected the overview load request"
        [[ "$result" == "b true" ]] \
          || fail_test "KWin did not accept the overview load request"
        wait_for_effect_loaded_state "$overview_plugin_id" true \
          || fail_test "the overview did not reach the loaded state"
      }

      unload_overview_effect() {
        run_checked \
          "KWin rejected the overview unload request" \
          busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          unloadEffect \
          s "$overview_plugin_id"
        wait_for_effect_loaded_state "$overview_plugin_id" false \
          || fail_test "the overview did not reach the unloaded state"
      }

      window_match_id() {
        local title=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$title" \
          2>/dev/null \
          | jq --exit-status --raw-output --arg title "$title" '
            [
              .data[0][]
              | select(.[1] | contains($title))
            ] as $matches
            | select($matches | length == 1)
            | $matches[0][0]
          '
      }

      wait_for_window() {
        local title=$1
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if window_match_id "$title" >/dev/null; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_window_gone() {
        local title=$1
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if ! window_match_id "$title" >/dev/null 2>&1; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      stop_process() {
        local pid=$1
        local title=$2

        kill "$pid" >/dev/null 2>&1 || true
        wait "$pid" >/dev/null 2>&1 || true
        wait_for_window_gone "$title"
      }

      start_test_konsole() {
        local title=$1

        QT_QPA_PLATFORM=wayland \
          konsole \
          --separate \
          --builtin-profile \
          --hide-menubar \
          --hide-tabbar \
          --notransparency \
          --qwindowtitle "$title" \
          -p "tabtitle=$title" \
          -p "LocalTabTitleFormat=$title" \
          -p "RemoteTabTitleFormat=$title" \
          -e sleep 180 \
          >> "$command_log" 2>&1 &
        test_konsole_pid=$!
        wait_for_window "$title"
      }

      start_test_kcalc() {
        local title=$1

        QT_QPA_PLATFORM=wayland \
          kcalc --qwindowtitle "$title" \
          >> "$command_log" 2>&1 &
        test_kcalc_pid=$!
        wait_for_window "$title"
      }

      collect_failure_diagnostics() {
        {
          printf '\nscript state: %s\n' "$(script_state)"
          printf 'package path: %s\n' "$installed_package"
          if [[ -f "$installed_package/metadata.json" ]]; then
            printf 'installed version: %s\n' \
              "$(installed_version 2>/dev/null || printf unreadable)"
            printf 'installed package ID: %s\n' \
              "$(installed_plugin_id 2>/dev/null || printf unreadable)"
          fi
          if [[ -f "$installed_package/contents/config/main.xml" ]]; then
            printf 'installed TouchpadNavigation default: %s\n' \
              "$(installed_config_default TouchpadNavigation 2>/dev/null || printf unreadable)"
          fi
          printf 'TouchpadNavigation override: %s\n' \
            "$(touchpad_navigation_override 2>/dev/null || printf unreadable)"
          printf '\nKPackage matches:\n'
          kpackagetool6 --type=KWin/Script --list 2>&1 \
            | grep --fixed-strings "$plugin_id" \
            || true
          printf '\noverview package path: %s\n' "$installed_overview_package"
          if [[ -f "$installed_overview_package/metadata.json" ]]; then
            printf 'overview installed version: %s\n' \
              "$(overview_installed_version 2>/dev/null || printf unreadable)"
            printf 'overview installed package ID: %s\n' \
              "$(overview_installed_plugin_id 2>/dev/null || printf unreadable)"
            printf 'overview enabled by default: %s\n' \
              "$(overview_installed_enabled_by_default 2>/dev/null || printf unreadable)"
          fi
          printf 'overview available: %s\n' \
            "$(effect_available_state "$overview_plugin_id" 2>/dev/null || printf unavailable)"
          printf 'overview loaded: %s\n' \
            "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || printf unavailable)"
          printf 'overview action registered: '
          if shortcut_is_registered "$overview_shortcut"; then
            printf 'true\n'
          else
            printf 'false\n'
          fi
          printf 'close-window action registered: '
          if shortcut_is_registered "$close_shortcut"; then
            printf 'true\n'
          else
            printf 'false\n'
          fi
          printf '\noverview KPackage matches:\n'
          kpackagetool6 --type=KWin/Effect --list 2>&1 \
            | grep --fixed-strings "$overview_plugin_id" \
            || true
          if [[ -s "$command_log" ]]; then
            printf '\ncommand log:\n'
            tail -n 80 "$command_log"
          fi
          printf '\nuser journal:\n'
          journalctl --user -b --no-pager -n 80 2>&1 || true
        } >> "$diagnostics_file"
      }

      finish() {
        local status=$?

        if [[ -n "$test_kcalc_pid" ]]; then
          kill "$test_kcalc_pid" >/dev/null 2>&1 || true
        fi
        if [[ -n "$test_konsole_pid" ]]; then
          kill "$test_konsole_pid" >/dev/null 2>&1 || true
        fi

        if [[ "$result_written" != true ]]; then
          collect_failure_diagnostics
          write_result false
        fi

        exit "$status"
      }

      trap finish EXIT
      rm -f -- "$result_file" "$result_file.tmp" "$command_log"
      : > "$diagnostics_file"
      progress "waiting for Plasma and KWin"
      wait_for_kwin || fail_test "KWin scripting did not become available"
      wait_for_window "$runner_title" \
        || fail_test "the visible lifecycle Konsole was not discovered"

      [[ "$(archive_version "$published_archive")" == "$published_version" ]] \
        || fail_test "the published archive metadata is unexpected"
      [[ "$(archive_plugin_id "$published_archive")" == "$plugin_id" ]] \
        || fail_test "the published archive package ID is unexpected"
      [[ "$(archive_version "$published_overview_archive")" == "$published_version" ]] \
        || fail_test "the published overview archive metadata is unexpected"
      [[ "$(archive_plugin_id "$published_overview_archive")" == "$overview_plugin_id" ]] \
        || fail_test "the published overview archive package ID is unexpected"
      [[ "$(archive_enabled_by_default "$published_overview_archive")" == false ]] \
        || fail_test "the published overview archive was enabled by default"
      [[ "$(archive_version "$current_archive")" == "$current_version" ]] \
        || fail_test "the current archive metadata is unexpected"
      [[ "$(archive_plugin_id "$current_archive")" == "$plugin_id" ]] \
        || fail_test "the current archive package ID is unexpected"
      [[ "$(archive_config_default "$current_archive" TouchpadNavigation)" == false ]] \
        || fail_test "the current archive enabled TouchpadNavigation by default"
      [[ "$(archive_version "$current_overview_archive")" == "$current_overview_version" ]] \
        || fail_test "the current overview archive metadata is unexpected"
      [[ "$(archive_plugin_id "$current_overview_archive")" == "$overview_plugin_id" ]] \
        || fail_test "the current overview archive package ID is unexpected"
      [[ "$(archive_enabled_by_default "$current_overview_archive")" == false ]] \
        || fail_test "the current overview archive was enabled by default"
      archive_contains_main "$published_archive" \
        || fail_test "the published archive entry point is missing or invalid"
      archive_contains_runtime "$published_archive" \
        || fail_test "the published archive runtime is missing or invalid"
      archive_has_content_addressed_layout "$published_archive" "$published_version" \
        || fail_test "the published archive bootstrap, selector, or hashed runtime is invalid"
      archive_contains_main "$published_overview_archive" \
        || fail_test "the published overview entry point is missing or invalid"
      archive_contains_runtime "$published_overview_archive" \
        || fail_test "the published overview runtime is missing or invalid"
      archive_has_content_addressed_layout "$published_overview_archive" "$published_version" \
        || fail_test "the published overview bootstrap, selector, or hashed runtime is invalid"
      archive_contains_main "$current_archive" \
        || fail_test "the current archive entry point is missing or invalid"
      archive_contains_runtime "$current_archive" \
        || fail_test "the current archive runtime is missing or invalid"
      archive_has_content_addressed_layout "$current_archive" "$current_version" \
        || fail_test "the current archive bootstrap, selector, or hashed runtime is invalid"
      archive_contains_main "$current_overview_archive" \
        || fail_test "the current overview entry point is missing or invalid"
      archive_contains_runtime "$current_overview_archive" \
        || fail_test "the current overview runtime is missing or invalid"
      archive_has_content_addressed_layout "$current_overview_archive" "$current_overview_version" \
        || fail_test "the current overview bootstrap, selector, or hashed runtime is invalid"
      published_archive_runtime_digest=$(archive_runtime_digest "$published_archive") \
        || fail_test "the published archive runtime could not be hashed"
      published_overview_archive_runtime_digest=$(archive_runtime_digest "$published_overview_archive") \
        || fail_test "the published overview archive runtime could not be hashed"
      current_archive_runtime_digest=$(archive_runtime_digest "$current_archive") \
        || fail_test "the current archive runtime could not be hashed"
      current_overview_archive_runtime_digest=$(archive_runtime_digest "$current_overview_archive") \
        || fail_test "the current overview archive runtime could not be hashed"
      [[ ! -e "$installed_package" ]] \
        || fail_test "a user package was present before the test"
      [[ ! -e "$installed_overview_package" ]] \
        || fail_test "a user overview package was present before the test"
      [[ ! -e "/run/current-system/sw/share/kwin/scripts/$plugin_id" ]] \
        || fail_test "a system package was present before the test"
      [[ ! -e "/run/current-system/sw/share/kwin/effects/$overview_plugin_id" ]] \
        || fail_test "a system overview package was present before the test"
      if package_is_listed; then
        fail_test "KPackage listed Driftile before installation"
      fi
      if overview_package_is_listed; then
        fail_test "KPackage listed the overview before installation"
      fi
      if effect_is_available "$overview_plugin_id"; then
        fail_test "KWin listed the overview before installation"
      fi
      wait_for_shortcut_registration_state "$overview_shortcut" false \
        || fail_test "the overview action existed before installation"
      [[ "$(touchpad_navigation_override)" == missing ]] \
        || fail_test "TouchpadNavigation had a user override before installation"
      progress "clean package baseline confirmed"

      run_checked \
        "the published package could not be installed" \
        kpackagetool6 --type=KWin/Script --install "$published_archive"
      run_checked \
        "the published overview package could not be installed" \
        kpackagetool6 --type=KWin/Effect --install "$published_overview_archive"
      package_is_listed \
        || fail_test "KPackage did not list the published package"
      overview_package_is_listed \
        || fail_test "KPackage did not list the published overview"
      [[ "$(installed_version)" == "$published_version" ]] \
        || fail_test "the installed published metadata is unexpected"
      [[ "$(installed_plugin_id)" == "$plugin_id" ]] \
        || fail_test "the installed published package ID is unexpected"
      installed_package_has_runtime \
        || fail_test "the installed published entry point or runtime is missing"
      installed_package_has_content_addressed_layout "$published_version" \
        || fail_test "the installed published bootstrap, selector, or hashed runtime is missing"
      published_runtime_digest=$(runtime_digest) \
        || fail_test "the published runtime could not be hashed"
      [[ "$published_runtime_digest" == "$published_archive_runtime_digest" ]] \
        || fail_test "the installed published runtime did not match its archive"
      [[ "$(overview_installed_version)" == "$published_version" ]] \
        || fail_test "the installed published overview metadata is unexpected"
      [[ "$(overview_installed_plugin_id)" == "$overview_plugin_id" ]] \
        || fail_test "the installed published overview package ID is unexpected"
      [[ "$(overview_installed_enabled_by_default)" == false ]] \
        || fail_test "the installed published overview was enabled by default"
      installed_overview_has_runtime \
        || fail_test "the installed published overview entry point or runtime is missing"
      installed_overview_has_content_addressed_layout "$published_version" \
        || fail_test "the installed published overview bootstrap, selector, or hashed runtime is missing"
      published_overview_runtime_digest=$(overview_runtime_digest) \
        || fail_test "the published overview runtime could not be hashed"
      [[ "$published_overview_runtime_digest" == "$published_overview_archive_runtime_digest" ]] \
        || fail_test "the installed published overview runtime did not match its archive"
      request_kwin_reconfigure
      wait_for_effect_available_state "$overview_plugin_id" true \
        || fail_test "KWin did not discover the published overview after reconfiguration"
      wait_for_effect_loaded_state "$overview_plugin_id" false \
        || fail_test "the published overview was loaded after installation"
      wait_for_shortcut_registration_state "$overview_shortcut" false \
        || fail_test "the disabled published overview registered its action"
      set_enabled true
      load_installed_script
      progress "published $published_version packages installed with the overview disabled and unbound"

      set_enabled false
      unload_installed_script
      run_checked \
        "the current package could not upgrade the published package" \
        kpackagetool6 --type=KWin/Script --upgrade "$current_archive"
      run_checked \
        "the current overview could not upgrade the published overview" \
        kpackagetool6 --type=KWin/Effect --upgrade "$current_overview_archive"
      request_kwin_reconfigure
      package_is_listed \
        || fail_test "KPackage did not list the upgraded package"
      overview_package_is_listed \
        || fail_test "KPackage did not list the upgraded overview"
      [[ "$(installed_version)" == "$current_version" ]] \
        || fail_test "the upgraded metadata did not change"
      [[ "$(installed_plugin_id)" == "$plugin_id" ]] \
        || fail_test "the upgraded package ID changed"
      installed_package_has_content_addressed_layout "$current_version" \
        || fail_test "the upgraded bootstrap, selector, or hashed runtime is missing"
      current_runtime_digest=$(runtime_digest) \
        || fail_test "the current runtime could not be hashed"
      [[ "$current_runtime_digest" == "$current_archive_runtime_digest" ]] \
        || fail_test "the installed current runtime did not match its archive"
      [[ "$(installed_config_default TouchpadNavigation)" == false ]] \
        || fail_test "the upgraded package enabled TouchpadNavigation by default"
      [[ "$(touchpad_navigation_override)" == missing ]] \
        || fail_test "the upgrade wrote a TouchpadNavigation override"
      [[ "$(overview_installed_version)" == "$current_overview_version" ]] \
        || fail_test "the upgraded overview metadata did not change"
      [[ "$(overview_installed_plugin_id)" == "$overview_plugin_id" ]] \
        || fail_test "the upgraded overview package ID changed"
      [[ "$(overview_installed_enabled_by_default)" == false ]] \
        || fail_test "the upgraded overview was enabled by default"
      installed_overview_has_content_addressed_layout "$current_overview_version" \
        || fail_test "the upgraded overview bootstrap, selector, or hashed runtime is missing"
      current_overview_runtime_digest=$(overview_runtime_digest) \
        || fail_test "the upgraded overview runtime could not be hashed"
      [[ "$current_overview_runtime_digest" == "$current_overview_archive_runtime_digest" ]] \
        || fail_test "the installed current overview runtime did not match its archive"
      wait_for_effect_available_state "$overview_plugin_id" true \
        || fail_test "KWin did not rediscover the upgraded overview"
      wait_for_effect_loaded_state "$overview_plugin_id" false \
        || fail_test "the overview was loaded by the upgrade"
      wait_for_shortcut_registration_state "$overview_shortcut" false \
        || fail_test "the disabled upgraded overview registered its action"
      wait_for_script_state false \
        || fail_test "the main script was loaded by the upgrade"
      progress "both packages upgraded to $current_version and retained disabled defaults"

      set_enabled true
      load_installed_script
      wait_for_shortcut_registration_state "$close_shortcut" true \
        || fail_test "the current runtime did not register the close-window action"
      progress "upgraded runtime loaded through the stable bootstrap"
      app_konsole_title="Driftile lifecycle Konsole application"
      app_kcalc_title="Driftile lifecycle Calculator application"
      start_test_konsole "$app_konsole_title" \
        || fail_test "the current runtime could not open Konsole"
      start_test_kcalc "$app_kcalc_title" \
        || fail_test "the current runtime could not open KDE Calculator"

      load_overview_effect
      wait_for_shortcut_registration_state "$overview_shortcut" true \
        || fail_test "the loaded overview did not register its action"
      overview_keys=$(shortcut_keys "$overview_shortcut" "$overview_shortcut_text") \
        || fail_test "KGlobalAccel did not expose the overview assignment"
      [[ "$overview_keys" == "[]" ]] \
        || fail_test "the upgrade changed the preserved unbound overview assignment: $overview_keys"
      wait_for_script_state true \
        || fail_test "loading the overview unloaded the current runtime"
      progress "current overview preserved the published unbound assignment"

      unload_overview_effect
      overview_keys=$(shortcut_keys "$overview_shortcut" "$overview_shortcut_text") \
        || fail_test "KGlobalAccel did not retain the unloaded overview action"
      [[ "$overview_keys" == "[]" ]] \
        || fail_test "unloading changed the preserved unbound overview assignment: $overview_keys"
      wait_for_script_state true \
        || fail_test "unloading the overview unloaded the current runtime"
      run_checked \
        "the current overview package could not be removed" \
        kpackagetool6 --type=KWin/Effect --remove "$overview_plugin_id"
      [[ ! -e "$installed_overview_package" ]] \
        || fail_test "the overview package remained after removal"
      if overview_package_is_listed; then
        fail_test "KPackage still listed the overview after removal"
      fi
      request_kwin_reconfigure
      wait_for_effect_available_state "$overview_plugin_id" false \
        || fail_test "KWin still listed the removed overview after reconfiguration"
      wait_for_effect_loaded_state "$overview_plugin_id" false \
        || fail_test "the overview was loaded after package removal"
      wait_for_script_state true \
        || fail_test "removing the overview unloaded the current runtime"
      progress "overview unload and removal preserved the current runtime"

      stop_process "$test_kcalc_pid" "$app_kcalc_title" \
        || fail_test "KDE Calculator did not close cleanly"
      test_kcalc_pid=""
      stop_process "$test_konsole_pid" "$app_konsole_title" \
        || fail_test "Konsole did not close cleanly"
      test_konsole_pid=""
      progress "current runtime opened and closed Konsole and KDE Calculator"

      set_enabled false
      unload_installed_script
      run_checked \
        "the current package could not be removed" \
        kpackagetool6 --type=KWin/Script --remove "$plugin_id"
      [[ ! -e "$installed_package" ]] \
        || fail_test "the user package remained after removal"
      if package_is_listed; then
        fail_test "KPackage still listed Driftile after removal"
      fi
      wait_for_script_state false \
        || fail_test "the script was loaded after package removal"

      post_remove_title="Driftile lifecycle post-remove Calculator"
      start_test_kcalc "$post_remove_title" \
        || fail_test "KDE Calculator could not open after package removal"
      stop_process "$test_kcalc_pid" "$post_remove_title" \
        || fail_test "the post-removal KDE Calculator did not close"
      test_kcalc_pid=""
      progress "package removal confirmed and KWin remains usable"
      write_result true
    '';
  };
  lifecycleLauncher = pkgs.writeShellApplication {
    name = "driftile-lifecycle-launcher";
    runtimeInputs = [ pkgs.kdePackages.konsole ];
    text = ''
      exec konsole \
        --separate \
        --builtin-profile \
        --hide-menubar \
        --hide-tabbar \
        --notransparency \
        --qwindowtitle "Driftile release lifecycle" \
        -p "tabtitle=Driftile release lifecycle" \
        -p "LocalTabTitleFormat=Driftile release lifecycle" \
        -p "RemoteTabTitleFormat=Driftile release lifecycle" \
        -e ${lifecycleCheck}/bin/driftile-lifecycle-check
    '';
  };
  screenLockerConfig = pkgs.writeText "driftile-lifecycle-kscreenlockerrc" ''
    [Daemon]
    Autolock=false
    LockOnResume=false
    LockOnStart=false
    RequirePassword=false
    Timeout=0
  '';
  powerDevilConfig = pkgs.writeText "driftile-lifecycle-powerdevilrc" ''
    [AC][Display]
    DimDisplayIdleTimeoutSec=-1
    DimDisplayWhenIdle=false
    TurnOffDisplayIdleTimeoutSec=-1
    TurnOffDisplayWhenIdle=false

    [AC][SuspendAndShutdown]
    AutoSuspendAction=0
    AutoSuspendIdleTimeoutSec=-1

    [Battery][Display]
    DimDisplayIdleTimeoutSec=-1
    DimDisplayWhenIdle=false
    TurnOffDisplayIdleTimeoutSec=-1
    TurnOffDisplayWhenIdle=false

    [Battery][SuspendAndShutdown]
    AutoSuspendAction=0
    AutoSuspendIdleTimeoutSec=-1

    [LowBattery][Display]
    DimDisplayIdleTimeoutSec=-1
    DimDisplayWhenIdle=false
    TurnOffDisplayIdleTimeoutSec=-1
    TurnOffDisplayWhenIdle=false

    [LowBattery][SuspendAndShutdown]
    AutoSuspendAction=0
    AutoSuspendIdleTimeoutSec=-1
  '';
in
assert currentVersion != publishedVersion;
assert currentOverviewVersion == currentVersion;
{
  networking.hostName = "driftile-vm-lifecycle";
  system.stateVersion = "26.05";
  system.switch.enable = false;

  boot.loader.grub.devices = [ "/dev/vda" ];
  fileSystems."/" = {
    device = "/dev/disk/by-label/nixos";
    fsType = "ext4";
  };

  users.allowNoPasswordLogin = true;
  users.mutableUsers = false;
  users.users.driftile = {
    createHome = true;
    extraGroups = [
      "input"
      "video"
    ];
    initialHashedPassword = "";
    isNormalUser = true;
  };

  services.logind.settings.Login = {
    HandleHibernateKey = "ignore";
    HandleLidSwitch = "ignore";
    HandleSuspendKey = "ignore";
    IdleAction = "ignore";
  };

  systemd.sleep.settings.Sleep = {
    AllowHibernation = false;
    AllowHybridSleep = false;
    AllowSuspend = false;
    AllowSuspendThenHibernate = false;
  };

  services.xserver.enable = true;
  services.desktopManager.plasma6.enable = true;
  services.displayManager = {
    autoLogin = {
      enable = true;
      user = "driftile";
    };
    defaultSession = "plasma";
    plasma-login-manager.enable = true;
  };

  environment.systemPackages = [ lifecycleLauncher ];

  system.activationScripts.driftileLifecycleUserConfig = {
    deps = [ "users" ];
    text = ''
      ${pkgs.coreutils}/bin/install \
        -d -m 0700 -o driftile -g users \
        /home/driftile/.config
      ${pkgs.coreutils}/bin/install \
        -m 0600 -o driftile -g users \
        ${screenLockerConfig} \
        /home/driftile/.config/kscreenlockerrc
      ${pkgs.coreutils}/bin/install \
        -m 0600 -o driftile -g users \
        ${powerDevilConfig} \
        /home/driftile/.config/powerdevilrc
    '';
  };

  environment.etc."xdg/autostart/${pluginId}-lifecycle.desktop".text = ''
    [Desktop Entry]
    Type=Application
    Name=Driftile release lifecycle
    Exec=${lifecycleLauncher}/bin/driftile-lifecycle-launcher
    OnlyShowIn=KDE;
    X-KDE-autostart-after=panel
  '';

  virtualisation.vmVariant.virtualisation = {
    cores = 8;
    diskImage = null;
    graphics = true;
    memorySize = 8192;
    resolution = {
      x = 1366;
      y = 768;
    };
    restrictNetwork = true;
    qemu = {
      forceAccel = true;
      options = [
        "-display gtk,gl=off"
        "-vga none"
        "-device virtio-gpu-pci,xres=1366,yres=768"
      ];
    };
  };
}
