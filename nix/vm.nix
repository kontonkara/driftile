{
  pkgs,
  self,
  ...
}:

let
  pluginId = "io.github.kontonkara.driftile";
  floatingNavigationProbe = ../tools/vm/floating-navigation-probe.js;
  firefoxPage = pkgs.writeText "driftile-vm-firefox.html" ''
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Driftile VM Firefox</title>
      </head>
      <body>
        <h1>Driftile Firefox acceptance window</h1>
      </body>
    </html>
  '';
  firefoxPreferences = pkgs.writeText "driftile-vm-firefox-user.js" ''
    user_pref("app.normandy.enabled", false);
    user_pref("app.shield.optoutstudies.enabled", false);
    user_pref("app.update.auto", false);
    user_pref("browser.newtabpage.enabled", false);
    user_pref("browser.shell.checkDefaultBrowser", false);
    user_pref("browser.startup.firstrunSkipsHomepage", true);
    user_pref("browser.startup.homepage_override.mstone", "ignore");
    user_pref("browser.startup.page", 0);
    user_pref("datareporting.healthreport.uploadEnabled", false);
    user_pref("datareporting.policy.dataSubmissionEnabled", false);
    user_pref("extensions.update.enabled", false);
    user_pref("network.captive-portal-service.enabled", false);
    user_pref("network.connectivity-service.enabled", false);
    user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
  '';
  demo = pkgs.writeShellApplication {
    name = "driftile-demo";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gnugrep
      pkgs.jq
      pkgs.kdotool
      pkgs.kdePackages.libkscreen
      pkgs.kdePackages.konsole
      pkgs.systemd
      pkgs.xmessage
      pkgs.xprop
    ];
    text = ''
      floating_navigation_probe_id="io.github.kontonkara.driftile.vm-floating-navigation"

      window_match_id() {
        local title=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$title" 2>/dev/null \
          | jq --exit-status --raw-output --arg title "$title" '
            [
              .data[0][]
              | select(.[1] == $title)
            ] as $matches
            | select($matches | length == 1)
            | $matches[0][0]
          '
      }

      window_id() {
        local match_id

        match_id=$(window_match_id "$1") || return 1
        printf '%s' "''${match_id#*_}"
      }

      window_action_match_id() {
        local action=$2
        local title=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$title $action" 2>/dev/null \
          | jq --exit-status --raw-output --arg title "$title" '
            [
              .data[0][]
              | select(.[1] == $title)
            ] as $matches
            | select($matches | length == 1)
            | $matches[0][0]
          '
      }

      run_window_action() {
        local match_id

        match_id=$(window_action_match_id "$1" "$2") || return 1
        busctl --user call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Run \
          ss "$match_id" "" \
          >/dev/null
      }

      wait_for_window() {
        local attempt
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if window_match_id "$title" >/dev/null; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_window_gone() {
        local attempt
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if ! window_match_id "$title" >/dev/null 2>&1; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      arrange_floating_navigation_windows() {
        local load_result
        local script_id
        local unload_result

        busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$floating_navigation_probe_id" \
          >/dev/null 2>&1 || true

        load_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          loadScript \
          ss ${floatingNavigationProbe} "$floating_navigation_probe_id" \
          2>/dev/null) || return 1

        if [[ ! "$load_result" =~ ^i\ ([0-9]+)$ ]]; then
          return 1
        fi

        script_id=''${BASH_REMATCH[1]}
        busctl --user call \
          org.kde.KWin \
          "/Scripting/Script$script_id" \
          org.kde.kwin.Script \
          run \
          >/dev/null || return 1

        unload_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$floating_navigation_probe_id" \
          2>/dev/null) || return 1

        [[ "$unload_result" == "b true" ]]
      }

      activate_window() {
        local match_id

        match_id=$(window_match_id "$1") || return 1
        busctl --user call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Run \
          ss "$match_id" "" \
          >/dev/null
      }

      active_window_caption() {
        kdotool getactivewindow getwindowname 2>/dev/null
      }

      window_is_active() {
        local active_title
        local title=$1

        active_title=$(active_window_caption) || return 1
        [[ "$active_title" == "$title" ]]
      }

      wait_for_active() {
        local attempt
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if window_is_active "$title"; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      window_is_active_contains() {
        local caption
        local needle=$1

        caption=$(active_window_caption) || return 1
        [[ "$caption" == *"$needle"* ]]
      }

      wait_for_active_contains() {
        local attempt
        local needle=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if window_is_active_contains "$needle"; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      window_match_id_contains() {
        local needle=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$needle" 2>/dev/null \
          | jq --exit-status --raw-output --arg needle "$needle" '
            [
              .data[0][]
              | select(.[1] | contains($needle))
            ]
            | unique_by(.[0])
            | select(length == 1)
            | .[0][0]
          '
      }

      window_action_match_id_contains() {
        local action=$2
        local needle=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$needle $action" 2>/dev/null \
          | jq --exit-status --raw-output --arg needle "$needle" '
            [
              .data[0][]
              | select(.[1] | contains($needle))
            ]
            | unique_by(.[0])
            | select(length == 1)
            | .[0][0]
          '
      }

      run_window_action_contains() {
        local match_id

        match_id=$(window_action_match_id_contains "$1" "$2") || return 1
        busctl --user call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Run \
          ss "$match_id" "" \
          >/dev/null
      }

      window_id_contains() {
        local match_id

        match_id=$(window_match_id_contains "$1") || return 1
        printf '%s' "''${match_id#*_}"
      }

      window_info_contains() {
        local id

        id=$(window_id_contains "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null
      }

      window_caption_contains() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output '
              .data[0].caption.data
              | select(type == "string" and length > 0)
            '
      }

      wait_for_window_caption() {
        local result_variable=$1
        local needle=$2
        local attempt
        local current_caption
        local previous_caption=""
        local stable_samples=0

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current_caption=$(window_caption_contains "$needle" 2>/dev/null || true)

          if [[ -n "$current_caption" && "$current_caption" == "$previous_caption" ]]; then
            stable_samples=$((stable_samples + 1))
          else
            previous_caption=$current_caption
            stable_samples=1
          fi

          if [[ -n "$current_caption" && "$stable_samples" -ge 2 ]]; then
            printf -v "$result_variable" '%s' "$current_caption"
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      start_konsole_window() {
        local pid_variable=$1
        local title_variable=$2
        local base_title=$3
        local process_pid
        local resolved_title

        QT_QPA_PLATFORM=wayland \
          ${pkgs.kdePackages.konsole}/bin/konsole \
          --separate \
          --builtin-profile \
          --hide-menubar \
          --hide-tabbar \
          --notransparency \
          --qwindowtitle "$base_title" \
          -p "tabtitle=$base_title" \
          -p "LocalTabTitleFormat=$base_title" \
          -p "RemoteTabTitleFormat=$base_title" \
          -e ${pkgs.coreutils}/bin/sleep 480 \
          >>/tmp/driftile-vm-konsole.log 2>&1 &
        process_pid=$!
        printf -v "$pid_variable" '%s' "$process_pid"

        if ! wait_for_window_caption resolved_title "$base_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        if ! real_window_is_normal "$resolved_title" \
          || ! real_window_identity_matches "$resolved_title" konsole \
          || ! real_window_protocol_matches "$resolved_title" konsole false \
          || ! wait_for_real_window_borderless "$resolved_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        printf -v "$title_variable" '%s' "$resolved_title"
      }

      start_firefox_window() {
        local pid_variable=$1
        local title_variable=$2
        local profile_variable=$3
        local base_title=$4
        local process_pid
        local profile_directory
        local resolved_title

        printf -v "$pid_variable" '%s' ""
        printf -v "$profile_variable" '%s' ""
        profile_directory=$(mktemp -d -t driftile-firefox.XXXXXXXXXX) || return 1

        if ! cp ${firefoxPreferences} "$profile_directory/user.js"; then
          rm -rf -- "$profile_directory"
          return 1
        fi

        printf -v "$profile_variable" '%s' "$profile_directory"
        env \
          MOZ_CRASHREPORTER_DISABLE=1 \
          MOZ_DATA_REPORTING=0 \
          MOZ_ENABLE_WAYLAND=1 \
          ${pkgs.firefox}/bin/firefox \
          --new-instance \
          --no-remote \
          --profile "$profile_directory" \
          --new-window "file://${firefoxPage}" \
          >>/tmp/driftile-vm-firefox.log 2>&1 &
        process_pid=$!
        printf -v "$pid_variable" '%s' "$process_pid"

        if ! wait_for_window_caption resolved_title "$base_title" \
          || ! real_window_is_normal "$resolved_title" \
          || ! real_window_identity_matches "$resolved_title" firefox \
          || ! real_window_protocol_matches "$resolved_title" firefox false \
          || ! wait_for_real_window_borderless "$resolved_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""

          if wait_for_window_gone_contains "$base_title"; then
            if rm -rf -- "$profile_directory"; then
              printf -v "$profile_variable" '%s' ""
            fi
          fi

          return 1
        fi

        printf -v "$title_variable" '%s' "$resolved_title"
      }

      start_kcalc_window() {
        local pid_variable=$1
        local title_variable=$2
        local base_title=$3
        local process_pid
        local resolved_title

        printf -v "$pid_variable" '%s' ""
        env QT_QPA_PLATFORM=wayland \
          ${pkgs.kdePackages.kcalc}/bin/kcalc \
          --qwindowtitle "$base_title" \
          >>/tmp/driftile-vm-kcalc.log 2>&1 &
        process_pid=$!
        printf -v "$pid_variable" '%s' "$process_pid"

        if ! wait_for_window_caption resolved_title "$base_title" \
          || ! real_window_is_normal "$resolved_title" \
          || ! real_window_identity_matches "$resolved_title" kcalc \
          || ! real_window_protocol_matches "$resolved_title" kcalc false \
          || ! wait_for_real_window_borderless "$resolved_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        printf -v "$title_variable" '%s' "$resolved_title"
      }

      start_xterm_window() {
        local pid_variable=$1
        local title_variable=$2
        local base_title=$3
        local process_pid
        local resolved_title

        printf -v "$pid_variable" '%s' ""
        DISPLAY="''${DISPLAY:-:0}" \
          ${pkgs.xterm}/bin/xterm \
          -T "$base_title" \
          -class DriftileXTerm \
          -e ${pkgs.coreutils}/bin/sleep 300 \
          >>/tmp/driftile-vm-xterm.log 2>&1 &
        process_pid=$!
        printf -v "$pid_variable" '%s' "$process_pid"

        if ! wait_for_window_caption resolved_title "$base_title" \
          || ! real_window_is_normal "$resolved_title" \
          || ! real_window_identity_matches "$resolved_title" xterm \
          || ! real_window_protocol_matches "$resolved_title" xterm true \
          || ! wait_for_real_window_borderless "$resolved_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        printf -v "$title_variable" '%s' "$resolved_title"
      }

      start_fixed_xmessage_window() {
        local pid_variable=$1
        local title_variable=$2
        local base_title=$3
        local process_pid
        local resolved_title

        DISPLAY="''${DISPLAY:-:0}" \
          ${pkgs.xmessage}/bin/xmessage \
          -title "$base_title" \
          -geometry 360x240 \
          -xrm '*minWidth: 360' \
          -xrm '*maxWidth: 360' \
          -xrm '*minHeight: 240' \
          -xrm '*maxHeight: 240' \
          "$base_title" \
          >>/tmp/driftile-vm-xmessage.log 2>&1 &
        process_pid=$!
        printf -v "$pid_variable" '%s' "$process_pid"

        if ! wait_for_window_caption resolved_title "$base_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        if ! real_window_is_normal "$resolved_title" \
          || ! real_window_identity_matches "$resolved_title" xmessage \
          || ! real_window_protocol_matches "$resolved_title" xmessage true \
          || ! wait_for_real_window_borderless "$resolved_title"; then
          terminate_process "$process_pid"
          printf -v "$pid_variable" '%s' ""
          return 1
        fi

        printf -v "$title_variable" '%s' "$resolved_title"
      }

      wait_for_window_query() {
        local result_variable=$1
        shift
        local attempt
        local query

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          for query in "$@"; do
            if window_match_id_contains "$query" >/dev/null; then
              printf -v "$result_variable" '%s' "$query"
              return 0
            fi
          done

          sleep 0.1
        done

        return 1
      }

      wait_for_window_gone_contains() {
        local attempt
        local query=$1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if ! window_match_id_contains "$query" >/dev/null 2>&1; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      virtual_desktop_count() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          desktops 2>/dev/null \
          | jq --exit-status --raw-output '.data | length'
      }

      virtual_desktop_id() {
        local index=$1

        busctl --user --json=short get-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          desktops 2>/dev/null \
          | jq --exit-status --raw-output \
            --argjson index "$index" \
            '.data | sort_by(.[0]) | .[$index][1]'
      }

      virtual_desktop_sequence() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          desktops 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data | sort_by(.[0]) | map(.[1]) | join(" ")'
      }

      wait_for_desktop_sequence() {
        local attempt
        local expected="$*"
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(virtual_desktop_sequence 2>/dev/null || true)" == "$expected" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_appended_desktop() {
        local result_variable=$1
        shift
        local attempt
        local candidate=""
        local count
        local expected_count
        local prefix="$*"
        local sequence
        local stable_candidate=""
        local stable_samples=0

        expected_count=$(($# + 1))

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          count=$(virtual_desktop_count 2>/dev/null || true)
          sequence=$(virtual_desktop_sequence 2>/dev/null || true)
          candidate=""

          if [[ "$count" == "$expected_count" && "$sequence" == "$prefix "* ]]; then
            candidate=$(virtual_desktop_id "$#" 2>/dev/null || true)

            if [[ "$sequence" != "$prefix $candidate" ]]; then
              candidate=""
            fi
          fi

          if [[ -n "$candidate" && "$candidate" == "$stable_candidate" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ -n "$candidate" ]]; then
            stable_candidate=$candidate
            stable_samples=1
          else
            stable_candidate=""
            stable_samples=0
          fi

          if ((stable_samples >= 2)); then
            printf -v "$result_variable" '%s' "$stable_candidate"
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      current_desktop_id() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          current 2>/dev/null \
          | jq --exit-status --raw-output '.data'
      }

      wait_for_current_desktop() {
        local attempt
        local expected=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(current_desktop_id 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      set_current_desktop() {
        local desktop=$1

        busctl --user set-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          current \
          s "$desktop" \
          >/dev/null \
          && wait_for_current_desktop "$desktop"
      }

      prepare_test_desktops() {
        local attempt

        [[ "$(virtual_desktop_count 2>/dev/null || true)" == 1 ]] || return 1
        primary_desktop_id=$(virtual_desktop_id 0) || return 1
        busctl --user call \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          createDesktop \
          us 1 "Driftile Test Desktop" \
          >/dev/null || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(virtual_desktop_count 2>/dev/null || true)" == 2 ]]; then
            secondary_desktop_id=$(virtual_desktop_id 1) || return 1
            break
          fi

          sleep 0.1
        done

        [[ -n "$secondary_desktop_id" ]] || return 1
        set_current_desktop "$primary_desktop_id"
      }

      window_is_on_desktop() {
        local expected=$2
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status \
            --arg expected "$expected" \
            '.data[0].desktops.data == [$expected]' \
            >/dev/null
      }

      wait_for_window_desktop() {
        local attempt
        local expected=$2
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if window_is_on_desktop "$title" "$expected"; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_shortcuts() {
        local attempt
        local shortcuts

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          shortcuts=$(busctl --user call \
            org.kde.kglobalaccel \
            /component/kwin \
            org.kde.kglobalaccel.Component \
            shortcutNames 2>/dev/null || true)

          if [[ "$shortcuts" == *"driftile_focus_column_left"* \
            && "$shortcuts" == *"driftile_focus_column_right"* \
            && "$shortcuts" == *"driftile_focus_column_first"* \
            && "$shortcuts" == *"driftile_focus_column_last"* \
            && "$shortcuts" == *"driftile_focus_window_up"* \
            && "$shortcuts" == *"driftile_focus_window_down"* \
            && "$shortcuts" == *"driftile_move_column_left"* \
            && "$shortcuts" == *"driftile_move_column_right"* \
            && "$shortcuts" == *"driftile_move_column_to_first"* \
            && "$shortcuts" == *"driftile_move_column_to_last"* \
            && "$shortcuts" == *"driftile_move_window_left"* \
            && "$shortcuts" == *"driftile_move_window_right"* \
            && "$shortcuts" == *"driftile_move_window_up"* \
            && "$shortcuts" == *"driftile_move_window_down"* \
            && "$shortcuts" == *"driftile_consume_window_into_column"* \
            && "$shortcuts" == *"driftile_expel_window_from_column"* \
            && "$shortcuts" == *"driftile_focus_previous_desktop"* \
            && "$shortcuts" == *"driftile_focus_next_desktop"* \
            && "$shortcuts" == *"driftile_focus_next_desktop_page_down"* \
            && "$shortcuts" == *"driftile_move_desktop_down"* \
            && "$shortcuts" == *"driftile_move_desktop_down_page_down"* \
            && "$shortcuts" == *"driftile_move_desktop_up"* \
            && "$shortcuts" == *"driftile_move_desktop_up_page_up"* \
            && "$shortcuts" == *"driftile_focus_desktop_1"* \
            && "$shortcuts" == *"driftile_focus_desktop_9"* \
            && "$shortcuts" == *"driftile_focus_output_left"* \
            && "$shortcuts" == *"driftile_focus_output_right"* \
            && "$shortcuts" == *"driftile_focus_output_up"* \
            && "$shortcuts" == *"driftile_focus_output_down"* \
            && "$shortcuts" == *"driftile_move_column_to_previous_desktop"* \
            && "$shortcuts" == *"driftile_move_column_to_next_desktop"* \
            && "$shortcuts" == *"driftile_move_column_to_desktop_2"* \
            && "$shortcuts" == *"driftile_move_column_to_desktop_9"* \
            && "$shortcuts" == *"driftile_move_column_to_output_left"* \
            && "$shortcuts" == *"driftile_move_column_to_output_right"* \
            && "$shortcuts" == *"driftile_move_column_to_output_up"* \
            && "$shortcuts" == *"driftile_move_column_to_output_down"* \
            && "$shortcuts" == *"driftile_move_window_to_previous_desktop"* \
            && "$shortcuts" == *"driftile_move_window_to_next_desktop"* \
            && "$shortcuts" == *"driftile_move_window_to_output_left"* \
            && "$shortcuts" == *"driftile_move_window_to_output_right"* \
            && "$shortcuts" == *"driftile_move_window_to_output_up"* \
            && "$shortcuts" == *"driftile_move_window_to_output_down"* \
            && "$shortcuts" == *"driftile_insert_window_into_stack_left"* \
            && "$shortcuts" == *"driftile_insert_window_into_stack_right"* \
            && "$shortcuts" == *"driftile_toggle_floating"* \
            && "$shortcuts" == *"driftile_switch_focus_between_floating_and_tiling"* \
            && "$shortcuts" == *"driftile_toggle_fullscreen"* \
            && "$shortcuts" == *"driftile_maximize_window_to_edges"* \
            && "$shortcuts" == *"driftile_decrease_column_width"* \
            && "$shortcuts" == *"driftile_increase_column_width"* \
            && "$shortcuts" == *"driftile_switch_preset_column_width"* \
            && "$shortcuts" == *"driftile_switch_preset_column_width_back"* \
            && "$shortcuts" == *"driftile_decrease_window_height"* \
            && "$shortcuts" == *"driftile_increase_window_height"* \
            && "$shortcuts" == *"driftile_switch_preset_window_height"* \
            && "$shortcuts" == *"driftile_switch_preset_window_height_back"* \
            && "$shortcuts" == *"driftile_reset_window_height"* \
            && "$shortcuts" == *"driftile_maximize_column"* \
            && "$shortcuts" == *"driftile_expand_column_to_available_width"* \
            && "$shortcuts" == *"driftile_center_column"* \
            && "$shortcuts" == *"driftile_center_visible_columns"* \
            && "$shortcuts" == *"driftile_reset_column_width"* ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      window_frame_x() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data[0].x.data | select(type == "number") | round | tostring'
      }

      frames_match_leftward_reveal() {
        local before_first=$1
        local after_first=$2
        local before_second=$3
        local after_second=$4
        local before_target=$5
        local after_target=$6
        local output_width=$7
        local before_first_x before_first_y before_first_width before_first_height
        local after_first_x after_first_y after_first_width after_first_height
        local before_second_x before_second_y before_second_width before_second_height
        local after_second_x after_second_y after_second_width after_second_height
        local before_target_x before_target_y before_target_width before_target_height
        local after_target_x after_target_y after_target_width after_target_height
        local delta
        local frame

        for frame in \
          "$before_first" "$after_first" \
          "$before_second" "$after_second" \
          "$before_target" "$after_target"; do
          [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
        done

        IFS=, read -r before_first_x before_first_y before_first_width before_first_height <<< "$before_first"
        IFS=, read -r after_first_x after_first_y after_first_width after_first_height <<< "$after_first"
        IFS=, read -r before_second_x before_second_y before_second_width before_second_height <<< "$before_second"
        IFS=, read -r after_second_x after_second_y after_second_width after_second_height <<< "$after_second"
        IFS=, read -r before_target_x before_target_y before_target_width before_target_height <<< "$before_target"
        IFS=, read -r after_target_x after_target_y after_target_width after_target_height <<< "$after_target"
        delta=$((after_first_x - before_first_x))

        ((
          delta < 0 &&
            after_second_x - before_second_x == delta &&
            after_target_x - before_target_x == delta &&
            before_first_y == after_first_y &&
            before_first_width == after_first_width &&
            before_first_height == after_first_height &&
            before_second_y == after_second_y &&
            before_second_width == after_second_width &&
            before_second_height == after_second_height &&
            before_target_y == after_target_y &&
            before_target_width == after_target_width &&
            before_target_height == after_target_height &&
            before_target_x + before_target_width > output_width &&
            after_target_x >= 0 &&
            after_target_x + after_target_width <= output_width
        ))
      }

      frames_share_horizontal_translation() {
        local before
        local after
        local before_x before_y before_width before_height
        local after_x after_y after_width after_height
        local delta=""

        (($# > 0 && $# % 2 == 0)) || return 1

        while (($# > 0)); do
          before=$1
          after=$2
          shift 2

          [[ "$before" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
          [[ "$after" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
          IFS=, read -r before_x before_y before_width before_height <<< "$before"
          IFS=, read -r after_x after_y after_width after_height <<< "$after"

          if [[ -z "$delta" ]]; then
            delta=$((after_x - before_x))
          fi

          ((
            after_x - before_x == delta &&
              before_y == after_y &&
              before_width == after_width &&
              before_height == after_height
          )) || return 1
        done
      }

      window_frame_width() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data[0].width.data | select(type == "number") | round | tostring'
      }

      window_frame() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output '
            .data[0] as $window
            | [
                $window.x.data,
                $window.y.data,
                $window.width.data,
                $window.height.data
              ]
            | select(map(type == "number") | all)
            | map(round | tostring)
              | join(",")
          '
      }

      wait_for_named_frames() {
        local attempt
        local current
        local index
        local matches
        local -a pairs=("$@")
        local stable_samples=0

        if (( ''${#pairs[@]} == 0 || ''${#pairs[@]} % 2 != 0 )); then
          return 1
        fi

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          matches=true

          for ((index = 0; index < ''${#pairs[@]}; index += 2)); do
            current=$(window_frame "''${pairs[index]}" 2>/dev/null || true)

            if [[ "$current" != "''${pairs[index + 1]}" ]]; then
              matches=false
              break
            fi
          done

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      window_minimized_state() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output '
            .data[0].minimized.data
            | select(type == "boolean")
            | tostring
          '
      }

      window_minimized_state_contains() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output '
            .data[0].minimized.data
            | select(type == "boolean")
            | tostring
          '
      }

      wait_for_window_minimized_state() {
        local attempt
        local expected=$2
        local title=$1
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_minimized_state "$title" 2>/dev/null || true)" == "$expected" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_window_minimized_state_contains() {
        local attempt
        local expected=$2
        local query=$1
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_minimized_state_contains "$query" 2>/dev/null || true)" == "$expected" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      set_external_window_minimized() {
        local expected=$2
        local title=$1

        if [[ "$(window_minimized_state "$title" 2>/dev/null || true)" != "$expected" ]]; then
          run_window_action "$title" minimize || return 1
        fi

        wait_for_window_minimized_state "$title" "$expected"
      }

      set_external_window_minimized_contains() {
        local expected=$2
        local query=$1

        if [[ "$(window_minimized_state_contains "$query" 2>/dev/null || true)" != "$expected" ]]; then
          run_window_action_contains "$query" minimize || return 1
        fi

        wait_for_window_minimized_state_contains "$query" "$expected"
      }

      set_gap() {
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key Gap \
          --type int \
          "$1" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_layout_configuration() {
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key DefaultColumnWidthPercent \
          --type int \
          "$1" \
          || return 1
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ColumnWidthStepPercent \
          --type int \
          "$2" \
          || return 1
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key Gap \
          --type int \
          "$3" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      restore_layout_configuration() {
        set_layout_configuration 50 10 16
      }

      window_fullscreen_state() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output '
            .data[0].fullscreen.data
            | select(type == "boolean")
            | tostring
          '
      }

      window_is_normal() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status '.data[0].type.data == 0' >/dev/null
      }

      wait_for_window_fullscreen_state() {
        local attempt
        local expected=$2
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_fullscreen_state "$title" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      window_maximized_state() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output '
            [
              .data[0].maximizeHorizontal.data,
              .data[0].maximizeVertical.data
            ]
            | select(map(type == "number") | all)
            | if all(. == 0) then
                "false"
              elif all(. != 0) then
                "true"
              else
                "partial"
              end
          '
      }

      wait_for_window_maximized_state() {
        local attempt
        local expected=$2
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_maximized_state "$title" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_window_native_state() {
        local title=$1
        local state=$2
        local expected=$3

        case "$state" in
          fullscreen)
            wait_for_window_fullscreen_state "$title" "$expected"
            ;;
          maximized)
            wait_for_window_maximized_state "$title" "$expected"
            ;;
          *)
            return 2
            ;;
        esac
      }

      single_enabled_output_frame() {
        kscreen-doctor -j 2>/dev/null \
          | jq --exit-status --raw-output '
            [.outputs[] | select(.enabled)]
            | select(length == 1)
            | .[0] as $output
            | ($output.scale // 1) as $scale
            | select(($scale | type) == "number" and $scale > 0)
            | [
                $output.pos.x,
                $output.pos.y,
                ($output.size.width / $scale),
                ($output.size.height / $scale)
              ]
            | select(map(type == "number") | all)
            | map(round | tostring)
            | join(",")
          '
      }

      maximized_work_area_frame() {
        local baseline=$1
        local baseline_height
        local baseline_y
        local output=$2
        local output_height
        local output_width
        local output_x
        local output_y
        local tiled_gap
        local work_area_height
        local work_area_y

        frame_is_valid "$baseline" && frame_is_valid "$output" || return 1
        IFS=, read -r _ baseline_y _ baseline_height <<< "$baseline"
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output"
        tiled_gap=$((baseline_y - output_y))
        work_area_y=$((baseline_y - tiled_gap))
        work_area_height=$((baseline_height + (2 * tiled_gap)))

        if ((tiled_gap <= 0 \
          || work_area_y < output_y \
          || work_area_y + work_area_height > output_y + output_height)); then
          return 1
        fi

        printf '%s,%s,%s,%s' \
          "$output_x" \
          "$work_area_y" \
          "$output_width" \
          "$work_area_height"
      }

      window_frame_contains() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output '
            .data[0] as $window
            | [
                $window.x.data,
                $window.y.data,
                $window.width.data,
                $window.height.data
              ]
            | select(map(type == "number") | all)
            | map(round | tostring)
            | join(",")
          '
      }

      wait_for_window_frame_contains() {
        local attempt
        local expected=$2
        local query=$1
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_frame_contains "$query" 2>/dev/null || true)" == "$expected" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      window_frame_width_contains() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output \
            '.data[0].width.data | select(type == "number") | round | tostring'
      }

      real_window_identity_matches() {
        local expected=$2

        window_info_contains "$1" \
          | jq --exit-status --arg expected "$expected" '
            .data[0] as $window
            | [
                $window.resourceClass.data?,
                $window.resourceName.data?,
                $window.desktopFile.data?
              ]
            | map(select(type == "string" and length > 0) | ascii_downcase)
            | (length > 0 and any(.[]; contains($expected)))
          ' >/dev/null
      }

      real_window_is_normal() {
        window_info_contains "$1" \
          | jq --exit-status '.data[0].type.data == 0' >/dev/null
      }

      x11_window_match_count() {
        local client_list
        local display="''${DISPLAY:-:0}"
        local expected_identity=$2
        local id
        local matches=0
        local class_properties
        local query=$1
        local title_properties

        client_list=$(
          xprop -display "$display" -root _NET_CLIENT_LIST 2>/dev/null
        ) || return 1

        while IFS= read -r id; do
          [[ -n "$id" ]] || continue
          title_properties=$(
            xprop -display "$display" -id "$id" \
              _NET_WM_NAME WM_NAME 2>/dev/null \
              || true
          )
          class_properties=$(
            xprop -display "$display" -id "$id" WM_CLASS 2>/dev/null \
              || true
          )

          if [[ "$title_properties" == *"$query"* ]] \
            && grep --fixed-strings --ignore-case --quiet \
              -- "$expected_identity" <<< "$class_properties"; then
            matches=$((matches + 1))
          fi
        done < <(
          grep --only-matching --extended-regexp \
            '0x[0-9a-fA-F]+' <<< "$client_list" \
            || true
        )

        printf '%s' "$matches"
      }

      x11_window_resize_policy() {
        local client_list
        local display="''${DISPLAY:-:0}"
        local expected_identity=$2
        local id
        local matched_id=""
        local class_properties
        local query=$1
        local title_properties
        local hints
        local hint
        local increments=""
        local base_size=""

        client_list=$(
          xprop -display "$display" -root _NET_CLIENT_LIST 2>/dev/null
        ) || return 1

        while IFS= read -r id; do
          [[ -n "$id" ]] || continue
          title_properties=$(
            xprop -display "$display" -id "$id" \
              _NET_WM_NAME WM_NAME 2>/dev/null \
              || true
          )
          class_properties=$(
            xprop -display "$display" -id "$id" WM_CLASS 2>/dev/null \
              || true
          )

          if [[ "$title_properties" == *"$query"* ]] \
            && grep --fixed-strings --ignore-case --quiet \
              -- "$expected_identity" <<< "$class_properties"; then
            [[ -z "$matched_id" ]] || return 1
            matched_id=$id
          fi
        done < <(
          grep --only-matching --extended-regexp \
            '0x[0-9a-fA-F]+' <<< "$client_list" \
            || true
        )

        [[ -n "$matched_id" ]] || return 1
        hints=$(
          LC_ALL=C xprop -display "$display" -id "$matched_id" \
            WM_NORMAL_HINTS 2>/dev/null
        ) || return 1

        while IFS= read -r hint; do
          if [[ "$hint" =~ program[[:space:]]specified[[:space:]]resize[[:space:]]increment:[[:space:]]([0-9]+)[[:space:]]by[[:space:]]([0-9]+) ]]; then
            increments="''${BASH_REMATCH[1]},''${BASH_REMATCH[2]}"
          elif [[ "$hint" =~ program[[:space:]]specified[[:space:]]base[[:space:]]size:[[:space:]]([0-9]+)[[:space:]]by[[:space:]]([0-9]+) ]]; then
            base_size="''${BASH_REMATCH[1]},''${BASH_REMATCH[2]}"
          fi
        done <<< "$hints"

        [[ "$increments" =~ ^[0-9]+,[0-9]+$ ]] || return 1
        [[ "$base_size" =~ ^[0-9]+,[0-9]+$ ]] || return 1
        printf '%s,%s' "$increments" "$base_size"
      }

      resize_policy_is_nontrivial() {
        local policy=$1
        local increment_width
        local increment_height
        local base_width
        local base_height

        [[ "$policy" =~ ^[0-9]+,[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
        IFS=, read -r \
          increment_width increment_height base_width base_height \
          <<< "$policy"

        ((
          increment_width > 1 &&
            increment_height > 1 &&
            base_width > 0 &&
            base_height > 0
        ))
      }

      frame_is_off_resize_lattice() {
        local frame=$1
        local policy=$2
        local width
        local height
        local increment_width
        local increment_height
        local base_width
        local base_height

        [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
        resize_policy_is_nontrivial "$policy" || return 1
        IFS=, read -r _ _ width height <<< "$frame"
        IFS=, read -r \
          increment_width increment_height base_width base_height \
          <<< "$policy"

        ((width > 0 && height > 0)) || return 1
        (((width - base_width) % increment_width != 0)) || \
          (((height - base_height) % increment_height != 0))
      }

      real_window_protocol_matches() {
        local attempt
        local expected_x11=$3
        local matches
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          matches=$(x11_window_match_count "$1" "$2") || return 1

          if { [[ "$expected_x11" == true ]] && ((matches == 1)); } \
            || { [[ "$expected_x11" == false ]] && ((matches == 0)); }; then
            stable_samples=$((stable_samples + 1))
          else
            stable_samples=0
          fi

          if ((stable_samples >= 3)); then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      real_window_border_state() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output '
            .data[0].noBorder.data? as $noBorder
            | if ($noBorder | type) == "boolean" then
                ($noBorder | tostring)
              else
                "unavailable"
              end
          '
      }

      wait_for_real_window_borderless() {
        local attempt
        local state

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          state=$(real_window_border_state "$1" 2>/dev/null) || {
            sleep 0.1
            continue
          }

          if [[ "$state" == true ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      window_frame_respects_fixed_client() {
        local client_height=$3
        local client_width=$2
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status \
            --argjson clientWidth "$client_width" \
            --argjson clientHeight "$client_height" '
              .data[0] as $window
              | ($window.type.data == 0)
                and ($window.width.data >= $clientWidth)
                and ($window.height.data >= $clientHeight)
                and (
                  ($window.noBorder.data == true)
                  or ($window.width.data > $clientWidth)
                  or ($window.height.data > $clientHeight)
                )
            ' >/dev/null
      }

      frame_is_valid() {
        [[ "$1" =~ ^-?[0-9]+,-?[0-9]+,[1-9][0-9]*,[1-9][0-9]*$ ]]
      }

      capture_stable_window_frame() {
        local attempt
        local current
        local previous=""
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current=$(window_frame "$1" 2>/dev/null || true)

          if frame_is_valid "$current" && [[ "$current" == "$previous" ]]; then
            stable_samples=$((stable_samples + 1))
          elif frame_is_valid "$current"; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous=$current

          if ((stable_samples >= 2)); then
            printf '%s' "$current"
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      capture_stable_window_frame_contains() {
        local attempt
        local current
        local previous=""
        local query=$1
        local stable_samples=0

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current=$(window_frame_contains "$query" 2>/dev/null || true)

          if frame_is_valid "$current" && [[ "$current" == "$previous" ]]; then
            stable_samples=$((stable_samples + 1))
          elif frame_is_valid "$current"; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous=$current

          if ((stable_samples >= 2)); then
            printf '%s' "$current"
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      verify_xterm_resize_increment_policy() {
        local query=$1
        local attempt
        local candidate_policy
        local policy=""
        local frame

        if ! wait_for_real_window_borderless "$query"; then
          return 1
        fi

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          candidate_policy=$(
            x11_window_resize_policy "$query" xterm 2>/dev/null \
              || true
          )

          if resize_policy_is_nontrivial "$candidate_policy"; then
            policy=$candidate_policy
            break
          fi

          sleep 0.1
        done

        [[ -n "$policy" ]] || return 1
        frame=$(capture_stable_window_frame_contains "$query") || return 1
        frame_is_off_resize_lattice "$frame" "$policy" || return 1

        {
          printf '\n[XWayland terminal resize-increment policy]\n'
          printf 'frame: %s\n' "$frame"
          printf 'resize increment and base size: %s\n' "$policy"
        } >> /tmp/shared/driftile-focus-diagnostics
      }

      capture_stable_frames() {
        local attempt
        local current_first
        local current_second
        local current_third
        local previous_first=""
        local previous_second=""
        local previous_third=""
        local required_samples=''${1:-2}
        local stable_samples=0

        [[ "$required_samples" =~ ^[1-9][0-9]*$ ]] || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            if [[ "$current_first" == "$previous_first" \
              && "$current_second" == "$previous_second" \
              && "$current_third" == "$previous_third" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_samples=1
            fi

            previous_first=$current_first
            previous_second=$current_second
            previous_third=$current_third

            if ((stable_samples >= required_samples)); then
              stable_first_frame=$current_first
              stable_second_frame=$current_second
              stable_third_frame=$current_third
              return 0
            fi
          else
            stable_samples=0
            previous_first=""
            previous_second=""
            previous_third=""
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_frames() {
        local attempt
        local current_first
        local current_second
        local current_third
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)

          if [[ "$current_first" == "$1" \
            && "$current_second" == "$2" \
            && "$current_third" == "$3" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_numbered_desktop_frames() {
        local attempt
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_frame "$title_a" 2>/dev/null || true)" == "$1" \
            && "$(window_frame "$title_b" 2>/dev/null || true)" == "$2" \
            && "$(window_frame "$title_c" 2>/dev/null || true)" == "$3" \
            && "$(window_frame "$title_desktop_destination" 2>/dev/null || true)" == "$4" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_automatic_floating_frames() {
        local attempt
        local current_first
        local current_fixed
        local current_second
        local current_third
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_fixed=$(window_frame "$4" 2>/dev/null || true)

          if [[ "$current_first" == "$1" \
            && "$current_second" == "$2" \
            && "$current_third" == "$3" \
            && "$current_fixed" == "$5" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_desktop_destination_layout() {
        local attempt
        local current_destination
        local current_first
        local current_layout
        local current_second
        local current_third
        local destination_height
        local destination_width
        local destination_x
        local destination_y
        local matches
        local previous_layout=""
        local second_height
        local second_width
        local second_x
        local second_y
        local source_first=$2
        local source_third=$3
        local source_width=$1
        local stable_samples=0

        frame_is_valid "$source_first" && frame_is_valid "$source_third" || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_destination=$(window_frame "$title_desktop_destination" 2>/dev/null || true)
          current_layout="$current_first|$current_second|$current_third|$current_destination"
          matches=false

          if [[ "$current_first" == "$source_first" \
            && "$current_third" == "$source_third" ]] \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_destination"; then
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r \
              destination_x \
              destination_y \
              destination_width \
              destination_height \
              <<< "$current_destination"

            if ((second_y == destination_y \
              && second_width == source_width \
              && second_height == destination_height \
              && destination_x + destination_width < second_x)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true && "$current_layout" == "$previous_layout" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ "$matches" == true ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous_layout=$current_layout

          if ((stable_samples >= 2)); then
            desktop_detached_first_frame=$current_first
            desktop_detached_third_frame=$current_third
            desktop_destination_frame=$current_destination
            desktop_moved_frame=$current_second
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_desktop_destination_frames() {
        local attempt
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(window_frame "$title_a" 2>/dev/null || true)" == "$3" \
            && "$(window_frame "$title_b" 2>/dev/null || true)" == "$2" \
            && "$(window_frame "$title_c" 2>/dev/null || true)" == "$4" \
            && "$(window_frame "$title_desktop_destination" 2>/dev/null || true)" == "$1" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_desktop_source_layout() {
        local attempt
        local current_first
        local current_layout
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local matches
        local previous_layout=""
        local second_height
        local second_width
        local second_x
        local second_y
        local source_third=$2
        local source_third_height
        local source_third_width
        local source_third_y
        local source_width=$1
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$source_third" || return 1
        IFS=, read -r \
          _ \
          source_third_y \
          source_third_width \
          source_third_height \
          <<< "$source_third"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_layout="$current_first|$current_second|$current_third"
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"

            if ((first_y == second_y \
              && second_y == third_y \
              && first_height == second_height \
              && second_height == third_height \
              && first_width == source_width \
              && second_width == source_width \
              && third_y == source_third_y \
              && third_width == source_third_width \
              && third_height == source_third_height \
              && first_x + first_width < second_x \
              && second_x + second_width < third_x)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true && "$current_layout" == "$previous_layout" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ "$matches" == true ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous_layout=$current_layout

          if ((stable_samples >= 2)); then
            desktop_return_first_frame=$current_first
            desktop_return_second_frame=$current_second
            desktop_return_third_frame=$current_third
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_four_frames() {
        local attempt
        local current_first
        local current_fourth
        local current_second
        local current_third
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_fourth=$(window_frame "$title_d" 2>/dev/null || true)

          if [[ "$current_first" == "$1" \
            && "$current_second" == "$2" \
            && "$current_third" == "$3" \
            && "$current_fourth" == "$4" ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_direct_insertion_source() {
        local attempt
        local current_first
        local current_fourth
        local current_layout
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local fourth_height
        local fourth_width
        local fourth_x
        local fourth_y
        local matches
        local previous_layout=""
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_fourth=$(window_frame "$title_d" 2>/dev/null || true)
          current_layout="$current_first|$current_second|$current_third|$current_fourth"
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third" \
            && frame_is_valid "$current_fourth"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            IFS=, read -r fourth_x fourth_y fourth_width fourth_height \
              <<< "$current_fourth"

            if ((first_x == second_x \
              && first_width == second_width \
              && first_y == third_y \
              && third_y == fourth_y \
              && second_y + second_height == third_y + third_height \
              && third_width == fourth_width \
              && third_height == fourth_height \
              && first_y + first_height < second_y \
              && first_x + first_width < third_x \
              && third_x + third_width < fourth_x)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true && "$current_layout" == "$previous_layout" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ "$matches" == true ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous_layout=$current_layout

          if ((stable_samples >= 2)); then
            direct_target_width=$first_width
            direct_reference_y=$third_y
            direct_reference_width=$third_width
            direct_reference_height=$third_height
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_direct_stack_layout_with_retained_peers() {
        local retained_first=$1
        local retained_second=$2
        local attempt
        local current_first
        local current_fourth
        local current_layout
        local current_second
        local current_third
        local fourth_height
        local fourth_width
        local fourth_x
        local fourth_y
        local matches
        local previous_layout=""
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$retained_first" \
          && frame_is_valid "$retained_second" \
          || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_fourth=$(window_frame "$title_d" 2>/dev/null || true)
          current_layout="$current_first|$current_second|$current_third|$current_fourth"
          matches=false

          if [[ "$current_first" == "$retained_first" \
            && "$current_second" == "$retained_second" ]] \
            && frame_is_valid "$current_third" \
            && frame_is_valid "$current_fourth"; then
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            IFS=, read -r fourth_x fourth_y fourth_width fourth_height \
              <<< "$current_fourth"

            if ((fourth_width == direct_target_width \
              && fourth_y > direct_reference_y \
              && fourth_y + fourth_height \
                == direct_reference_y + direct_reference_height \
              && fourth_x + fourth_width < third_x \
              && third_y == direct_reference_y \
              && third_width == direct_reference_width \
              && third_height == direct_reference_height)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true && "$current_layout" == "$previous_layout" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ "$matches" == true ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous_layout=$current_layout

          if ((stable_samples >= 2)); then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_direct_stack_layout() {
        local attempt
        local current_first
        local current_fourth
        local current_layout
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local fourth_height
        local fourth_width
        local fourth_x
        local fourth_y
        local matches
        local previous_layout=""
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          current_fourth=$(window_frame "$title_d" 2>/dev/null || true)
          current_layout="$current_first|$current_second|$current_third|$current_fourth"
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third" \
            && frame_is_valid "$current_fourth"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            IFS=, read -r fourth_x fourth_y fourth_width fourth_height \
              <<< "$current_fourth"

            if ((first_x == second_x \
              && second_x == fourth_x \
              && first_width == direct_target_width \
              && second_width == direct_target_width \
              && fourth_width == direct_target_width \
              && first_y == direct_reference_y \
              && fourth_y + fourth_height \
                == direct_reference_y + direct_reference_height \
              && first_y + first_height < second_y \
              && second_y + second_height < fourth_y \
              && first_x + first_width < third_x \
              && third_y == direct_reference_y \
              && third_width == direct_reference_width \
              && third_height == direct_reference_height)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true && "$current_layout" == "$previous_layout" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ "$matches" == true ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous_layout=$current_layout

          if ((stable_samples >= 2)); then
            direct_first_frame=$current_first
            direct_second_frame=$current_second
            direct_third_frame=$current_third
            direct_fourth_frame=$current_fourth
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_stack_layout() {
        local attempt
        local baseline_first=$2
        local baseline_third=$3
        local baseline_first_height
        local baseline_first_width
        local baseline_first_y
        local baseline_third_height
        local baseline_third_width
        local baseline_third_y
        local current_first
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local matches
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_third" \
          || return 1
        IFS=, read -r \
          _ \
          baseline_first_y \
          baseline_first_width \
          baseline_first_height \
          <<< "$baseline_first"
        IFS=, read -r \
          _ \
          baseline_third_y \
          baseline_third_width \
          baseline_third_height \
          <<< "$baseline_third"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"

            if ((first_x == second_x \
              && first_width == baseline_first_width \
              && second_width == baseline_first_width \
              && first_x + first_width < third_x \
              && third_y == baseline_third_y \
              && third_width == baseline_third_width \
              && third_height == baseline_third_height)); then
              case "$1" in
                first-above-second)
                  ((first_y == baseline_first_y \
                    && first_y + first_height < second_y \
                    && second_y + second_height \
                      == baseline_first_y + baseline_first_height)) \
                    && matches=true
                  ;;
                second-above-first)
                  ((second_y == baseline_first_y \
                    && second_y + second_height < first_y \
                    && first_y + first_height \
                      == baseline_first_y + baseline_first_height)) \
                    && matches=true
                  ;;
                *)
                  return 1
                  ;;
              esac
            fi
          fi

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_singleton_layout() {
        local attempt
        local current_first
        local current_second
        local current_third
        local expected_first_height
        local expected_first_width
        local expected_first_y
        local expected_second_height
        local expected_second_width
        local expected_second_y
        local expected_third_height
        local expected_third_width
        local expected_third_y
        local first_height
        local first_width
        local first_x
        local first_y
        local first_gap
        local gap_difference
        local matches
        local second_height
        local second_width
        local second_x
        local second_y
        local second_gap
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$1" && frame_is_valid "$2" && frame_is_valid "$3" \
          || return 1
        IFS=, read -r \
          _ \
          expected_first_y \
          expected_first_width \
          expected_first_height \
          <<< "$1"
        IFS=, read -r \
          _ \
          expected_second_y \
          expected_second_width \
          expected_second_height \
          <<< "$2"
        IFS=, read -r \
          _ \
          expected_third_y \
          expected_third_width \
          expected_third_height \
          <<< "$3"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            first_gap=$((second_x - first_x - first_width))
            second_gap=$((third_x - second_x - second_width))
            gap_difference=$((first_gap - second_gap))

            if ((gap_difference < 0)); then
              gap_difference=$((-gap_difference))
            fi

            if ((first_y == expected_first_y \
              && first_width == expected_first_width \
              && first_height == expected_first_height \
              && second_y == expected_second_y \
              && second_width == expected_second_width \
              && second_height == expected_second_height \
              && third_y == expected_third_y \
              && third_width == expected_third_width \
              && third_height == expected_third_height \
              && first_gap > 0 \
              && second_gap > 0 \
              && gap_difference <= 1)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_floating_layout() {
        local attempt
        local current_first
        local current_gap
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local matches
        local previous_first=""
        local previous_second=""
        local previous_third=""
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y
        local expected_floating_second="''${4:-}"
        local tiled_first=$1
        local tiled_first_gap
        local tiled_first_height
        local tiled_first_width
        local tiled_first_x
        local tiled_first_y
        local tiled_second=$2
        local tiled_second_gap
        local tiled_second_width
        local tiled_second_x
        local tiled_third=$3
        local tiled_third_height
        local tiled_third_width
        local tiled_third_x
        local tiled_third_y

        frame_is_valid "$tiled_first" \
          && frame_is_valid "$tiled_second" \
          && frame_is_valid "$tiled_third" \
          || return 1
        IFS=, read -r \
          tiled_first_x \
          tiled_first_y \
          tiled_first_width \
          tiled_first_height \
          <<< "$tiled_first"
        IFS=, read -r tiled_second_x _ tiled_second_width _ \
          <<< "$tiled_second"
        IFS=, read -r \
          tiled_third_x \
          tiled_third_y \
          tiled_third_width \
          tiled_third_height \
          <<< "$tiled_third"
        tiled_first_gap=$((
          tiled_second_x - tiled_first_x - tiled_first_width
        ))
        tiled_second_gap=$((
          tiled_third_x - tiled_second_x - tiled_second_width
        ))

        ((tiled_first_gap > 0 \
          && tiled_second_gap >= tiled_first_gap - 1 \
          && tiled_second_gap <= tiled_first_gap + 1)) \
          || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            current_gap=$((third_x - first_x - first_width))

            if ((first_y == tiled_first_y \
              && first_width == tiled_first_width \
              && first_height == tiled_first_height \
              && third_y == tiled_third_y \
              && third_width == tiled_third_width \
              && third_height == tiled_third_height \
              && first_y == third_y \
              && first_width == third_width \
              && first_height == third_height \
              && current_gap >= tiled_first_gap - 1 \
              && current_gap <= tiled_first_gap + 1)) \
              && [[ "$current_first" != "$tiled_first" \
                || "$current_third" != "$tiled_third" ]] \
              && [[ -z "$expected_floating_second" \
                || "$current_second" == "$expected_floating_second" ]]; then
              matches=true
            fi
          fi

          if [[ "$matches" == true ]]; then
            if [[ "$current_first" == "$previous_first" \
              && "$current_second" == "$previous_second" \
              && "$current_third" == "$previous_third" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_samples=1
            fi

            previous_first=$current_first
            previous_second=$current_second
            previous_third=$current_third

            if ((stable_samples >= 2)); then
              stable_first_frame=$current_first
              stable_second_frame=$current_second
              stable_third_frame=$current_third
              return 0
            fi
          else
            stable_samples=0
            previous_first=""
            previous_second=""
            previous_third=""
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_layout() {
        local attempt
        local first_x
        local second_x
        local third_x

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          first_x=$(window_frame_x "$title_a" 2>/dev/null || true)
          second_x=$(window_frame_x "$title_b" 2>/dev/null || true)
          third_x=$(window_frame_x "$title_c" 2>/dev/null || true)

          if [[ "$first_x" == "$1" && "$second_x" == "$2" && "$third_x" == "$3" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      middle_width_matches() {
        local comparison=$1
        local expected_first=$2
        local reference_second=$3
        local expected_third=$4
        local first_width
        local second_width
        local third_width

        first_width=$(window_frame_width "$title_a" 2>/dev/null || true)
        second_width=$(window_frame_width "$title_b" 2>/dev/null || true)
        third_width=$(window_frame_width "$title_c" 2>/dev/null || true)

        [[ "$first_width" =~ ^[0-9]+$ \
          && "$second_width" =~ ^[0-9]+$ \
          && "$third_width" =~ ^[0-9]+$ ]] \
          && ((first_width == expected_first && third_width == expected_third)) \
          || return 1

        case "$comparison" in
          equal)
            ((second_width == reference_second))
            ;;
          greater)
            ((second_width > reference_second))
            ;;
          less)
            ((second_width < reference_second))
            ;;
          *)
            return 1
            ;;
        esac
      }

      wait_for_middle_width() {
        local attempt
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if middle_width_matches "$@"; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_available_width_expansion() {
        local baseline_first=$1
        local baseline_second=$2
        local baseline_third=$3
        local usable_left=$4
        local usable_right=$5
        local attempt
        local baseline_first_gap
        local baseline_first_height
        local baseline_first_width
        local baseline_first_x
        local baseline_first_y
        local baseline_second_gap
        local baseline_second_height
        local baseline_second_width
        local baseline_second_x
        local baseline_second_y
        local baseline_third_height
        local baseline_third_width
        local baseline_third_x
        local baseline_third_y
        local current_first
        local current_first_gap
        local current_second
        local current_second_gap
        local current_third
        local expected_second_width
        local first_height
        local first_width
        local first_x
        local first_y
        local left_difference
        local matches
        local right_difference
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_second" \
          && frame_is_valid "$baseline_third" \
          && [[ "$usable_left" =~ ^-?[0-9]+$ ]] \
          && [[ "$usable_right" =~ ^-?[0-9]+$ ]] \
          || return 1
        IFS=, read -r \
          baseline_first_x \
          baseline_first_y \
          baseline_first_width \
          baseline_first_height \
          <<< "$baseline_first"
        IFS=, read -r \
          baseline_second_x \
          baseline_second_y \
          baseline_second_width \
          baseline_second_height \
          <<< "$baseline_second"
        IFS=, read -r \
          baseline_third_x \
          baseline_third_y \
          baseline_third_width \
          baseline_third_height \
          <<< "$baseline_third"
        baseline_first_gap=$((
          baseline_second_x - baseline_first_x - baseline_first_width
        ))
        baseline_second_gap=$((
          baseline_third_x - baseline_second_x - baseline_second_width
        ))
        expected_second_width=$((
          usable_right \
            - usable_left \
            - baseline_third_width \
            - baseline_second_gap
        ))

        ((usable_right > usable_left \
          && baseline_first_gap > 0 \
          && baseline_second_gap > 0 \
          && expected_second_width > baseline_second_width)) \
          || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            current_first_gap=$((second_x - first_x - first_width))
            current_second_gap=$((third_x - second_x - second_width))
            left_difference=$((second_x - usable_left))
            right_difference=$((third_x + third_width - usable_right))

            ((left_difference < 0)) \
              && left_difference=$((-left_difference))
            ((right_difference < 0)) \
              && right_difference=$((-right_difference))

            if ((first_y == baseline_first_y \
              && first_width == baseline_first_width \
              && first_height == baseline_first_height \
              && second_y == baseline_second_y \
              && second_height == baseline_second_height \
              && third_y == baseline_third_y \
              && third_width == baseline_third_width \
              && third_height == baseline_third_height \
              && second_width >= expected_second_width - 1 \
              && second_width <= expected_second_width + 1 \
              && current_first_gap >= baseline_first_gap - 1 \
              && current_first_gap <= baseline_first_gap + 1 \
              && current_second_gap >= baseline_second_gap - 1 \
              && current_second_gap <= baseline_second_gap + 1 \
              && left_difference <= 1 \
              && right_difference <= 1)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_visible_group_centered() {
        local baseline_first=$1
        local baseline_second=$2
        local baseline_third=$3
        local usable_left=$4
        local usable_right=$5
        local attempt
        local baseline_first_gap
        local baseline_first_height
        local baseline_first_width
        local baseline_first_x
        local baseline_first_y
        local baseline_left_margin
        local baseline_margin_difference
        local baseline_right_margin
        local baseline_second_gap
        local baseline_second_height
        local baseline_second_width
        local baseline_second_x
        local baseline_second_y
        local baseline_third_height
        local baseline_third_width
        local baseline_third_x
        local baseline_third_y
        local current_first
        local current_first_gap
        local current_second
        local current_second_gap
        local current_third
        local delta_difference
        local first_delta
        local first_height
        local first_width
        local first_x
        local first_y
        local left_margin
        local margin_difference
        local matches
        local right_margin
        local second_delta
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0
        local third_delta
        local third_height
        local third_width
        local third_x
        local third_y

        frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_second" \
          && frame_is_valid "$baseline_third" \
          && [[ "$usable_left" =~ ^-?[0-9]+$ ]] \
          && [[ "$usable_right" =~ ^-?[0-9]+$ ]] \
          || return 1
        IFS=, read -r \
          baseline_first_x \
          baseline_first_y \
          baseline_first_width \
          baseline_first_height \
          <<< "$baseline_first"
        IFS=, read -r \
          baseline_second_x \
          baseline_second_y \
          baseline_second_width \
          baseline_second_height \
          <<< "$baseline_second"
        IFS=, read -r \
          baseline_third_x \
          baseline_third_y \
          baseline_third_width \
          baseline_third_height \
          <<< "$baseline_third"
        baseline_first_gap=$((
          baseline_second_x - baseline_first_x - baseline_first_width
        ))
        baseline_second_gap=$((
          baseline_third_x - baseline_second_x - baseline_second_width
        ))
        baseline_left_margin=$((baseline_second_x - usable_left))
        baseline_right_margin=$((
          usable_right - baseline_third_x - baseline_third_width
        ))
        baseline_margin_difference=$((
          baseline_left_margin - baseline_right_margin
        ))
        ((baseline_margin_difference < 0)) \
          && baseline_margin_difference=$((-baseline_margin_difference))

        ((usable_right > usable_left \
          && baseline_first_gap > 0 \
          && baseline_second_gap > 0 \
          && baseline_left_margin >= 0 \
          && baseline_right_margin >= 0 \
          && baseline_margin_difference > 1)) \
          || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && frame_is_valid "$current_third"; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            IFS=, read -r third_x third_y third_width third_height \
              <<< "$current_third"
            first_delta=$((first_x - baseline_first_x))
            second_delta=$((second_x - baseline_second_x))
            third_delta=$((third_x - baseline_third_x))
            current_first_gap=$((second_x - first_x - first_width))
            current_second_gap=$((third_x - second_x - second_width))
            left_margin=$((second_x - usable_left))
            right_margin=$((usable_right - third_x - third_width))
            margin_difference=$((left_margin - right_margin))
            delta_difference=$((first_delta - second_delta))

            ((margin_difference < 0)) \
              && margin_difference=$((-margin_difference))
            ((delta_difference < 0)) \
              && delta_difference=$((-delta_difference))

            if ((delta_difference <= 1)); then
              delta_difference=$((second_delta - third_delta))
              ((delta_difference < 0)) \
                && delta_difference=$((-delta_difference))
            fi

            if ((first_y == baseline_first_y \
              && first_width == baseline_first_width \
              && first_height == baseline_first_height \
              && second_y == baseline_second_y \
              && second_width == baseline_second_width \
              && second_height == baseline_second_height \
              && third_y == baseline_third_y \
              && third_width == baseline_third_width \
              && third_height == baseline_third_height \
              && current_first_gap >= baseline_first_gap - 1 \
              && current_first_gap <= baseline_first_gap + 1 \
              && current_second_gap >= baseline_second_gap - 1 \
              && current_second_gap <= baseline_second_gap + 1 \
              && delta_difference <= 1 \
              && second_delta != 0 \
              && left_margin >= 0 \
              && right_margin >= 0 \
              && margin_difference <= 1)); then
              matches=true
            fi
          fi

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_stacked_height_relation() {
        local relation=$1
        local baseline_first=$2
        local baseline_second=$3
        local baseline_third=$4
        local attempt
        local baseline_first_height
        local baseline_first_width
        local baseline_first_x
        local baseline_first_y
        local baseline_gap
        local baseline_second_height
        local baseline_second_width
        local baseline_second_x
        local baseline_second_y
        local current_first
        local current_gap
        local current_second
        local current_third
        local first_height
        local first_width
        local first_x
        local first_y
        local matches
        local second_height
        local second_width
        local second_x
        local second_y
        local stable_samples=0

        frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_second" \
          && frame_is_valid "$baseline_third" \
          || return 1
        IFS=, read -r \
          baseline_first_x \
          baseline_first_y \
          baseline_first_width \
          baseline_first_height \
          <<< "$baseline_first"
        IFS=, read -r \
          baseline_second_x \
          baseline_second_y \
          baseline_second_width \
          baseline_second_height \
          <<< "$baseline_second"
        baseline_gap=$((
          baseline_second_y - baseline_first_y - baseline_first_height
        ))

        ((baseline_gap > 0)) || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current_first=$(window_frame "$title_a" 2>/dev/null || true)
          current_second=$(window_frame "$title_b" 2>/dev/null || true)
          current_third=$(window_frame "$title_c" 2>/dev/null || true)
          matches=false

          if frame_is_valid "$current_first" \
            && frame_is_valid "$current_second" \
            && [[ "$current_third" == "$baseline_third" ]]; then
            IFS=, read -r first_x first_y first_width first_height \
              <<< "$current_first"
            IFS=, read -r second_x second_y second_width second_height \
              <<< "$current_second"
            current_gap=$((second_y - first_y - first_height))

            if ((first_x == baseline_first_x \
              && first_y == baseline_first_y \
              && first_width == baseline_first_width \
              && second_x == baseline_second_x \
              && second_width == baseline_second_width \
              && first_x == second_x \
              && current_gap == baseline_gap \
              && second_y + second_height \
                == baseline_second_y + baseline_second_height)); then
              case "$relation" in
                active-larger)
                  ((first_height < baseline_first_height \
                    && second_height > baseline_second_height)) \
                    && matches=true
                  ;;
                active-smaller)
                  ((first_height > baseline_first_height \
                    && second_height < baseline_second_height)) \
                    && matches=true
                  ;;
                *)
                  return 1
                  ;;
              esac
            fi
          fi

          if [[ "$matches" == true ]]; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      invoke_shortcut() {
        busctl --user call \
          org.kde.kglobalaccel \
          /component/kwin \
          org.kde.kglobalaccel.Component \
          invokeShortcut \
          s "$1" \
          >/dev/null
      }

      wait_for_shortcut_focus() {
        local attempt
        local sample
        local shortcut=$1
        local title=$2

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          if window_is_active "$title"; then
            return 0
          fi

          invoke_shortcut "$shortcut" || return 1

          for ((sample = 0; sample < 2; sample += 1)); do
            sleep 0.1

            if window_is_active "$title"; then
              return 0
            fi
          done
        done

        return 1
      }

      wait_for_shortcut_focus_contains() {
        local attempt
        local shortcut=$1
        local query=$2
        local sample

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          if window_is_active_contains "$query"; then
            return 0
          fi

          invoke_shortcut "$shortcut" || return 1

          for ((sample = 0; sample < 2; sample += 1)); do
            sleep 0.1

            if window_is_active_contains "$query"; then
              return 0
            fi
          done
        done

        return 1
      }

      named_frames_match_once() {
        local current

        (($# > 0 && $# % 2 == 0)) || return 1

        while (($# > 0)); do
          current=$(window_frame "$1" 2>/dev/null || true)
          [[ "$current" == "$2" ]] || return 1
          shift 2
        done
      }

      wait_for_shortcut_frames() {
        local attempt
        local sample
        local shortcut=$1
        local -a frame_pairs

        shift
        frame_pairs=("$@")

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          if named_frames_match_once "''${frame_pairs[@]}"; then
            wait_for_named_frames "''${frame_pairs[@]}"
            return
          fi

          invoke_shortcut "$shortcut" || return 1

          for ((sample = 0; sample < 2; sample += 1)); do
            sleep 0.1

            if named_frames_match_once "''${frame_pairs[@]}"; then
              wait_for_named_frames "''${frame_pairs[@]}"
              return
            fi
          done
        done

        return 1
      }

      wait_for_real_window_width() {
        local attempt
        local comparison=$2
        local current
        local query=$1
        local reference=$3
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current=$(window_frame_width_contains "$query" 2>/dev/null || true)

          if [[ "$current" =~ ^[1-9][0-9]*$ ]]; then
            case "$comparison" in
              equal)
                ((current == reference)) && stable_samples=$((stable_samples + 1)) \
                  || stable_samples=0
                ;;
              less)
                ((current < reference)) && stable_samples=$((stable_samples + 1)) \
                  || stable_samples=0
                ;;
              *)
                return 1
                ;;
            esac
          else
            stable_samples=0
          fi

          if ((stable_samples >= 2)); then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      record_real_application_state() {
        local border_state
        local label=$1
        local query=$2

        border_state=$(real_window_border_state "$query" 2>/dev/null || printf unavailable)

        {
          printf '\n[%s]\n' "$label"
          printf 'query: %s\n' "$query"
          printf 'frame: %s\n' \
            "$(window_frame_contains "$query" 2>/dev/null || printf missing)"
          printf 'borderless: %s\n' "$border_state"
          printf 'window info: '
          window_info_contains "$query" 2>/dev/null \
            | jq --compact-output '
                .data[0] as $window
                | {
                    caption: $window.caption.data?,
                    desktopFile: $window.desktopFile.data?,
                    minimized: $window.minimized.data?,
                    noBorder: $window.noBorder.data?,
                    resourceClass: $window.resourceClass.data?,
                    resourceName: $window.resourceName.data?,
                    type: $window.type.data?,
                    x11Client: $window.x11Client.data?,
                    xwayland: $window.xwayland.data?
                  }
              ' || true
        } >> /tmp/shared/driftile-focus-diagnostics
      }

      record_real_application_failure() {
        local expected_identity=$4
        local expected_x11=$5
        local label=$1
        local query=$2
        local step=$3
        local x11_matches

        x11_matches=$(
          x11_window_match_count "$query" "$expected_identity" 2>/dev/null \
            || printf unavailable
        )

        {
          printf '\n[%s acceptance failed]\n' "$label"
          printf 'step: %s\n' "$step"
          printf 'expected identity: %s\n' "$expected_identity"
          printf 'expected X11: %s\n' "$expected_x11"
          printf 'matching X11 windows: %s\n' "$x11_matches"
          printf 'active window: %s\n' \
            "$(active_window_caption 2>/dev/null || printf unavailable)"
        } >> /tmp/shared/driftile-focus-diagnostics
        record_real_application_state "$label acceptance state" "$query"
      }

      verify_real_application_window() {
        local expected_identity=$3
        local expected_x11=$4
        local frame
        local initial_width
        local label=$1
        local query=$2
        local tiled_first_frame
        local tiled_second_frame
        local tiled_third_frame

        if ! real_window_is_normal "$query"; then
          record_real_application_failure \
            "$label" "$query" "normal-window classification" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! real_window_identity_matches "$query" "$expected_identity"; then
          record_real_application_failure \
            "$label" "$query" identity "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! real_window_protocol_matches \
          "$query" "$expected_identity" "$expected_x11"; then
          record_real_application_failure \
            "$label" "$query" protocol "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_real_window_borderless "$query"; then
          record_real_application_failure \
            "$label" "$query" "borderless state" "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_shortcut_focus_contains \
            "driftile_focus_column_right" "$query"; then
          record_real_application_failure \
            "$label" "$query" "active state before minimize" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! frame=$(capture_stable_window_frame_contains "$query"); then
          record_real_application_failure \
            "$label" "$query" "stable frame" "$expected_identity" "$expected_x11"
          return 1
        fi
        IFS=, read -r _ _ initial_width _ <<< "$frame"
        if [[ ! "$initial_width" =~ ^[1-9][0-9]*$ ]]; then
          record_real_application_failure \
            "$label" "$query" "initial width" "$expected_identity" "$expected_x11"
          return 1
        fi

        tiled_first_frame=$(capture_stable_window_frame "$title_a") \
          || tiled_first_frame=""
        tiled_second_frame=$(capture_stable_window_frame "$title_b") \
          || tiled_second_frame=""
        tiled_third_frame=$(capture_stable_window_frame "$title_c") \
          || tiled_third_frame=""
        if [[ -z "$tiled_first_frame" \
          || -z "$tiled_second_frame" \
          || -z "$tiled_third_frame" ]]; then
          record_real_application_failure \
            "$label" "$query" "tiled baseline before minimize" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! set_external_window_minimized_contains "$query" true; then
          record_real_application_failure \
            "$label" "$query" "external minimize" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_window_frame_contains "$query" "$frame" \
          || ! wait_for_named_frames \
            "$title_a" "$tiled_first_frame" \
            "$title_b" "$tiled_second_frame" \
            "$title_c" "$tiled_third_frame" \
          || ! wait_for_window_minimized_state_contains "$query" true; then
          record_real_application_failure \
            "$label" "$query" "hidden slot while minimized" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_active "$title_c"; then
          record_real_application_failure \
            "$label" "$query" "focus fallback after minimize" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! set_external_window_minimized_contains "$query" false; then
          record_real_application_failure \
            "$label" "$query" "external restore" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_window_frame_contains "$query" "$frame" \
          || ! wait_for_named_frames \
            "$title_a" "$tiled_first_frame" \
            "$title_b" "$tiled_second_frame" \
            "$title_c" "$tiled_third_frame"; then
          record_real_application_failure \
            "$label" "$query" "exact frame after restore" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_shortcut_focus_contains \
            "driftile_focus_column_right" "$query"; then
          record_real_application_failure \
            "$label" "$query" "focus restored slot" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_decrease_column_width"; then
          record_real_application_failure \
            "$label" "$query" "decrease-width shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_real_window_width "$query" less "$initial_width"; then
          record_real_application_failure \
            "$label" "$query" "decreased width" "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_reset_column_width"; then
          record_real_application_failure \
            "$label" "$query" "reset-width shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_real_window_width "$query" equal "$initial_width"; then
          record_real_application_failure \
            "$label" "$query" "reset width" "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_focus_column_left"; then
          record_real_application_failure \
            "$label" "$query" "focus-left shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_active "$title_c"; then
          record_real_application_failure \
            "$label" "$query" "left focus target" "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_focus_column_right"; then
          record_real_application_failure \
            "$label" "$query" "focus-right shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_decrease_column_width"; then
          record_real_application_failure \
            "$label" "$query" "right-target resize shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_real_window_width "$query" less "$initial_width"; then
          record_real_application_failure \
            "$label" "$query" "right focus target" "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! invoke_shortcut "driftile_reset_column_width"; then
          record_real_application_failure \
            "$label" "$query" "final reset-width shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

        if ! wait_for_real_window_width "$query" equal "$initial_width"; then
          record_real_application_failure \
            "$label" "$query" "final reset width" "$expected_identity" "$expected_x11"
          return 1
        fi

        record_real_application_state "$label tiled, focused, and resized" "$query"
      }

      terminate_process() {
        local attempt
        local pid=$1
        local status

        kill "$pid" >/dev/null 2>&1 || true

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          if [[ -r "/proc/$pid/stat" ]]; then
            status=$(<"/proc/$pid/stat")
          else
            status=""
          fi

          if ! kill -0 "$pid" >/dev/null 2>&1 || [[ "$status" == *") Z "* ]]; then
            wait "$pid" >/dev/null 2>&1 || true
            return 0
          fi

          sleep 0.1
        done

        kill -KILL "$pid" >/dev/null 2>&1 || true
        wait "$pid" >/dev/null 2>&1 || true
      }

      cleanup_fourth_window() {
        local process_pid="''${fourth_window:-}"
        local profile_directory="''${fourth_window_profile:-}"

        if [[ -n "$process_pid" ]]; then
          terminate_process "$process_pid"
        fi
        fourth_window=""

        if [[ -n "$profile_directory" ]]; then
          if ! wait_for_window_gone_contains "$base_title_d"; then
            return 1
          fi

          if ! rm -rf -- "$profile_directory"; then
            return 1
          fi

          fourth_window_profile=""
        fi
      }

      cleanup_fifth_window() {
        local process_pid="''${fifth_window:-}"

        if [[ -n "$process_pid" ]]; then
          terminate_process "$process_pid"
        fi
        fifth_window=""
      }

      cleanup_desktop_window() {
        local process_pid="''${desktop_window:-}"

        if [[ -n "$process_pid" ]]; then
          terminate_process "$process_pid"
        fi
        desktop_window=""
      }

      cleanup_temporary_windows() {
        restore_layout_configuration >/dev/null 2>&1 || true
        cleanup_fourth_window || true
        cleanup_fifth_window
        cleanup_desktop_window
      }

      rebuild_direct_insertion_with_konsole() {
        local firefox_title=$title_d

        if ! cleanup_fourth_window \
          || ! wait_for_window_gone "$firefox_title" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c"; then
          return 1
        fi

        title_d=$base_title_d_konsole
        start_konsole_window \
          fourth_window \
          title_d \
          "$base_title_d_konsole" \
          && wait_for_window "$title_d" \
          && activate_window "$title_d" \
          && wait_for_active "$title_d" \
          && wait_for_direct_insertion_source \
          && invoke_shortcut "driftile_insert_window_into_stack_left" \
          && wait_for_direct_stack_layout \
          && wait_for_active "$title_d" \
          && invoke_shortcut "driftile_insert_window_into_stack_right" \
          && wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          && wait_for_active "$title_d"
      }

      close_real_application_and_restore() {
        local baseline_first=$3
        local baseline_second=$4
        local baseline_third=$5
        local pid=$2
        local query=$1

        terminate_process "$pid"

        if ! wait_for_window_gone_contains "$query"; then
          record_real_application_state \
            "real application window did not close" \
            "$query"
          return 1
        fi

        if ! activate_window "$title_c" || ! wait_for_active "$title_c"; then
          record_focus_state \
            "real application layout focus restoration failed"
          return 1
        fi

        if ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          record_focus_state \
            "real application layout restoration failed"
          {
            printf 'expected frame A: %s\n' "$baseline_first"
            printf 'expected frame B: %s\n' "$baseline_second"
            printf 'expected frame C: %s\n' "$baseline_third"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
      }

      record_focus_state() {
        local label=$1

        {
          printf '\n[%s]\n' "$label"
          printf 'shortcuts: '
          busctl --user call \
            org.kde.kglobalaccel \
            /component/kwin \
            org.kde.kglobalaccel.Component \
            shortcutNames 2>/dev/null \
            | grep -oE \
              'driftile_[a-z0-9_]+' \
            | sort -u \
            | tr '\n' ' ' || true
          printf '\nwindow A captions: '
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s "$title_a" 2>/dev/null \
            | jq --compact-output '[.data[0][] | .[1]]' || true
          printf 'window B captions: '
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s "$title_b" 2>/dev/null \
            | jq --compact-output '[.data[0][] | .[1]]' || true
          printf 'window C captions: '
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s "$title_c" 2>/dev/null \
            | jq --compact-output '[.data[0][] | .[1]]' || true
          printf 'window D captions: '
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s "$title_d" 2>/dev/null \
            | jq --compact-output '[.data[0][] | .[1]]' || true
          printf 'desktop destination captions: '
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s "$title_desktop_destination" 2>/dev/null \
            | jq --compact-output '[.data[0][] | .[1]]' || true
          printf 'current desktop: %s\n' \
            "$(current_desktop_id 2>/dev/null || printf missing)"
          printf 'frame x positions: A=%s B=%s C=%s D=%s destination=%s\n' \
            "$(window_frame_x "$title_a" 2>/dev/null || printf missing)" \
            "$(window_frame_x "$title_b" 2>/dev/null || printf missing)" \
            "$(window_frame_x "$title_c" 2>/dev/null || printf missing)" \
            "$(window_frame_x "$title_d" 2>/dev/null || printf missing)" \
            "$(window_frame_x "$title_desktop_destination" 2>/dev/null || printf missing)"
          printf 'frame widths: A=%s B=%s C=%s D=%s destination=%s\n' \
            "$(window_frame_width "$title_a" 2>/dev/null || printf missing)" \
            "$(window_frame_width "$title_b" 2>/dev/null || printf missing)" \
            "$(window_frame_width "$title_c" 2>/dev/null || printf missing)" \
            "$(window_frame_width "$title_d" 2>/dev/null || printf missing)" \
            "$(window_frame_width "$title_desktop_destination" 2>/dev/null || printf missing)"
          printf 'full frames (x,y,width,height): A=%s B=%s C=%s D=%s destination=%s\n' \
            "$(window_frame "$title_a" 2>/dev/null || printf missing)" \
            "$(window_frame "$title_b" 2>/dev/null || printf missing)" \
            "$(window_frame "$title_c" 2>/dev/null || printf missing)" \
            "$(window_frame "$title_d" 2>/dev/null || printf missing)" \
            "$(window_frame "$title_desktop_destination" 2>/dev/null || printf missing)"
        } >> /tmp/shared/driftile-focus-diagnostics
      }

      automatic_floating_shortcut_is_no_op() {
        invoke_shortcut "$1" \
          && wait_for_automatic_floating_frames "$3" "$4" "$5" "$2" "$6" \
          && wait_for_active "$2" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$2" "$primary_desktop_id"
      }

      verify_relation_free_automatic_desktop_transfer() {
        local fixed_frame=$2
        local fixed_title=$1
        local first_frame=$3
        local second_frame=$4
        local third_frame=$5
        local trailing_desktop_id=""

        invoke_shortcut "driftile_move_column_to_next_desktop" \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && wait_for_window_desktop "$fixed_title" "$secondary_desktop_id" \
          && wait_for_automatic_floating_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_title" \
            "$fixed_frame" \
          && wait_for_active "$fixed_title" \
          && wait_for_appended_desktop \
            trailing_desktop_id \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
          && [[ "$trailing_desktop_id" != "$secondary_desktop_id" ]] \
          && invoke_shortcut "driftile_move_column_to_desktop_1" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$fixed_title" "$primary_desktop_id" \
          && wait_for_automatic_floating_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_title" \
            "$fixed_frame" \
          && wait_for_active "$fixed_title" \
          && wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id"
      }

      verify_automatic_floating() {
        local first_frame
        local fixed_frame
        local fixed_base_title="$status - fixed-size automatic floating"
        local fixed_title="$fixed_base_title"
        local fixed_window=""
        local restored=false
        local second_frame
        local third_frame
        local verified=false

        capture_stable_frames || return 1
        first_frame=$stable_first_frame
        second_frame=$stable_second_frame
        third_frame=$stable_third_frame

        if start_fixed_xmessage_window \
          fixed_window \
          fixed_title \
          "$fixed_base_title" \
          && wait_for_window "$fixed_title" \
          && activate_window "$fixed_title" \
          && wait_for_active "$fixed_title" \
          && wait_for_real_window_borderless "$fixed_title" \
          && fixed_frame=$(capture_stable_window_frame "$fixed_title") \
          && window_frame_respects_fixed_client "$fixed_title" 360 240 \
          && wait_for_automatic_floating_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_title" \
            "$fixed_frame" \
          && automatic_floating_shortcut_is_no_op \
            "driftile_focus_column_left" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame" \
          && automatic_floating_shortcut_is_no_op \
            "driftile_move_window_left" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame" \
          && automatic_floating_shortcut_is_no_op \
            "driftile_toggle_floating" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame" \
          && verify_relation_free_automatic_desktop_transfer \
            "$fixed_title" \
            "$fixed_frame" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
          && automatic_floating_shortcut_is_no_op \
            "driftile_move_column_to_output_right" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame"; then
          verified=true
        fi

        [[ -z "$fixed_window" ]] || terminate_process "$fixed_window"

        if wait_for_window_gone "$fixed_title" \
          && set_current_desktop "$primary_desktop_id" \
          && activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_frames "$first_frame" "$second_frame" "$third_frame"; then
          restored=true
        fi

        [[ "$verified" == true && "$restored" == true ]]
      }

      capture_minimized_fixture_frames() {
        minimized_first_frame=$(capture_stable_window_frame "$title_a") \
          && minimized_middle_frame=$(capture_stable_window_frame "$title_b") \
          && minimized_last_frame=$(capture_stable_window_frame "$title_d") \
          && minimized_middle_column_frame=$(capture_stable_window_frame "$title_c") \
          && minimized_edge_frame=$(capture_stable_window_frame "$title_e")
      }

      wait_for_minimized_fixture_frames() {
        wait_for_named_frames \
          "$title_a" "$1" \
          "$title_b" "$2" \
          "$title_d" "$3" \
          "$title_c" "$4" \
          "$title_e" "$5"
      }

      run_minimized_slot_navigation_checks() {
        local boundary_edge
        local boundary_first
        local boundary_last
        local boundary_middle
        local boundary_middle_column
        local before_end_edge
        local before_end_first
        local before_end_last
        local before_end_middle
        local before_end_middle_column
        local restored_edge
        local restored_first
        local restored_last
        local restored_middle
        local restored_middle_column
        local baseline_first=$1
        local baseline_middle=$2
        local baseline_last=$3
        local baseline_middle_column=$4
        local baseline_edge=$5

        set_external_window_minimized "$title_b" true || return 1
        wait_for_minimized_fixture_frames \
          "$baseline_first" \
          "$baseline_middle" \
          "$baseline_last" \
          "$baseline_middle_column" \
          "$baseline_edge" \
          || return 1
        set_external_window_minimized "$title_c" true || return 1
        wait_for_minimized_fixture_frames \
          "$baseline_first" \
          "$baseline_middle" \
          "$baseline_last" \
          "$baseline_middle_column" \
          "$baseline_edge" \
          || return 1
        activate_window "$title_a" && wait_for_active "$title_a" || return 1
        invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_d" \
          && capture_minimized_fixture_frames \
          || return 1
        boundary_first=$minimized_first_frame
        boundary_middle=$minimized_middle_frame
        boundary_last=$minimized_last_frame
        boundary_middle_column=$minimized_middle_column_frame
        boundary_edge=$minimized_edge_frame
        invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_d" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        invoke_shortcut "driftile_focus_window_up" \
          && wait_for_active "$title_a" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          && invoke_shortcut "driftile_focus_window_up" \
          && wait_for_active "$title_a" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          && invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_d" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_e" \
          && capture_minimized_fixture_frames \
          || return 1
        boundary_first=$minimized_first_frame
        boundary_middle=$minimized_middle_frame
        boundary_last=$minimized_last_frame
        boundary_middle_column=$minimized_middle_column_frame
        boundary_edge=$minimized_edge_frame
        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_e" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_a" \
          && capture_minimized_fixture_frames \
          || return 1
        boundary_first=$minimized_first_frame
        boundary_middle=$minimized_middle_frame
        boundary_last=$minimized_last_frame
        boundary_middle_column=$minimized_middle_column_frame
        boundary_edge=$minimized_edge_frame
        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_a" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          && invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_d" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        set_external_window_minimized "$title_c" false || return 1
        set_external_window_minimized "$title_e" true || return 1
        wait_for_named_frames \
          "$title_a" "$boundary_first" \
          "$title_b" "$boundary_middle" \
          "$title_d" "$boundary_last" \
          "$title_e" "$boundary_edge" \
          || return 1
        capture_stable_window_frame "$title_c" >/dev/null || return 1
        activate_window "$title_d" && wait_for_active "$title_d" || return 1
        wait_for_shortcut_focus \
          "driftile_focus_column_right" "$title_c" \
          || return 1
        activate_window "$title_d" && wait_for_active "$title_d" || return 1
        capture_minimized_fixture_frames || return 1
        before_end_first=$minimized_first_frame
        before_end_middle=$minimized_middle_frame
        before_end_last=$minimized_last_frame
        before_end_middle_column=$minimized_middle_column_frame
        before_end_edge=$minimized_edge_frame
        invoke_shortcut "driftile_focus_column_last" \
          && wait_for_active "$title_c" \
          && capture_minimized_fixture_frames \
          || return 1
        boundary_first=$minimized_first_frame
        boundary_middle=$minimized_middle_frame
        boundary_last=$minimized_last_frame
        boundary_middle_column=$minimized_middle_column_frame
        boundary_edge=$minimized_edge_frame
        frames_match_leftward_reveal \
          "$before_end_first" "$boundary_first" \
          "$before_end_last" "$boundary_last" \
          "$before_end_middle_column" "$boundary_middle_column" \
          1680 \
          || return 1
        [[ "$boundary_middle" == "$before_end_middle" ]] || return 1
        [[ "$boundary_edge" == "$before_end_edge" ]] || return 1
        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && invoke_shortcut "driftile_focus_column_last" \
          && wait_for_active "$title_c" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        set_external_window_minimized "$title_a" true || return 1
        set_external_window_minimized "$title_d" true || return 1
        set_external_window_minimized "$title_e" false || return 1
        wait_for_named_frames \
          "$title_a" "$boundary_first" \
          "$title_b" "$boundary_middle" \
          "$title_d" "$boundary_last" \
          "$title_c" "$boundary_middle_column" \
          || return 1
        capture_stable_window_frame "$title_e" >/dev/null || return 1
        activate_window "$title_c" && wait_for_active "$title_c" || return 1
        wait_for_shortcut_focus \
          "driftile_focus_column_left" "$title_e" \
          || return 1
        activate_window "$title_c" && wait_for_active "$title_c" || return 1
        capture_minimized_fixture_frames || return 1
        invoke_shortcut "driftile_focus_column_first" \
          && wait_for_active "$title_e" \
          && capture_minimized_fixture_frames \
          || return 1
        boundary_first=$minimized_first_frame
        boundary_middle=$minimized_middle_frame
        boundary_last=$minimized_last_frame
        boundary_middle_column=$minimized_middle_column_frame
        boundary_edge=$minimized_edge_frame
        activate_window "$title_e" \
          && wait_for_active "$title_e" \
          && invoke_shortcut "driftile_focus_column_first" \
          && wait_for_active "$title_e" \
          && wait_for_minimized_fixture_frames \
            "$boundary_first" \
            "$boundary_middle" \
            "$boundary_last" \
            "$boundary_middle_column" \
            "$boundary_edge" \
          || return 1

        set_external_window_minimized "$title_a" false || return 1
        set_external_window_minimized "$title_b" false || return 1
        set_external_window_minimized "$title_d" false || return 1
        capture_stable_window_frame "$title_a" >/dev/null || return 1
        capture_stable_window_frame "$title_b" >/dev/null || return 1
        capture_stable_window_frame "$title_d" >/dev/null || return 1
        activate_window "$title_a" && wait_for_active "$title_a" || return 1
        capture_minimized_fixture_frames || return 1
        restored_first=$minimized_first_frame
        restored_middle=$minimized_middle_frame
        restored_last=$minimized_last_frame
        restored_middle_column=$minimized_middle_column_frame
        restored_edge=$minimized_edge_frame
        frames_share_horizontal_translation \
          "$baseline_first" "$restored_first" \
          "$baseline_middle" "$restored_middle" \
          "$baseline_last" "$restored_last" \
          "$baseline_middle_column" "$restored_middle_column" \
          "$baseline_edge" "$restored_edge" \
          || return 1
        invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_b" \
          && invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_d" \
          && invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_e" \
          && invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_c" \
          && invoke_shortcut "driftile_focus_column_first" \
          && wait_for_active "$title_a" \
          && wait_for_minimized_fixture_frames \
            "$restored_first" \
            "$restored_middle" \
            "$restored_last" \
            "$restored_middle_column" \
            "$restored_edge"
      }

      verify_minimized_slot_navigation() {
        local baseline_edge
        local baseline_first
        local baseline_last
        local baseline_middle
        local baseline_middle_column
        local centered_first
        local centered_fourth
        local centered_second
        local centered_third
        local direct_first_height
        local direct_first_width
        local direct_first_x
        local direct_first_y
        local direct_fourth_height
        local direct_fourth_width
        local direct_fourth_y
        local direct_second_height
        local direct_second_width
        local direct_second_y
        local direct_third_height
        local direct_third_width
        local direct_third_x
        local direct_third_y
        local fixture_gap
        local fixture_restored=false
        local verified=false

        if start_xterm_window \
          fifth_window \
          title_e \
          "$base_title_e" \
          && wait_for_window "$title_e" \
          && activate_window "$title_a" \
          && wait_for_active "$title_a" \
          && capture_minimized_fixture_frames; then
          baseline_first=$minimized_first_frame
          baseline_middle=$minimized_middle_frame
          baseline_last=$minimized_last_frame
          baseline_middle_column=$minimized_middle_column_frame
          baseline_edge=$minimized_edge_frame

          if run_minimized_slot_navigation_checks \
            "$baseline_first" \
            "$baseline_middle" \
            "$baseline_last" \
            "$baseline_middle_column" \
            "$baseline_edge"; then
            verified=true
          fi
        fi

        set_external_window_minimized "$title_a" false >/dev/null 2>&1 || true
        set_external_window_minimized "$title_b" false >/dev/null 2>&1 || true
        set_external_window_minimized "$title_c" false >/dev/null 2>&1 || true
        set_external_window_minimized "$title_d" false >/dev/null 2>&1 || true
        set_external_window_minimized "$title_e" false >/dev/null 2>&1 || true
        cleanup_fifth_window

        IFS=, read -r \
          direct_first_x direct_first_y direct_first_width direct_first_height \
          <<< "$direct_first_frame"
        IFS=, read -r \
          _ direct_second_y direct_second_width direct_second_height \
          <<< "$direct_second_frame"
        IFS=, read -r \
          direct_third_x direct_third_y direct_third_width direct_third_height \
          <<< "$direct_third_frame"
        IFS=, read -r \
          _ direct_fourth_y direct_fourth_width direct_fourth_height \
          <<< "$direct_fourth_frame"
        fixture_gap=$((direct_third_x - direct_first_x - direct_first_width))
        direct_first_x=$(((1680 - direct_first_width) / 2))
        centered_first="$direct_first_x,$direct_first_y,$direct_first_width,$direct_first_height"
        centered_second="$direct_first_x,$direct_second_y,$direct_second_width,$direct_second_height"
        centered_third="$((direct_first_x + direct_first_width + fixture_gap)),$direct_third_y,$direct_third_width,$direct_third_height"
        centered_fourth="$direct_first_x,$direct_fourth_y,$direct_fourth_width,$direct_fourth_height"

        if wait_for_window_gone "$title_e" \
          && activate_window "$title_d" \
          && wait_for_active "$title_d" \
          && wait_for_shortcut_frames \
            "driftile_center_column" \
            "$title_a" "$centered_first" \
            "$title_b" "$centered_second" \
            "$title_c" "$centered_third" \
            "$title_d" "$centered_fourth" \
          && wait_for_shortcut_focus \
            "driftile_focus_column_right" "$title_c" \
          && wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          && activate_window "$title_d" \
          && wait_for_active "$title_d"; then
          fixture_restored=true
        fi

        if [[ "$verified" != true || "$fixture_restored" != true ]]; then
          record_focus_state "minimized-slot navigation failed"
          return 1
        fi

        record_focus_state \
          "minimized slots preserved focus boundaries, order, and exact frames"
      }

      verify_physical_vertical_reorder_past_minimized_peer() {
        if ! activate_window "$title_a" \
          || ! wait_for_active "$title_a" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame"; then
          record_focus_state "physical minimized-peer reorder setup failed"
          return 1
        fi

        if ! set_external_window_minimized "$title_b" true \
          || ! wait_for_window_minimized_state "$title_b" true \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! activate_window "$title_a" \
          || ! wait_for_active "$title_a"; then
          record_focus_state "physical minimized-peer reorder settle failed"
          return 1
        fi

        if ! request_physical_shortcut ctrl-j \
          || ! wait_for_active "$title_a" \
          || ! wait_for_four_frames \
            "$direct_second_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_minimized_state "$title_b" true \
          || [[ "$(window_frame "$title_b" 2>/dev/null || true)" \
            != "$direct_second_frame" ]]; then
          record_focus_state "physical minimized-peer reorder failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+J reordered past a minimized peer without writing it"

        if ! set_external_window_minimized "$title_b" false \
          || ! wait_for_window_minimized_state "$title_b" false \
          || ! wait_for_four_frames \
            "$direct_second_frame" \
            "$direct_first_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! activate_window "$title_a" \
          || ! wait_for_active "$title_a"; then
          record_focus_state "physical minimized-peer reorder restore failed"
          return 1
        fi

        if ! request_physical_shortcut ctrl-k \
          || ! wait_for_active "$title_a" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame"; then
          record_focus_state "physical minimized-peer reorder reconstruction failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+K reconstructed the exact minimized-peer fixture"
      }

      verify_physical_horizontal_extraction_past_minimized_peer() {
        local direct_first_height
        local direct_first_width
        local direct_first_x
        local direct_first_y
        local direct_fourth_height
        local direct_fourth_width
        local direct_fourth_x
        local direct_fourth_y
        local direct_second_width
        local direct_second_x
        local direct_second_y
        local direct_third_height
        local direct_third_width
        local direct_third_x
        local direct_third_y
        local horizontal_gap
        local remaining_available_height
        local remaining_first_frame
        local remaining_first_height
        local remaining_last_frame
        local remaining_last_height
        local shifted_unrelated_frame
        local singleton_frame
        local stack_height
        local vertical_gap

        frame_is_valid "$direct_first_frame" \
          && frame_is_valid "$direct_second_frame" \
          && frame_is_valid "$direct_third_frame" \
          && frame_is_valid "$direct_fourth_frame" \
          || return 1
        IFS=, read -r \
          direct_first_x \
          direct_first_y \
          direct_first_width \
          direct_first_height \
          <<< "$direct_first_frame"
        IFS=, read -r \
          direct_second_x \
          direct_second_y \
          direct_second_width \
          _ \
          <<< "$direct_second_frame"
        IFS=, read -r \
          direct_third_x \
          direct_third_y \
          direct_third_width \
          direct_third_height \
          <<< "$direct_third_frame"
        IFS=, read -r \
          direct_fourth_x \
          direct_fourth_y \
          direct_fourth_width \
          direct_fourth_height \
          <<< "$direct_fourth_frame"
        vertical_gap=$((
          direct_second_y - direct_first_y - direct_first_height
        ))
        horizontal_gap=$((
          direct_third_x - direct_first_x - direct_first_width
        ))
        stack_height=$((
          direct_fourth_y + direct_fourth_height - direct_first_y
        ))
        remaining_available_height=$((stack_height - vertical_gap))
        remaining_first_height=$((remaining_available_height / 2))
        remaining_last_height=$((
          remaining_available_height - remaining_first_height
        ))
        printf -v remaining_first_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$remaining_first_height"
        printf -v remaining_last_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$((direct_first_y + remaining_first_height + vertical_gap))" \
          "$direct_first_width" \
          "$remaining_last_height"
        printf -v singleton_frame '%s,%s,%s,%s' \
          "$direct_third_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$stack_height"
        printf -v shifted_unrelated_frame '%s,%s,%s,%s' \
          "$((direct_third_x + direct_first_width + horizontal_gap))" \
          "$direct_third_y" \
          "$direct_third_width" \
          "$direct_third_height"

        if ((vertical_gap <= 0 \
          || horizontal_gap <= 0 \
          || remaining_first_height <= 0 \
          || remaining_last_height <= 0 \
          || direct_first_x != direct_second_x \
          || direct_second_x != direct_fourth_x \
          || direct_first_width != direct_second_width \
          || direct_second_width != direct_fourth_width)); then
          record_focus_state "physical horizontal extraction geometry was invalid"
          return 1
        fi

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame"; then
          record_focus_state "physical horizontal extraction setup failed"
          return 1
        fi

        if ! set_external_window_minimized "$title_d" true \
          || ! wait_for_window_minimized_state "$title_d" true \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical horizontal extraction peer settle failed"
          return 1
        fi

        if ! request_physical_shortcut bracket-right \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$remaining_first_frame" \
            "$singleton_frame" \
            "$shifted_unrelated_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_minimized_state "$title_d" true \
          || [[ "$(window_frame "$title_d" 2>/dev/null || true)" \
            != "$direct_fourth_frame" ]]; then
          record_focus_state "physical minimized-peer horizontal extraction failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+] extracted an immediate-right singleton past a minimized peer"

        if ! invoke_shortcut "driftile_move_window_left" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_fourth_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_minimized_state "$title_d" true \
          || ! invoke_shortcut "driftile_move_window_up" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_minimized_state "$title_d" true \
          || ! set_external_window_minimized "$title_d" false \
          || ! wait_for_window_minimized_state "$title_d" false \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame"; then
          record_focus_state "physical horizontal extraction fixture reconstruction failed"
          return 1
        fi
        record_focus_state \
          "horizontal extraction cleanup reconstructed the exact fixture"
      }

      verify_physical_consume_past_minimized_peers() {
        local direct_first_height
        local direct_first_width
        local direct_first_x
        local direct_first_y
        local direct_fourth_height
        local direct_fourth_y
        local direct_second_y
        local direct_third_height
        local direct_third_width
        local direct_third_x
        local direct_third_y
        local horizontal_gap
        local setup_active_frame
        local setup_first_frame
        local setup_lower_height
        local setup_lower_y
        local setup_minimized_source_frame
        local setup_moved_frame
        local setup_top_height
        local shifted_source_frame
        local stack_height
        local vertical_gap

        frame_is_valid "$direct_first_frame" \
          && frame_is_valid "$direct_second_frame" \
          && frame_is_valid "$direct_third_frame" \
          && frame_is_valid "$direct_fourth_frame" \
          || return 1
        IFS=, read -r \
          direct_first_x \
          direct_first_y \
          direct_first_width \
          direct_first_height \
          <<< "$direct_first_frame"
        IFS=, read -r _ direct_second_y _ _ <<< "$direct_second_frame"
        IFS=, read -r \
          direct_third_x \
          direct_third_y \
          direct_third_width \
          direct_third_height \
          <<< "$direct_third_frame"
        IFS=, read -r \
          _ \
          direct_fourth_y \
          _ \
          direct_fourth_height \
          <<< "$direct_fourth_frame"
        vertical_gap=$((
          direct_second_y - direct_first_y - direct_first_height
        ))
        horizontal_gap=$((
          direct_third_x - direct_first_x - direct_first_width
        ))
        stack_height=$((
          direct_fourth_y + direct_fourth_height - direct_first_y
        ))
        setup_top_height=$(((stack_height - vertical_gap) / 2))
        setup_lower_y=$((direct_first_y + setup_top_height + vertical_gap))
        setup_lower_height=$((
          stack_height - vertical_gap - setup_top_height
        ))

        if ((vertical_gap <= 0 \
          || horizontal_gap <= 0 \
          || setup_top_height <= 0 \
          || setup_lower_height <= 0 \
          || direct_first_width != direct_third_width \
          || direct_first_y != direct_third_y \
          || stack_height != direct_third_height)); then
          record_focus_state "physical minimized-peer consume geometry was invalid"
          return 1
        fi

        printf -v setup_first_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$setup_top_height"
        printf -v setup_active_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$setup_lower_y" \
          "$direct_first_width" \
          "$setup_lower_height"
        printf -v setup_moved_frame '%s,%s,%s,%s' \
          "$direct_third_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$setup_top_height"
        printf -v setup_minimized_source_frame '%s,%s,%s,%s' \
          "$direct_third_x" \
          "$setup_lower_y" \
          "$direct_first_width" \
          "$setup_lower_height"
        printf -v shifted_source_frame '%s,%s,%s,%s' \
          "$((direct_third_x + direct_first_width + horizontal_gap))" \
          "$direct_third_y" \
          "$direct_third_width" \
          "$direct_third_height"

        if ! activate_window "$title_d" \
          || ! wait_for_active "$title_d" \
          || ! invoke_shortcut "driftile_move_window_right" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! invoke_shortcut "driftile_move_window_left" \
          || ! invoke_shortcut "driftile_move_window_up" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$setup_first_frame" \
            "$setup_active_frame" \
            "$setup_moved_frame" \
            "$setup_minimized_source_frame"; then
          record_focus_state "physical minimized-peer consume setup failed"
          return 1
        fi

        if ! set_external_window_minimized "$title_d" true \
          || ! wait_for_window_minimized_state "$title_d" true \
          || ! wait_for_four_frames \
            "$setup_first_frame" \
            "$setup_active_frame" \
            "$setup_moved_frame" \
            "$setup_minimized_source_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical minimized-peer consume settlement failed"
          return 1
        fi

        if ! request_physical_shortcut minimized-consume \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_fourth_frame" \
            "$setup_minimized_source_frame" \
          || ! wait_for_window_minimized_state "$title_d" true \
          || [[ "$(window_frame "$title_d" 2>/dev/null || true)" \
            != "$setup_minimized_source_frame" ]]; then
          record_focus_state "physical Meta+, minimized-peer consume failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+, consumed a visible top member past minimized peers"

        if ! set_external_window_minimized "$title_d" false \
          || ! wait_for_window_minimized_state "$title_d" false \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_fourth_frame" \
            "$direct_third_frame" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! invoke_shortcut "driftile_move_window_right" \
          || ! wait_for_four_frames \
            "$setup_first_frame" \
            "$setup_active_frame" \
            "$direct_third_frame" \
            "$shifted_source_frame" \
          || ! activate_window "$title_d" \
          || ! wait_for_active "$title_d" \
          || ! invoke_shortcut "driftile_insert_window_into_stack_left" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical minimized-peer consume fixture reconstruction failed"
          return 1
        fi
        record_focus_state \
          "minimized-peer consume cleanup reconstructed the exact fixture"
      }

      verify_physical_expel_past_minimized_peer() {
        local direct_first_height
        local direct_first_width
        local direct_first_x
        local direct_first_y
        local direct_fourth_height
        local direct_fourth_y
        local direct_second_y
        local direct_third_height
        local direct_third_width
        local direct_third_x
        local direct_third_y
        local horizontal_gap
        local remaining_active_frame
        local remaining_active_height
        local remaining_active_y
        local remaining_top_height
        local shifted_unrelated_frame
        local stack_height
        local vertical_gap

        frame_is_valid "$direct_first_frame" \
          && frame_is_valid "$direct_second_frame" \
          && frame_is_valid "$direct_third_frame" \
          && frame_is_valid "$direct_fourth_frame" \
          || return 1
        IFS=, read -r \
          direct_first_x \
          direct_first_y \
          direct_first_width \
          direct_first_height \
          <<< "$direct_first_frame"
        IFS=, read -r _ direct_second_y _ _ <<< "$direct_second_frame"
        IFS=, read -r \
          direct_third_x \
          direct_third_y \
          direct_third_width \
          direct_third_height \
          <<< "$direct_third_frame"
        IFS=, read -r \
          _ \
          direct_fourth_y \
          _ \
          direct_fourth_height \
          <<< "$direct_fourth_frame"
        vertical_gap=$((
          direct_second_y - direct_first_y - direct_first_height
        ))
        horizontal_gap=$((
          direct_third_x - direct_first_x - direct_first_width
        ))
        stack_height=$((
          direct_fourth_y + direct_fourth_height - direct_first_y
        ))
        remaining_top_height=$(((stack_height - vertical_gap) / 2))
        remaining_active_y=$((
          direct_first_y + remaining_top_height + vertical_gap
        ))
        remaining_active_height=$((
          stack_height - vertical_gap - remaining_top_height
        ))

        if ((vertical_gap <= 0 \
          || horizontal_gap <= 0 \
          || remaining_top_height <= 0 \
          || remaining_active_height <= 0 \
          || direct_first_width != direct_third_width \
          || direct_first_y != direct_third_y \
          || stack_height != direct_third_height)); then
          record_focus_state "physical minimized-peer expel geometry was invalid"
          return 1
        fi

        printf -v remaining_active_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$remaining_active_y" \
          "$direct_first_width" \
          "$remaining_active_height"
        printf -v shifted_unrelated_frame '%s,%s,%s,%s' \
          "$((direct_third_x + direct_third_width + horizontal_gap))" \
          "$direct_third_y" \
          "$direct_third_width" \
          "$direct_third_height"

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! set_external_window_minimized "$title_a" true \
          || ! wait_for_window_minimized_state "$title_a" true \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! activate_window "$title_d" \
          || ! wait_for_active "$title_d"; then
          record_focus_state "physical minimized-peer expel setup failed"
          return 1
        fi

        if ! request_physical_shortcut minimized-expel \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$remaining_active_frame" \
            "$shifted_unrelated_frame" \
            "$direct_third_frame" \
          || ! wait_for_window_minimized_state "$title_a" true \
          || [[ "$(window_frame "$title_a" 2>/dev/null || true)" \
            != "$direct_first_frame" ]]; then
          record_focus_state "physical Meta+. minimized-peer expel failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+. expelled a visible bottom member past a minimized peer"

        if ! invoke_shortcut "driftile_consume_window_into_column" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_minimized_state "$title_a" true \
          || [[ "$(window_frame "$title_a" 2>/dev/null || true)" \
            != "$direct_first_frame" ]] \
          || ! set_external_window_minimized "$title_a" false \
          || ! wait_for_window_minimized_state "$title_a" false \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical minimized-peer expel fixture reconstruction failed"
          return 1
        fi
        record_focus_state \
          "minimized-peer expel cleanup reconstructed the exact fixture"
      }

      verify_focus() {
        local baseline_first_height
        local baseline_first_width
        local baseline_first_x
        local baseline_first_y
        local baseline_second_height
        local baseline_second_width
        local baseline_second_x
        local baseline_second_y
        local baseline_third_height
        local baseline_third_width
        local baseline_third_x
        local baseline_third_y
        local border_query
        local configured_default_first_frame
        local configured_default_second_frame
        local configured_default_third_frame
        local configured_default_width
        local configured_step_second_frame
        local configured_step_third_frame
        local configured_step_width
        local consume_fixture_rebuilt
        local default_width_delivery_first_frame
        local default_width_delivery_second_frame
        local default_width_delivery_third_frame
        local default_width_restore_first_frame
        local default_width_restore_second_frame
        local default_width_restore_third_frame
        local desktop_reorder_destination_frame
        local desktop_source_width
        local direct_insert_verified
        local first_trailing_desktop_id=""
        local floating_second_frame
        local gap_first_frame
        local gap_third_frame
        local horizontal_extraction_verified
        local merged_first_frame
        local merged_second_frame
        local merged_third_frame
        local minimized_consume_verified
        local minimized_expel_verified
        local minimized_reorder_verified
        local minimized_slots_verified
        local singleton_first_frame
        local singleton_second_frame
        local singleton_third_frame
        local tiled_first_height
        local tiled_first_width
        local tiled_first_x
        local tiled_first_y
        local tiled_third_height
        local tiled_third_width
        local tiled_third_x
        local tiled_third_y
        local second_trailing_desktop_id=""
        local stacked_fullscreen_verified
        local stacked_maximize_verified

        wait_for_window "$title_a" \
          && wait_for_window "$title_b" \
          && wait_for_window "$title_c" \
          || return 1

        if ! wait_for_shortcuts; then
          record_focus_state "shortcut registration failed"
          return 1
        fi

        if ! driftile-shortcuts claim; then
          record_focus_state "shortcut profile claim failed"
          return 1
        fi

        if ! driftile-shortcuts check; then
          record_focus_state "shortcut ownership verification failed"
          return 1
        fi
        record_focus_state "physical shortcut profile claimed"

        if ! capture_stable_frames 30; then
          record_focus_state "initial topology did not settle"
          return 1
        fi

        for border_query in "$title_a" "$title_b" "$title_c"; do
          if ! wait_for_real_window_borderless "$border_query"; then
            record_real_application_state \
              "Initial application borderless check failed" \
              "$border_query"
            return 1
          fi
        done

        record_focus_state "windows ready"

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "window C activated"

        if ! verify_physical_edge_shortcuts; then
          record_focus_state "physical edge shortcuts failed"
          return 1
        fi
        record_focus_state "physical edge shortcuts preserved order and focus"

        if ! verify_automatic_floating; then
          record_focus_state "automatic-floating acceptance failed"
          return 1
        fi
        record_focus_state "automatic-floating window preserved layout and focus"

        capture_stable_frames \
          && invoke_shortcut "driftile_move_window_to_output_left" \
          && wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          && wait_for_active "$title_c" \
          && invoke_shortcut "driftile_move_window_to_output_right" \
          && wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          && wait_for_active "$title_c" \
          && invoke_shortcut "driftile_move_window_to_output_up" \
          && wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          && wait_for_active "$title_c" \
          && invoke_shortcut "driftile_move_window_to_output_down" \
          && wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          && wait_for_active "$title_c" \
          || return 1
        record_focus_state "single-output transfer boundaries preserved layout and focus"

        invoke_shortcut "driftile_move_column_left" \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 864 32 \
          || return 1
        record_focus_state "column C moved left"

        invoke_shortcut "driftile_move_column_right" \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "column C moved right"

        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_b" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "focus left to B invoked"

        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_a" \
          && wait_for_layout 0 832 1664 \
          || return 1
        record_focus_state "focus left to A invoked"

        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_b" \
          && wait_for_layout 0 832 1664 \
          || return 1
        record_focus_state "focus right to B invoked"

        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "focus right to C invoked"

        activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && capture_stable_frames \
          || return 1

        IFS=, read -r \
          baseline_first_x \
          baseline_first_y \
          baseline_first_width \
          baseline_first_height \
          <<< "$stable_first_frame"
        IFS=, read -r \
          baseline_second_x \
          baseline_second_y \
          baseline_second_width \
          baseline_second_height \
          <<< "$stable_second_frame"
        IFS=, read -r \
          baseline_third_x \
          baseline_third_y \
          baseline_third_width \
          baseline_third_height \
          <<< "$stable_third_frame"

        if ! frame_is_valid "$stable_first_frame" \
          || ! frame_is_valid "$stable_second_frame" \
          || ! frame_is_valid "$stable_third_frame"; then
          return 1
        fi

        record_focus_state "window B activated for column resizing"

        configured_default_width=$((
          (70 * ((2 * baseline_second_width + 48) - 16) + 50) / 100 - 16
        ))
        default_width_delivery_first_frame="$((baseline_first_x + 8)),$((baseline_first_y + 8)),$((baseline_first_width - 12)),$((baseline_first_height - 16))"
        default_width_delivery_second_frame="$((baseline_second_x + 4)),$((baseline_second_y + 8)),$((baseline_second_width - 12)),$((baseline_second_height - 16))"
        default_width_delivery_third_frame="$baseline_third_x,$((baseline_third_y + 8)),$((baseline_third_width - 12)),$((baseline_third_height - 16))"
        configured_default_first_frame=$stable_first_frame
        configured_default_second_frame="$baseline_second_x,$baseline_second_y,$configured_default_width,$baseline_second_height"
        configured_default_third_frame="$((baseline_third_x + configured_default_width - baseline_second_width)),$baseline_third_y,$baseline_third_width,$baseline_third_height"
        configured_step_width=$((
          (60 * (baseline_second_width + 16) + 50) / 100 - 16
        ))
        configured_step_second_frame="$baseline_second_x,$baseline_second_y,$configured_step_width,$baseline_second_height"
        configured_step_third_frame="$((baseline_third_x + configured_step_width - baseline_second_width)),$baseline_third_y,$baseline_third_width,$baseline_third_height"
        default_width_restore_first_frame=$default_width_delivery_first_frame
        default_width_restore_second_frame="$((baseline_second_x + 4)),$((baseline_second_y + 8)),$((configured_default_width - 14)),$((baseline_second_height - 16))"
        default_width_restore_third_frame="$((baseline_third_x + configured_default_width - baseline_second_width - 2)),$((baseline_third_y + 8)),$((baseline_third_width - 12)),$((baseline_third_height - 16))"

        if ! set_layout_configuration 70 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured default column width delivery failed"
          return 1
        fi
        record_focus_state \
          "configured default column width preserved existing policy before reset"

        if ! invoke_shortcut "driftile_reset_column_width" \
          || ! wait_for_frames \
            "$configured_default_first_frame" \
            "$configured_default_second_frame" \
            "$configured_default_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured default column width reset failed"
          return 1
        fi
        record_focus_state \
          "configured default column width reset exactly to 70 percent"

        if ! set_layout_configuration 50 10 24 \
          || ! wait_for_frames \
            "$default_width_restore_first_frame" \
            "$default_width_restore_second_frame" \
            "$default_width_restore_third_frame" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$configured_default_first_frame" \
            "$configured_default_second_frame" \
            "$configured_default_third_frame" \
          || ! invoke_shortcut "driftile_reset_column_width" \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "default column width restoration failed"
          return 1
        fi
        record_focus_state "default column width restored exact baseline frames"

        if ! set_layout_configuration 50 20 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured column-width step delivery failed"
          return 1
        fi
        record_focus_state \
          "configured column-width step preserved exact frames before resize"

        if ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$configured_step_second_frame" \
            "$configured_step_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_increase_column_width" \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured column-width step round trip failed"
          return 1
        fi
        record_focus_state \
          "configured column-width step completed an exact 20-point round trip"

        if ! set_layout_configuration 50 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$stable_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "default column-width step restoration failed"
          return 1
        fi
        record_focus_state "default column-width step restored exact baseline frames"

        invoke_shortcut "driftile_increase_column_width" \
          && wait_for_middle_width \
            greater \
            "$baseline_first_width" \
            "$baseline_second_width" \
            "$baseline_third_width" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "column B width increased"

        invoke_shortcut "driftile_decrease_column_width" \
          && wait_for_middle_width \
            equal \
            "$baseline_first_width" \
            "$baseline_second_width" \
            "$baseline_third_width" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "column B width restored by decrease"

        invoke_shortcut "driftile_decrease_column_width" \
          && wait_for_middle_width \
            less \
            "$baseline_first_width" \
            "$baseline_second_width" \
            "$baseline_third_width" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "column B width decreased"

        invoke_shortcut "driftile_reset_column_width" \
          && wait_for_middle_width \
            equal \
            "$baseline_first_width" \
            "$baseline_second_width" \
            "$baseline_third_width" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "column B width reset"

        activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && capture_stable_frames \
          || return 1
        singleton_first_frame=$stable_first_frame
        singleton_second_frame=$stable_second_frame
        singleton_third_frame=$stable_third_frame

        if ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_floating_layout \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
          || ! wait_for_real_window_borderless "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "window B floating reflow failed"
          return 1
        fi
        floating_second_frame=$stable_second_frame
        record_focus_state "window B floated from its tiled column"

        IFS=, read -r \
          tiled_first_x \
          tiled_first_y \
          tiled_first_width \
          tiled_first_height \
          <<< "$stable_first_frame"
        IFS=, read -r \
          tiled_third_x \
          tiled_third_y \
          tiled_third_width \
          tiled_third_height \
          <<< "$stable_third_frame"
        gap_first_frame="$((tiled_first_x + 8)),$((tiled_first_y + 8)),$((tiled_first_width - 12)),$((tiled_first_height - 16))"
        gap_third_frame="$((tiled_third_x + 4)),$((tiled_third_y + 8)),$((tiled_third_width - 12)),$((tiled_third_height - 16))"

        if ! set_gap 24 \
          || ! wait_for_frames \
            "$gap_first_frame" \
            "$floating_second_frame" \
            "$gap_third_frame" \
          || ! wait_for_active "$title_b"; then
          set_gap 16 >/dev/null 2>&1 || true
          record_focus_state "live window gap reflow failed"
          return 1
        fi
        record_focus_state \
          "live window gap reflow preserved the real floating application"

        if ! set_gap 16 \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "default window gap restoration failed"
          return 1
        fi
        record_focus_state "default window gap restored exactly"

        invoke_shortcut "driftile_toggle_floating" \
          && wait_for_frames \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
          && wait_for_real_window_borderless "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "window B restored to its tiled column"

        invoke_shortcut "driftile_move_window_left" \
          && wait_for_stack_layout \
            first-above-second \
            "$singleton_first_frame" \
            "$singleton_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "window B merged into the left stack"

        capture_stable_frames || return 1
        merged_first_frame=$stable_first_frame
        merged_second_frame=$stable_second_frame
        merged_third_frame=$stable_third_frame

        IFS=, read -r _ _ desktop_source_width _ <<< "$merged_first_frame"

        if [[ ! "$desktop_source_width" =~ ^[1-9][0-9]*$ ]]; then
          return 1
        fi

        set_current_desktop "$secondary_desktop_id" || return 1
        start_kcalc_window \
          desktop_window \
          title_desktop_destination \
          "$base_title_desktop_destination" \
          && wait_for_window "$title_desktop_destination" \
          && wait_for_active "$title_desktop_destination" \
          && capture_stable_window_frame "$title_desktop_destination" >/dev/null \
          && wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          && set_current_desktop "$primary_desktop_id" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        wait_for_appended_desktop \
          first_trailing_desktop_id \
          "$primary_desktop_id" \
          "$secondary_desktop_id" \
          || return 1
        record_focus_state "desktop transfer destination seeded"

        desktop_reorder_destination_frame=$(
          capture_stable_window_frame "$title_desktop_destination"
        ) || return 1

        if ! verify_physical_desktop_reorder_shortcuts \
          "$merged_first_frame" \
          "$merged_second_frame" \
          "$merged_third_frame" \
          "$desktop_reorder_destination_frame" \
          "$first_trailing_desktop_id"; then
          record_focus_state "physical desktop reorder shortcuts failed"
          return 1
        fi

        if ! verify_physical_numbered_desktop_shortcuts \
          "$merged_first_frame" \
          "$merged_second_frame" \
          "$merged_third_frame" \
          "$first_trailing_desktop_id"; then
          record_focus_state "physical numbered desktop shortcuts failed"
          return 1
        fi
        record_focus_state \
          "physical numbered desktop shortcuts preserved focus and lifecycle"

        if ! verify_physical_page_down_desktop_shortcut \
          "$merged_first_frame" \
          "$merged_second_frame" \
          "$merged_third_frame"; then
          record_focus_state "physical Page Down desktop shortcut failed"
          return 1
        fi

        if ! verify_physical_manual_floating_desktop_shortcut \
          "$merged_first_frame" \
          "$merged_second_frame" \
          "$merged_third_frame" \
          "$first_trailing_desktop_id"; then
          record_focus_state "physical manual floating desktop transfer failed"
          return 1
        fi
        record_focus_state \
          "physical manual floating desktop transfer preserved exact state"

        invoke_shortcut "driftile_focus_next_desktop" \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && invoke_shortcut "driftile_focus_previous_desktop" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$first_trailing_desktop_id" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "desktop focus navigation preserved the trailing desktop"

        invoke_shortcut "driftile_move_window_to_previous_desktop" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "previous desktop boundary preserved the source stack"

        set_external_window_minimized "$title_a" true \
          && wait_for_window_minimized_state "$title_a" true \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "retained desktop-transfer peer minimized without changing its frame"

        invoke_shortcut "driftile_move_window_to_next_desktop" \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$secondary_desktop_id" \
          && wait_for_window_minimized_state "$title_a" true \
          && wait_for_desktop_destination_layout \
            "$desktop_source_width" \
            "$merged_first_frame" \
            "$merged_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "window B moved to the next desktop"

        invoke_shortcut "driftile_move_window_to_next_desktop" \
          && wait_for_current_desktop "$first_trailing_desktop_id" \
          && wait_for_window_desktop \
            "$title_b" \
            "$first_trailing_desktop_id" \
          && wait_for_active "$title_b" \
          && wait_for_appended_desktop \
            second_trailing_desktop_id \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$first_trailing_desktop_id" \
          && [[ "$second_trailing_desktop_id" \
            != "$first_trailing_desktop_id" ]] \
          || return 1
        record_focus_state "window B occupied the trailing desktop and replenished it"

        invoke_shortcut "driftile_move_window_to_previous_desktop" \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$secondary_desktop_id" \
          && wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$first_trailing_desktop_id" \
          && wait_for_desktop_destination_frames \
            "$desktop_destination_frame" \
            "$desktop_moved_frame" \
            "$desktop_detached_first_frame" \
            "$desktop_detached_third_frame" \
          && wait_for_window_minimized_state "$title_a" true \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "redundant trailing desktop removed"

        set_current_desktop "$primary_desktop_id" \
          && set_external_window_minimized "$title_a" false \
          && wait_for_window_minimized_state "$title_a" false \
          && activate_window "$title_a" \
          && wait_for_active "$title_a" \
          && set_current_desktop "$secondary_desktop_id" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "retained desktop-transfer peer restored before the return transfer"

        invoke_shortcut "driftile_move_window_to_previous_desktop" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          && wait_for_desktop_source_layout \
            "$desktop_source_width" \
            "$merged_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "window B returned after the source active column"

        invoke_shortcut "driftile_move_window_to_previous_desktop" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_frames \
            "$desktop_return_first_frame" \
            "$desktop_return_second_frame" \
            "$desktop_return_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "returned window preserved the previous desktop boundary"
        floating_second_frame=$desktop_return_second_frame

        invoke_shortcut "driftile_move_window_left" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          && wait_for_active "$title_b" \
          || return 1

        cleanup_desktop_window
        wait_for_window_gone "$title_desktop_destination" || return 1
        wait_for_desktop_sequence \
          "$primary_desktop_id" \
          "$secondary_desktop_id" \
          || return 1
        record_focus_state "desktop transfer source layout restored"

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "window C activated before direct insertion"

        direct_insert_verified=false

        if start_firefox_window \
          fourth_window \
          title_d \
          fourth_window_profile \
          "$base_title_d" \
          && wait_for_window "$title_d" \
          && activate_window "$title_d" \
          && wait_for_active "$title_d" \
          && wait_for_direct_insertion_source \
          && set_external_window_minimized "$title_a" true \
          && set_external_window_minimized "$title_b" true \
          && wait_for_window_minimized_state "$title_a" true \
          && wait_for_window_minimized_state "$title_b" true \
          && direct_retained_frame=$(window_frame "$title_a") \
          && direct_second_retained_frame=$(window_frame "$title_b") \
          && frame_is_valid "$direct_retained_frame" \
          && frame_is_valid "$direct_second_retained_frame" \
          && activate_window "$title_d" \
          && wait_for_active "$title_d" \
          && invoke_shortcut "driftile_insert_window_into_stack_left" \
          && wait_for_direct_stack_layout_with_retained_peers \
            "$direct_retained_frame" \
            "$direct_second_retained_frame" \
          && wait_for_window_minimized_state "$title_a" true \
          && wait_for_window_minimized_state "$title_b" true \
          && [[ "$(window_frame "$title_a" 2>/dev/null || true)" \
            == "$direct_retained_frame" ]] \
          && [[ "$(window_frame "$title_b" 2>/dev/null || true)" \
            == "$direct_second_retained_frame" ]] \
          && set_external_window_minimized "$title_a" false \
          && set_external_window_minimized "$title_b" false \
          && wait_for_window_minimized_state "$title_a" false \
          && wait_for_window_minimized_state "$title_b" false \
          && wait_for_direct_stack_layout \
          && wait_for_active "$title_d" \
          && invoke_shortcut "driftile_insert_window_into_stack_right" \
          && wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          && wait_for_active "$title_d"; then
          direct_insert_verified=true
          record_focus_state \
            "Firefox D inserted while minimized Konsole peers retained their frames"
        else
          record_focus_state "direct stack insertion failed"
        fi

        stacked_maximize_verified=false

        if [[ "$direct_insert_verified" == true ]] \
          && verify_physical_stacked_native_state_shortcut \
            maximized \
            stacked-m-enter \
            stacked-m-exit \
            maximize \
            "$title_d"; then
          stacked_maximize_verified=true
          record_focus_state \
            "physical stacked maximize preserved extraction semantics"
        else
          record_focus_state "physical stacked maximize verification failed"
        fi

        stacked_fullscreen_verified=false

        if [[ "$direct_insert_verified" == true \
          && "$stacked_maximize_verified" == true ]] \
          && verify_physical_stacked_native_state_shortcut \
            fullscreen \
            stacked-shift-f-enter \
            stacked-shift-f-exit \
            fullscreen \
            "$title_a"; then
          stacked_fullscreen_verified=true
          record_focus_state \
            "physical stacked fullscreen preserved extraction semantics"
        else
          record_focus_state "physical stacked fullscreen verification failed"
        fi

        minimized_slots_verified=false

        if [[ "$direct_insert_verified" == true \
          && "$stacked_maximize_verified" == true \
          && "$stacked_fullscreen_verified" == true ]] \
          && verify_minimized_slot_navigation; then
          minimized_slots_verified=true
        fi

        minimized_reorder_verified=false

        if [[ "$minimized_slots_verified" == true ]] \
          && verify_physical_vertical_reorder_past_minimized_peer; then
          minimized_reorder_verified=true
        fi

        horizontal_extraction_verified=false

        if [[ "$minimized_reorder_verified" == true ]] \
          && verify_physical_horizontal_extraction_past_minimized_peer; then
          horizontal_extraction_verified=true
        fi

        consume_fixture_rebuilt=false

        if [[ "$horizontal_extraction_verified" == true ]] \
          && rebuild_direct_insertion_with_konsole; then
          consume_fixture_rebuilt=true
          record_focus_state \
            "Konsole D reconstructed the deterministic consume fixture"
        else
          record_focus_state "deterministic consume fixture reconstruction failed"
        fi

        minimized_consume_verified=false

        if [[ "$consume_fixture_rebuilt" == true ]] \
          && verify_physical_consume_past_minimized_peers; then
          minimized_consume_verified=true
        fi

        minimized_expel_verified=false

        if [[ "$minimized_consume_verified" == true ]] \
          && verify_physical_expel_past_minimized_peer; then
          minimized_expel_verified=true
        fi

        cleanup_fourth_window

        wait_for_window_gone "$title_d" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "three-window layout restored after direct insertion"

        [[ "$direct_insert_verified" == true \
          && "$stacked_maximize_verified" == true \
          && "$stacked_fullscreen_verified" == true \
          && "$minimized_slots_verified" == true \
          && "$minimized_reorder_verified" == true \
          && "$horizontal_extraction_verified" == true \
          && "$minimized_consume_verified" == true \
          && "$minimized_expel_verified" == true ]] || return 1

        if ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_floating_layout \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
            "$floating_second_frame" \
          || ! wait_for_real_window_borderless "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "window B stack floating reflow failed"
          return 1
        fi
        record_focus_state "window B floated from the left stack"

        invoke_shortcut "driftile_toggle_floating" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          && wait_for_real_window_borderless "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "window B restored to the left stack"

        invoke_shortcut "driftile_focus_window_up" \
          && wait_for_active "$title_a" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "focus moved up within the stack"

        invoke_shortcut "driftile_focus_window_down" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "focus moved down within the stack"

        invoke_shortcut "driftile_move_window_up" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_second_frame" \
            "$merged_first_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "window B moved up within the stack"

        invoke_shortcut "driftile_move_window_down" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "window B moved down within the stack"

        invoke_shortcut "driftile_move_window_right" \
          && wait_for_active "$title_b" \
          && wait_for_singleton_layout \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
          || return 1
        record_focus_state "window B extracted into the right column"
      }

      request_physical_shortcut() {
        local attempt
        local key_name=$1
        local ready_file="/tmp/shared/driftile-key-test-$key_name-ready"
        local sent_file="/tmp/shared/driftile-key-test-$key_name-sent"

        rm -f "$ready_file" "$sent_file"
        : > "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$sent_file" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      verify_physical_desktop_reorder_shortcuts() {
        local first_frame=$1
        local second_frame=$2
        local third_frame=$3
        local destination_frame=$4
        local trailing_desktop_id=$5

        if ! request_physical_shortcut desktop-move-down \
          || ! wait_for_desktop_sequence \
            "$secondary_desktop_id" \
            "$primary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+Shift+U desktop reorder failed"
          return 1
        fi

        if ! request_physical_shortcut desktop-move-up-page-up \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical Meta+Shift+PageUp desktop reorder failed"
          return 1
        fi

        if ! request_physical_shortcut desktop-move-down-page-down \
          || ! wait_for_desktop_sequence \
            "$secondary_desktop_id" \
            "$primary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical Meta+Shift+PageDown desktop reorder failed"
          return 1
        fi

        if ! request_physical_shortcut desktop-move-up \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+Shift+I desktop reorder failed"
          return 1
        fi

        record_focus_state \
          "physical desktop reorder aliases preserved IDs, focus, frames, and the shared tail"
      }

      verify_physical_numbered_desktop_shortcuts() {
        local destination_frame
        local destination_height
        local destination_width
        local destination_x
        local destination_y
        local first_height
        local first_width
        local first_x
        local first_y
        local gap
        local second_height
        local second_trailing_desktop_id=""
        local second_width
        local second_x
        local second_y
        local source_first_frame=$1
        local source_second_frame=$2
        local source_singleton_frame
        local source_third_frame=$3
        local target_first_frame
        local target_second_frame
        local target_x
        local third_height
        local third_width
        local third_x
        local third_y
        local trailing_desktop_id=$4

        destination_frame=$(capture_stable_window_frame "$title_desktop_destination") \
          || return 1
        frame_is_valid "$source_first_frame" \
          && frame_is_valid "$source_second_frame" \
          && frame_is_valid "$source_third_frame" \
          && frame_is_valid "$destination_frame" \
          || return 1

        IFS=, read -r first_x first_y first_width first_height \
          <<< "$source_first_frame"
        IFS=, read -r second_x second_y second_width second_height \
          <<< "$source_second_frame"
        IFS=, read -r third_x third_y third_width third_height \
          <<< "$source_third_frame"
        IFS=, read -r \
          destination_x \
          destination_y \
          destination_width \
          destination_height \
          <<< "$destination_frame"
        gap=$((third_x - first_x - first_width))

        if ((gap < 0 \
          || first_x != second_x \
          || first_width != second_width \
          || first_width != third_width \
          || destination_width != third_width \
          || destination_height != third_height)); then
          return 1
        fi

        target_x=$((destination_x + destination_width + gap))
        printf -v target_first_frame '%s,%s,%s,%s' \
          "$target_x" "$first_y" "$first_width" "$first_height"
        printf -v target_second_frame '%s,%s,%s,%s' \
          "$target_x" "$second_y" "$second_width" "$second_height"
        printf -v source_singleton_frame '%s,%s,%s,%s' \
          "$first_x" "$third_y" "$third_width" "$third_height"

        if ! request_physical_shortcut desktop-1 \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id"; then
          record_focus_state "physical Meta+1 same-target desktop focus failed"
          return 1
        fi
        record_focus_state "physical Meta+1 preserved desktop 1 state"

        if ! request_physical_shortcut desktop-9 \
          || ! wait_for_current_desktop "$trailing_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id"; then
          record_focus_state "physical Meta+9 trailing desktop focus failed"
          return 1
        fi
        record_focus_state "physical Meta+9 focused the shared empty tail"

        invoke_shortcut "driftile_focus_desktop_1" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          || return 1

        if ! set_external_window_minimized "$title_a" true \
          || ! wait_for_window_minimized_state "$title_a" true \
          || ! wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "minimized physical numbered desktop transfer setup failed"
          return 1
        fi

        if ! request_physical_shortcut desktop-ctrl-2 \
          || ! wait_for_current_desktop "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_window_minimized_state "$title_a" true \
          || [[ "$(window_frame "$title_a" 2>/dev/null || true)" \
            != "$source_first_frame" ]] \
          || ! wait_for_named_frames \
            "$title_b" "$target_second_frame" \
            "$title_c" "$source_third_frame" \
            "$title_desktop_destination" "$destination_frame" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id"; then
          record_focus_state "physical Meta+Ctrl+2 column transfer failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+2 transferred the stack without writing its minimized member"

        if ! set_external_window_minimized "$title_a" false \
          || ! wait_for_window_minimized_state "$title_a" false \
          || ! wait_for_numbered_desktop_frames \
            "$target_first_frame" \
            "$target_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "transferred minimized desktop member restoration failed"
          return 1
        fi
        record_focus_state \
          "restored minimized desktop member occupied its transferred logical slot"

        invoke_shortcut "driftile_move_column_to_desktop_1" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          && wait_for_active "$title_b" \
          && wait_for_numbered_desktop_frames \
            "$target_first_frame" \
            "$target_second_frame" \
            "$source_singleton_frame" \
            "$destination_frame" \
          && invoke_shortcut "driftile_move_column_left" \
          && wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          && wait_for_active "$title_b" \
          || return 1

        if ! request_physical_shortcut desktop-ctrl-9 \
          || ! wait_for_current_desktop "$trailing_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$trailing_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$trailing_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! wait_for_appended_desktop \
            second_trailing_desktop_id \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          || [[ "$second_trailing_desktop_id" == "$trailing_desktop_id" ]]; then
          record_focus_state "physical Meta+Ctrl+9 trailing transfer failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+9 replenished one empty tail after moving the stack"

        invoke_shortcut "driftile_move_column_to_desktop_1" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          && wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          && wait_for_active "$title_b" \
          && wait_for_numbered_desktop_frames \
            "$target_first_frame" \
            "$target_second_frame" \
            "$source_singleton_frame" \
            "$destination_frame" \
          && invoke_shortcut "driftile_move_column_left" \
          && wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          && wait_for_active "$title_b"
      }

      verify_physical_page_down_desktop_shortcut() {
        local destination_frame
        local source_first_frame=$1
        local source_second_frame=$2
        local source_third_frame=$3

        destination_frame=$(capture_stable_window_frame "$title_desktop_destination") \
          || return 1

        if ! wait_for_window_minimized_state "$title_b" false \
          || ! wait_for_window_minimized_state \
            "$title_desktop_destination" \
            false \
          || ! request_physical_shortcut desktop-next-page-down \
          || ! wait_for_current_desktop "$secondary_desktop_id" \
          || ! wait_for_active "$title_desktop_destination" \
          || ! wait_for_window_minimized_state "$title_b" false \
          || ! wait_for_window_minimized_state \
            "$title_desktop_destination" \
            false; then
          record_focus_state \
            "physical Meta+PageDown desktop navigation or minimize isolation failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+PageDown changed desktops without minimizing either active window"

        invoke_shortcut "driftile_focus_previous_desktop" \
          && wait_for_current_desktop "$primary_desktop_id" \
          && wait_for_active "$title_b" \
          && wait_for_window_minimized_state "$title_b" false \
          && wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame"
      }

      verify_physical_manual_floating_desktop_shortcut() {
        local destination_frame
        local floating_frame
        local floating_first_frame
        local floating_third_frame
        local source_first_frame=$1
        local source_second_frame=$2
        local source_third_frame=$3
        local trailing_desktop_id=$4

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "manual floating desktop transfer setup failed"
          return 1
        fi

        floating_first_frame=$(capture_stable_window_frame "$title_a") \
          || return 1
        floating_frame=$(capture_stable_window_frame "$title_b") \
          || return 1
        floating_third_frame=$(capture_stable_window_frame "$title_c") \
          || return 1
        destination_frame=$(capture_stable_window_frame "$title_desktop_destination") \
          || return 1

        if ! wait_for_numbered_desktop_frames \
          "$floating_first_frame" \
          "$floating_frame" \
          "$floating_third_frame" \
          "$destination_frame" \
          || ! request_physical_shortcut floating-desktop-next \
          || ! wait_for_current_desktop "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$floating_first_frame" \
            "$floating_frame" \
            "$floating_third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id"; then
          record_focus_state "physical Meta+Ctrl+U floating desktop transfer failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+U moved only the active floating window"

        if ! invoke_shortcut "driftile_focus_tiling" \
          || ! wait_for_active "$title_desktop_destination" \
          || ! invoke_shortcut "driftile_focus_floating" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_numbered_desktop_frames \
            "$floating_first_frame" \
            "$floating_frame" \
            "$floating_third_frame" \
            "$destination_frame"; then
          record_focus_state "floating layer state changed during physical desktop transfer"
          return 1
        fi

        if ! invoke_shortcut "driftile_move_column_to_desktop_1" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_numbered_desktop_frames \
            "$floating_first_frame" \
            "$floating_frame" \
            "$floating_third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_numbered_desktop_frames \
            "$source_first_frame" \
            "$source_second_frame" \
            "$source_third_frame" \
            "$destination_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "manual floating desktop transfer cleanup failed"
          return 1
        fi
        record_focus_state \
          "manual floating desktop transfer restored the exact tiled stack"
      }

      verify_physical_layer_focus_shortcut() {
        local floating_first_frame
        local floating_second_frame
        local floating_third_frame
        local tiled_first_frame
        local tiled_second_frame
        local tiled_third_frame

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! capture_stable_frames; then
          record_focus_state "physical layer-focus shortcut setup failed"
          return 1
        fi

        tiled_first_frame=$stable_first_frame
        tiled_second_frame=$stable_second_frame
        tiled_third_frame=$stable_third_frame

        if ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_active "$title_b" \
          || ! capture_stable_frames; then
          record_focus_state "physical layer-focus floating setup failed"
          return 1
        fi

        floating_first_frame=$stable_first_frame
        floating_second_frame=$stable_second_frame
        floating_third_frame=$stable_third_frame

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$floating_first_frame" \
            "$floating_second_frame" \
            "$floating_third_frame" \
          || ! request_physical_shortcut shift-v-floating \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$floating_first_frame" \
            "$floating_second_frame" \
            "$floating_third_frame"; then
          record_focus_state "physical Meta+Shift+V did not focus the floating layer"
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+V focused the floating layer without moving windows"

        if ! request_physical_shortcut shift-v-tiling \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$floating_first_frame" \
            "$floating_second_frame" \
            "$floating_third_frame"; then
          record_focus_state "physical Meta+Shift+V did not restore tiled focus"
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+V restored tiled focus without moving windows"

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_toggle_floating" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$tiled_first_frame" \
            "$tiled_second_frame" \
            "$tiled_third_frame"; then
          record_focus_state "physical layer-focus shortcut cleanup failed"
          return 1
        fi
      }

      verify_physical_consume_expel_shortcuts() {
        local consumed_first_frame
        local consumed_second_frame
        local consumed_third_frame
        local first_x
        local first_frame
        local second_x
        local second_frame
        local third_frame

        if ! activate_window "$title_a" \
          || ! wait_for_active "$title_a" \
          || ! capture_stable_frames; then
          record_focus_state "physical consume/expel shortcut setup failed"
          return 1
        fi

        first_frame=$stable_first_frame
        second_frame=$stable_second_frame
        third_frame=$stable_third_frame
        IFS=, read -r first_x _ _ _ <<< "$first_frame"
        IFS=, read -r second_x _ _ _ <<< "$second_frame"
        [[ "$first_x" =~ ^-?[0-9]+$ && "$second_x" =~ ^-?[0-9]+$ ]] \
          || return 1
        consumed_first_frame="$first_x,16,816,478"
        consumed_second_frame="$first_x,510,816,478"
        consumed_third_frame="$second_x,16,816,972"

        if ! request_physical_shortcut comma \
          || ! wait_for_active "$title_a" \
          || ! wait_for_frames \
            "$consumed_first_frame" \
            "$consumed_second_frame" \
            "$consumed_third_frame"; then
          record_focus_state "physical Meta+, consume failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+, consumed the right top window without changing focus"

        if ! request_physical_shortcut period \
          || ! wait_for_active "$title_a" \
          || ! wait_for_frames "$first_frame" "$second_frame" "$third_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames "$first_frame" "$second_frame" "$third_frame"; then
          record_focus_state "physical Meta+. expel or cleanup failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+. expelled the bottom window and restored the layout"
      }

      verify_physical_floating_navigation_shortcuts() {
        local center_frame="650,120,360,240"
        local center_pid=""
        local center_base_title="Driftile VM Floating Navigation center"
        local center_title="$center_base_title"
        local first_frame
        local left_frame="120,380,360,240"
        local left_pid=""
        local left_base_title="Driftile VM Floating Navigation left"
        local left_title="$left_base_title"
        local restored=false
        local right_frame="1100,650,360,240"
        local right_pid=""
        local right_base_title="Driftile VM Floating Navigation right"
        local right_title="$right_base_title"
        local second_frame
        local third_frame
        local verified=false

        if ! capture_stable_frames; then
          record_focus_state "physical floating navigation baseline capture failed"
          return 1
        fi

        first_frame=$stable_first_frame
        second_frame=$stable_second_frame
        third_frame=$stable_third_frame

        if start_fixed_xmessage_window \
          left_pid \
          left_title \
          "$left_base_title" \
          && start_fixed_xmessage_window \
            center_pid \
            center_title \
            "$center_base_title" \
          && start_fixed_xmessage_window \
            right_pid \
            right_title \
            "$right_base_title" \
          && wait_for_window "$left_title" \
          && wait_for_window "$center_title" \
          && wait_for_window "$right_title" \
          && wait_for_real_window_borderless "$left_title" \
          && wait_for_real_window_borderless "$center_title" \
          && wait_for_real_window_borderless "$right_title" \
          && arrange_floating_navigation_windows \
          && wait_for_named_frames \
            "$left_title" "$left_frame" \
            "$center_title" "$center_frame" \
            "$right_title" "$right_frame" \
          && wait_for_frames "$first_frame" "$second_frame" "$third_frame" \
          && activate_window "$center_title" \
          && wait_for_active "$center_title" \
          && request_physical_shortcut floating-home \
          && wait_for_active "$left_title" \
          && request_physical_shortcut floating-end \
          && wait_for_active "$right_title" \
          && request_physical_shortcut floating-left \
          && wait_for_active "$center_title" \
          && request_physical_shortcut floating-right \
          && wait_for_active "$right_title" \
          && request_physical_shortcut floating-up \
          && wait_for_active "$left_title" \
          && request_physical_shortcut floating-down \
          && wait_for_active "$right_title" \
          && wait_for_named_frames \
            "$left_title" "$left_frame" \
            "$center_title" "$center_frame" \
            "$right_title" "$right_frame" \
          && wait_for_frames "$first_frame" "$second_frame" "$third_frame"; then
          verified=true
          record_focus_state \
            "physical floating navigation selected geometric targets without moving windows"
        else
          record_focus_state "physical floating navigation failed"
          {
            printf 'expected floating frames: %s | %s | %s\n' \
              "$left_frame" "$center_frame" "$right_frame"
            printf 'actual floating frames: %s | %s | %s\n' \
              "$(window_frame "$left_title" 2>/dev/null || printf missing)" \
              "$(window_frame "$center_title" 2>/dev/null || printf missing)" \
              "$(window_frame "$right_title" 2>/dev/null || printf missing)"
          } >> /tmp/shared/driftile-focus-diagnostics
        fi

        [[ -z "$left_pid" ]] || terminate_process "$left_pid"
        [[ -z "$center_pid" ]] || terminate_process "$center_pid"
        [[ -z "$right_pid" ]] || terminate_process "$right_pid"

        if wait_for_window_gone "$left_title" \
          && wait_for_window_gone "$center_title" \
          && wait_for_window_gone "$right_title" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames "$first_frame" "$second_frame" "$third_frame"; then
          restored=true
          record_focus_state "physical floating navigation cleanup restored tiled state"
        else
          record_focus_state "physical floating navigation cleanup failed"
          {
            printf 'remaining floating captions: %s | %s | %s\n' \
              "$(window_match_id "$left_title" 2>/dev/null || printf gone)" \
              "$(window_match_id "$center_title" 2>/dev/null || printf gone)" \
              "$(window_match_id "$right_title" 2>/dev/null || printf gone)"
            printf 'expected tiled frames: %s | %s | %s\n' \
              "$first_frame" "$second_frame" "$third_frame"
            printf 'actual tiled frames: %s | %s | %s\n' \
              "$(window_frame "$title_a" 2>/dev/null || printf missing)" \
              "$(window_frame "$title_b" 2>/dev/null || printf missing)" \
              "$(window_frame "$title_c" 2>/dev/null || printf missing)"
          } >> /tmp/shared/driftile-focus-diagnostics
        fi

        [[ "$verified" == true && "$restored" == true ]]
      }

      verify_physical_edge_shortcuts() {
        request_physical_shortcut home \
          && wait_for_active "$title_a" \
          && wait_for_layout 0 832 1664 \
          || return 1
        record_focus_state "physical Meta+Home focused the first column"

        request_physical_shortcut end \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "physical Meta+End focused the last column"

        request_physical_shortcut ctrl-home \
          && wait_for_active "$title_c" \
          && wait_for_layout 832 1664 0 \
          || return 1
        record_focus_state "physical Meta+Ctrl+Home moved the column first"

        request_physical_shortcut ctrl-end \
          && wait_for_active "$title_c" \
          && wait_for_layout -800 32 864 \
          || return 1
        record_focus_state "physical Meta+Ctrl+End moved the column last"
      }

      verify_physical_width_shortcuts() {
        local after_width
        local attempt
        local before_width
        local decreased_width
        local equal_width

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          || return 1
        before_width=$(window_frame_width "$title_c") || return 1
        decreased_width=$before_width
        equal_width=$before_width

        request_physical_shortcut minus || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          after_width=$(window_frame_width "$title_c") || return 1

          if ((after_width < before_width)); then
            decreased_width=$after_width
            record_focus_state "physical Meta+- decreased the active column width"
            break
          fi

          sleep 0.1
        done

        if ((decreased_width >= before_width)); then
          record_focus_state "physical Meta+- did not reach Driftile"
          return 1
        fi

        request_physical_shortcut equal || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          after_width=$(window_frame_width "$title_c") || return 1

          if ((after_width == before_width)); then
            equal_width=$after_width
            record_focus_state "physical Meta+= restored the active column width"
            break
          fi

          sleep 0.1
        done

        if ((equal_width != before_width)); then
          record_focus_state "physical Meta+= did not restore the column width"
          return 1
        fi

        return 0
      }

      verify_physical_height_shortcuts() {
        local singleton_first_frame
        local singleton_second_frame
        local singleton_third_frame
        local stack_first_frame
        local stack_second_frame
        local stack_third_frame

        activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && capture_stable_frames \
          || return 1
        singleton_first_frame=$stable_first_frame
        singleton_second_frame=$stable_second_frame
        singleton_third_frame=$stable_third_frame

        invoke_shortcut "driftile_move_window_left" \
          && wait_for_stack_layout \
            first-above-second \
            "$singleton_first_frame" \
            "$singleton_third_frame" \
          && wait_for_active "$title_b" \
          && capture_stable_frames \
          || return 1
        stack_first_frame=$stable_first_frame
        stack_second_frame=$stable_second_frame
        stack_third_frame=$stable_third_frame
        record_focus_state "window B stacked for physical height shortcuts"

        if ! invoke_shortcut "driftile_decrease_window_height" \
          || ! wait_for_stacked_height_relation \
            active-smaller \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "D-Bus height decrease preflight failed"
          return 1
        fi
        record_focus_state "D-Bus height decrease preflight passed"

        if ! invoke_shortcut "driftile_reset_window_height" \
          || ! wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "D-Bus height reset preflight failed"
          return 1
        fi
        record_focus_state "D-Bus height reset preflight passed"

        if ! request_physical_shortcut shift-minus; then
          record_focus_state "physical Meta+Shift+- delivery failed"
          return 1
        fi

        if ! wait_for_stacked_height_relation \
          active-smaller \
          "$stack_first_frame" \
          "$stack_second_frame" \
          "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+Shift+- produced no height change"
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+- decreased B and expanded sibling A"

        request_physical_shortcut shift-equal \
          && wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "physical Meta+Shift+= restored B and sibling A heights"

        request_physical_shortcut ctrl-shift-r \
          && wait_for_stacked_height_relation \
            active-larger \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "physical Meta+Ctrl+Shift+R selected a taller B preset"

        request_physical_shortcut ctrl-r \
          && wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "physical Meta+Ctrl+R restored automatic stack heights"

        if ! invoke_shortcut "driftile_move_window_right" \
          || ! wait_for_singleton_layout \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical height shortcut layout restoration failed"
          return 1
        fi

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame"; then
          record_focus_state \
            "physical height shortcut viewport restoration failed"
          {
            printf 'expected frame A: %s\n' "$singleton_first_frame"
            printf 'expected frame B: %s\n' "$singleton_second_frame"
            printf 'expected frame C: %s\n' "$singleton_third_frame"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical height shortcut viewport restored before application tests"
      }

      verify_physical_column_view_shortcuts() {
        local center_first_frame
        local center_second_frame
        local center_third_frame
        local expand_first_frame
        local expand_second_frame
        local expand_third_frame
        local expanded_second_width
        local full_second_frame
        local full_second_height
        local full_second_width
        local full_second_y
        local original_first_frame
        local original_first_width
        local original_gap
        local original_second_frame
        local original_second_height
        local original_second_width
        local original_second_x
        local original_second_y
        local original_third_frame
        local original_third_width
        local original_third_x
        local setup_second_width
        local setup_second_x
        local setup_third_width
        local setup_third_x
        local usable_left
        local usable_right

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && capture_stable_frames \
          || return 1
        original_first_frame=$stable_first_frame
        original_second_frame=$stable_second_frame
        original_third_frame=$stable_third_frame
        IFS=, read -r _ _ original_first_width _ \
          <<< "$original_first_frame"
        IFS=, read -r \
          original_second_x \
          original_second_y \
          original_second_width \
          original_second_height \
          <<< "$original_second_frame"
        IFS=, read -r original_third_x _ original_third_width _ \
          <<< "$original_third_frame"
        original_gap=$((
          original_third_x - original_second_x - original_second_width
        ))

        activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$original_first_frame" \
            "$original_second_frame" \
            "$original_third_frame" \
          || return 1

        if ! invoke_shortcut "driftile_maximize_column" \
          || ! wait_for_middle_width \
            greater \
            "$original_first_width" \
            "$original_second_width" \
            "$original_third_width" \
          || ! capture_stable_frames \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "available-width usable span discovery failed"
          return 1
        fi
        full_second_frame=$stable_second_frame
        IFS=, read -r \
          _ \
          full_second_y \
          full_second_width \
          full_second_height \
          <<< "$full_second_frame"
        usable_right=$((
          original_third_x + original_third_width - original_gap
        ))
        usable_left=$((usable_right - full_second_width))

        if ((original_gap <= 0 \
          || usable_right <= usable_left \
          || full_second_width <= original_second_width \
          || full_second_y != original_second_y \
          || full_second_height != original_second_height)); then
          record_focus_state \
            "available-width usable span was invalid"
          return 1
        fi

        if ! invoke_shortcut "driftile_maximize_column" \
          || ! wait_for_middle_width \
            equal \
            "$original_first_width" \
            "$original_second_width" \
            "$original_third_width" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$original_first_frame" \
            "$original_second_frame" \
            "$original_third_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "available-width baseline restoration failed"
          return 1
        fi

        if ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_middle_width \
            less \
            "$original_first_width" \
            "$original_second_width" \
            "$original_third_width" \
          || ! capture_stable_frames \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "available-width physical shortcut setup failed"
          return 1
        fi
        expand_first_frame=$stable_first_frame
        expand_second_frame=$stable_second_frame
        expand_third_frame=$stable_third_frame
        IFS=, read -r setup_second_x _ setup_second_width _ \
          <<< "$expand_second_frame"
        IFS=, read -r setup_third_x _ setup_third_width _ \
          <<< "$expand_third_frame"

        if ((setup_second_x < usable_left \
          || setup_third_x + setup_third_width > usable_right \
          || setup_third_x <= setup_second_x + setup_second_width)); then
          record_focus_state \
            "available-width physical shortcut setup was not fully visible"
          return 1
        fi

        if ! request_physical_shortcut ctrl-f \
          || ! wait_for_available_width_expansion \
            "$expand_first_frame" \
            "$expand_second_frame" \
            "$expand_third_frame" \
            "$usable_left" \
            "$usable_right" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical Meta+Ctrl+F available-width expansion failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+F filled the available column span"

        capture_stable_frames || return 1
        expanded_second_width=$(window_frame_width "$title_b") || return 1

        if ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_middle_width \
            less \
            "$original_first_width" \
            "$expanded_second_width" \
            "$original_third_width" \
          || ! capture_stable_frames \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "visible-column centering physical shortcut setup failed"
          return 1
        fi
        center_first_frame=$stable_first_frame
        center_second_frame=$stable_second_frame
        center_third_frame=$stable_third_frame

        if ! request_physical_shortcut ctrl-c \
          || ! wait_for_visible_group_centered \
            "$center_first_frame" \
            "$center_second_frame" \
            "$center_third_frame" \
            "$usable_left" \
            "$usable_right" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical Meta+Ctrl+C visible-column centering failed"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+C centered the fully visible columns"

        if ! invoke_shortcut "driftile_reset_column_width" \
          || ! wait_for_middle_width \
            equal \
            "$original_first_width" \
            "$original_second_width" \
            "$original_third_width" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$original_first_frame" \
            "$original_second_frame" \
            "$original_third_frame"; then
          record_focus_state \
            "physical column-view shortcut viewport restoration failed"
          {
            printf 'expected frame A: %s\n' "$original_first_frame"
            printf 'expected frame B: %s\n' "$original_second_frame"
            printf 'expected frame C: %s\n' "$original_third_frame"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical column-view shortcut viewport restored before application tests"
      }

      verify_physical_fullscreen_shortcut() {
        local baseline_first
        local baseline_second
        local baseline_third
        local output_frame

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! window_is_normal "$title_b" \
          || ! wait_for_window_fullscreen_state "$title_b" false \
          || ! capture_stable_frames; then
          record_focus_state "physical fullscreen shortcut setup failed"
          return 1
        fi

        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)

        if ! frame_is_valid "$output_frame" \
          || [[ "$baseline_second" == "$output_frame" ]]; then
          record_focus_state "physical fullscreen output frame was invalid"
          return 1
        fi

        if ! request_physical_shortcut shift-f-enter \
          || ! wait_for_window_fullscreen_state "$title_b" true \
          || ! wait_for_frames \
            "$baseline_first" \
            "$output_frame" \
            "$baseline_third" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+Shift+F fullscreen entry failed"
          {
            printf 'expected fullscreen frames: %s | %s | %s\n' \
              "$baseline_first" \
              "$output_frame" \
              "$baseline_third"
            printf 'actual fullscreen frames: %s | %s | %s\n' \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+F entered native fullscreen without moving siblings"

        if ! request_physical_shortcut shift-f-exit \
          || ! wait_for_window_fullscreen_state "$title_b" false \
          || ! wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+Shift+F fullscreen exit failed"
          {
            printf 'expected restored frames: %s | %s | %s\n' \
              "$baseline_first" \
              "$baseline_second" \
              "$baseline_third"
            printf 'actual restored frames: %s | %s | %s\n' \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+F restored the exact tiled layout and focus"
      }

      verify_physical_stacked_native_state_shortcut() {
        local direct_first_height
        local direct_first_width
        local direct_first_x
        local direct_first_y
        local direct_fourth_height
        local direct_fourth_width
        local direct_fourth_x
        local direct_fourth_y
        local direct_second_width
        local direct_second_x
        local direct_second_y
        local direct_third_height
        local direct_third_width
        local direct_third_x
        local direct_third_y
        local horizontal_gap
        local enter_marker=$2
        local extracted_first_frame
        local extracted_fourth_frame
        local exit_marker=$3
        local minimized_frame
        local minimized_peer=$5
        local native_frame
        local output_frame
        local remaining_available_height
        local remaining_first_frame
        local remaining_first_height
        local remaining_last_frame
        local remaining_last_height
        local restored_bottom_frame
        local restored_middle_frame
        local shifted_unrelated_frame
        local singleton_frame
        local singleton_x
        local state=$1
        local state_label=$4
        local stack_height
        local vertical_gap

        case "$state" in
          fullscreen|maximized) ;;
          *) return 2 ;;
        esac

        frame_is_valid "$direct_first_frame" \
          && frame_is_valid "$direct_second_frame" \
          && frame_is_valid "$direct_third_frame" \
          && frame_is_valid "$direct_fourth_frame" \
          || return 1
        IFS=, read -r \
          direct_first_x \
          direct_first_y \
          direct_first_width \
          direct_first_height \
          <<< "$direct_first_frame"
        IFS=, read -r \
          direct_second_x \
          direct_second_y \
          direct_second_width \
          _ \
          <<< "$direct_second_frame"
        IFS=, read -r \
          direct_third_x \
          direct_third_y \
          direct_third_width \
          direct_third_height \
          <<< "$direct_third_frame"
        IFS=, read -r \
          direct_fourth_x \
          direct_fourth_y \
          direct_fourth_width \
          direct_fourth_height \
          <<< "$direct_fourth_frame"
        vertical_gap=$((
          direct_second_y - direct_first_y - direct_first_height
        ))
        horizontal_gap=$((
          direct_third_x - direct_first_x - direct_first_width
        ))
        stack_height=$((
          direct_fourth_y + direct_fourth_height - direct_first_y
        ))
        remaining_available_height=$((stack_height - vertical_gap))
        remaining_first_height=$((remaining_available_height / 2))
        remaining_last_height=$((
          remaining_available_height - remaining_first_height
        ))
        singleton_x=$direct_third_x
        printf -v remaining_first_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$remaining_first_height"
        printf -v remaining_last_frame '%s,%s,%s,%s' \
          "$direct_first_x" \
          "$((direct_first_y + remaining_first_height + vertical_gap))" \
          "$direct_first_width" \
          "$remaining_last_height"
        printf -v singleton_frame '%s,%s,%s,%s' \
          "$singleton_x" \
          "$direct_first_y" \
          "$direct_first_width" \
          "$stack_height"
        printf -v shifted_unrelated_frame '%s,%s,%s,%s' \
          "$((singleton_x + direct_first_width + horizontal_gap))" \
          "$direct_third_y" \
          "$direct_third_width" \
          "$direct_third_height"
        restored_middle_frame=$direct_second_frame
        restored_bottom_frame=$direct_fourth_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)

        case "$minimized_peer" in
          "$title_a")
            minimized_frame=$direct_first_frame
            extracted_first_frame=$direct_first_frame
            extracted_fourth_frame=$remaining_last_frame
            ;;
          "$title_d")
            minimized_frame=$direct_fourth_frame
            extracted_first_frame=$remaining_first_frame
            extracted_fourth_frame=$direct_fourth_frame
            ;;
          *)
            return 2
            ;;
        esac

        if [[ "$state" == "maximized" ]]; then
          native_frame=$(
            maximized_work_area_frame \
              "$direct_third_frame" \
              "$output_frame" 2>/dev/null \
              || true
          )
        else
          native_frame=$output_frame
        fi

        if ((vertical_gap <= 0 \
          || horizontal_gap <= 0 \
          || remaining_first_height <= 0 \
          || remaining_last_height <= 0 \
          || direct_first_x != direct_second_x \
          || direct_second_x != direct_fourth_x \
          || direct_first_width != direct_second_width \
          || direct_second_width != direct_fourth_width)) \
          || ! frame_is_valid "$native_frame"; then
          record_focus_state "physical stacked $state_label geometry was invalid"
          return 1
        fi

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_window_native_state "$title_b" "$state" false \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame"; then
          record_focus_state "physical stacked $state_label setup failed"
          return 1
        fi

        if ! set_external_window_minimized "$minimized_peer" true \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_window_fullscreen_state "$minimized_peer" false \
          || ! wait_for_window_maximized_state "$minimized_peer" false \
          || [[ "$(window_frame "$minimized_peer" 2>/dev/null || true)" \
            != "$minimized_frame" ]] \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical stacked $state_label minimized-peer setup failed"
          return 1
        fi
        record_focus_state \
          "physical stacked $state_label passive peer settled minimized"

        if ! request_physical_shortcut "$enter_marker" \
          || ! wait_for_window_native_state "$title_b" "$state" true \
          || ! wait_for_four_frames \
            "$extracted_first_frame" \
            "$native_frame" \
            "$shifted_unrelated_frame" \
            "$extracted_fourth_frame" \
          || ! wait_for_window_minimized_state "$minimized_peer" true \
          || ! wait_for_window_fullscreen_state "$minimized_peer" false \
          || ! wait_for_window_maximized_state "$minimized_peer" false \
          || ! wait_for_window_desktop "$title_a" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_b" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_c" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$title_d" "$primary_desktop_id" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical stacked $state_label entry failed"
          {
            printf 'expected stacked %s frames: %s | %s | %s | %s\n' \
              "$state_label" \
              "$extracted_first_frame" \
              "$native_frame" \
              "$shifted_unrelated_frame" \
              "$extracted_fourth_frame"
            printf 'actual stacked %s frames: %s | %s | %s | %s\n' \
              "$state_label" \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)" \
              "$(window_frame "$title_d" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical stacked $state_label extracted past a minimized peer"

        if ! request_physical_shortcut "$exit_marker" \
          || ! wait_for_window_native_state "$title_b" "$state" false \
          || ! wait_for_four_frames \
            "$extracted_first_frame" \
            "$singleton_frame" \
            "$shifted_unrelated_frame" \
            "$extracted_fourth_frame" \
          || ! wait_for_window_minimized_state "$minimized_peer" true \
          || ! wait_for_window_fullscreen_state "$minimized_peer" false \
          || ! wait_for_window_maximized_state "$minimized_peer" false \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical stacked $state_label exit failed"
          {
            printf 'expected former stacked %s frames: %s | %s | %s | %s\n' \
              "$state_label" \
              "$extracted_first_frame" \
              "$singleton_frame" \
              "$shifted_unrelated_frame" \
              "$extracted_fourth_frame"
            printf 'actual former stacked %s frames: %s | %s | %s | %s\n' \
              "$state_label" \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)" \
              "$(window_frame "$title_d" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical stacked $state_label kept the restored window separate"

        if ! set_external_window_minimized "$minimized_peer" false \
          || ! wait_for_four_frames \
            "$remaining_first_frame" \
            "$singleton_frame" \
            "$shifted_unrelated_frame" \
            "$remaining_last_frame" \
          || ! wait_for_window_fullscreen_state "$minimized_peer" false \
          || ! wait_for_window_maximized_state "$minimized_peer" false \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical stacked $state_label minimized-peer restore failed"
          return 1
        fi
        record_focus_state \
          "physical stacked $state_label preserved the minimized peer"

        if ! invoke_shortcut "driftile_move_window_left" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$restored_bottom_frame" \
            "$direct_third_frame" \
            "$restored_middle_frame" \
          || ! invoke_shortcut "driftile_move_window_up" \
          || ! wait_for_four_frames \
            "$direct_first_frame" \
            "$direct_second_frame" \
            "$direct_third_frame" \
            "$direct_fourth_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical stacked $state_label fixture restore failed"
          return 1
        fi
        record_focus_state \
          "physical stacked $state_label restored the exact source fixture"
      }

      verify_physical_maximize_shortcut() {
        local baseline_first
        local baseline_second
        local baseline_third
        local maximize_frame
        local output_frame

        if ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! window_is_normal "$title_b" \
          || ! wait_for_window_maximized_state "$title_b" false \
          || ! capture_stable_frames; then
          record_focus_state "physical maximize shortcut setup failed"
          return 1
        fi

        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        maximize_frame=$(
          maximized_work_area_frame \
            "$baseline_second" \
            "$output_frame" 2>/dev/null \
            || true
        )

        if ! frame_is_valid "$output_frame" \
          || ! frame_is_valid "$maximize_frame" \
          || [[ "$baseline_second" == "$maximize_frame" ]]; then
          record_focus_state "physical maximize work-area frame was invalid"
          return 1
        fi

        if ! request_physical_shortcut m-enter \
          || ! wait_for_window_maximized_state "$title_b" true \
          || ! wait_for_frames \
            "$baseline_first" \
            "$maximize_frame" \
            "$baseline_third" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+M maximize entry failed"
          {
            printf 'expected maximized frames: %s | %s | %s\n' \
              "$baseline_first" \
              "$maximize_frame" \
              "$baseline_third"
            printf 'actual maximized frames: %s | %s | %s\n' \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical Meta+M entered native maximize without moving siblings"

        if ! request_physical_shortcut m-exit \
          || ! wait_for_window_maximized_state "$title_b" false \
          || ! wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical Meta+M maximize exit failed"
          {
            printf 'expected maximize restore frames: %s | %s | %s\n' \
              "$baseline_first" \
              "$baseline_second" \
              "$baseline_third"
            printf 'actual maximize restore frames: %s | %s | %s\n' \
              "$(window_frame "$title_a" 2>/dev/null || true)" \
              "$(window_frame "$title_b" 2>/dev/null || true)" \
              "$(window_frame "$title_c" 2>/dev/null || true)"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical Meta+M restored the exact tiled layout and focus"
      }

      verify_real_applications() {
        local baseline_first
        local baseline_second
        local baseline_third
        local calculator_pid
        local calculator_query=""
        local calculator_title="Driftile VM KDE Calculator"
        local firefox_pid
        local firefox_profile
        local firefox_query=""
        local firefox_title="Driftile VM Firefox"
        local xterm_pid
        local xterm_query=""
        local xterm_title="Driftile VM XWayland Terminal"

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && capture_stable_frames \
          || return 1
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        firefox_profile=$(mktemp -d -t driftile-firefox.XXXXXXXXXX) || return 1

        if ! cp ${firefoxPreferences} "$firefox_profile/user.js"; then
          rm -rf -- "$firefox_profile"
          return 1
        fi

        env \
          MOZ_CRASHREPORTER_DISABLE=1 \
          MOZ_DATA_REPORTING=0 \
          MOZ_ENABLE_WAYLAND=1 \
          ${pkgs.firefox}/bin/firefox \
          --new-instance \
          --no-remote \
          --profile "$firefox_profile" \
          --new-window "file://${firefoxPage}" \
          >/tmp/driftile-vm-firefox.log 2>&1 &
        firefox_pid=$!

        if ! wait_for_window_query firefox_query "$firefox_title"; then
          terminate_process "$firefox_pid"

          if wait_for_window_gone_contains "$firefox_title"; then
            rm -rf -- "$firefox_profile"
          fi

          record_focus_state "Firefox window discovery failed"
          return 1
        fi

        if ! verify_real_application_window \
          "Firefox" \
          "$firefox_query" \
          firefox \
          false; then
          record_real_application_state "Firefox acceptance failed" "$firefox_query"
          if close_real_application_and_restore \
              "$firefox_query" \
              "$firefox_pid" \
              "$baseline_first" \
              "$baseline_second" \
              "$baseline_third"; then
            rm -rf -- "$firefox_profile"
          fi

          return 1
        fi

        if ! close_real_application_and_restore \
            "$firefox_query" \
            "$firefox_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          return 1
        fi
        if ! rm -rf -- "$firefox_profile"; then
          record_focus_state "Firefox profile cleanup failed"
          return 1
        fi

        record_focus_state "Firefox closed and the tiled layout reflowed"

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && capture_stable_frames \
          || return 1
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame

        env QT_QPA_PLATFORM=wayland \
          ${pkgs.kdePackages.kcalc}/bin/kcalc \
          --qwindowtitle "$calculator_title" \
          >/tmp/driftile-vm-kcalc.log 2>&1 &
        calculator_pid=$!

        if ! wait_for_window_query \
          calculator_query \
          "$calculator_title" \
          KCalc; then
          terminate_process "$calculator_pid"
          record_focus_state "KDE Calculator window discovery failed"
          return 1
        fi

        if ! verify_real_application_window \
          "KDE Calculator" \
          "$calculator_query" \
          kcalc \
          false; then
          record_real_application_state \
            "KDE Calculator acceptance failed" \
            "$calculator_query"
          close_real_application_and_restore \
            "$calculator_query" \
            "$calculator_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
            || true
          return 1
        fi

        close_real_application_and_restore \
          "$calculator_query" \
          "$calculator_pid" \
          "$baseline_first" \
          "$baseline_second" \
          "$baseline_third" \
          || return 1
        record_focus_state "KDE Calculator closed and the tiled layout reflowed"

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && capture_stable_frames \
          || return 1
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame

        DISPLAY="''${DISPLAY:-:0}" \
          ${pkgs.xterm}/bin/xterm \
          -T "$xterm_title" \
          -b 2 \
          -class DriftileXTerm \
          -fn fixed \
          -geometry 80x24 \
          -e ${pkgs.coreutils}/bin/sleep 300 \
          >/tmp/driftile-vm-xterm.log 2>&1 &
        xterm_pid=$!

        if ! wait_for_window_query xterm_query "$xterm_title"; then
          terminate_process "$xterm_pid"
          record_focus_state "XWayland terminal window discovery failed"
          return 1
        fi

        if ! verify_real_application_window \
          "XWayland terminal" \
          "$xterm_query" \
          xterm \
          true; then
          record_real_application_state \
            "XWayland terminal acceptance failed" \
            "$xterm_query"
          close_real_application_and_restore \
            "$xterm_query" \
            "$xterm_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
            || true
          return 1
        fi

        if ! verify_xterm_resize_increment_policy "$xterm_query"; then
          record_real_application_failure \
            "XWayland terminal" \
            "$xterm_query" \
            "resize-increment policy" \
            xterm \
            true
          close_real_application_and_restore \
            "$xterm_query" \
            "$xterm_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
            || true
          return 1
        fi

        close_real_application_and_restore \
          "$xterm_query" \
          "$xterm_pid" \
          "$baseline_first" \
          "$baseline_second" \
          "$baseline_third" \
          || return 1
        record_focus_state "XWayland terminal closed and the tiled layout reflowed"
      }

      loaded=false

      for _ in $(seq 1 200); do
        state=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          isScriptLoaded \
          s ${pluginId} 2>/dev/null || true)

        if [[ "$state" == "b true" ]]; then
          loaded=true
          break
        fi

        sleep 0.1
      done

      if [[ "$loaded" == true ]]; then
        status="Driftile loaded"
      else
        status="Driftile failed to load"
      fi

      kscreen-doctor output.1.mode.1680x1050@60 \
        || kscreen-doctor output.1.mode.1680x1050 \
        || true
      kscreen-doctor -o > /tmp/shared/driftile-display

      printf '%s\n' "$loaded" > /tmp/shared/driftile-loaded

      primary_desktop_id=""
      secondary_desktop_id=""
      desktops_ready=false

      if prepare_test_desktops; then
        desktops_ready=true
      fi

      base_title_a="$status - Konsole A - Meta+H"
      base_title_b="$status - Konsole B - middle column"
      base_title_c="$status - Konsole C - Meta+L"
      base_title_d="Driftile VM Firefox"
      base_title_d_konsole="$status - Konsole D - consume and expel"
      base_title_e="$status - XWayland xterm E - minimized edge"
      base_title_desktop_destination="$status - KCalc desktop destination"
      title_a="$base_title_a"
      title_b="$base_title_b"
      title_c="$base_title_c"
      title_d="$base_title_d"
      title_e="$base_title_e"
      title_desktop_destination="$base_title_desktop_destination"
      first_window=""
      second_window=""
      third_window=""
      desktop_window=""
      fifth_window=""
      fourth_window=""
      fourth_window_profile=""
      trap cleanup_temporary_windows EXIT
      : > /tmp/shared/driftile-focus-diagnostics

      start_konsole_window first_window title_a "$base_title_a" \
        && wait_for_window "$title_a" \
        && activate_window "$title_a" \
        && wait_for_active "$title_a" \
        || true

      start_konsole_window second_window title_b "$base_title_b" \
        && wait_for_window "$title_b" \
        && activate_window "$title_b" \
        && wait_for_active "$title_b" \
        || true

      start_konsole_window third_window title_c "$base_title_c" || true

      focus_verified=false

      if [[ "$loaded" == true && "$desktops_ready" == true ]] \
        && verify_focus \
        && verify_physical_consume_expel_shortcuts \
        && verify_physical_layer_focus_shortcut \
        && verify_physical_floating_navigation_shortcuts \
        && verify_physical_width_shortcuts \
        && verify_physical_height_shortcuts \
        && verify_physical_column_view_shortcuts \
        && verify_physical_fullscreen_shortcut \
        && verify_physical_maximize_shortcut \
        && verify_real_applications; then
        focus_verified=true
      fi

      cleanup_temporary_windows

      if [[ -n "$primary_desktop_id" ]]; then
        set_current_desktop "$primary_desktop_id" || true
      fi

      printf '%s\n' "$focus_verified" > /tmp/shared/driftile-focus-verified

      if [[ -n "$first_window" && -n "$second_window" && -n "$third_window" ]]; then
        wait "$first_window" "$second_window" "$third_window"
      fi
    '';
  };
  kwinConfig = pkgs.writeText "driftile-vm-kwinrc" ''
    [Plugins]
    ${pluginId}Enabled=true

    [Script-${pluginId}]
    ColumnWidthStepPercent=10
    DefaultColumnWidthPercent=50
    Gap=16
  '';
  screenLockerConfig = pkgs.writeText "driftile-vm-kscreenlockerrc" ''
    [Daemon]
    Autolock=false
    LockOnResume=false
    LockOnStart=false
    RequirePassword=false
    Timeout=0
  '';
  powerDevilConfig = pkgs.writeText "driftile-vm-powerdevilrc" ''
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
{
  networking.hostName = "driftile-vm";
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

  environment.systemPackages = [
    demo
    self.packages.${pkgs.stdenv.hostPlatform.system}.driftile
  ];

  system.activationScripts.driftileVmUserConfig = {
    deps = [ "users" ];
    text = ''
      ${pkgs.coreutils}/bin/install \
        -d -m 0700 -o driftile -g users \
        /home/driftile/.config
      ${pkgs.coreutils}/bin/install \
        -m 0600 -o driftile -g users \
        ${kwinConfig} \
        /home/driftile/.config/kwinrc
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

  environment.etc."xdg/autostart/${pluginId}-demo.desktop".text = ''
    [Desktop Entry]
    Type=Application
    Name=Driftile VM demo
    Exec=${demo}/bin/driftile-demo
    OnlyShowIn=KDE;
    X-KDE-autostart-after=panel
  '';

  virtualisation.vmVariant.virtualisation = {
    cores = 8;
    diskImage = null;
    graphics = true;
    memorySize = 8192;
    resolution = {
      x = 1680;
      y = 1050;
    };
    restrictNetwork = true;
    qemu = {
      forceAccel = true;
      options = [
        "-display gtk,gl=off"
        "-vga none"
        "-device virtio-gpu-pci,xres=1680,yres=1050"
      ];
    };
  };
}
