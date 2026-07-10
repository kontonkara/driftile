{
  pkgs,
  self,
  ...
}:

let
  pluginId = "io.github.kontonkara.driftile";
  demoClient = ../tools/integration/client.qml;
  fixedSizeClient = ../tools/integration/fixed-size-client.qml;
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
      pkgs.kdePackages.libkscreen
      pkgs.kdePackages.qtdeclarative
      pkgs.systemd
      pkgs.xprop
    ];
    text = ''
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
              | select(.[1] == $title or .[1] == ($title + " [active]"))
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

      window_is_active() {
        local title=$1

        busctl --user --json=short call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Match \
          s "$title" 2>/dev/null \
          | jq --exit-status --arg active_title "$title [active]" \
            '[.data[0][] | select(.[1] == $active_title)] | length == 1' \
            >/dev/null
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
              | select(
                  (.[1] | sub(" \\[active\\]$"; ""))
                  | contains($needle)
                )
            ]
            | unique_by(.[0])
            | select(length == 1)
            | .[0][0]
          '
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
            && "$shortcuts" == *"driftile_focus_previous_desktop"* \
            && "$shortcuts" == *"driftile_focus_next_desktop"* \
            && "$shortcuts" == *"driftile_focus_output_left"* \
            && "$shortcuts" == *"driftile_focus_output_right"* \
            && "$shortcuts" == *"driftile_focus_output_up"* \
            && "$shortcuts" == *"driftile_focus_output_down"* \
            && "$shortcuts" == *"driftile_move_column_to_previous_desktop"* \
            && "$shortcuts" == *"driftile_move_column_to_next_desktop"* \
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
            && "$shortcuts" == *"driftile_decrease_column_width"* \
            && "$shortcuts" == *"driftile_increase_column_width"* \
            && "$shortcuts" == *"driftile_increase_column_width_plus"* \
            && "$shortcuts" == *"driftile_switch_preset_column_width"* \
            && "$shortcuts" == *"driftile_switch_preset_column_width_back"* \
            && "$shortcuts" == *"driftile_maximize_column"* \
            && "$shortcuts" == *"driftile_center_column"* \
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
            | map(select(type == "string") | ascii_downcase)
            | if length == 0 then
                true
              else
                any(.[]; contains($expected))
              end
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
        local tiled_first=$1
        local tiled_first_height
        local tiled_first_width
        local tiled_first_y
        local tiled_second=$2
        local tiled_third=$3
        local tiled_third_height
        local tiled_third_width
        local tiled_third_y

        frame_is_valid "$tiled_first" \
          && frame_is_valid "$tiled_second" \
          && frame_is_valid "$tiled_third" \
          || return 1
        IFS=, read -r \
          _ \
          tiled_first_y \
          tiled_first_width \
          tiled_first_height \
          <<< "$tiled_first"
        IFS=, read -r \
          _ \
          tiled_third_y \
          tiled_third_width \
          tiled_third_height \
          <<< "$tiled_third"

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

            if ((first_y == tiled_first_y \
              && first_width == tiled_first_width \
              && first_height == tiled_first_height \
              && third_y == tiled_third_y \
              && third_width == tiled_third_width \
              && third_height == tiled_third_height \
              && first_y == third_y \
              && first_width == third_width \
              && first_height == third_height \
              && first_x + first_width < third_x)) \
              && [[ "$current_first" != "$tiled_first" \
                && "$current_third" != "$tiled_third" ]] \
              && [[ "$current_second" != "$current_first" \
                && "$current_second" != "$current_third" ]]; then
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

      wait_for_middle_width() {
        local attempt
        local comparison=$1
        local expected_first=$2
        local reference_second=$3
        local expected_third=$4
        local first_width
        local matches
        local second_width
        local stable_samples=0
        local third_width

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          first_width=$(window_frame_width "$title_a" 2>/dev/null || true)
          second_width=$(window_frame_width "$title_b" 2>/dev/null || true)
          third_width=$(window_frame_width "$title_c" 2>/dev/null || true)
          matches=false

          if [[ "$first_width" =~ ^[0-9]+$ \
            && "$second_width" =~ ^[0-9]+$ \
            && "$third_width" =~ ^[0-9]+$ ]] \
            && ((first_width == expected_first && third_width == expected_third)); then
            case "$comparison" in
              equal)
                ((second_width == reference_second)) && matches=true
                ;;
              greater)
                ((second_width > reference_second)) && matches=true
                ;;
              less)
                ((second_width < reference_second)) && matches=true
                ;;
              *)
                return 1
                ;;
            esac
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

        if ! invoke_shortcut "driftile_focus_column_right"; then
          record_real_application_failure \
            "$label" "$query" "initial focus-right shortcut" \
            "$expected_identity" "$expected_x11"
          return 1
        fi

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

      close_real_application_and_restore() {
        local baseline_first=$3
        local baseline_second=$4
        local baseline_third=$5
        local pid=$2
        local query=$1

        terminate_process "$pid"

        wait_for_window_gone_contains "$query" \
          && activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"
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

      verify_automatic_floating() {
        local first_frame
        local fixed_frame
        local fixed_title="$status - fixed-size automatic floating"
        local fixed_window
        local restored=false
        local second_frame
        local third_frame
        local verified=false

        capture_stable_frames || return 1
        first_frame=$stable_first_frame
        second_frame=$stable_second_frame
        third_frame=$stable_third_frame

        qml ${fixedSizeClient} -- "$fixed_title" &
        fixed_window=$!

        if wait_for_window "$fixed_title" \
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
          && automatic_floating_shortcut_is_no_op \
            "driftile_move_column_to_next_desktop" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame" \
          && automatic_floating_shortcut_is_no_op \
            "driftile_move_column_to_output_right" \
            "$fixed_title" \
            "$first_frame" \
            "$second_frame" \
            "$third_frame" \
            "$fixed_frame"; then
          verified=true
        fi

        kill "$fixed_window" >/dev/null 2>&1 || true
        wait "$fixed_window" >/dev/null 2>&1 || true

        if wait_for_window_gone "$fixed_title" \
          && set_current_desktop "$primary_desktop_id" \
          && activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_frames "$first_frame" "$second_frame" "$third_frame"; then
          restored=true
        fi

        [[ "$verified" == true && "$restored" == true ]]
      }

      verify_focus() {
        local baseline_first_width
        local baseline_second_width
        local baseline_third_width
        local border_query
        local desktop_source_width
        local desktop_window
        local direct_insert_verified
        local first_trailing_desktop_id=""
        local floating_first_frame
        local floating_second_frame
        local floating_third_frame
        local merged_first_frame
        local merged_second_frame
        local merged_third_frame
        local singleton_first_frame
        local singleton_second_frame
        local singleton_third_frame
        local second_trailing_desktop_id=""

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

        IFS=, read -r _ _ baseline_first_width _ <<< "$stable_first_frame"
        IFS=, read -r _ _ baseline_second_width _ <<< "$stable_second_frame"
        IFS=, read -r _ _ baseline_third_width _ <<< "$stable_third_frame"

        if [[ ! "$baseline_first_width" =~ ^[0-9]+$ \
          || ! "$baseline_second_width" =~ ^[0-9]+$ \
          || ! "$baseline_third_width" =~ ^[0-9]+$ ]]; then
          return 1
        fi

        record_focus_state "window B activated for column resizing"

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

        invoke_shortcut "driftile_toggle_floating" \
          && wait_for_floating_layout \
            "$singleton_first_frame" \
            "$singleton_second_frame" \
            "$singleton_third_frame" \
          && wait_for_real_window_borderless "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
        floating_first_frame=$stable_first_frame
        floating_second_frame=$stable_second_frame
        floating_third_frame=$stable_third_frame
        record_focus_state "window B floated from its tiled column"

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
        qml ${demoClient} -- --mark-active "$title_desktop_destination" &
        desktop_window=$!

        wait_for_window "$title_desktop_destination" \
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

        invoke_shortcut "driftile_move_window_to_next_desktop" \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && wait_for_window_desktop "$title_b" "$secondary_desktop_id" \
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
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state "redundant trailing desktop removed"

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

        kill "$desktop_window" >/dev/null 2>&1 || true
        wait "$desktop_window" >/dev/null 2>&1 || true
        desktop_window=""
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

        qml ${demoClient} -- --mark-active "$title_d" &
        fourth_window=$!
        direct_insert_verified=false

        if wait_for_window "$title_d" \
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
          && wait_for_active "$title_d"; then
          direct_insert_verified=true
          record_focus_state "window D inserted directly into the left stack"
        else
          record_focus_state "direct stack insertion failed"
        fi

        kill "$fourth_window" >/dev/null 2>&1 || true
        wait "$fourth_window" >/dev/null 2>&1 || true
        fourth_window=""

        wait_for_window_gone "$title_d" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$merged_first_frame" \
            "$merged_second_frame" \
            "$merged_third_frame" \
          || return 1
        record_focus_state "three-window layout restored after direct insertion"

        [[ "$direct_insert_verified" == true ]] || return 1

        invoke_shortcut "driftile_toggle_floating" \
          && wait_for_frames \
            "$floating_first_frame" \
            "$floating_second_frame" \
            "$floating_third_frame" \
          && wait_for_real_window_borderless "$title_b" \
          && wait_for_active "$title_b" \
          || return 1
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

          if ((after_width > decreased_width)); then
            equal_width=$after_width
            record_focus_state "physical Meta+= increased the active column width"
            break
          fi

          sleep 0.1
        done

        if ((equal_width <= decreased_width)); then
          record_focus_state "physical Meta+= did not reach Driftile"
          return 1
        fi

        request_physical_shortcut plus || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          after_width=$(window_frame_width "$title_c") || return 1

          if ((after_width > equal_width)); then
            record_focus_state "physical Meta++ increased the active column width"
            invoke_shortcut "driftile_reset_column_width" || true
            return 0
          fi

          sleep 0.1
        done

        record_focus_state "physical Meta++ did not reach Driftile"
        return 1
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
        cp ${firefoxPreferences} "$firefox_profile/user.js" || return 1

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
          rm -rf "$firefox_profile"
          record_focus_state "Firefox window discovery failed"
          return 1
        fi

        if ! verify_real_application_window \
          "Firefox" \
          "$firefox_query" \
          firefox \
          false; then
          record_real_application_state "Firefox acceptance failed" "$firefox_query"
          close_real_application_and_restore \
            "$firefox_query" \
            "$firefox_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
            || true
          rm -rf "$firefox_profile"
          return 1
        fi

        close_real_application_and_restore \
          "$firefox_query" \
          "$firefox_pid" \
          "$baseline_first" \
          "$baseline_second" \
          "$baseline_third" \
          || return 1
        rm -rf "$firefox_profile"
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
          -class DriftileXTerm \
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

      title_a="$status - window A - Meta+H"
      title_b="$status - window B - middle column"
      title_c="$status - window C - Meta+L"
      title_d="$status - window D - direct insertion"
      title_desktop_destination="$status - desktop destination"
      fourth_window=""
      : > /tmp/shared/driftile-focus-diagnostics

      qml ${demoClient} -- --mark-active "$title_a" &
      first_window=$!

      wait_for_window "$title_a" \
        && activate_window "$title_a" \
        && wait_for_active "$title_a" \
        || true

      qml ${demoClient} -- --mark-active "$title_b" &
      second_window=$!

      wait_for_window "$title_b" \
        && activate_window "$title_b" \
        && wait_for_active "$title_b" \
        || true

      qml ${demoClient} -- --mark-active "$title_c" &
      third_window=$!

      focus_verified=false

      if [[ "$loaded" == true && "$desktops_ready" == true ]] \
        && verify_focus \
        && verify_physical_width_shortcuts \
        && verify_real_applications; then
        focus_verified=true
      fi

      if [[ -n "$primary_desktop_id" ]]; then
        set_current_desktop "$primary_desktop_id" || true
      fi

      printf '%s\n' "$focus_verified" > /tmp/shared/driftile-focus-verified

      wait "$first_window" "$second_window" "$third_window"
    '';
  };
  kwinConfig = pkgs.writeText "driftile-vm-kwinrc" ''
    [Plugins]
    ${pluginId}Enabled=true
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
    cores = 4;
    diskImage = null;
    graphics = true;
    memorySize = 4096;
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
