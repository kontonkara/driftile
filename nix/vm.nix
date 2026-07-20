{
  driftileVmTwoHead ? false,
  pkgs,
  ...
}:

let
  pluginId = "io.github.kontonkara.driftile";
  wheelControlPluginId = "driftile_wheel_control";
  overviewZoom = {
    config = "0.43";
    milli = 430;
  };
  activityMembershipProbe = ../tools/vm/activity-membership-probe.js;
  twoHeadGpu = builtins.toJSON {
    driver = "virtio-gpu-pci";
    id = "video0";
    max_outputs = 2;
    outputs = [
      {
        name = "Driftile-L";
        xres = 688;
        yres = 768;
      }
      {
        name = "Driftile-R";
        xres = 688;
        yres = 768;
      }
    ];
  };
  floatingNavigationProbe = ../tools/vm/floating-navigation-probe.js;
  interactiveResizeStateProbe = pkgs.writeText "driftile-vm-interactive-resize-state.js" ''
    var window = workspace.activeWindow;
    var publishedStates = {};

    if (window === null || window === undefined) {
      throw new Error("the interactive-resize probe requires an active window");
    }

    function publishState() {
      var frame = window.frameGeometry;
      var shortcutName = [
        "driftile_vm_pointer_state",
        String(window.move),
        String(window.resize),
        String(Math.round(frame.x)),
        String(Math.round(frame.y)),
        String(Math.round(frame.width)),
        String(Math.round(frame.height)),
        String(window.active),
      ].join("_");

      if (publishedStates[shortcutName]) {
        return;
      }
      publishedStates[shortcutName] = true;
      registerShortcut(
        shortcutName,
        "Driftile VM interactive resize state",
        "",
        function () {},
      );
    }

    window.moveResizedChanged.connect(publishState);
    publishState();
  '';
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
  firefoxWindowState = pkgs.writeText "driftile-vm-firefox-xulstore.json" (
    builtins.toJSON {
      "chrome://browser/content/browser.xhtml" = {
        "main-window" = {
          height = "650";
          screenX = "16";
          screenY = "16";
          sizemode = "normal";
          width = "640";
        };
      };
    }
  );
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
      activity_membership_probe_id="io.github.kontonkara.driftile.vm-activity-membership"
      floating_navigation_probe_id="io.github.kontonkara.driftile.vm-floating-navigation"
      interactive_resize_probe_id="io.github.kontonkara.driftile.vm-interactive-resize"
      overview_plugin_id="io.github.kontonkara.driftile.overview"
      overview_shortcut="driftile_toggle_overview"
      overview_shortcut_text="Driftile: Toggle overview"
      overview_default_keys='[[268435535,0,0,0]]'
      plasma_overview_effect_id="overview"
      wheel_control_effect_id="${wheelControlPluginId}"
      layout_state_file="''${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini"

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

      verify_shortcut_editor() {
        local editor_pid
        local verified=true

        driftile-shortcut-editor \
          > /tmp/shared/driftile-shortcut-editor.log \
          2>&1 &
        editor_pid=$!

        if ! wait_for_window "Driftile Shortcuts"; then
          verified=false
        else
          sleep 0.5
          if window_match_id "Shortcut editor" >/dev/null 2>&1; then
            verified=false
          fi
        fi

        terminate_process "$editor_pid"
        if ! wait_for_window_gone "Driftile Shortcuts"; then
          verified=false
        fi

        [[ "$verified" == true ]]
      }

      run_kwin_probe() {
        local load_result
        local probe_id=$2
        local script_id
        local unload_result

        busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$probe_id" \
          >/dev/null 2>&1 || true

        load_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          loadScript \
          ss "$1" "$probe_id" \
          2>/dev/null) || return 1

        if [[ ! "$load_result" =~ ^i\ ([0-9]+)$ ]]; then
          return 1
        fi

        script_id=''${BASH_REMATCH[1]}
        if ! busctl --user call \
          org.kde.KWin \
          "/Scripting/Script$script_id" \
          org.kde.kwin.Script \
          run \
          >/dev/null; then
          busctl --user call \
            org.kde.KWin \
            /Scripting \
            org.kde.kwin.Scripting \
            unloadScript \
            s "$probe_id" \
            >/dev/null 2>&1 || true
          return 1
        fi

        unload_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$probe_id" \
          2>/dev/null) || return 1

        [[ "$unload_result" == "b true" ]]
      }

      arrange_floating_navigation_windows() {
        run_kwin_probe ${floatingNavigationProbe} "$floating_navigation_probe_id"
      }

      capture_interactive_resize_state() {
        local attempt
        local expected_mode=''${1:-any}
        local load_result
        local probe_state=""
        local script_id
        local shortcuts
        local unload_result

        case "$expected_mode" in
          any | move | resize) ;;
          *) return 1 ;;
        esac

        busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$interactive_resize_probe_id" \
          >/dev/null 2>&1 || true

        load_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          loadScript \
          ss ${interactiveResizeStateProbe} "$interactive_resize_probe_id" \
          2>/dev/null) || return 1

        if [[ ! "$load_result" =~ ^i\ ([0-9]+)$ ]]; then
          return 1
        fi

        script_id=''${BASH_REMATCH[1]}
        if ! busctl --user call \
          org.kde.KWin \
          "/Scripting/Script$script_id" \
          org.kde.kwin.Script \
          run \
          >/dev/null; then
          busctl --user call \
            org.kde.KWin \
            /Scripting \
            org.kde.kwin.Scripting \
            unloadScript \
            s "$interactive_resize_probe_id" \
            >/dev/null 2>&1 || true
          return 1
        fi

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          shortcuts=$(busctl --user call \
            org.kde.kglobalaccel \
            /component/kwin \
            org.kde.kglobalaccel.Component \
            shortcutNames 2>/dev/null) || true

          if [[ "$expected_mode" == move \
            && "$shortcuts" =~ driftile_vm_pointer_state_true_false_(-?[0-9]+)_(-?[0-9]+)_([0-9]+)_([0-9]+)_(true|false) ]]; then
            probe_state="true,false,''${BASH_REMATCH[1]},''${BASH_REMATCH[2]},''${BASH_REMATCH[3]},''${BASH_REMATCH[4]},''${BASH_REMATCH[5]}"
            break
          fi

          if [[ "$expected_mode" == resize \
            && "$shortcuts" =~ driftile_vm_pointer_state_false_true_(-?[0-9]+)_(-?[0-9]+)_([0-9]+)_([0-9]+)_(true|false) ]]; then
            probe_state="false,true,''${BASH_REMATCH[1]},''${BASH_REMATCH[2]},''${BASH_REMATCH[3]},''${BASH_REMATCH[4]},''${BASH_REMATCH[5]}"
            break
          fi

          if [[ "$expected_mode" == any \
            && "$shortcuts" =~ driftile_vm_pointer_state_(true|false)_(true|false)_(-?[0-9]+)_(-?[0-9]+)_([0-9]+)_([0-9]+)_(true|false) ]]; then
            probe_state="''${BASH_REMATCH[1]},''${BASH_REMATCH[2]},''${BASH_REMATCH[3]},''${BASH_REMATCH[4]},''${BASH_REMATCH[5]},''${BASH_REMATCH[6]},''${BASH_REMATCH[7]}"
            break
          fi

          sleep 0.1
        done

        unload_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$interactive_resize_probe_id" \
          2>/dev/null) || return 1

        [[ "$unload_result" == "b true" && -n "$probe_state" ]] || return 1
        printf '%s' "$probe_state"
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

      active_window_classname() {
        kdotool getactivewindow getwindowclassname 2>/dev/null
      }

      active_window_is_krunner() {
        local classname

        classname=$(active_window_classname) || return 1
        [[ "$classname" == krunner || "$classname" == org.kde.krunner ]]
      }

      wait_for_active_krunner() {
        local attempt
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if active_window_is_krunner; then
            stable_samples=$((stable_samples + 1))

            if ((stable_samples >= 5)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      display_krunner() {
        busctl --user call \
          org.kde.krunner \
          /App \
          org.kde.krunner.App \
          display \
          >/dev/null
      }

      display_krunner_after_physical_close() {
        local active_caption
        local attempt
        local query=$2
        local sent_file="/tmp/shared/driftile-key-test-$1-sent"
        local shortcut_sent=false

        for ((attempt = 0; attempt < 1000; attempt += 1)); do
          if [[ -f "$sent_file" ]]; then
            shortcut_sent=true
          fi

          if [[ "$shortcut_sent" == true ]] \
            && active_caption=$(active_window_caption) \
            && [[ "$active_caption" != *"$query"* ]]; then
            display_krunner
            return
          fi

          sleep 0.01
        done

        return 1
      }

      toggle_krunner_display() {
        busctl --user call \
          org.kde.krunner \
          /App \
          org.kde.krunner.App \
          toggleDisplay \
          >/dev/null
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
        window_info_by_id "$id"
      }

      window_info_by_id() {
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$1" 2>/dev/null
      }

      window_has_exact_activity() {
        local activity=$2

        window_info_by_id "$1" \
          | jq --exit-status --arg activity "$activity" \
            '.data[0].activities.data == [$activity]' \
          >/dev/null
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

      virtual_desktop_rows() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /VirtualDesktopManager \
          org.kde.KWin.VirtualDesktopManager \
          rows 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data | select(type == "number" and . >= 1 and . <= 25)'
      }

      wait_for_virtual_desktop_rows() {
        local attempt
        local expected=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(virtual_desktop_rows 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
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

      wait_for_single_inserted_desktop_between() {
        local result_variable=$1
        local left_desktop_id=$2
        local right_desktop_id=$3
        local attempt
        local candidate=""
        local count
        local sequence
        local stable_candidate=""
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          count=$(virtual_desktop_count 2>/dev/null || true)
          candidate=$(virtual_desktop_id 1 2>/dev/null || true)
          sequence=$(virtual_desktop_sequence 2>/dev/null || true)

          if [[ "$count" == 3 \
            && -n "$candidate" \
            && "$candidate" != "$left_desktop_id" \
            && "$candidate" != "$right_desktop_id" \
            && "$sequence" == "$left_desktop_id $candidate $right_desktop_id" ]]; then
            if [[ "$candidate" == "$stable_candidate" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_candidate=$candidate
              stable_samples=1
            fi
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

      overview_spatial_drop_request_id() {
        ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
          --file "''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/driftile-overview-command.ini" \
          --group Command \
          --key last-request-id \
          --default 0
      }

      wait_for_overview_spatial_drop_request_after() {
        local attempt
        local current
        local previous=$1

        [[ "$previous" =~ ^[0-9]+$ ]] || return 1

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          current=$(overview_spatial_drop_request_id 2>/dev/null || true)
          if [[ "$current" =~ ^[1-9][0-9]*$ ]] && ((current != previous)); then
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
        wait_for_virtual_desktop_rows 2 || return 1
        set_current_desktop "$primary_desktop_id"
      }

      activity_manager_call() {
        busctl --user call \
          org.kde.ActivityManager \
          /ActivityManager/Activities \
          org.kde.ActivityManager.Activities \
          "$@"
      }

      activity_manager_json_call() {
        busctl --user --json=short call \
          org.kde.ActivityManager \
          /ActivityManager/Activities \
          org.kde.ActivityManager.Activities \
          "$@"
      }

      activity_ids() {
        activity_manager_json_call ListActivities 2>/dev/null \
          | jq --exit-status --raw-output '.data[0][]'
      }

      current_activity_id() {
        activity_manager_json_call CurrentActivity 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data[0] | select(type == "string" and length > 0)'
      }

      activity_exists() {
        local activities

        activities=$(activity_ids) || return 2
        grep -Fxq -- "$1" <<< "$activities"
      }

      create_activity() {
        local activity

        activity=$(activity_manager_json_call AddActivity s "$1" 2>/dev/null \
          | jq --exit-status --raw-output \
            '.data[0] | select(type == "string" and length > 0)') \
          || return 1

        printf '%s' "$activity"
      }

      wait_for_current_activity() {
        local attempt
        local expected=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(current_activity_id 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      set_current_activity() {
        local result

        result=$(activity_manager_call SetCurrentActivity s "$1" 2>/dev/null) \
          || return 1

        [[ "$result" == "b true" ]] && wait_for_current_activity "$1"
      }

      remove_activity() {
        local activity=$1
        local attempt
        local status

        activity_manager_call RemoveActivity s "$activity" >/dev/null \
          || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if activity_exists "$activity"; then
            status=0
          else
            status=$?
          fi

          ((status == 1)) && return 0
          sleep 0.1
        done

        return 1
      }

      assign_activity_fixture_windows() {
        run_kwin_probe ${activityMembershipProbe} "$activity_membership_probe_id"
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

      window_desktop_output_state_contains() {
        local desktop
        local output_frame=$2
        local output_height
        local output_width
        local output_x
        local output_y
        local state
        local window_frame
        local window_height
        local window_width
        local window_x
        local window_y

        frame_is_valid "$output_frame" || return 1
        state=$(
          window_info_contains "$1" \
            | jq --exit-status --raw-output '
                .data[0] as $window
                | ($window.desktops.data // []) as $desktops
                | select(
                    ($desktops | type) == "array"
                    and ($desktops | length) == 1
                    and ($desktops[0] | type) == "string"
                    and ($window.x.data | type) == "number"
                    and ($window.y.data | type) == "number"
                    and ($window.width.data | type) == "number"
                    and ($window.width.data > 0)
                    and ($window.height.data | type) == "number"
                    and ($window.height.data > 0)
                  )
                | [
                    $desktops[0],
                    (
                      [
                        $window.x.data,
                        $window.y.data,
                        $window.width.data,
                        $window.height.data
                      ]
                      | map(round | tostring)
                      | join(",")
                    )
                  ]
                | @tsv
              '
        ) || return 1
        IFS=$'\t' read -r desktop window_frame <<< "$state"
        frame_is_valid "$window_frame" || return 1
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        IFS=, read -r \
          window_x \
          window_y \
          window_width \
          window_height \
          <<< "$window_frame"

        ((window_x + window_width / 2 >= output_x \
          && window_x + window_width / 2 < output_x + output_width \
          && window_y + window_height / 2 >= output_y \
          && window_y + window_height / 2 < output_y + output_height)) \
          || return 1
        printf '%s|%s|%s\n' "$desktop" "$output_frame" "$window_frame"
      }

      wait_for_cross_desktop_pointer_destination() {
        local active
        local attempt
        local current
        local expected_desktop=$3
        local firefox_desktop
        local firefox_frame
        local firefox_output
        local firefox_state
        local output_frame=$4
        local previous=""
        local snapshot
        local stable_samples=0
        local target_desktop
        local target_frame
        local target_output
        local target_state

        [[ "$(single_enabled_output_frame 2>/dev/null || true)" \
          == "$output_frame" ]] || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current=$(current_desktop_id 2>/dev/null || true)
          firefox_state=$(
            window_desktop_output_state_contains \
              "$1" "$output_frame" 2>/dev/null || true
          )
          target_state=$(
            window_desktop_output_state_contains \
              "$2" "$output_frame" 2>/dev/null || true
          )
          IFS='|' read -r \
            firefox_desktop \
            firefox_output \
            firefox_frame \
            <<< "$firefox_state"
          IFS='|' read -r \
            target_desktop \
            target_output \
            target_frame \
            <<< "$target_state"
          active=$(active_window_caption 2>/dev/null || true)
          snapshot="$current|$firefox_state|$target_state|$active"

          if [[ "$current" == "$expected_desktop" \
            && "$firefox_desktop" == "$expected_desktop" \
            && "$target_desktop" == "$expected_desktop" \
            && "$firefox_output" == "$output_frame" \
            && "$target_output" == "$output_frame" \
            && -n "$firefox_frame" \
            && -n "$target_frame" \
            && "$active" == "$1" ]]; then
            if [[ "$snapshot" == "$previous" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_samples=1
            fi

            if ((stable_samples >= 2)); then
              return 0
            fi
          else
            stable_samples=0
          fi

          previous=$snapshot
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
            && "$shortcuts" == *"driftile_close_window"* \
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
            && "$shortcuts" == *"driftile_toggle_column_tabbed_display"* \
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

      wait_for_horizontal_order() {
        local attempt
        local first_x
        local relation=$2
        local second_x
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          first_x=$(window_frame_x "$1" 2>/dev/null || true)
          second_x=$(window_frame_x "$3" 2>/dev/null || true)

          if [[ "$first_x" =~ ^-?[0-9]+$ && "$second_x" =~ ^-?[0-9]+$ ]] \
            && { [[ "$relation" == left && "$first_x" -lt "$second_x" ]] \
              || [[ "$relation" == right && "$first_x" -gt "$second_x" ]]; }; then
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

      precise_window_frame() {
        local id

        id=$(window_id "$1") || return 1
        busctl --user --json=short call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          getWindowInfo \
          s "$id" 2>/dev/null \
          | jq --exit-status --raw-output '
            def coordinate:
              (((. * 1000000) | round) / 1000000) | tostring;
            .data[0] as $window
            | [
                $window.x.data,
                $window.y.data,
                $window.width.data,
                $window.height.data
              ]
            | select(map(type == "number") | all)
            | map(coordinate)
            | join(",")
          '
      }

      wait_for_precise_window_frame() {
        local attempt
        local current
        local expected=$2
        local stable_samples=0
        local title=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current=$(precise_window_frame "$title" 2>/dev/null || true)

          if [[ "$current" == "$expected" ]]; then
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

      set_center_focused_column() {
        local value=$1

        [[ "$value" == true || "$value" == false ]] || return 1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key CenterFocusedColumn \
          --type bool \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_application_focus_centering() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ApplicationFocusCentering \
          --type string \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_application_column_widths() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ApplicationColumnWidths \
          --type string \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_application_tiling_exclusions() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ApplicationTilingExclusions \
          --type string \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_application_borderless_exclusions() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ApplicationBorderlessExclusions \
          --type string \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_column_width_presets() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key ColumnWidthPresets \
          --type string \
          "$value" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      set_window_height_presets() {
        local value=$1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key WindowHeightPresets \
          --type string \
          "$value" \
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
          --key WindowHeightStepPercent \
          --type int \
          "$3" \
          || return 1
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "$HOME/.config/kwinrc" \
          --group "Script-${pluginId}" \
          --key Gap \
          --type int \
          "$4" \
          || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      restore_layout_configuration() {
        set_layout_configuration 50 10 10 16
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

      centered_frame_in_work_area() {
        local work_area=$1
        local frame=$2

        jq --exit-status --null-input --raw-output \
          --arg workArea "$work_area" \
          --arg frame "$frame" '
            def rect($raw):
              ($raw | split(",") | map(tonumber)) as $values
              | {
                  x: $values[0],
                  y: $values[1],
                  width: $values[2],
                  height: $values[3]
                };
            def coordinate:
              (((. * 1000000) | round) / 1000000) | tostring;
            (rect($workArea)) as $work
            | (rect($frame)) as $window
            | [
                $work.x + ([($work.width - $window.width) / 2, 0] | max),
                $work.y + ([($work.height - $window.height) / 2, 0] | max),
                $window.width,
                $window.height
              ]
            | map(coordinate)
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

      window_desktop_file_contains() {
        window_info_contains "$1" \
          | jq --exit-status --raw-output '
              .data[0].desktopFile.data
              | select(type == "string" and length > 0)
            '
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

      frame_width_matches_resize_lattice() {
        local frame=$1
        local policy=$2
        local width
        local increment_width
        local base_width

        [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
        resize_policy_is_nontrivial "$policy" || return 1
        IFS=, read -r _ _ width _ <<< "$frame"
        IFS=, read -r increment_width _ base_width _ <<< "$policy"

        ((width > 0 \
          && width >= base_width \
          && (width - base_width) % increment_width == 0))
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

      wait_for_real_window_decorated() {
        local attempt
        local state

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          state=$(real_window_border_state "$1" 2>/dev/null) || {
            sleep 0.1
            continue
          }

          if [[ "$state" == false ]]; then
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

      capture_stable_named_frame_set() {
        local attempt
        local current=""
        local frame
        local previous=""
        local query
        local required_samples=$1
        local stable_samples=0
        shift

        [[ "$required_samples" =~ ^[1-9][0-9]*$ && $# -gt 0 ]] \
          || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          current=""

          for query in "$@"; do
            frame=$(window_frame_contains "$query" 2>/dev/null || true)
            if ! frame_is_valid "$frame"; then
              current=""
              break
            fi
            if [[ -n "$current" ]]; then
              current+="|"
            fi
            current+="$frame"
          done

          if [[ -n "$current" && "$current" == "$previous" ]]; then
            stable_samples=$((stable_samples + 1))
          elif [[ -n "$current" ]]; then
            stable_samples=1
          else
            stable_samples=0
          fi

          previous=$current
          if ((stable_samples >= required_samples)); then
            printf '%s' "$current"
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_pointer_stack_order() {
        local attempt
        local bottom_frame
        local bottom_height
        local bottom_width
        local bottom_x
        local bottom_y
        local expected_width=$3
        local previous_layout=""
        local stable_samples=0
        local top_frame
        local top_height
        local top_width
        local top_x
        local top_y

        [[ "$expected_width" =~ ^[1-9][0-9]*$ ]] || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          top_frame=$(window_frame_contains "$1" 2>/dev/null || true)
          bottom_frame=$(window_frame_contains "$2" 2>/dev/null || true)

          if frame_is_valid "$top_frame" && frame_is_valid "$bottom_frame"; then
            IFS=, read -r top_x top_y top_width top_height <<< "$top_frame"
            IFS=, read -r \
              bottom_x \
              bottom_y \
              bottom_width \
              bottom_height \
              <<< "$bottom_frame"

            if ((top_x == bottom_x \
              && top_width == expected_width \
              && bottom_width == expected_width \
              && top_y + top_height < bottom_y \
              && bottom_y + bottom_height > top_y + top_height)); then
              if [[ "$top_frame|$bottom_frame" == "$previous_layout" ]]; then
                stable_samples=$((stable_samples + 1))
              else
                stable_samples=1
              fi

              if ((stable_samples >= 2)); then
                return 0
              fi
            else
              stable_samples=0
            fi
          else
            stable_samples=0
          fi

          previous_layout="$top_frame|$bottom_frame"
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

      focused_column_frames_are_centered() {
        local baseline_first=$1
        local baseline_second=$2
        local baseline_third=$3
        local current_first=$4
        local current_second=$5
        local current_third=$6
        local work_area=$7
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
        local first_delta
        local first_height
        local first_width
        local first_x
        local first_y
        local midpoint_difference
        local second_delta
        local second_height
        local second_width
        local second_x
        local second_y
        local third_delta
        local third_height
        local third_width
        local third_x
        local third_y
        local work_area_width
        local work_area_x

        frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_second" \
          && frame_is_valid "$baseline_third" \
          && frame_is_valid "$current_first" \
          && frame_is_valid "$current_second" \
          && frame_is_valid "$current_third" \
          && frame_is_valid "$work_area" \
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
        IFS=, read -r work_area_x _ work_area_width _ <<< "$work_area"

        ((baseline_first_x < baseline_second_x \
          && baseline_second_x < baseline_third_x \
          && work_area_width > 0)) \
          || return 1
        IFS=, read -r first_x first_y first_width first_height \
          <<< "$current_first"
        IFS=, read -r second_x second_y second_width second_height \
          <<< "$current_second"
        IFS=, read -r third_x third_y third_width third_height \
          <<< "$current_third"
        first_delta=$((first_x - baseline_first_x))
        second_delta=$((second_x - baseline_second_x))
        third_delta=$((third_x - baseline_third_x))
        midpoint_difference=$((
          2 * (second_x - work_area_x) \
            + second_width \
            - work_area_width
        ))
        ((midpoint_difference < 0)) \
          && midpoint_difference=$((-midpoint_difference))

        ((first_y == baseline_first_y \
          && first_width == baseline_first_width \
          && first_height == baseline_first_height \
          && second_y == baseline_second_y \
          && second_width == baseline_second_width \
          && second_height == baseline_second_height \
          && third_y == baseline_third_y \
          && third_width == baseline_third_width \
          && third_height == baseline_third_height \
          && first_x < second_x \
          && second_x < third_x \
          && first_delta != 0 \
          && first_delta == second_delta \
          && second_delta == third_delta \
          && midpoint_difference <= 2))
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

      shortcut_is_registered() {
        busctl --user call \
          org.kde.kglobalaccel \
          /component/kwin \
          org.kde.kglobalaccel.Component \
          shortcutNames 2>/dev/null \
          | grep -Fq "$1"
      }

      wait_for_shortcut_registration_state() {
        local attempt
        local expected=$2
        local shortcut=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
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

      kwin_shortcut_names() {
        busctl --user --json=short call \
          org.kde.kglobalaccel \
          /component/kwin \
          org.kde.kglobalaccel.Component \
          shortcutNames 2>/dev/null \
          | jq --exit-status --compact-output '
            .data[0]
            | select(type == "array" and all(.[]; type == "string"))
            | sort
          '
      }

      core_script_loaded_state() {
        local state

        state=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          isScriptLoaded \
          s ${pluginId} 2>/dev/null) || return 1

        case "$state" in
          "b true") printf '%s' true ;;
          "b false") printf '%s' false ;;
          *) return 1 ;;
        esac
      }

      effect_is_available() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          listOfEffects 2>/dev/null \
          | jq --exit-status \
            --arg effectId "$1" \
            '.data | any(. == $effectId)' \
            >/dev/null
      }

      effect_loaded_state() {
        local state

        state=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          isEffectLoaded \
          s "$1" 2>/dev/null) || return 1

        case "$state" in
          "b true") printf '%s' true ;;
          "b false") printf '%s' false ;;
          *) return 1 ;;
        esac
      }

      effect_active_state() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          activeEffects 2>/dev/null \
          | jq --exit-status --raw-output \
            --arg effectId "$1" \
            '.data | any(. == $effectId) | tostring'
      }

      kwin_process_id() {
        local process_id
        local reply
        local signature
        local trailing

        reply=$(busctl --user call \
          org.freedesktop.DBus \
          /org/freedesktop/DBus \
          org.freedesktop.DBus \
          GetConnectionUnixProcessID \
          s org.kde.KWin 2>/dev/null) || return 1
        read -r signature process_id trailing <<< "$reply"

        [[ "$signature" == u \
          && "$process_id" =~ ^[1-9][0-9]*$ \
          && -z "$trailing" ]] || return 1

        printf '%s' "$process_id"
      }

      kwin_process_is_unchanged() {
        local expected_process_id=$1
        local process_id

        process_id=$(kwin_process_id) || return 1
        [[ "$process_id" == "$expected_process_id" ]]
      }

      wait_for_effect_loaded_state() {
        local attempt
        local effect_id=$1
        local expected=$2

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(effect_loaded_state "$effect_id" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_effect_active_state() {
        local attempt
        local effect_id=$1
        local expected=$2

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(effect_active_state "$effect_id" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      load_overview_effect() {
        local result

        result=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          loadEffect \
          s "$overview_plugin_id" 2>/dev/null) || return 1

        [[ "$result" == "b true" ]] \
          && wait_for_effect_loaded_state "$overview_plugin_id" true
      }

      unload_overview_effect() {
        busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          unloadEffect \
          s "$overview_plugin_id" \
          >/dev/null 2>&1 || return 1

        wait_for_effect_loaded_state "$overview_plugin_id" false
      }

      capture_journal_cursor() {
        local line

        while IFS= read -r line; do
          if [[ "$line" == "-- cursor: "* ]]; then
            printf '%s' "''${line#-- cursor: }"
            return 0
          fi
        done < <(journalctl --user -n 0 --show-cursor --no-pager -o cat 2>/dev/null)

        return 1
      }

      overview_component_errors_after() {
        local errors
        local journal

        journal=$(journalctl \
          --user \
          --after-cursor "$1" \
          --no-pager \
          -o cat 2>/dev/null) || return 1

        if errors=$(printf '%s\n' "$journal" \
          | grep -Ei 'io\.github\.kontonkara\.driftile\.overview|driftile-overview' \
          | grep -Ei 'QQml|component|error|failed|not found|not ready|not a type|unavailable'); then
          {
            printf '\n[overview component errors]\n'
            printf '%s\n' "$errors"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi

        return 0
      }

      overview_layout_representation() {
        ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
          --file "$layout_state_file" \
          --group Layout \
          --key layout-v1 \
          --default ""
      }

      normalize_overview_layout_document() {
        jq --exit-status --compact-output --slurp '
          select(length == 1)
          | .[0]
          | if type == "object" then
              .
            elif type == "string" then
              fromjson | select(type == "object")
            else
              empty
            end
        '
      }

      overview_checkpoint_trace() {
        printf '[overview checkpoint] %s\n' "$1" \
          >> /tmp/shared/driftile-focus-diagnostics
      }

      wait_for_stable_overview_layout_digest() {
        local attempt
        local canonical_bytes=0
        local current=""
        local file_bytes=0
        local file_exists=false
        local first_digest
        local layout_document
        local layout_representation
        local previous=""
        local representation_bytes=0
        local samples=""
        local second_digest
        local stable_samples=0
        local topology="unavailable"
        local version="unavailable"

        for ((attempt = 0; attempt < 40; attempt += 1)); do
          canonical_bytes=0
          current="invalid"
          file_bytes=0
          file_exists=false
          representation_bytes=0
          topology="unavailable"
          version="unavailable"

          if [[ -e "$layout_state_file" ]]; then
            file_exists=true
            file_bytes=$(stat --format '%s' "$layout_state_file" 2>/dev/null || printf '0')
          fi

          if [[ -s "$layout_state_file" ]] \
            && first_digest=$(sha256sum "$layout_state_file" 2>/dev/null) \
            && layout_representation=$(overview_layout_representation 2>/dev/null) \
            && second_digest=$(sha256sum "$layout_state_file" 2>/dev/null); then
            first_digest=''${first_digest%% *}
            second_digest=''${second_digest%% *}
            representation_bytes=''${#layout_representation}

            if [[ "$first_digest" == "$second_digest" ]] \
              && layout_document=$(normalize_overview_layout_document \
                <<< "$layout_representation" 2>/dev/null); then
              canonical_bytes=''${#layout_document}
              version=$(jq --raw-output '.version // "missing"' \
                <<< "$layout_document" 2>/dev/null || printf 'invalid-json')
              topology=$(jq --raw-output '
                if (.snapshots | type) == "array"
                  and (.snapshots | length) > 0
                then (.snapshots[0].topology != null | tostring)
                else "missing"
                end
              ' <<< "$layout_document" 2>/dev/null || printf 'invalid-json')

              if jq --exit-status '
                .version == 2
                  and (.snapshots | length) > 0
                  and .snapshots[0].topology != null
                ' <<< "$layout_document" >/dev/null; then
                current=$second_digest
              fi
            fi
          fi

          samples+="''${samples:+,}''${current:0:12}"

          if [[ "$current" != invalid ]]; then

            if [[ -n "$previous" && "$current" == "$previous" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_samples=1
            fi
            previous=$current

            if ((stable_samples >= 5)); then
              overview_checkpoint_trace \
                "layout barrier=stable path=$layout_state_file exists=$file_exists file-bytes=$file_bytes representation-bytes=$representation_bytes canonical-bytes=$canonical_bytes version=$version topology=$topology samples=$samples"
              printf '%s' "$current"
              return 0
            fi
          else
            previous=""
            stable_samples=0
          fi

          sleep 0.1
        done

        overview_checkpoint_trace \
          "layout barrier=failed path=$layout_state_file exists=$file_exists file-bytes=$file_bytes representation-bytes=$representation_bytes canonical-bytes=$canonical_bytes version=$version topology=$topology samples=$samples"
        return 1
      }

      overview_checkpoint_once() {
        local active_caption
        local built_in_active
        local built_in_loaded
        local current_desktop
        local desktop_sequence
        local digest
        local frame
        local frames=""
        local quoted_title
        local title

        digest=$(wait_for_stable_overview_layout_digest) || {
          overview_checkpoint_trace "field=layout-digest result=failed"
          return 1
        }
        desktop_sequence=$(virtual_desktop_sequence) || {
          overview_checkpoint_trace "field=desktop-sequence result=failed"
          return 1
        }
        current_desktop=$(current_desktop_id) || {
          overview_checkpoint_trace "field=current-desktop result=failed"
          return 1
        }
        active_caption=$(active_window_caption) || {
          overview_checkpoint_trace "field=active-caption result=failed"
          return 1
        }
        if [[ -z "$active_caption" ]]; then
          overview_checkpoint_trace "field=active-caption result=empty"
          return 1
        fi
        overview_checkpoint_trace \
          "fields digest=''${digest:0:12} desktops=$desktop_sequence current=$current_desktop active=$active_caption"

        for title in "$@"; do
          printf -v quoted_title '%q' "$title"
          frame=$(capture_stable_window_frame "$title") || {
            overview_checkpoint_trace \
              "field=frame title=$quoted_title result=failed current=$(window_frame "$title" 2>/dev/null || printf 'unavailable')"
            return 1
          }
          overview_checkpoint_trace \
            "field=frame title=$quoted_title result=stable value=$frame"
          frames+="''${frames:+|}$title=$frame"
        done

        built_in_loaded=$(effect_loaded_state "$plasma_overview_effect_id") || {
          overview_checkpoint_trace "field=built-in-loaded result=failed"
          return 1
        }
        built_in_active=$(effect_active_state "$plasma_overview_effect_id") || {
          overview_checkpoint_trace "field=built-in-active result=failed"
          return 1
        }
        overview_checkpoint_trace \
          "fields built-in-loaded=$built_in_loaded built-in-active=$built_in_active"

        printf '%s\037%s\037%s\037%s\037%s\037%s\037%s' \
          "$digest" \
          "$desktop_sequence" \
          "$current_desktop" \
          "$active_caption" \
          "$frames" \
          "$built_in_loaded" \
          "$built_in_active"
      }

      capture_overview_checkpoint() {
        local attempt
        local current
        local previous=""

        for ((attempt = 0; attempt < 20; attempt += 1)); do
          current=$(overview_checkpoint_once "$@") || {
            overview_checkpoint_trace \
              "checkpoint attempt=$attempt result=field-failure"
            previous=""
            sleep 0.1
            continue
          }

          if [[ -n "$previous" && "$current" == "$previous" ]]; then
            overview_checkpoint_trace \
              "checkpoint attempt=$attempt result=stable"
            printf '%s' "$current"
            return 0
          fi

          if [[ -n "$previous" ]]; then
            overview_checkpoint_trace \
              "checkpoint attempt=$attempt result=mismatch"
          fi
          previous=$current
          sleep 0.1
        done

        overview_checkpoint_trace "checkpoint result=failed"
        return 1
      }

      capture_stable_layout_bytes() {
        local bytes
        local expected_digest
        local first_digest
        local second_digest

        expected_digest=$(wait_for_stable_overview_layout_digest) || return 1
        first_digest=$(sha256sum "$layout_state_file" 2>/dev/null) || return 1
        bytes=$(base64 --wrap=0 "$layout_state_file" 2>/dev/null) || return 1
        second_digest=$(sha256sum "$layout_state_file" 2>/dev/null) || return 1
        first_digest=''${first_digest%% *}
        second_digest=''${second_digest%% *}

        [[ "$first_digest" == "$expected_digest" \
          && "$second_digest" == "$expected_digest" ]] || return 1
        printf '%s' "$bytes"
      }

      capture_stable_overview_active_semantic_digest() {
        local excluded_desktop_id=''${1:-}
        local expected_digest
        local first_digest
        local layout_document
        local layout_representation
        local second_digest
        local snapshot
        local snapshot_digest

        expected_digest=$(wait_for_stable_overview_layout_digest) || return 1
        first_digest=$(sha256sum "$layout_state_file" 2>/dev/null) || return 1
        layout_representation=$(overview_layout_representation 2>/dev/null) || return 1
        second_digest=$(sha256sum "$layout_state_file" 2>/dev/null) || return 1
        first_digest=''${first_digest%% *}
        second_digest=''${second_digest%% *}
        [[ "$first_digest" == "$expected_digest" \
          && "$second_digest" == "$expected_digest" ]] || return 1

        layout_document=$(normalize_overview_layout_document \
          <<< "$layout_representation" 2>/dev/null) || return 1
        if [[ -n "$excluded_desktop_id" ]] \
          && ! jq \
            --exit-status \
            --arg desktopId "$excluded_desktop_id" \
            '(.snapshots[0].state.contexts | all(.desktopId != $desktopId))
              and (.snapshots[0].state.floatingWindows | all(.desktopId != $desktopId))' \
            <<< "$layout_document" >/dev/null 2>&1; then
          return 1
        fi

        snapshot=$(jq \
          --exit-status \
          --sort-keys \
          --compact-output \
          '.snapshots[0]
            | select(type == "object")
            | .state.contexts |= map(
                del(.restoreFingerprint)
                | .columns |= map(.members |= map(del(.restoreBaseline)))
              )' \
          <<< "$layout_document" 2>/dev/null) || return 1
        snapshot_digest=$(printf '%s' "$snapshot" | sha256sum) || return 1
        printf '%s' "''${snapshot_digest%% *}"
      }

      touchpad_navigation_checkpoint_once() {
        local core_loaded
        local layout_bytes
        local overview_checkpoint
        local shortcut_names

        overview_checkpoint=$(overview_checkpoint_once "$@") || return 1
        layout_bytes=$(capture_stable_layout_bytes) || return 1
        shortcut_names=$(kwin_shortcut_names) || return 1
        core_loaded=$(core_script_loaded_state) || return 1
        [[ "$core_loaded" == true ]] || return 1

        printf '%s\036%s\036%s\036%s' \
          "$overview_checkpoint" \
          "$layout_bytes" \
          "$shortcut_names" \
          "$core_loaded"
      }

      capture_touchpad_navigation_checkpoint() {
        local attempt
        local current
        local previous=""

        for ((attempt = 0; attempt < 20; attempt += 1)); do
          current=$(touchpad_navigation_checkpoint_once "$@") || {
            previous=""
            sleep 0.1
            continue
          }

          if [[ -n "$previous" && "$current" == "$previous" ]]; then
            printf '%s' "$current"
            return 0
          fi

          previous=$current
          sleep 0.1
        done

        return 1
      }

      read_touchpad_navigation() {
        ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
          --file "''${XDG_CONFIG_HOME:-$HOME/.config}/kwinrc" \
          --group "Script-${pluginId}" \
          --key TouchpadNavigation \
          --default false
      }

      read_touchpad_workspace_navigation() {
        ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
          --file "''${XDG_CONFIG_HOME:-$HOME/.config}/kwinrc" \
          --group "Script-${pluginId}" \
          --key TouchpadWorkspaceNavigation \
          --default false
      }

      set_touchpad_navigation_modes() {
        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "''${XDG_CONFIG_HOME:-$HOME/.config}/kwinrc" \
          --group "Script-${pluginId}" \
          --key TouchpadNavigation \
          --type bool \
          "$1" || return 1

        ${pkgs.kdePackages.kconfig}/bin/kwriteconfig6 \
          --file "''${XDG_CONFIG_HOME:-$HOME/.config}/kwinrc" \
          --group "Script-${pluginId}" \
          --key TouchpadWorkspaceNavigation \
          --type bool \
          "$1" || return 1

        busctl --user call \
          org.kde.KWin \
          /KWin \
          org.kde.KWin \
          reconfigure \
          >/dev/null
      }

      restore_touchpad_navigation() {
        local result=0

        set_touchpad_navigation_modes false || result=1
        sleep 0.4
        [[ "$(read_touchpad_navigation 2>/dev/null || true)" == false ]] \
          || result=1
        [[ "$(read_touchpad_workspace_navigation 2>/dev/null || true)" == false ]] \
          || result=1
        return "$result"
      }

      touchpad_navigation_journal_is_clean_after() {
        local created_count
        local destroyed_count
        local diagnostics=""
        local journal
        local workspace_created_count
        local workspace_destroyed_count

        journal=$(journalctl \
          --user \
          --after-cursor "$1" \
          --no-pager \
          -o cat 2>/dev/null) || return 1
        created_count=$(grep -Foc \
          '[driftile] touchpad-navigation lifecycle=created' \
          <<< "$journal" || true)
        destroyed_count=$(grep -Foc \
          '[driftile] touchpad-navigation lifecycle=destroyed' \
          <<< "$journal" || true)
        workspace_created_count=$(grep -Foc \
          '[driftile] touchpad-workspace-navigation lifecycle=created' \
          <<< "$journal" || true)
        workspace_destroyed_count=$(grep -Foc \
          '[driftile] touchpad-workspace-navigation lifecycle=destroyed' \
          <<< "$journal" || true)

        if diagnostics=$(printf '%s\n' "$journal" \
          | grep -Ei -- 'Touchpad(Navigation|WorkspaceNavigation)\.qml' \
          | grep -Ei \
            '(^|[[:space:]:])qml([[:space:]:]|$)|qqml|component|error|fail(ed|ure)?|unavailable|not[[:space:]]+a[[:space:]]+type|is[[:space:]]+not[[:space:]]+installed|cannot[[:space:]]+(assign|create|load)|invalid'); then
          {
            printf '\n[touchpad-navigation QML diagnostics]\n'
            printf '%s\n' "$diagnostics"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi

        if ((created_count != 2 || destroyed_count != 2 \
          || workspace_created_count != 2 || workspace_destroyed_count != 2)); then
          {
            printf '\n[touchpad-navigation lifecycle mismatch]\n'
            printf 'horizontal created: %s\nhorizontal destroyed: %s\n' \
              "$created_count" \
              "$destroyed_count"
            printf 'vertical created: %s\nvertical destroyed: %s\n' \
              "$workspace_created_count" \
              "$workspace_destroyed_count"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi

        return 0
      }

      verify_touchpad_navigation_checkpoint() {
        local after_checkpoint
        local baseline_checkpoint
        local expected
        local journal_cursor
        local result=0
        local state

        if [[ "$(read_touchpad_navigation 2>/dev/null || true)" != false ]]; then
          record_focus_state "touchpad navigation was not disabled by default"
          result=1
        fi
        if [[ "$(read_touchpad_workspace_navigation 2>/dev/null || true)" != false ]]; then
          record_focus_state \
            "touchpad workspace navigation was not disabled by default"
          result=1
        fi

        if ((result == 0)); then
          baseline_checkpoint=$(capture_touchpad_navigation_checkpoint "$@") \
            || result=1
        fi
        if ((result == 0)); then
          journal_cursor=$(capture_journal_cursor) || result=1
        fi

        if ((result == 0)); then
          for expected in true false true false; do
            if [[ "$expected" == true ]]; then
              state=enabled
            else
              state=disabled
            fi

            if ! set_touchpad_navigation_modes "$expected"; then
              record_focus_state \
                "live touchpad navigation modes could not be $state"
              result=1
              break
            fi

            # KWin returns before the 200 ms settings timer applies the value.
            sleep 0.4

            if [[ "$(read_touchpad_navigation 2>/dev/null || true)" != "$expected" ]]; then
              record_focus_state \
                "horizontal touchpad navigation did not retain the $state value"
              result=1
              break
            fi
            if [[ "$(read_touchpad_workspace_navigation 2>/dev/null || true)" != "$expected" ]]; then
              record_focus_state \
                "vertical touchpad navigation did not retain the $state value"
              result=1
              break
            fi

            after_checkpoint=$(capture_touchpad_navigation_checkpoint "$@") \
              || {
                record_focus_state \
                  "the $state touchpad-navigation checkpoint did not stabilize"
                result=1
                break
              }
            if [[ "$after_checkpoint" != "$baseline_checkpoint" ]]; then
              record_focus_state \
                "the $state touchpad-navigation checkpoint changed core state"
              result=1
              break
            fi
          done
        fi

        if ((result == 0)) \
          && ! touchpad_navigation_journal_is_clean_after "$journal_cursor"; then
          record_focus_state \
            "touchpad-navigation lifecycle or QML diagnostics were invalid"
          result=1
        fi

        if ! restore_touchpad_navigation; then
          record_focus_state \
            "touchpad navigation cleanup did not restore false"
          result=1
        fi

        if ((result == 0)); then
          record_focus_state \
            "live touchpad navigation preserved real applications and core state"
        fi

        return "$result"
      }

      overview_checkpoint_failure() {
        local active_caption
        local kwin_id
        local message=$1

        active_caption=$(
          active_window_caption 2>/dev/null || printf unavailable
        )
        kwin_id=$(kwin_process_id 2>/dev/null || printf unavailable)

        {
          printf '\n[visible overview checkpoint failed]\n'
          printf '%s\n' "$message"
          printf 'overview loaded: %s\n' \
            "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || true)"
          printf 'overview active: %s\n' \
            "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)"
          printf 'expected KWin process: %s\n' \
            "''${kwin_overview_wheel_process_id:-unavailable}"
          printf 'KWin process: %s\n' "$kwin_id"
          printf 'pre-close active window: %s\n' \
            "''${overview_wheel_active_caption:-unavailable}"
          printf 'active window: %s\n' "$active_caption"
        } >> /tmp/shared/driftile-focus-diagnostics

        unload_overview_effect >/dev/null 2>&1 || true
      }

      verify_overview_effect_checkpoint() {
        local after_checkpoint
        local after_active_layout_digest
        local after_semantic_checkpoint
        local baseline_active_layout_digest
        local baseline_checkpoint
        local baseline_semantic_checkpoint
        local checkpoint_separator=$'\037'
        local desktop_count
        local expected_reordered_checkpoint
        local firefox_checkpoint
        local firefox_title=$4
        local fixture_checkpoint
        local fixture_sequence
        local overview_wheel_active_caption=""
        local journal_cursor
        local kwin_overview_wheel_process_id
        local kwin_live_camera_process_id
        local kwin_search_process_id
        local kwin_spatial_drop_process_id
        local live_camera_initial_width
        local live_refresh_base_title="Driftile VM Overview Live Refresh"
        local live_refresh_pid=""
        local live_refresh_title=""
        local output_frame
        local overview_keys
        local plasma_active
        local plasma_loaded
        local reordered_checkpoint
        local reordered_sequence
        local spatial_drop_checkpoint
        local spatial_drop_source_frame
        local spatial_drop_target_frame
        local spatial_drop_target_width
        local trailing_desktop_id=""
        local workspace_gap_before_count
        local workspace_gap_before_request_id
        local workspace_gap_before_sequence
        local workspace_gap_created_desktop_id=""
        local xterm_title=$5

        if ! effect_is_available "$overview_plugin_id" \
          || ! wait_for_effect_loaded_state "$overview_plugin_id" false \
          || ! wait_for_shortcut_registration_state "$overview_shortcut" false; then
          overview_checkpoint_failure \
            "the installed overview was not available and disabled before loading"
          return 1
        fi

        if ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "the ordered XWayland window was not active before the keyboard checkpoint"
          return 1
        fi

        baseline_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the real-application layout or persisted v2 state did not stabilize"
          return 1
        }
        baseline_active_layout_digest=$(capture_stable_overview_active_semantic_digest) || {
          overview_checkpoint_failure \
            "the active persisted layout snapshot did not stabilize"
          return 1
        }
        baseline_semantic_checkpoint="''${baseline_checkpoint#*"$checkpoint_separator"}"
        plasma_loaded=$(effect_loaded_state "$plasma_overview_effect_id") || return 1
        plasma_active=$(effect_active_state "$plasma_overview_effect_id") || return 1
        journal_cursor=$(capture_journal_cursor) || {
          overview_checkpoint_failure "the user journal cursor was unavailable"
          return 1
        }

        if ! load_overview_effect \
          || ! wait_for_shortcut_registration_state "$overview_shortcut" true; then
          overview_checkpoint_failure "KWin could not load the overview effect and action"
          return 1
        fi

        overview_keys=$(shortcut_keys "$overview_shortcut" "$overview_shortcut_text") || {
          overview_checkpoint_failure "KGlobalAccel did not expose the overview action"
          return 1
        }
        if [[ "$overview_keys" != "$overview_default_keys" ]]; then
          overview_checkpoint_failure \
            "the overview action did not expose its default Meta+O assignment: $overview_keys"
          return 1
        fi

        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the layout did not stabilize after loading the overview"
          return 1
        }
        if [[ "$after_checkpoint" != "$baseline_checkpoint" ]]; then
          overview_checkpoint_failure \
            "loading the overview changed frames, focus, desktops, layout state, or the built-in Overview"
          return 1
        fi

        if ! set_current_desktop "$secondary_desktop_id" \
          || ! start_kcalc_window \
            desktop_window \
            title_desktop_destination \
            "$base_title_desktop_destination" \
          || ! wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          || ! wait_for_appended_desktop \
            trailing_desktop_id \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
          || ! wait_for_virtual_desktop_rows 3 \
          || [[ "$trailing_desktop_id" == "$primary_desktop_id" ]] \
          || [[ "$trailing_desktop_id" == "$secondary_desktop_id" ]] \
          || ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$xterm_title" \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "the existing applications could not prepare the three-desktop reorder fixture"
          return 1
        fi

        desktop_count=$(virtual_desktop_count 2>/dev/null || true)
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        fixture_checkpoint=$(capture_overview_checkpoint \
          "$@" \
          "$title_desktop_destination") || {
          overview_checkpoint_failure \
            "the overview desktop-reorder fixture checkpoint did not stabilize"
          return 1
        }
        fixture_sequence="$primary_desktop_id $secondary_desktop_id $trailing_desktop_id"
        reordered_sequence="$secondary_desktop_id $primary_desktop_id $trailing_desktop_id"
        expected_reordered_checkpoint="''${fixture_checkpoint/''${checkpoint_separator}''${fixture_sequence}''${checkpoint_separator}/''${checkpoint_separator}''${reordered_sequence}''${checkpoint_separator}}"
        if [[ "$desktop_count" != 3 ]] \
          || ! frame_is_valid "$output_frame" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$1" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$2" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$3" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$firefox_title" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$xterm_title" "$primary_desktop_id" \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "the overview desktop-reorder fixture did not preserve exact desktop membership"
          return 1
        fi

        if ! request_physical_shortcut overview-open \
          || ! wait_for_effect_active_state "$overview_plugin_id" true; then
          overview_checkpoint_failure "physical Meta+O did not open the overview"
          return 1
        fi

        sleep 3

        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the visible overview did not remain active and component-error-free"
          return 1
        fi

        live_camera_initial_width=$(window_frame_width "$xterm_title" 2>/dev/null || true)
        if [[ ! "$live_camera_initial_width" =~ ^[1-9][0-9]*$ ]] \
          || ! kwin_live_camera_process_id=$(kwin_process_id); then
          overview_checkpoint_failure \
            "the current tiled overview window did not expose its frame and KWin process"
          return 1
        fi

        if ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_real_window_width \
            "$xterm_title" \
            less \
            "$live_camera_initial_width" \
          || [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "a real tiled frame change did not preserve the active overview and KWin process"
          return 1
        fi

        if ! invoke_shortcut "driftile_increase_column_width" \
          || ! wait_for_real_window_width \
            "$xterm_title" \
            equal \
            "$live_camera_initial_width"; then
          overview_checkpoint_failure \
            "the current tiled overview window did not restore its original frame width"
          return 1
        fi
        after_checkpoint=$(capture_overview_checkpoint \
          "$@" \
          "$title_desktop_destination") || {
          overview_checkpoint_failure \
            "the live-camera frame-change checkpoint did not stabilize"
          return 1
        }
        if [[ "$after_checkpoint" != "$fixture_checkpoint" ]] \
          || [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the live-camera frame round trip changed applications, layout state, or the KWin process"
          return 1
        fi

        record_focus_state \
          "the active overview survived a real current-row tiled frame change"

        if ! kwin_overview_wheel_process_id=$(kwin_process_id) \
          || ! request_physical_overview_wheel_controls \
            "$output_frame" \
            "$kwin_overview_wheel_process_id"; then
          overview_checkpoint_failure \
            "the physical zoom plus vertical and horizontal wheel controls were not delivered to the multi-column overview"
          return 1
        fi
        sleep 0.3
        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_overview_wheel_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "wheel controls did not preserve the active overview and KWin process"
          return 1
        fi
        if ! wait_for_current_desktop "$primary_desktop_id"; then
          overview_checkpoint_failure \
            "shifted horizontal wheel input leaked into vertical workspace navigation"
          return 1
        fi
        overview_wheel_active_caption=$(
          active_window_caption 2>/dev/null || printf unavailable
        )

        if ! invoke_shortcut "$overview_shortcut"; then
          overview_checkpoint_failure \
            "the overview toggle was not delivered to the wheel checkpoint"
          return 1
        fi

        if ! wait_for_effect_active_state "$overview_plugin_id" false; then
          if ! kwin_process_is_unchanged \
              "$kwin_overview_wheel_process_id"; then
            overview_checkpoint_failure \
              "the KWin process changed while waiting for the overview toggle to close the wheel checkpoint"
          else
            overview_checkpoint_failure \
              "the overview toggle did not close the wheel checkpoint"
          fi
          return 1
        fi

        if ! kwin_process_is_unchanged \
            "$kwin_overview_wheel_process_id" \
          || ! kwin_process_is_unchanged \
            "$kwin_live_camera_process_id"; then
          overview_checkpoint_failure \
            "the KWin process changed while closing the live-camera overview checkpoint"
          return 1
        fi

        if ! wait_for_active "$xterm_title"; then
          if ! kwin_process_is_unchanged \
              "$kwin_overview_wheel_process_id"; then
            overview_checkpoint_failure \
              "the KWin process changed while restoring focus after the overview wheel checkpoint"
          else
            overview_checkpoint_failure \
              "the overview toggle closed the wheel checkpoint but did not restore the expected active window"
          fi
          return 1
        fi
        after_checkpoint=$(capture_overview_checkpoint \
          "$@" \
          "$title_desktop_destination") || {
          overview_checkpoint_failure \
            "the overview wheel checkpoint did not stabilize after closing"
          return 1
        }
        if [[ "$after_checkpoint" != "$fixture_checkpoint" ]] \
          || ! kwin_process_is_unchanged "$kwin_overview_wheel_process_id" \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "live-camera and wheel controls changed applications, layout state, or the KWin process"
          return 1
        fi

        record_focus_state \
          "a real current-row frame change and physical vertical and horizontal wheel controls closed cleanly without restarting KWin"

        if ! invoke_shortcut "$overview_shortcut" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true; then
          overview_checkpoint_failure \
            "the overview could not reopen after the wheel checkpoint"
          return 1
        fi
        sleep 0.3

        if ! start_konsole_window \
            live_refresh_pid \
            live_refresh_title \
            "$live_refresh_base_title"; then
          overview_checkpoint_failure \
            "the live overview refresh window could not be started"
          return 1
        fi

        # A stable checkpoint outlasts the effect's bounded two-sample model read.
        if ! capture_overview_checkpoint \
            "$@" \
            "$title_desktop_destination" \
            "$live_refresh_title" \
            >/dev/null \
          || [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          terminate_process "$live_refresh_pid"
          live_refresh_pid=""
          wait_for_window_gone "$live_refresh_title" >/dev/null 2>&1 || true
          overview_checkpoint_failure \
            "adding a real window did not keep the refreshed overview active and component-error-free"
          return 1
        fi

        terminate_process "$live_refresh_pid"
        live_refresh_pid=""
        if ! wait_for_window_gone "$live_refresh_title" \
          || ! capture_overview_checkpoint \
            "$@" \
            "$title_desktop_destination" \
            >/dev/null \
          || [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "removing a real window did not keep the refreshed overview active and component-error-free"
          return 1
        fi

        record_focus_state \
          "the active overview refreshed after a real window was added and removed"

        if ! request_physical_overview_desktop_drag \
            "$output_frame" \
            "$desktop_count" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id"; then
          overview_checkpoint_failure \
            "the plain physical gutter drag did not keep the reordered overview active without restarting KWin"
          return 1
        fi

        reordered_checkpoint=$(capture_overview_checkpoint \
          "$@" \
          "$title_desktop_destination") || {
          overview_checkpoint_failure \
            "the reordered overview checkpoint did not stabilize"
          return 1
        }
        if [[ "$(virtual_desktop_count 2>/dev/null || true)" != 3 ]] \
          || ! wait_for_desktop_sequence \
            "$secondary_desktop_id" \
            "$primary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_virtual_desktop_rows 3 \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_active "$xterm_title" \
          || ! wait_for_window_desktop \
            "$title_desktop_destination" \
            "$secondary_desktop_id" \
          || ! wait_for_window_desktop "$1" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$2" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$3" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$firefox_title" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$xterm_title" "$primary_desktop_id" \
          || [[ "$expected_reordered_checkpoint" == "$fixture_checkpoint" ]] \
          || [[ "$reordered_checkpoint" != "$expected_reordered_checkpoint" ]] \
          || [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the live desktop reorder changed IDs, the protected tail, focus, applications, layout state, or the KWin process"
          return 1
        fi

        if ! request_physical_shortcut overview-reorder-escape \
          || ! wait_for_effect_active_state "$overview_plugin_id" false \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id"; then
          overview_checkpoint_failure \
            "physical Escape did not close the live reordered overview without restarting KWin"
          return 1
        fi

        if ! invoke_shortcut "driftile_move_desktop_up" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
            "$trailing_desktop_id" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_active "$xterm_title" \
          || ! cleanup_desktop_window \
          || ! wait_for_window_gone "$title_desktop_destination" \
          || ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$xterm_title" \
          || ! wait_for_active "$xterm_title" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
          || ! wait_for_virtual_desktop_rows 2; then
          overview_checkpoint_failure \
            "the existing desktop shortcut and calculator cleanup did not restore the reorder fixture"
          return 1
        fi

        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the restored overview checkpoint did not stabilize"
          return 1
        }
        if [[ "$after_checkpoint" != "$baseline_checkpoint" ]] \
          || [[ "$(effect_loaded_state "$overview_plugin_id")" != true ]] \
          || [[ "$(effect_active_state "$overview_plugin_id")" != false ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "reorder cleanup did not restore exact desktops, applications, focus, frames, or state"
          return 1
        fi

        if ! invoke_shortcut "$overview_shortcut" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true \
          || ! kwin_process_is_unchanged "$kwin_live_camera_process_id"; then
          overview_checkpoint_failure \
            "the overview could not reopen after the live desktop reorder checkpoint without restarting KWin"
          return 1
        fi
        sleep 0.3

        if ! request_physical_shortcut overview-enter-initial \
          || ! wait_for_effect_active_state "$overview_plugin_id" false \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "physical Enter did not activate the initial XWayland selection"
          return 1
        fi

        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the layout did not stabilize after activating the initial selection"
          return 1
        }
        if [[ "$after_checkpoint" != "$baseline_checkpoint" ]] \
          || [[ "$(effect_loaded_state "$overview_plugin_id")" != true ]] \
          || [[ "$(effect_loaded_state "$plasma_overview_effect_id")" != "$plasma_loaded" ]] \
          || [[ "$(effect_active_state "$plasma_overview_effect_id")" != "$plasma_active" ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the initial keyboard selection changed the XWayland checkpoint or the built-in Overview"
          return 1
        fi

        if ! activate_window "$firefox_title" \
          || ! wait_for_active "$firefox_title"; then
          overview_checkpoint_failure \
            "the expected Firefox keyboard checkpoint could not be prepared"
          return 1
        fi
        firefox_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the expected Firefox keyboard checkpoint did not stabilize"
          return 1
        }
        if ! activate_window "$xterm_title" \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "the initial XWayland keyboard checkpoint could not be restored"
          return 1
        fi
        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the restored XWayland keyboard checkpoint did not stabilize"
          return 1
        }
        if [[ "$after_checkpoint" != "$baseline_checkpoint" ]]; then
          overview_checkpoint_failure \
            "preparing the expected Firefox checkpoint changed the XWayland checkpoint"
          return 1
        fi

        if ! invoke_shortcut "$overview_shortcut" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true; then
          overview_checkpoint_failure \
            "the overview could not reopen for directional keyboard navigation"
          return 1
        fi
        sleep 0.3
        if ! request_physical_shortcut overview-up; then
          overview_checkpoint_failure \
            "physical Up was not delivered to the directional keyboard checkpoint"
          return 1
        fi
        sleep 0.2
        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "physical Up did not keep the directional keyboard checkpoint active"
          return 1
        fi
        if ! request_physical_shortcut overview-enter-target \
          || ! wait_for_effect_active_state "$overview_plugin_id" false \
          || ! wait_for_active "$firefox_title"; then
          overview_checkpoint_failure \
            "physical Up and Enter did not activate the Firefox selection"
          return 1
        fi
        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the Firefox keyboard checkpoint did not stabilize"
          return 1
        }
        if [[ "$after_checkpoint" != "$firefox_checkpoint" ]] \
          || [[ "$(effect_loaded_state "$overview_plugin_id")" != true ]] \
          || [[ "$(effect_loaded_state "$plasma_overview_effect_id")" != "$plasma_loaded" ]] \
          || [[ "$(effect_active_state "$plasma_overview_effect_id")" != "$plasma_active" ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "directional keyboard activation did not produce the expected Firefox checkpoint"
          return 1
        fi

        if ! invoke_shortcut "$overview_shortcut" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true \
          || ! kwin_search_process_id=$(kwin_process_id); then
          overview_checkpoint_failure \
            "the overview could not reopen for the physical search checkpoint"
          return 1
        fi
        sleep 0.3

        if ! request_physical_shortcut overview-search-query; then
          overview_checkpoint_failure \
            "the physical overview search query was not delivered"
          return 1
        fi
        sleep 0.2
        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_search_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the physical overview search query did not preserve the active effect and KWin process"
          return 1
        fi

        if ! request_physical_shortcut overview-search-edit; then
          overview_checkpoint_failure \
            "the physical overview search edit was not delivered"
          return 1
        fi
        sleep 0.2
        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
          || ! kwin_process_is_unchanged "$kwin_search_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "editing the physical overview search query did not preserve the active effect and KWin process"
          return 1
        fi

        if ! request_physical_shortcut overview-search-close \
          || ! wait_for_effect_active_state "$overview_plugin_id" false \
          || ! kwin_process_is_unchanged "$kwin_search_process_id" \
          || ! wait_for_active "$firefox_title"; then
          overview_checkpoint_failure \
            "physical Escape did not clear search and close the reopened Firefox checkpoint"
          return 1
        fi
        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the Firefox checkpoint did not stabilize after physical Escape"
          return 1
        }
        if [[ "$after_checkpoint" != "$firefox_checkpoint" ]] \
          || [[ "$(effect_loaded_state "$overview_plugin_id")" != true ]] \
          || [[ "$(effect_loaded_state "$plasma_overview_effect_id")" != "$plasma_loaded" ]] \
          || [[ "$(effect_active_state "$plasma_overview_effect_id")" != "$plasma_active" ]] \
          || ! kwin_process_is_unchanged "$kwin_search_process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "physical search input changed the Firefox checkpoint, KWin process, or built-in Overview"
          return 1
        fi

        record_focus_state \
          "physical overview search input changed a query and closed without restarting KWin"

        spatial_drop_source_frame=$(
          capture_stable_window_frame_contains "$xterm_title" 2>/dev/null \
            || true
        )
        spatial_drop_target_frame=$(
          capture_stable_window_frame_contains "$firefox_title" 2>/dev/null \
            || true
        )
        spatial_drop_target_width=$(window_frame_width "$xterm_title" 2>/dev/null || true)
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        workspace_gap_before_count=$(virtual_desktop_count 2>/dev/null || true)
        workspace_gap_before_request_id=$(overview_spatial_drop_request_id 2>/dev/null || true)
        workspace_gap_before_sequence=$(virtual_desktop_sequence 2>/dev/null || true)
        if ! frame_is_valid "$spatial_drop_source_frame" \
          || ! frame_is_valid "$spatial_drop_target_frame" \
          || ! frame_is_valid "$output_frame" \
          || [[ ! "$spatial_drop_target_width" =~ ^[1-9][0-9]*$ ]] \
          || [[ ! "$workspace_gap_before_request_id" =~ ^[0-9]+$ ]] \
          || [[ "$workspace_gap_before_count" != 2 ]] \
          || [[ "$workspace_gap_before_sequence" \
            != "$primary_desktop_id $secondary_desktop_id" ]] \
          || ! wait_for_pointer_stack_order \
            "$firefox_title" \
            "$xterm_title" \
            "$spatial_drop_target_width"; then
          overview_checkpoint_failure \
            "the workspace-gap baseline did not preserve two exact desktops and a real tiled stack"
          return 1
        fi

        if ! invoke_shortcut "$overview_shortcut" \
          || ! wait_for_effect_active_state "$overview_plugin_id" true \
          || ! kwin_spatial_drop_process_id=$(kwin_process_id); then
          overview_checkpoint_failure \
            "the overview could not reopen for the workspace-gap drop"
          return 1
        fi
        # Pointer geometry must be sampled after the opening transform settles.
        sleep 3

        if ! request_physical_overview_workspace_gap_drop \
            "$spatial_drop_source_frame" \
            "$output_frame"; then
          overview_checkpoint_failure \
            "the physical workspace-gap drag was not delivered"
          return 1
        fi
        if ! wait_for_overview_spatial_drop_request_after \
            "$workspace_gap_before_request_id"; then
          overview_checkpoint_failure \
            "the physical workspace-gap drag did not submit a spatial drop command"
          return 1
        fi
        if ! wait_for_single_inserted_desktop_between \
            workspace_gap_created_desktop_id \
            "$primary_desktop_id" \
            "$secondary_desktop_id"; then
          overview_checkpoint_failure \
            "the physical workspace-gap drop did not insert one exact desktop"
          return 1
        fi
        if ! wait_for_window_desktop \
            "$xterm_title" \
            "$workspace_gap_created_desktop_id"; then
          overview_checkpoint_failure \
            "the workspace-gap drop did not move the exact XWayland window"
          return 1
        fi
        if ! wait_for_window_desktop "$firefox_title" "$primary_desktop_id"; then
          overview_checkpoint_failure \
            "the workspace-gap drop changed the peer window desktop"
          return 1
        fi
        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]]; then
          overview_checkpoint_failure \
            "the workspace-gap drop closed the active overview"
          return 1
        fi
        if ! kwin_process_is_unchanged "$kwin_spatial_drop_process_id"; then
          overview_checkpoint_failure \
            "the workspace-gap drop restarted KWin"
          return 1
        fi
        if ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the workspace-gap drop produced an Overview component error"
          return 1
        fi

        if ! request_physical_shortcut overview-window-drop-escape \
          || ! wait_for_effect_active_state "$overview_plugin_id" false \
          || ! kwin_process_is_unchanged "$kwin_spatial_drop_process_id" \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "physical Escape did not close the workspace-gap checkpoint without restarting KWin"
          return 1
        fi

        if ! invoke_shortcut "driftile_move_window_to_previous_desktop" \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! wait_for_window_desktop "$xterm_title" "$primary_desktop_id" \
          || ! wait_for_window_desktop "$firefox_title" "$primary_desktop_id" \
          || ! wait_for_desktop_sequence \
            "$primary_desktop_id" \
            "$secondary_desktop_id" \
          || ! wait_for_active "$xterm_title"; then
          overview_checkpoint_failure \
            "workspace-gap cleanup did not return xterm and remove the created desktop"
          return 1
        fi

        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the workspace-gap checkpoint did not stabilize after cleanup"
          return 1
        }
        after_active_layout_digest=$(capture_stable_overview_active_semantic_digest \
          "$workspace_gap_created_desktop_id") || {
          overview_checkpoint_failure \
            "the workspace-gap active layout snapshot did not stabilize or retained the removed workspace"
          return 1
        }
        after_semantic_checkpoint="''${after_checkpoint#*"$checkpoint_separator"}"
        if [[ "$after_semantic_checkpoint" != "$baseline_semantic_checkpoint" \
          || "$after_active_layout_digest" != "$baseline_active_layout_digest" ]]; then
          if ! invoke_shortcut "driftile_move_window_left" \
            || ! wait_for_pointer_stack_order \
              "$firefox_title" \
              "$xterm_title" \
              "$spatial_drop_target_width"; then
            overview_checkpoint_failure \
              "workspace-gap cleanup did not restore the exact source stack"
            return 1
          fi
          after_checkpoint=$(capture_overview_checkpoint "$@") || {
            overview_checkpoint_failure \
              "the restored workspace-gap source stack did not stabilize"
            return 1
          }
          after_active_layout_digest=$(capture_stable_overview_active_semantic_digest \
            "$workspace_gap_created_desktop_id") || {
            overview_checkpoint_failure \
              "the restored workspace-gap active layout snapshot did not stabilize or retained the removed workspace"
            return 1
          }
          after_semantic_checkpoint="''${after_checkpoint#*"$checkpoint_separator"}"
        fi
        if [[ "$after_semantic_checkpoint" != "$baseline_semantic_checkpoint" \
          || "$after_active_layout_digest" != "$baseline_active_layout_digest" ]] \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "workspace-gap cleanup did not restore the exact desktops, window, and layout"
          return 1
        fi
        spatial_drop_checkpoint=$after_checkpoint

        record_focus_state \
          "a physical Overview gap drop created one workspace, moved a real window, and cleaned up exactly"

        if ! unload_overview_effect \
          || ! wait_for_shortcut_registration_state "$overview_shortcut" true; then
          overview_checkpoint_failure \
            "effect unload did not retain the inert overview action"
          return 1
        fi

        overview_keys=$(shortcut_keys "$overview_shortcut" "$overview_shortcut_text") || {
          overview_checkpoint_failure \
            "KGlobalAccel did not expose the retained overview action"
          return 1
        }
        if [[ "$overview_keys" != "$overview_default_keys" ]]; then
          overview_checkpoint_failure \
            "the unloaded overview action did not retain its Meta+O assignment: $overview_keys"
          return 1
        fi

        if ! invoke_shortcut "$overview_shortcut"; then
          overview_checkpoint_failure \
            "the retained inert overview action could not be invoked"
          return 1
        fi

        sleep 0.3

        after_checkpoint=$(capture_overview_checkpoint "$@") || {
          overview_checkpoint_failure \
            "the layout did not stabilize after invoking the inert overview action"
          return 1
        }
        if [[ "$(effect_loaded_state "$overview_plugin_id")" != false ]] \
          || [[ "$(effect_active_state "$overview_plugin_id")" != false ]] \
          || [[ "$after_checkpoint" != "$spatial_drop_checkpoint" ]] \
          || [[ "$(effect_loaded_state "$plasma_overview_effect_id")" != "$plasma_loaded" ]] \
          || [[ "$(effect_active_state "$plasma_overview_effect_id")" != "$plasma_active" ]] \
          || [[ "$(busctl --user call \
            org.kde.KWin \
            /Scripting \
            org.kde.kwin.Scripting \
            isScriptLoaded \
            s ${pluginId} 2>/dev/null)" != "b true" ]] \
          || ! wait_for_shortcut_registration_state "driftile_focus_window_down" true \
          || ! overview_component_errors_after "$journal_cursor"; then
          overview_checkpoint_failure \
            "the inert action changed the overview, captured layout, core extension, or built-in Overview"
          return 1
        fi

        record_focus_state \
          "physical overview keyboard navigation selected real applications and preserved core state"
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

      wait_for_window_width_near() {
        local attempt
        local current
        local expected=$2
        local stable_samples=0
        local title=$1
        local tolerance=$3

        [[ "$expected" =~ ^[1-9][0-9]*$ \
          && "$tolerance" =~ ^[0-9]+$ ]] || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current=$(window_frame_width "$title" 2>/dev/null || true)

          if [[ "$current" =~ ^[1-9][0-9]*$ ]] \
            && ((current >= expected - tolerance \
              && current <= expected + tolerance)); then
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

      cleanup_activity_fixture() {
        local cleanup_verified=true
        local firefox_pid="''${activity_firefox_pid:-}"
        local firefox_profile="''${activity_firefox_profile:-}"
        local primary_activity="''${activity_primary_id:-}"
        local secondary_activity="''${activity_secondary_id:-}"
        local xterm_pid="''${activity_xterm_pid:-}"

        busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          unloadScript \
          s "$activity_membership_probe_id" \
          >/dev/null 2>&1 || true

        if [[ -n "$primary_activity" ]]; then
          if activity_exists "$primary_activity"; then
            set_current_activity "$primary_activity" || cleanup_verified=false
          elif [[ $? -ne 1 ]]; then
            cleanup_verified=false
          fi
        fi

        if [[ -n "$xterm_pid" ]]; then
          terminate_process "$xterm_pid"
        fi
        activity_xterm_id=""
        activity_xterm_pid=""
        activity_xterm_title=""

        if [[ -n "$firefox_pid" ]]; then
          terminate_process "$firefox_pid"
        fi
        activity_firefox_id=""
        activity_firefox_pid=""
        activity_firefox_title=""

        if [[ -n "$firefox_profile" ]]; then
          rm -rf -- "$firefox_profile" || cleanup_verified=false
        fi
        activity_firefox_profile=""

        if [[ -n "$secondary_activity" ]]; then
          if activity_exists "$secondary_activity"; then
            remove_activity "$secondary_activity" || cleanup_verified=false
          elif [[ $? -ne 1 ]]; then
            cleanup_verified=false
          fi
        fi

        activity_primary_id=""
        activity_secondary_id=""
        [[ "$cleanup_verified" == true ]]
      }

      cleanup_temporary_windows() {
        unload_overview_effect >/dev/null 2>&1 || true
        set_application_column_widths "" >/dev/null 2>&1 || true
        set_application_tiling_exclusions "" >/dev/null 2>&1 || true
        restore_layout_configuration >/dev/null 2>&1 || true
        cleanup_activity_fixture || true
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

      close_real_application_physically_and_restore() {
        local baseline_first=$3
        local baseline_second=$4
        local baseline_third=$5
        local krunner_request_pid
        local pid=$2
        local query=$1

        if ! wait_for_active_contains "$query"; then
          record_real_application_state \
            "real application was not active before physical close" \
            "$query"
          terminate_process "$pid"
          wait_for_window_gone_contains "$query" >/dev/null 2>&1 || true
          return 1
        fi

        rm -f \
          /tmp/shared/driftile-key-test-close-window-ready \
          /tmp/shared/driftile-key-test-close-window-sent
        display_krunner_after_physical_close close-window "$query" &
        krunner_request_pid=$!

        if ! request_physical_shortcut close-window; then
          record_real_application_state \
            "physical close shortcut was not delivered" \
            "$query"
          kill "$krunner_request_pid" >/dev/null 2>&1 || true
          wait "$krunner_request_pid" >/dev/null 2>&1 || true
          terminate_process "$pid"
          wait_for_window_gone_contains "$query" >/dev/null 2>&1 || true
          return 1
        fi

        if ! wait "$krunner_request_pid"; then
          record_real_application_state \
            "KRunner did not open immediately after physical close" \
            "$query"
          terminate_process "$pid"
          wait_for_window_gone_contains "$query" >/dev/null 2>&1 || true
          return 1
        fi

        if ! wait_for_window_gone_contains "$query"; then
          record_real_application_state \
            "physical close shortcut did not close the real application" \
            "$query"
          toggle_krunner_display >/dev/null 2>&1 || true
          terminate_process "$pid"
          wait_for_window_gone_contains "$query" >/dev/null 2>&1 || true
          return 1
        fi

        terminate_process "$pid"

        if ! wait_for_active_krunner \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          || ! active_window_is_krunner; then
          record_focus_state \
            "physical close did not preserve consecutive KRunner focus"
          {
            printf 'active caption: %s\n' \
              "$(active_window_caption 2>/dev/null || printf unavailable)"
            printf 'active class: %s\n' \
              "$(active_window_classname 2>/dev/null || printf unavailable)"
          } >> /tmp/shared/driftile-focus-diagnostics
          toggle_krunner_display >/dev/null 2>&1 || true
          return 1
        fi

        if ! request_physical_shortcut overview-escape; then
          record_focus_state \
            "physical Escape was not delivered to KRunner after close"
          toggle_krunner_display >/dev/null 2>&1 || true
          return 1
        fi

        if ! wait_for_active "$title_c"; then
          record_focus_state \
            "KRunner Escape did not restore the pre-application focus"
          if active_window_is_krunner; then
            toggle_krunner_display >/dev/null 2>&1 || true
          fi
          return 1
        fi

        if ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          record_focus_state \
            "KRunner close-focus layout restoration failed"
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

      verify_physical_wheel_control() {
        local baseline_first=""
        local baseline_second=""
        local baseline_third=""
        local cleanup_verified=true
        local handshake_verified=true
        local output_frame=""
        local output_height
        local output_width
        local output_x
        local output_y
        local pointer_x
        local pointer_y
        local process_id=""
        local ready_file=/tmp/shared/driftile-wheel-control-ready
        local temporary_file="$ready_file.tmp"

        clear_physical_wheel_control_handshake || return 1
        if ! effect_is_available "$wheel_control_effect_id" \
          || ! wait_for_effect_loaded_state "$wheel_control_effect_id" true; then
          record_focus_state \
            "the native wheel control effect was unavailable or unloaded"
          return 1
        fi

        if ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b" \
          || ! capture_stable_frames; then
          record_focus_state \
            "the physical wheel control fixture did not reach its baseline"
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        process_id=$(kwin_process_id 2>/dev/null || true)

        if [[ ! "$process_id" =~ ^[1-9][0-9]*$ ]] \
          || ! frame_is_valid "$output_frame"; then
          clear_physical_wheel_control_handshake || true
          record_focus_state \
            "the physical wheel control handshake could not start"
          return 1
        fi
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        pointer_x=$((output_x + output_width / 2))
        pointer_y=$((output_y + output_height / 2))
        if ! printf '%s %s %s %s %s %s\n' \
            "$pointer_x" \
            "$pointer_y" \
            "$output_x" \
            "$output_y" \
            "$output_width" \
            "$output_height" \
            > "$temporary_file" \
          || ! mv "$temporary_file" "$ready_file"; then
          clear_physical_wheel_control_handshake || true
          record_focus_state \
            "the physical wheel control pointer handshake could not start"
          return 1
        fi

        if wait_for_physical_wheel_control_file \
            /tmp/shared/driftile-wheel-control-desktop-next-sent \
          && wait_for_current_desktop "$secondary_desktop_id" \
          && kwin_process_is_unchanged "$process_id"; then
          acknowledge_physical_wheel_control_phase desktop-next \
            || handshake_verified=false
        else
          handshake_verified=false
        fi

        if [[ "$handshake_verified" == true ]] \
          && wait_for_physical_wheel_control_file \
            /tmp/shared/driftile-wheel-control-desktop-previous-sent \
          && wait_for_current_desktop "$primary_desktop_id" \
          && activate_window "$title_b" \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && kwin_process_is_unchanged "$process_id"; then
          acknowledge_physical_wheel_control_phase desktop-previous \
            || handshake_verified=false
        else
          handshake_verified=false
        fi

        if [[ "$handshake_verified" == true ]] \
          && wait_for_physical_wheel_control_file \
            /tmp/shared/driftile-wheel-control-focus-right-sent \
          && wait_for_active "$title_c" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && kwin_process_is_unchanged "$process_id"; then
          acknowledge_physical_wheel_control_phase focus-right \
            || handshake_verified=false
        else
          handshake_verified=false
        fi

        if [[ "$handshake_verified" == true ]] \
          && wait_for_physical_wheel_control_file \
            /tmp/shared/driftile-wheel-control-focus-left-sent \
          && wait_for_active "$title_b" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && kwin_process_is_unchanged "$process_id"; then
          acknowledge_physical_wheel_control_phase focus-left \
            || handshake_verified=false
        else
          handshake_verified=false
        fi

        if [[ "$handshake_verified" != true ]] \
          || ! wait_for_physical_wheel_control_file \
            /tmp/shared/driftile-wheel-control-sent; then
          handshake_verified=false
        fi

        clear_physical_wheel_control_handshake || cleanup_verified=false
        if ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          || ! kwin_process_is_unchanged "$process_id"; then
          cleanup_verified=false
        fi

        if [[ "$handshake_verified" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "physical wheel controls switched desktops and focused adjacent columns without restarting KWin"
          return 0
        fi

        record_focus_state "physical wheel control verification failed"
        {
          printf 'wheel handshake verified: %s\n' "$handshake_verified"
          printf 'wheel cleanup verified: %s\n' "$cleanup_verified"
          printf 'wheel effect loaded: %s\n' \
            "$(effect_loaded_state "$wheel_control_effect_id" 2>/dev/null || true)"
          printf 'wheel checkpoint KWin PID: %s\n' "$process_id"
          printf 'current KWin PID: %s\n' \
            "$(kwin_process_id 2>/dev/null || true)"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
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
        local configured_height_step_second_frame
        local configured_height_step_value
        local consume_fixture_rebuilt
        local default_width_delivery_first_frame
        local default_width_delivery_second_frame
        local default_width_delivery_third_frame
        local default_gap_restore_first_frame
        local default_gap_restore_second_frame
        local default_gap_restore_third_frame
        local default_width_restore_first_frame
        local default_width_restore_second_frame
        local default_width_restore_third_frame
        local desktop_reorder_destination_frame
        local desktop_source_width
        local direct_insert_verified
        local first_trailing_desktop_id=""
        local floating_center_frame
        local floating_decreased_height
        local floating_decreased_frame
        local floating_decreased_width
        local floating_desktop
        local floating_height_decreased_frame
        local floating_height_delta
        local floating_height_step_percent
        local floating_left_frame
        local floating_left_up_frame
        local floating_output_frame
        local floating_second_height
        local floating_second_frame
        local floating_second_width
        local floating_second_x
        local floating_second_y
        local floating_up_frame
        local floating_width_delta
        local floating_width_step_percent
        local floating_work_area
        local floating_work_area_height
        local floating_work_area_width
        local floating_work_area_x
        local floating_work_area_y
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

        if ! verify_physical_wheel_control; then
          record_focus_state "physical wheel controls failed"
          return 1
        fi

        activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_layout -816 16 848 \
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
          && wait_for_layout -816 848 16 \
          || return 1
        record_focus_state "column C moved left"

        invoke_shortcut "driftile_move_column_right" \
          && wait_for_active "$title_c" \
          && wait_for_layout -816 16 848 \
          || return 1
        record_focus_state "column C moved right"

        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_b" \
          && wait_for_layout -816 16 848 \
          || return 1
        record_focus_state "focus left to B invoked"

        invoke_shortcut "driftile_focus_column_left" \
          && wait_for_active "$title_a" \
          && wait_for_layout 16 848 1680 \
          || return 1
        record_focus_state "focus left to A invoked"

        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_b" \
          && wait_for_layout 16 848 1680 \
          || return 1
        record_focus_state "focus right to B invoked"

        invoke_shortcut "driftile_focus_column_right" \
          && wait_for_active "$title_c" \
          && wait_for_layout -816 16 848 \
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
        default_width_delivery_first_frame="$((baseline_first_x + 12)),$((baseline_first_y + 8)),$((baseline_first_width - 12)),$((baseline_first_height - 16))"
        default_width_delivery_second_frame="$((baseline_second_x + 8)),$((baseline_second_y + 8)),$((baseline_second_width - 12)),$((baseline_second_height - 16))"
        default_width_delivery_third_frame="$((baseline_third_x + 4)),$((baseline_third_y + 8)),$((baseline_third_width - 12)),$((baseline_third_height - 16))"
        default_gap_restore_first_frame="$((baseline_first_x + 4)),$baseline_first_y,$baseline_first_width,$baseline_first_height"
        default_gap_restore_second_frame="$((baseline_second_x + 4)),$baseline_second_y,$baseline_second_width,$baseline_second_height"
        default_gap_restore_third_frame="$((baseline_third_x + 4)),$baseline_third_y,$baseline_third_width,$baseline_third_height"
        configured_default_first_frame=$default_gap_restore_first_frame
        configured_default_second_frame="$((baseline_second_x + 4)),$baseline_second_y,$configured_default_width,$baseline_second_height"
        configured_default_third_frame="$((baseline_third_x + configured_default_width - baseline_second_width + 4)),$baseline_third_y,$baseline_third_width,$baseline_third_height"
        configured_step_width=$((
          (60 * (baseline_second_width + 16) + 50) / 100 - 16
        ))
        configured_step_second_frame="$((baseline_second_x + 4)),$baseline_second_y,$configured_step_width,$baseline_second_height"
        configured_step_third_frame="$((baseline_third_x + configured_step_width - baseline_second_width + 4)),$baseline_third_y,$baseline_third_width,$baseline_third_height"
        configured_height_step_value=$((
          (80 * (baseline_second_height + 16) + 50) / 100 - 16
        ))
        configured_height_step_second_frame="$((baseline_second_x + 4)),$baseline_second_y,$baseline_second_width,$configured_height_step_value"
        default_width_restore_first_frame=$default_width_delivery_first_frame
        default_width_restore_second_frame="$((baseline_second_x + 8)),$((baseline_second_y + 8)),$((configured_default_width - 14)),$((baseline_second_height - 16))"
        default_width_restore_third_frame="$((baseline_third_x + configured_default_width - baseline_second_width + 2)),$((baseline_third_y + 8)),$((baseline_third_width - 12)),$((baseline_third_height - 16))"

        if ! set_layout_configuration 70 10 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
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

        if ! set_layout_configuration 50 10 10 24 \
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
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "default column width restoration failed"
          return 1
        fi
        record_focus_state "default column width restored exact default-gap frames"

        if ! set_layout_configuration 50 20 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured column-width step delivery failed"
          return 1
        fi
        record_focus_state \
          "configured column-width step preserved exact frames before resize"

        if ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$configured_step_second_frame" \
            "$configured_step_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_increase_column_width" \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured column-width step round trip failed"
          return 1
        fi
        record_focus_state \
          "configured column-width step completed an exact 20-point round trip"

        if ! set_layout_configuration 50 10 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "default column-width step restoration failed"
          return 1
        fi
        record_focus_state "default column-width step restored exact default-gap frames"

        if ! set_layout_configuration 50 10 20 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured window-height step delivery failed"
          return 1
        fi
        record_focus_state \
          "configured window-height step preserved exact frames before resize"

        if ! invoke_shortcut "driftile_decrease_window_height" \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$configured_height_step_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_increase_window_height" \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_reset_window_height" \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "configured window-height step round trip failed"
          return 1
        fi
        record_focus_state \
          "configured window-height step completed an exact 20-point round trip"

        if ! set_layout_configuration 50 10 10 24 \
          || ! wait_for_frames \
            "$default_width_delivery_first_frame" \
            "$default_width_delivery_second_frame" \
            "$default_width_delivery_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_gap 16 \
          || ! wait_for_frames \
            "$default_gap_restore_first_frame" \
            "$default_gap_restore_second_frame" \
            "$default_gap_restore_third_frame" \
          || ! wait_for_active "$title_b"; then
          restore_layout_configuration >/dev/null 2>&1 || true
          record_focus_state "default window-height step restoration failed"
          return 1
        fi
        record_focus_state "default window-height step restored exact default-gap frames"

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

        if ! frame_is_valid "$floating_second_frame"; then
          record_focus_state "window B floating movement baseline was invalid"
          return 1
        fi
        IFS=, read -r \
          floating_second_x \
          floating_second_y \
          floating_second_width \
          floating_second_height \
          <<< "$floating_second_frame"
        floating_left_frame="$((floating_second_x - 50)),$floating_second_y,$floating_second_width,$floating_second_height"
        floating_left_up_frame="$((floating_second_x - 50)),$((floating_second_y - 50)),$floating_second_width,$floating_second_height"
        floating_up_frame="$floating_second_x,$((floating_second_y - 50)),$floating_second_width,$floating_second_height"
        floating_output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        floating_work_area=$(
          maximized_work_area_frame \
            "$singleton_first_frame" \
            "$floating_output_frame" \
            2>/dev/null \
            || true
        )
        floating_center_frame=$(
          centered_frame_in_work_area \
            "$floating_work_area" \
            "$floating_second_frame" \
            2>/dev/null \
            || true
        )

        if ! frame_is_valid "$floating_work_area" \
          || ! frame_is_valid "$floating_center_frame"; then
          record_focus_state "window B floating center target was invalid"
          return 1
        fi

        if ! request_physical_shortcut floating-move-left \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_left_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! request_physical_shortcut floating-move-up \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_left_up_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! request_physical_shortcut floating-move-right \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_up_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! request_physical_shortcut floating-move-down \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical manual floating movement did not preserve exact frames and focus"
          return 1
        fi
        record_focus_state \
          "physical manual floating shortcuts moved window B by exact 50-pixel steps"

        if ! request_physical_shortcut floating-center \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_center_frame" \
            "$stable_third_frame" \
          || ! wait_for_precise_window_frame \
            "$title_b" \
            "$floating_center_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "physical Meta+C did not center the real manual floating window"
          return 1
        fi
        floating_second_frame=$floating_center_frame
        record_focus_state \
          "physical Meta+C centered the real manual floating window exactly"

        if ! floating_width_step_percent=$(
          ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
            --file "$HOME/.config/kwinrc" \
            --group "Script-${pluginId}" \
            --key ColumnWidthStepPercent \
            --default 10
        ); then
          record_focus_state \
            "manual floating width checkpoint could not read its configured step"
          return 1
        fi

        if [[ ! "$floating_width_step_percent" =~ ^[1-9][0-9]*$ ]] \
          || ((floating_width_step_percent > 50)); then
          record_focus_state \
            "manual floating width checkpoint received an invalid configured step"
          return 1
        fi

        IFS=, read -r _ _ floating_work_area_width _ \
          <<< "$floating_work_area"
        IFS=, read -r \
          floating_second_x \
          floating_second_y \
          floating_second_width \
          floating_second_height \
          <<< "$floating_second_frame"
        floating_width_delta=$((
          (floating_work_area_width * floating_width_step_percent + 50) / 100
        ))
        floating_decreased_width=$((
          floating_second_width - floating_width_delta
        ))
        floating_decreased_frame="$floating_second_x,$floating_second_y,$floating_decreased_width,$floating_second_height"

        if ((floating_width_delta <= 0 \
          || floating_decreased_width <= 0)) \
          || ! frame_is_valid "$floating_decreased_frame"; then
          record_focus_state \
            "manual floating width checkpoint target was invalid"
          return 1
        fi

        floating_desktop=$(current_desktop_id 2>/dev/null || true)

        if [[ -z "$floating_desktop" ]] \
          || ! window_is_on_desktop "$title_b" "$floating_desktop" \
          || ! window_desktop_output_state_contains \
            "$title_b" \
            "$floating_output_frame" \
            >/dev/null; then
          record_focus_state \
            "manual floating width checkpoint context was unavailable"
          return 1
        fi

        if ! request_physical_shortcut floating-width-minus \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_decreased_frame" \
            "$stable_third_frame" \
          || ! wait_for_precise_window_frame \
            "$title_b" \
            "$floating_decreased_frame" \
          || ! wait_for_active "$title_b" \
          || [[ "$(current_desktop_id 2>/dev/null || true)" \
            != "$floating_desktop" ]] \
          || ! window_is_on_desktop "$title_b" "$floating_desktop" \
          || ! window_desktop_output_state_contains \
            "$title_b" \
            "$floating_output_frame" \
            >/dev/null; then
          record_focus_state \
            "physical Meta+- did not preserve the exact floating frame and context"
          return 1
        fi

        if ! request_physical_shortcut floating-width-equal \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_precise_window_frame \
            "$title_b" \
            "$floating_second_frame" \
          || ! wait_for_active "$title_b" \
          || [[ "$(current_desktop_id 2>/dev/null || true)" \
            != "$floating_desktop" ]] \
          || ! window_is_on_desktop "$title_b" "$floating_desktop" \
          || ! window_desktop_output_state_contains \
            "$title_b" \
            "$floating_output_frame" \
            >/dev/null; then
          record_focus_state \
            "physical Meta+= did not restore the exact floating frame and context"
          return 1
        fi
        record_focus_state \
          "physical Meta+- and Meta+= resized the manual floating window by the configured work-area step and restored it exactly"

        if ! floating_height_step_percent=$(
          ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
            --file "$HOME/.config/kwinrc" \
            --group "Script-${pluginId}" \
            --key WindowHeightStepPercent \
            --default 10
        ); then
          record_focus_state \
            "manual floating height checkpoint could not read its configured step"
          return 1
        fi

        if [[ ! "$floating_height_step_percent" =~ ^[1-9][0-9]*$ ]] \
          || ((floating_height_step_percent > 50)); then
          record_focus_state \
            "manual floating height checkpoint received an invalid configured step"
          return 1
        fi

        IFS=, read -r \
          floating_work_area_x \
          floating_work_area_y \
          floating_work_area_width \
          floating_work_area_height \
          <<< "$floating_work_area"
        IFS=, read -r \
          floating_second_x \
          floating_second_y \
          floating_second_width \
          floating_second_height \
          <<< "$floating_second_frame"
        floating_height_delta=$((
          (floating_work_area_height * floating_height_step_percent + 50) / 100
        ))
        floating_decreased_height=$((
          floating_second_height - floating_height_delta
        ))
        floating_height_decreased_frame="$floating_second_x,$floating_second_y,$floating_second_width,$floating_decreased_height"

        if ((floating_height_delta <= 0 \
          || floating_decreased_height <= 0 \
          || floating_second_x < floating_work_area_x \
          || floating_second_y < floating_work_area_y \
          || floating_second_x + floating_second_width \
            > floating_work_area_x + floating_work_area_width \
          || floating_second_y + floating_decreased_height \
            > floating_work_area_y + floating_work_area_height)) \
          || ! frame_is_valid "$floating_height_decreased_frame"; then
          record_focus_state \
            "manual floating height checkpoint target or placement was invalid"
          return 1
        fi

        if ! request_physical_shortcut shift-minus \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_height_decreased_frame" \
            "$stable_third_frame" \
          || ! wait_for_precise_window_frame \
            "$title_b" \
            "$floating_height_decreased_frame" \
          || ! wait_for_active "$title_b" \
          || [[ "$(current_desktop_id 2>/dev/null || true)" \
            != "$floating_desktop" ]] \
          || ! window_is_on_desktop "$title_b" "$floating_desktop" \
          || ! window_desktop_output_state_contains \
            "$title_b" \
            "$floating_output_frame" \
            >/dev/null; then
          record_focus_state \
            "physical Meta+Shift+- did not preserve the floating width, placement, and context"
          return 1
        fi

        if ! request_physical_shortcut shift-equal \
          || ! wait_for_frames \
            "$stable_first_frame" \
            "$floating_second_frame" \
            "$stable_third_frame" \
          || ! wait_for_precise_window_frame \
            "$title_b" \
            "$floating_second_frame" \
          || ! wait_for_active "$title_b" \
          || [[ "$(current_desktop_id 2>/dev/null || true)" \
            != "$floating_desktop" ]] \
          || ! window_is_on_desktop "$title_b" "$floating_desktop" \
          || ! window_desktop_output_state_contains \
            "$title_b" \
            "$floating_output_frame" \
            >/dev/null; then
          record_focus_state \
            "physical Meta+Shift+= did not restore the exact floating frame and context"
          return 1
        fi
        record_focus_state \
          "physical Meta+Shift+- and Meta+Shift+= resized the real manual floating window by the configured work-area height step and restored it exactly"

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

      verify_center_focused_column_configuration() {
        local attempt
        local application_target
        local canonical_first
        local canonical_second
        local canonical_third
        local centered_first
        local centered_second
        local centered_third
        local disabled_verified=false
        local enabled_verified=false
        local nonmatching_application="io.github.kontonkara.driftile.vm.nonmatch"
        local output_frame
        local work_area

        if ! set_center_focused_column false \
          || ! set_application_focus_centering "" \
          || ! activate_window "$title_a" \
          || ! wait_for_active "$title_a" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          record_focus_state \
            "focused-column centering baseline setup failed"
          return 1
        fi
        canonical_first=$stable_first_frame
        canonical_second=$stable_second_frame
        canonical_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)
        work_area=$(
          maximized_work_area_frame \
            "$canonical_second" \
            "$output_frame" \
            2>/dev/null \
            || true
        )

        if ! frame_is_valid "$work_area" \
          || ! invoke_shortcut "driftile_focus_column_left" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
          || ! invoke_shortcut "driftile_focus_column_right" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          record_focus_state \
            "disabled focused-column centering changed the minimal reveal"
          return 1
        fi
        record_focus_state \
          "disabled focused-column centering preserved the minimal reveal"

        if ! set_center_focused_column true \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_center_focused_column false >/dev/null 2>&1 || true
          set_application_focus_centering "" >/dev/null 2>&1 || true
          record_focus_state \
            "enabling focused-column centering changed settled state"
          return 1
        fi

        for ((attempt = 0; attempt < 30; attempt += 1)); do
          if activate_window "$title_c" \
            && wait_for_active "$title_c" \
            && wait_for_frames \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
            && invoke_shortcut "driftile_focus_column_left" \
            && wait_for_active "$title_b" \
            && capture_stable_frames \
            && focused_column_frames_are_centered \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
              "$stable_first_frame" \
              "$stable_second_frame" \
              "$stable_third_frame" \
              "$work_area"; then
            enabled_verified=true
            break
          fi
        done

        if [[ "$enabled_verified" != true ]]; then
          set_center_focused_column false >/dev/null 2>&1 || true
          set_application_focus_centering "" >/dev/null 2>&1 || true
          activate_window "$title_c" >/dev/null 2>&1 || true
          wait_for_active "$title_c" >/dev/null 2>&1 || true
          wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
            >/dev/null 2>&1 \
            || true
          record_focus_state \
            "enabled focused-column centering did not center B"
          return 1
        fi
        centered_first=$stable_first_frame
        centered_second=$stable_second_frame
        centered_third=$stable_third_frame
        record_focus_state \
          "enabled focused-column centering translated the viewport after $((attempt + 1)) focus probes"

        if ! set_center_focused_column false \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$centered_first" \
            "$centered_second" \
            "$centered_third"; then
          set_center_focused_column false >/dev/null 2>&1 || true
          set_application_focus_centering "" >/dev/null 2>&1 || true
          record_focus_state \
            "disabling focused-column centering changed settled state"
          return 1
        fi

        for ((attempt = 0; attempt < 30; attempt += 1)); do
          if activate_window "$title_c" \
            && wait_for_active "$title_c" \
            && wait_for_frames \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
            && invoke_shortcut "driftile_focus_column_left" \
            && wait_for_active "$title_b" \
            && capture_stable_frames \
            && [[ "$stable_first_frame" == "$canonical_first" \
              && "$stable_second_frame" == "$canonical_second" \
              && "$stable_third_frame" == "$canonical_third" ]]; then
            disabled_verified=true
            break
          fi
        done

        if [[ "$disabled_verified" != true ]] \
          || ! invoke_shortcut "driftile_focus_column_right" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_center_focused_column false >/dev/null 2>&1 || true
          set_application_focus_centering "" >/dev/null 2>&1 || true
          activate_window "$title_c" >/dev/null 2>&1 || true
          wait_for_active "$title_c" >/dev/null 2>&1 || true
          wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
            >/dev/null 2>&1 \
            || true
          record_focus_state \
            "disabling focused-column centering did not restore minimal reveal"
          return 1
        fi
        record_focus_state \
          "focused-column centering live toggle restored the exact baseline after $((attempt + 1)) focus probes"

        application_target=$(
          window_desktop_file_contains "$title_b" 2>/dev/null || true
        )

        if [[ -z "$application_target" \
          || "$application_target" == "$nonmatching_application" ]] \
          || ! set_application_focus_centering "$nonmatching_application" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
          || ! invoke_shortcut "driftile_focus_column_left" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
          || ! invoke_shortcut "driftile_focus_column_right" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
          || ! set_application_focus_centering "" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          activate_window "$title_c" >/dev/null 2>&1 || true
          wait_for_active "$title_c" >/dev/null 2>&1 || true
          wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
            >/dev/null 2>&1 \
            || true
          record_focus_state \
            "nonmatching application focus centering changed minimal reveal"
          return 1
        fi
        record_focus_state \
          "nonmatching application focus centering preserved minimal reveal"

        enabled_verified=false
        disabled_verified=false

        if [[ -z "$application_target" ]] \
          || ! set_application_focus_centering "$application_target" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          record_focus_state \
            "application focus-centering baseline setup failed"
          return 1
        fi
        record_focus_state \
          "matching application focus-centering list preserved settled state"

        for ((attempt = 0; attempt < 30; attempt += 1)); do
          if activate_window "$title_c" \
            && wait_for_active "$title_c" \
            && wait_for_frames \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
            && invoke_shortcut "driftile_focus_column_left" \
            && wait_for_active "$title_b" \
            && capture_stable_frames \
            && focused_column_frames_are_centered \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
              "$stable_first_frame" \
              "$stable_second_frame" \
              "$stable_third_frame" \
              "$work_area"; then
            enabled_verified=true
            break
          fi
        done

        if [[ "$enabled_verified" != true ]]; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          activate_window "$title_c" >/dev/null 2>&1 || true
          wait_for_active "$title_c" >/dev/null 2>&1 || true
          wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
            >/dev/null 2>&1 \
            || true
          record_focus_state \
            "matching application focus-centering rule did not center B"
          return 1
        fi
        centered_first=$stable_first_frame
        centered_second=$stable_second_frame
        centered_third=$stable_third_frame
        record_focus_state \
          "matching application focus-centering rule translated the viewport after $((attempt + 1)) focus probes"

        if ! set_application_focus_centering "" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$centered_first" \
            "$centered_second" \
            "$centered_third"; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          record_focus_state \
            "clearing application focus centering changed settled state"
          return 1
        fi
        record_focus_state \
          "clearing application focus centering preserved settled state"

        for ((attempt = 0; attempt < 30; attempt += 1)); do
          if activate_window "$title_c" \
            && wait_for_active "$title_c" \
            && wait_for_frames \
              "$canonical_first" \
              "$canonical_second" \
              "$canonical_third" \
            && invoke_shortcut "driftile_focus_column_left" \
            && wait_for_active "$title_b" \
            && capture_stable_frames \
            && [[ "$stable_first_frame" == "$canonical_first" \
              && "$stable_second_frame" == "$canonical_second" \
              && "$stable_third_frame" == "$canonical_third" ]]; then
            disabled_verified=true
            break
          fi
        done

        if [[ "$disabled_verified" != true ]] \
          || ! invoke_shortcut "driftile_focus_column_right" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third"; then
          set_application_focus_centering "" >/dev/null 2>&1 || true
          set_center_focused_column false >/dev/null 2>&1 || true
          activate_window "$title_c" >/dev/null 2>&1 || true
          wait_for_active "$title_c" >/dev/null 2>&1 || true
          wait_for_frames \
            "$canonical_first" \
            "$canonical_second" \
            "$canonical_third" \
            >/dev/null 2>&1 \
            || true
          record_focus_state \
            "clearing application focus centering did not restore minimal reveal"
          return 1
        fi
        record_focus_state \
          "application focus-centering cleanup restored the exact baseline after $((attempt + 1)) focus probes"
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

      clear_physical_wheel_control_handshake() {
        rm -f \
          /tmp/shared/driftile-wheel-control-ready \
          /tmp/shared/driftile-wheel-control-ready.tmp \
          /tmp/shared/driftile-wheel-control-sent \
          /tmp/shared/driftile-wheel-control-desktop-next-sent \
          /tmp/shared/driftile-wheel-control-desktop-next-verified \
          /tmp/shared/driftile-wheel-control-desktop-previous-sent \
          /tmp/shared/driftile-wheel-control-desktop-previous-verified \
          /tmp/shared/driftile-wheel-control-focus-right-sent \
          /tmp/shared/driftile-wheel-control-focus-right-verified \
          /tmp/shared/driftile-wheel-control-focus-left-sent \
          /tmp/shared/driftile-wheel-control-focus-left-verified
      }

      wait_for_physical_wheel_control_file() {
        local attempt
        local path=$1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$path" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      acknowledge_physical_wheel_control_phase() {
        : > "/tmp/shared/driftile-wheel-control-$1-verified"
      }

      request_physical_overview_wheel_controls() {
        local attempt
        local down_sent_file=/tmp/shared/driftile-overview-vertical-wheel-down-sent
        local down_observed_file=/tmp/shared/driftile-overview-vertical-wheel-down-observed
        local down_verified_file=/tmp/shared/driftile-overview-vertical-wheel-down-verified
        local output_frame=$1
        local output_height
        local output_width
        local output_x
        local output_y
        local pointer_x
        local pointer_y
        local process_id=$2
        local ready_file=/tmp/shared/driftile-overview-wheel-controls-ready
        local sent_file=/tmp/shared/driftile-overview-wheel-controls-sent
        local temporary_file="$ready_file.tmp"
        local up_sent_file=/tmp/shared/driftile-overview-vertical-wheel-up-sent
        local up_observed_file=/tmp/shared/driftile-overview-vertical-wheel-up-observed
        local up_verified_file=/tmp/shared/driftile-overview-vertical-wheel-up-verified

        if ! frame_is_valid "$output_frame" \
          || [[ ! "$process_id" =~ ^[1-9][0-9]*$ ]]; then
          return 1
        fi
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        pointer_x=$((output_x + output_width / 2))
        pointer_y=$((output_y + output_height / 2))

        rm -f \
          "$down_sent_file" \
          "$down_observed_file" \
          "$down_verified_file" \
          "$ready_file" \
          "$sent_file" \
          "$temporary_file" \
          "$up_sent_file" \
          "$up_observed_file" \
          "$up_verified_file" \
          /tmp/shared/driftile-overview-zoom-wheel-in-sent \
          /tmp/shared/driftile-overview-zoom-wheel-in-verified \
          /tmp/shared/driftile-overview-zoom-wheel-in-observed \
          /tmp/shared/driftile-overview-zoom-wheel-reset-sent \
          /tmp/shared/driftile-overview-zoom-wheel-reset-verified \
          /tmp/shared/driftile-overview-zoom-wheel-reset-observed \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-in-sent \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-in-verified \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-in-observed \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-reset-sent \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-reset-verified \
          /tmp/shared/driftile-overview-zoom-anchor-wheel-reset-observed \
          /tmp/shared/driftile-overview-zoom-key-in-sent \
          /tmp/shared/driftile-overview-zoom-key-in-verified \
          /tmp/shared/driftile-overview-zoom-key-in-observed \
          /tmp/shared/driftile-overview-zoom-key-reset-sent \
          /tmp/shared/driftile-overview-zoom-key-reset-verified \
          /tmp/shared/driftile-overview-zoom-key-reset-observed \
          /tmp/shared/driftile-overview-zoom-continuity-seed-sent \
          /tmp/shared/driftile-overview-zoom-continuity-seed-verified \
          /tmp/shared/driftile-overview-zoom-continuity-seed-observed \
          /tmp/shared/driftile-overview-zoom-continuity-sent \
          /tmp/shared/driftile-overview-zoom-continuity-verified \
          /tmp/shared/driftile-overview-zoom-continuity-observed \
          /tmp/shared/driftile-overview-zoom-configured-reset-sent \
          /tmp/shared/driftile-overview-zoom-configured-reset-verified \
          /tmp/shared/driftile-overview-zoom-configured-reset-observed \
          /tmp/shared/driftile-overview-zoom-fresh-seed-sent \
          /tmp/shared/driftile-overview-zoom-fresh-seed-verified \
          /tmp/shared/driftile-overview-zoom-fresh-seed-observed \
          /tmp/shared/driftile-overview-zoom-fresh-close-sent \
          /tmp/shared/driftile-overview-zoom-fresh-close-verified \
          /tmp/shared/driftile-overview-zoom-fresh-close-observed \
          /tmp/shared/driftile-overview-zoom-fresh-open-sent \
          /tmp/shared/driftile-overview-zoom-fresh-open-verified \
          /tmp/shared/driftile-overview-zoom-fresh-open-observed
        printf '%s %s %s %s %s %s\n' \
          "$pointer_x" \
          "$pointer_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        verify_physical_overview_zoom_phase wheel-in true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase wheel-reset true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase anchor-wheel-in true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase anchor-wheel-reset true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase key-in true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase key-reset true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase continuity-seed true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase continuity true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase configured-reset true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase fresh-seed true "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase fresh-close false "$process_id" \
          || return 1
        verify_physical_overview_zoom_phase fresh-open true "$process_id" \
          || return 1

        wait_for_physical_wheel_control_file "$down_sent_file" \
          || return 1
        sleep 0.5
        printf 'expected=%s actual=%s sequence=%s\n' \
          "$secondary_desktop_id" \
          "$(current_desktop_id 2>/dev/null || printf unavailable)" \
          "$(virtual_desktop_sequence 2>/dev/null || printf unavailable)" \
          > "$down_observed_file"
        wait_for_current_desktop "$secondary_desktop_id" \
          || return 1
        : > "$down_verified_file"

        wait_for_physical_wheel_control_file "$up_sent_file" \
          || return 1
        sleep 0.5
        printf 'expected=%s actual=%s sequence=%s\n' \
          "$primary_desktop_id" \
          "$(current_desktop_id 2>/dev/null || printf unavailable)" \
          "$(virtual_desktop_sequence 2>/dev/null || printf unavailable)" \
          > "$up_observed_file"
        wait_for_current_desktop "$primary_desktop_id" \
          || return 1
        : > "$up_verified_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$sent_file" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      verify_physical_overview_zoom_phase() {
        local expected_active=$2
        local observed_file="/tmp/shared/driftile-overview-zoom-$1-observed"
        local phase=$1
        local process_id=$3
        local sent_file="/tmp/shared/driftile-overview-zoom-$phase-sent"
        local verified_file="/tmp/shared/driftile-overview-zoom-$phase-verified"

        wait_for_physical_wheel_control_file "$sent_file" \
          || return 1
        wait_for_effect_active_state "$overview_plugin_id" "$expected_active" \
          || return 1
        if [[ "$expected_active" == true ]]; then
          sleep 0.3
        fi

        printf 'phase=%s expected-active=%s actual-active=%s expected-desktop=%s actual-desktop=%s process=%s\n' \
          "$phase" \
          "$expected_active" \
          "$(effect_active_state "$overview_plugin_id" 2>/dev/null || printf unavailable)" \
          "$primary_desktop_id" \
          "$(current_desktop_id 2>/dev/null || printf unavailable)" \
          "$(kwin_process_id 2>/dev/null || printf unavailable)" \
          > "$observed_file"

        if [[ "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != "$expected_active" ]] \
          || ! wait_for_current_desktop "$primary_desktop_id" \
          || ! kwin_process_is_unchanged "$process_id" \
          || ! overview_component_errors_after "$journal_cursor"; then
          return 1
        fi

        : > "$verified_file"
      }

      request_physical_pointer_drag() {
        local attempt
        local destination_x=$4
        local destination_y=$5
        local drag_name=$1
        local output_frame=$6
        local output_height
        local output_width
        local output_x
        local output_y
        local ready_file="/tmp/shared/driftile-pointer-drag-$drag_name-ready"
        local sent_file="/tmp/shared/driftile-pointer-drag-$drag_name-sent"
        local source_x=$2
        local source_y=$3
        local temporary_file="$ready_file.tmp"

        case "$drag_name" in
          cross-column|same-stack) ;;
          *) return 1 ;;
        esac

        frame_is_valid "$output_frame" || return 1
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        rm -f "$ready_file" "$sent_file" "$temporary_file"
        printf '%s %s %s %s %s %s %s %s\n' \
          "$source_x" \
          "$source_y" \
          "$destination_x" \
          "$destination_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$sent_file" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      request_physical_overview_desktop_drag() {
        local attempt
        local card_height_milli
        local card_width_milli
        local desktop_count=$2
        local destination_x
        local destination_y
        local edge_margin_milli
        local gap_milli
        local gutter_x_milli
        local gutter_y_milli
        local output_frame=$1
        local output_height
        local output_width
        local output_x
        local output_y
        local projected_width_milli
        local ready_file=/tmp/shared/driftile-overview-desktop-drag-ready
        local sent_file=/tmp/shared/driftile-overview-desktop-drag-sent
        local source_x
        local source_y
        local stride_milli
        local temporary_file="$ready_file.tmp"
        local viewport_origin_x_milli
        local zoom_milli=${toString overviewZoom.milli}

        frame_is_valid "$output_frame" || return 1
        [[ "$desktop_count" =~ ^[0-9]+$ ]] || return 1
        ((desktop_count >= 3)) || return 1
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"

        card_height_milli=$((output_height * zoom_milli))
        card_width_milli=$((output_width * 1000))
        edge_margin_milli=$(((output_height * 1000 - card_height_milli) / 2))
        gap_milli=$((card_height_milli / 10))
        ((gap_milli <= 48000)) || gap_milli=48000
        ((card_width_milli > 0 && card_height_milli > 0)) || return 1
        stride_milli=$((card_height_milli + gap_milli))

        projected_width_milli=$((output_width * card_height_milli / output_height))
        viewport_origin_x_milli=$(((card_width_milli - projected_width_milli) / 2))
        if ((viewport_origin_x_milli >= 48000)); then
          gutter_x_milli=$((viewport_origin_x_milli - 46000))
        else
          gutter_x_milli=$((viewport_origin_x_milli + 10000))
        fi
        ((gutter_x_milli >= 6000)) || gutter_x_milli=6000
        ((gutter_x_milli <= card_width_milli - 42000)) \
          || gutter_x_milli=$((card_width_milli - 42000))
        gutter_y_milli=8000

        source_x=$((output_x + (gutter_x_milli + 18000) / 1000))
        destination_x=$source_x
        source_y=$((output_y + (edge_margin_milli + stride_milli \
          + gutter_y_milli + 18000) / 1000))
        destination_y=$((output_y \
          + (edge_margin_milli + card_height_milli / 4) / 1000))
        ((source_x >= output_x \
          && source_x < output_x + output_width \
          && source_y >= output_y + (edge_margin_milli + stride_milli) / 1000 \
          && source_y < output_y + output_height \
          && destination_y >= output_y \
          && destination_y < source_y)) \
          || return 1

        rm -f "$ready_file" "$sent_file" "$temporary_file"
        printf '%s %s %s %s %s %s %s %s\n' \
          "$source_x" \
          "$source_y" \
          "$destination_x" \
          "$destination_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$sent_file" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      request_physical_overview_workspace_gap_drop() {
        local attempt
        local card_height_milli
        local destination_x
        local destination_y
        local edge_margin_milli
        local gap_milli
        local output_frame=$2
        local output_height
        local output_width
        local output_x
        local output_y
        local ready_file=/tmp/shared/driftile-overview-window-drop-ready
        local sent_file=/tmp/shared/driftile-overview-window-drop-sent
        local source_frame=$1
        local source_height
        local source_width
        local source_x
        local source_x_milli
        local source_y
        local source_y_milli
        local temporary_file="$ready_file.tmp"
        local viewport_origin_x_milli
        local zoom_milli=${toString overviewZoom.milli}

        frame_is_valid "$source_frame" || return 1
        frame_is_valid "$output_frame" || return 1
        IFS=, read -r \
          source_x \
          source_y \
          source_width \
          source_height \
          <<< "$source_frame"
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"

        card_height_milli=$((output_height * zoom_milli))
        edge_margin_milli=$(((output_height * 1000 - card_height_milli) / 2))
        gap_milli=$((card_height_milli / 10))
        ((gap_milli <= 48000)) || gap_milli=48000
        viewport_origin_x_milli=$(((output_width * 1000 \
          - output_width * zoom_milli) / 2))
        source_x_milli=$((output_x * 1000 + viewport_origin_x_milli \
          + (source_x - output_x) * zoom_milli \
          + source_width * zoom_milli / 2))
        source_y_milli=$((output_y * 1000 + edge_margin_milli \
          + (source_y - output_y) * zoom_milli \
          + source_height * zoom_milli / 2))
        source_x=$(((source_x_milli + 500) / 1000))
        source_y=$(((source_y_milli + 500) / 1000))
        destination_x=$source_x
        destination_y=$((output_y \
          + (edge_margin_milli + card_height_milli + gap_milli / 2 + 500) / 1000))

        ((source_x >= output_x \
          && source_x < output_x + output_width \
          && source_y >= output_y \
          && source_y < output_y + output_height \
          && destination_x >= output_x \
          && destination_x < output_x + output_width \
          && destination_y >= output_y \
          && destination_y < output_y + output_height \
          && source_y != destination_y)) \
          || return 1

        rm -f "$ready_file" "$sent_file" "$temporary_file"
        printf '%s %s %s %s %s %s %s %s\n' \
          "$source_x" \
          "$source_y" \
          "$destination_x" \
          "$destination_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$sent_file" ]] && return 0
          sleep 0.1
        done

        return 1
      }

      request_physical_pointer_resize() {
        local active_title=$7
        local armed_file=/tmp/shared/driftile-pointer-resize-horizontal-armed
        local attempt
        local destination_x=$4
        local destination_y=$5
        local held_file=/tmp/shared/driftile-pointer-resize-horizontal-held
        local interactive_state=""
        local interactive_state_variable=$9
        local live_frame=""
        local live_frame_variable=$8
        local output_frame=$6
        local output_height
        local output_width
        local output_x
        local output_y
        local positioned_file=/tmp/shared/driftile-pointer-resize-horizontal-positioned
        local ready_file=/tmp/shared/driftile-pointer-resize-horizontal-ready
        local release_ready_file=/tmp/shared/driftile-pointer-resize-horizontal-release-ready
        local sent_file=/tmp/shared/driftile-pointer-resize-horizontal-sent
        local source_x=$2
        local source_y=$3
        local temporary_file="$ready_file.tmp"

        [[ "$1" == horizontal ]] || return 1
        frame_is_valid "$output_frame" || return 1
        printf -v "$live_frame_variable" '%s' ""
        printf -v "$interactive_state_variable" '%s' ""
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        rm -f \
          "$armed_file" \
          "$held_file" \
          "$positioned_file" \
          "$ready_file" \
          "$release_ready_file" \
          "$sent_file" \
          "$temporary_file"
        printf '%s %s %s %s %s %s %s %s\n' \
          "$source_x" \
          "$source_y" \
          "$destination_x" \
          "$destination_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          [[ -f "$positioned_file" ]] && break
          sleep 0.1
        done

        if [[ ! -f "$positioned_file" ]] \
          || ! activate_window "$active_title" \
          || ! wait_for_active "$active_title"; then
          rm -f \
            "$armed_file" \
            "$held_file" \
            "$positioned_file" \
            "$ready_file" \
            "$release_ready_file" \
            "$temporary_file"
          return 1
        fi
        : > "$armed_file"

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          [[ -f "$held_file" ]] && break
          sleep 0.1
        done

        if [[ ! -f "$held_file" ]]; then
          rm -f \
            "$armed_file" \
            "$held_file" \
            "$positioned_file" \
            "$ready_file" \
            "$release_ready_file" \
            "$temporary_file"
          return 1
        fi

        live_frame=$(
          capture_stable_window_frame_contains "$active_title" 2>/dev/null \
            || true
        )
        interactive_state=$(capture_interactive_resize_state resize 2>/dev/null || true)
        printf -v "$live_frame_variable" '%s' "$live_frame"
        printf -v "$interactive_state_variable" '%s' "$interactive_state"
        : > "$release_ready_file"

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if [[ -f "$sent_file" ]]; then
            rm -f \
              "$armed_file" \
              "$held_file" \
              "$positioned_file" \
              "$ready_file" \
              "$release_ready_file" \
              "$sent_file" \
              "$temporary_file"
            return 0
          fi

          sleep 0.1
        done

        rm -f \
          "$armed_file" \
          "$held_file" \
          "$positioned_file" \
          "$ready_file" \
          "$release_ready_file" \
          "$temporary_file"
        return 1
      }

      clear_physical_cross_desktop_pointer_handshake() {
        rm -f \
          /tmp/shared/driftile-cross-desktop-pointer-armed \
          /tmp/shared/driftile-cross-desktop-pointer-edge-ready \
          /tmp/shared/driftile-cross-desktop-pointer-edge-rejected \
          /tmp/shared/driftile-cross-desktop-pointer-hold-ready \
          /tmp/shared/driftile-cross-desktop-pointer-held \
          /tmp/shared/driftile-cross-desktop-pointer-moving \
          /tmp/shared/driftile-cross-desktop-pointer-positioned \
          /tmp/shared/driftile-cross-desktop-pointer-release-ready \
          /tmp/shared/driftile-cross-desktop-pointer-released \
          /tmp/shared/driftile-cross-desktop-pointer-hold-ready.tmp \
          /tmp/shared/driftile-cross-desktop-pointer-release-ready.tmp
      }

      request_physical_cross_desktop_pointer_hold() {
        local armed_file=/tmp/shared/driftile-cross-desktop-pointer-armed
        local attempt
        local current_desktop=""
        local current_source_frame=""
        local edge_x=$3
        local edge_y=$4
        local edge_ready_file=/tmp/shared/driftile-cross-desktop-pointer-edge-ready
        local edge_rejected_file=/tmp/shared/driftile-cross-desktop-pointer-edge-rejected
        local frame_exact=false
        local frame_failures=0
        local held_file=/tmp/shared/driftile-cross-desktop-pointer-held
        local interactive_state=""
        local interactive_state_variable=$7
        local membership_exact=false
        local membership_failures=0
        local moving_file=/tmp/shared/driftile-cross-desktop-pointer-moving
        local output_frame=$5
        local output_height
        local output_width
        local output_x
        local output_y
        local pointer_location=""
        local pointer_exact=false
        local pointer_failures=0
        local pointer_location_variable=$8
        local positioned_file=/tmp/shared/driftile-cross-desktop-pointer-positioned
        local pre_arm_ready=false
        local pre_arm_samples=0
        local pre_arm_stable_samples=0
        local ready_file=/tmp/shared/driftile-cross-desktop-pointer-hold-ready
        local ready_exposed_variable=$6
        local source_active=false
        local active_failures=0
        local source_x=$1
        local source_y=$2
        local desktop_exact=false
        local desktop_failures=0
        local source_desktop_id=''${11}
        local source_frame=''${10}
        local source_frame_height
        local source_frame_width
        local source_frame_x
        local source_frame_y
        local source_title=$9
        local temporary_file="$ready_file.tmp"

        printf -v "$ready_exposed_variable" '%s' false || return 1
        printf -v "$interactive_state_variable" '%s' "" || return 1
        printf -v "$pointer_location_variable" '%s' "" || return 1
        frame_is_valid "$output_frame" || return 1
        frame_is_valid "$source_frame" || return 1
        [[ -n "$source_desktop_id" && -n "$source_title" ]] || return 1
        IFS=, read -r \
          source_frame_x \
          source_frame_y \
          source_frame_width \
          source_frame_height \
          <<< "$source_frame"
        ((source_x > source_frame_x \
          && source_x < source_frame_x + source_frame_width - 1 \
          && source_y > source_frame_y \
          && source_y < source_frame_y + source_frame_height - 1)) \
          || return 1
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        clear_physical_cross_desktop_pointer_handshake || return 1
        printf '%s %s %s %s %s %s %s %s\n' \
          "$source_x" \
          "$source_y" \
          "$edge_x" \
          "$edge_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"
        printf -v "$ready_exposed_variable" '%s' true || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          [[ -f "$positioned_file" ]] && break
          sleep 0.1
        done
        [[ -f "$positioned_file" ]] || return 1

        for ((attempt = 0; attempt < 20; attempt += 1)); do
          pre_arm_samples=$((pre_arm_samples + 1))
          current_source_frame=$(window_frame_contains \
            "$source_title" 2>/dev/null || true)
          current_desktop=$(current_desktop_id 2>/dev/null || true)
          pointer_location=$(kdotool getmouselocation 2>/dev/null || true)

          frame_exact=false
          desktop_exact=false
          source_active=false
          membership_exact=false
          pointer_exact=false

          if [[ "$current_source_frame" == "$source_frame" ]]; then
            frame_exact=true
          else
            frame_failures=$((frame_failures + 1))
          fi
          if [[ "$current_desktop" == "$source_desktop_id" ]]; then
            desktop_exact=true
          else
            desktop_failures=$((desktop_failures + 1))
          fi
          if window_is_active "$source_title"; then
            source_active=true
          else
            active_failures=$((active_failures + 1))
          fi
          if window_is_on_desktop "$source_title" "$source_desktop_id"; then
            membership_exact=true
          else
            membership_failures=$((membership_failures + 1))
          fi
          if [[ "$pointer_location" \
            =~ ^x:([0-9]+)[[:space:]]y:([0-9]+)[[:space:]] ]] \
            && ((BASH_REMATCH[1] >= source_x - 2 \
              && BASH_REMATCH[1] <= source_x + 2 \
              && BASH_REMATCH[2] >= source_y - 2 \
              && BASH_REMATCH[2] <= source_y + 2)); then
            pointer_exact=true
          else
            pointer_failures=$((pointer_failures + 1))
          fi

          if [[ "$frame_exact" == true \
            && "$desktop_exact" == true \
            && "$source_active" == true \
            && "$membership_exact" == true \
            && "$pointer_exact" == true ]]; then
            pre_arm_stable_samples=$((pre_arm_stable_samples + 1))
            if ((pre_arm_stable_samples >= 2)); then
              pre_arm_ready=true
              break
            fi
          else
            pre_arm_stable_samples=0
          fi

          sleep 0.1
        done

        printf -v "$pointer_location_variable" '%s' "$pointer_location"
        if [[ "$pre_arm_ready" != true ]]; then
          {
            printf '\n[cross-desktop pointer pre-arm rejected]\n'
            printf 'samples: %s; consecutive exact: %s\n' \
              "$pre_arm_samples" "$pre_arm_stable_samples"
            printf 'frame exact: %s; failures: %s; expected: %s; observed: %s\n' \
              "$frame_exact" "$frame_failures" "$source_frame" \
              "''${current_source_frame:-unavailable}"
            printf 'desktop exact: %s; failures: %s; expected: %s; observed: %s\n' \
              "$desktop_exact" "$desktop_failures" "$source_desktop_id" \
              "''${current_desktop:-unavailable}"
            printf 'active exact: %s; failures: %s\n' \
              "$source_active" "$active_failures"
            printf 'membership exact: %s; failures: %s\n' \
              "$membership_exact" "$membership_failures"
            printf 'pointer exact: %s; failures: %s; expected: %s,%s; observed: %s\n' \
              "$pointer_exact" "$pointer_failures" "$source_x" "$source_y" \
              "''${pointer_location:-unavailable}"
          } >> /tmp/shared/driftile-focus-diagnostics
          : > "$edge_rejected_file" || return 1

          for ((attempt = 0; attempt < 200; attempt += 1)); do
            [[ -f "$held_file" ]] && break
            sleep 0.1
          done
          [[ -f "$held_file" ]] || return 1

          pointer_location=$(kdotool getmouselocation 2>/dev/null || true)
          printf -v "$pointer_location_variable" '%s' "$pointer_location"
          return 1
        fi

        : > "$armed_file" || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          [[ -f "$moving_file" ]] && break
          sleep 0.1
        done
        [[ -f "$moving_file" ]] || return 1

        interactive_state=$(capture_interactive_resize_state move 2>/dev/null || true)
        printf -v "$interactive_state_variable" '%s' "$interactive_state"

        if [[ ! "$interactive_state" \
          =~ ^true,false,-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+,true$ ]]; then
          : > "$edge_rejected_file" || return 1

          for ((attempt = 0; attempt < 200; attempt += 1)); do
            [[ -f "$held_file" ]] && break
            sleep 0.1
          done
          [[ -f "$held_file" ]] || return 1

          pointer_location=$(kdotool getmouselocation 2>/dev/null || true)
          printf -v "$pointer_location_variable" '%s' "$pointer_location"
          return 1
        fi

        : > "$edge_ready_file" || return 1

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          [[ -f "$held_file" ]] && break
          sleep 0.1
        done
        [[ -f "$held_file" ]] || return 1

        pointer_location=$(kdotool getmouselocation 2>/dev/null || true)
        printf -v "$pointer_location_variable" '%s' "$pointer_location"

        return 0
      }

      request_physical_cross_desktop_pointer_release() {
        local attempt
        local output_frame=$3
        local output_height
        local output_width
        local output_x
        local output_y
        local ready_file=/tmp/shared/driftile-cross-desktop-pointer-release-ready
        local released_file=/tmp/shared/driftile-cross-desktop-pointer-released
        local target_x=$1
        local target_y=$2
        local temporary_file="$ready_file.tmp"

        frame_is_valid "$output_frame" || return 1
        IFS=, read -r \
          output_x \
          output_y \
          output_width \
          output_height \
          <<< "$output_frame"
        rm -f "$ready_file" "$released_file" "$temporary_file"
        printf '%s %s %s %s %s %s\n' \
          "$target_x" \
          "$target_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          [[ -f "$released_file" ]] && return 0
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
          && wait_for_layout 16 848 1680 \
          || return 1
        record_focus_state "physical Meta+Home focused the first column"

        request_physical_shortcut end \
          && wait_for_active "$title_c" \
          && wait_for_layout -816 16 848 \
          || return 1
        record_focus_state "physical Meta+End focused the last column"

        request_physical_shortcut ctrl-home \
          && wait_for_active "$title_c" \
          && wait_for_layout 848 1680 16 \
          || return 1
        record_focus_state "physical Meta+Ctrl+Home moved the column first"

        request_physical_shortcut ctrl-end \
          && wait_for_active "$title_c" \
          && wait_for_layout -816 16 848 \
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

      verify_configured_column_width_presets() {
        local backward_wrap_width=""
        local baseline_first
        local baseline_second
        local baseline_third
        local baseline_third_y
        local cleanup_verified=false
        local expected_narrow_width
        local expected_wide_width
        local forward_wrap_width=""
        local gap
        local output_frame=""
        local output_width
        local output_y
        local presets_verified=false
        local wide_width=""

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! invoke_shortcut "driftile_reset_column_width" \
          || ! capture_stable_frames; then
          record_focus_state "configured column-width preset baseline failed"
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)

        if frame_is_valid "$output_frame" \
          && frame_is_valid "$baseline_third"; then
          IFS=, read -r \
            _ \
            output_y \
            output_width \
            _ \
            <<< "$output_frame"
          IFS=, read -r _ baseline_third_y _ _ <<< "$baseline_third"
          gap=$((baseline_third_y - output_y))
          expected_narrow_width=$((
            (25 * (output_width - gap) + 50) / 100 - gap
          ))
          expected_wide_width=$((
            (75 * (output_width - gap) + 50) / 100 - gap
          ))

          if ((gap >= 0 \
            && expected_narrow_width > 0 \
            && expected_wide_width > expected_narrow_width)) \
            && set_column_width_presets "25,75" \
            && request_physical_shortcut preset-next \
            && wait_for_window_width_near \
              "$title_c" "$expected_wide_width" 2 \
            && wait_for_active "$title_c"; then
            wide_width=$(window_frame_width "$title_c" 2>/dev/null || true)

            if request_physical_shortcut preset-next-wrap \
              && wait_for_window_width_near \
                "$title_c" "$expected_narrow_width" 2 \
              && wait_for_active "$title_c"; then
              forward_wrap_width=$(
                window_frame_width "$title_c" 2>/dev/null || true
              )

              if request_physical_shortcut preset-back \
                && wait_for_window_width_near \
                  "$title_c" "$expected_wide_width" 2 \
                && wait_for_active "$title_c"; then
                backward_wrap_width=$(
                  window_frame_width "$title_c" 2>/dev/null || true
                )
                presets_verified=true
              fi
            fi
          fi
        fi

        if set_column_width_presets "" \
          && invoke_shortcut "driftile_reset_column_width" \
          && activate_window "$title_a" \
          && wait_for_active "$title_a" \
          && activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=true
        fi

        if [[ "$presets_verified" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "configured column-width presets wrapped forward physically and backward with Meta+Shift+R"
          return 0
        fi

        record_focus_state "configured column-width preset verification failed"
        {
          printf 'output frame: %s\n' "$output_frame"
          printf 'derived gap: %s\n' "''${gap:-unavailable}"
          printf 'expected 25 percent width: %s\n' \
            "''${expected_narrow_width:-unavailable}"
          printf 'expected 75 percent width: %s\n' \
            "''${expected_wide_width:-unavailable}"
          printf 'first forward width: %s\n' "''${wide_width:-missing}"
          printf 'forward wrap width: %s\n' "''${forward_wrap_width:-missing}"
          printf 'backward wrap width: %s\n' "''${backward_wrap_width:-missing}"
          printf 'preset sequence verified: %s\n' "$presets_verified"
          printf 'configuration cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      verify_physical_height_shortcuts() {
        local singleton_first_frame
        local singleton_second_frame
        local singleton_third_frame
        local stack_first_frame
        local stack_first_width
        local stack_first_x
        local stack_first_y
        local stack_second_frame
        local stack_second_height
        local stack_second_width
        local stack_second_x
        local stack_second_y
        local stack_third_frame
        local tabbed_frame

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

        IFS=, read -r \
          stack_first_x \
          stack_first_y \
          stack_first_width \
          _ \
          <<< "$stack_first_frame"
        IFS=, read -r \
          stack_second_x \
          stack_second_y \
          stack_second_width \
          stack_second_height \
          <<< "$stack_second_frame"

        if ((stack_first_x != stack_second_x \
          || stack_first_width != stack_second_width)); then
          record_focus_state "tabbed column source frames did not align"
          return 1
        fi

        tabbed_frame="$stack_first_x,$stack_first_y,$stack_first_width,$((
          stack_second_y + stack_second_height - stack_first_y
        ))"

        if ! request_physical_shortcut tabbed-enter \
          || ! wait_for_frames \
            "$tabbed_frame" \
            "$tabbed_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical tabbed column entry failed"
          return 1
        fi
        record_focus_state "physical tabbed column entry overlaid the stack"

        if ! invoke_shortcut "driftile_focus_window_up" \
          || ! wait_for_active "$title_a" \
          || ! invoke_shortcut "driftile_focus_window_up" \
          || ! wait_for_active "$title_a" \
          || ! invoke_shortcut "driftile_focus_window_down" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_focus_window_down" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "tabbed column focus boundaries failed"
          return 1
        fi
        record_focus_state "tabbed column focus preserved both boundaries"

        if ! invoke_shortcut "driftile_move_window_up" \
          || ! wait_for_active "$title_b" \
          || ! invoke_shortcut "driftile_focus_window_down" \
          || ! wait_for_active "$title_a" \
          || ! invoke_shortcut "driftile_move_window_up" \
          || ! wait_for_active "$title_a" \
          || ! invoke_shortcut "driftile_focus_window_down" \
          || ! wait_for_active "$title_b" \
          || ! wait_for_frames \
            "$tabbed_frame" \
            "$tabbed_frame" \
            "$stack_third_frame"; then
          record_focus_state "tabbed column reorder round trip failed"
          return 1
        fi
        record_focus_state "tabbed column reorder restored the stack order"

        if ! request_physical_shortcut tabbed-exit \
          || ! wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "physical tabbed column exit failed"
          return 1
        fi
        record_focus_state "physical tabbed column exit restored stack heights"

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

        if ! invoke_shortcut "driftile_decrease_window_height"; then
          record_focus_state "stacked height decrease delivery failed"
          return 1
        fi

        if ! wait_for_stacked_height_relation \
          active-smaller \
          "$stack_first_frame" \
          "$stack_second_frame" \
          "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          record_focus_state "stacked height decrease produced no height change"
          return 1
        fi
        record_focus_state \
          "stacked height decrease shrank B and expanded sibling A"

        invoke_shortcut "driftile_increase_window_height" \
          && wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          && wait_for_active "$title_b" \
          || return 1
        record_focus_state \
          "stacked height increase restored B and sibling A heights"

        if ! set_window_height_presets "25,75" \
          || ! request_physical_shortcut height-preset-next \
          || ! wait_for_stacked_height_relation \
            active-larger \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          set_window_height_presets "" >/dev/null 2>&1 || true
          record_focus_state \
            "physical Meta+Ctrl+Shift+R did not select the configured taller B preset"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+Shift+R selected the configured taller B preset"

        if ! request_physical_shortcut ctrl-r \
          || ! wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b" \
          || ! set_window_height_presets "" \
          || ! wait_for_frames \
            "$stack_first_frame" \
            "$stack_second_frame" \
            "$stack_third_frame" \
          || ! wait_for_active "$title_b"; then
          set_window_height_presets "" >/dev/null 2>&1 || true
          record_focus_state \
            "physical height preset cleanup did not restore the stack"
          return 1
        fi
        record_focus_state \
          "physical Meta+Ctrl+R restored automatic stack heights and cleared the configured presets"

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
        local full_first_x
        local full_first_width
        local full_second_frame
        local full_second_height
        local full_second_width
        local full_second_x
        local full_second_y
        local full_third_x
        local restored_first_frame
        local restored_second_frame
        local restored_third_frame
        local original_first_frame
        local original_first_height
        local original_first_width
        local original_first_y
        local original_gap
        local original_second_frame
        local original_second_height
        local original_second_width
        local original_second_x
        local original_second_y
        local original_third_frame
        local original_third_height
        local original_third_width
        local original_third_x
        local original_third_y
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
        IFS=, read -r \
          _ \
          original_first_y \
          original_first_width \
          original_first_height \
          <<< "$original_first_frame"
        IFS=, read -r \
          original_second_x \
          original_second_y \
          original_second_width \
          original_second_height \
          <<< "$original_second_frame"
        IFS=, read -r \
          original_third_x \
          original_third_y \
          original_third_width \
          original_third_height \
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
        IFS=, read -r full_first_x _ full_first_width _ \
          <<< "$stable_first_frame"
        IFS=, read -r \
          full_second_x \
          full_second_y \
          full_second_width \
          full_second_height \
          <<< "$full_second_frame"
        IFS=, read -r full_third_x _ _ _ \
          <<< "$stable_third_frame"
        usable_right=$((
          original_third_x + original_third_width
        ))
        usable_left=$((usable_right - full_second_width))
        printf -v restored_first_frame '%s,%s,%s,%s' \
          "$((full_second_x - original_gap - original_first_width))" \
          "$original_first_y" \
          "$original_first_width" \
          "$original_first_height"
        printf -v restored_second_frame '%s,%s,%s,%s' \
          "$full_second_x" \
          "$original_second_y" \
          "$original_second_width" \
          "$original_second_height"
        printf -v restored_third_frame '%s,%s,%s,%s' \
          "$((full_second_x + original_second_width + original_gap))" \
          "$original_third_y" \
          "$original_third_width" \
          "$original_third_height"

        if ((original_gap <= 0 \
          || usable_right <= usable_left \
          || full_second_width <= original_second_width \
          || full_second_x != usable_left \
          || full_second_x + full_second_width != usable_right \
          || full_first_x + full_first_width > usable_left - (2 * original_gap) \
          || full_third_x < usable_right + (2 * original_gap) \
          || full_second_y != original_second_y \
          || full_second_height != original_second_height)); then
          record_focus_state \
            "full-width viewport margins or neighbor visibility were invalid"
          return 1
        fi

        if ! invoke_shortcut "driftile_maximize_column" \
          || ! wait_for_middle_width \
            equal \
            "$original_first_width" \
            "$original_second_width" \
            "$original_third_width" \
          || ! wait_for_frames \
            "$restored_first_frame" \
            "$restored_second_frame" \
            "$restored_third_frame" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$restored_first_frame" \
            "$restored_second_frame" \
            "$restored_third_frame" \
          || ! activate_window "$title_b" \
          || ! wait_for_active "$title_b"; then
          record_focus_state \
            "full-width viewport retention failed"
          {
            printf 'expected restored frame A: %s\n' "$restored_first_frame"
            printf 'expected restored frame B: %s\n' "$restored_second_frame"
            printf 'expected restored frame C: %s\n' "$restored_third_frame"
          } >> /tmp/shared/driftile-focus-diagnostics
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
            "$restored_first_frame" \
            "$restored_second_frame" \
            "$restored_third_frame"; then
          record_focus_state \
            "physical column-view shortcut viewport retention failed"
          {
            printf 'expected frame A: %s\n' "$restored_first_frame"
            printf 'expected frame B: %s\n' "$restored_second_frame"
            printf 'expected frame C: %s\n' "$restored_third_frame"
          } >> /tmp/shared/driftile-focus-diagnostics
          return 1
        fi
        record_focus_state \
          "physical column-view shortcut viewport retained before application tests"
      }

      verify_full_width_successor_edge_gaps() {
        local active_caption=""
        local attempt
        local baseline_first
        local baseline_second
        local baseline_third
        local cleanup_verified=true
        local current_pair=""
        local current_predecessor_frame=""
        local current_successor_frame=""
        local full_frame=""
        local full_height=0
        local full_right=0
        local full_width=0
        local full_x=0
        local full_y=0
        local gap=""
        local original_frame=""
        local original_width=0
        local predecessor_frame=""
        local predecessor_height=0
        local predecessor_pid=""
        local predecessor_right=0
        local predecessor_title="Driftile VM Full-width Konsole"
        local predecessor_width=0
        local predecessor_x=0
        local predecessor_y=0
        local previous_pair=""
        local stable_samples=0
        local successor_frame=""
        local successor_height=0
        local successor_pid=""
        local successor_right=0
        local successor_title="Driftile VM Full-width KDE Calculator"
        local successor_width=0
        local successor_x=0
        local successor_y=0
        local verified=false

        if ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames; then
          record_focus_state "full-width successor baseline failed"
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame

        if ! set_current_desktop "$secondary_desktop_id"; then
          record_focus_state "full-width successor desktop setup failed"
          return 1
        fi

        if start_konsole_window \
            predecessor_pid \
            predecessor_title \
            "$predecessor_title" \
          && activate_window "$predecessor_title" \
          && wait_for_active "$predecessor_title" \
          && original_frame=$(capture_stable_window_frame "$predecessor_title") \
          && invoke_shortcut "driftile_maximize_column" \
          && full_frame=$(capture_stable_window_frame "$predecessor_title") \
          && start_kcalc_window \
            successor_pid \
            successor_title \
            "$successor_title" \
          && activate_window "$successor_title" \
          && wait_for_active "$successor_title"; then
          for ((attempt = 0; attempt < 100; attempt += 1)); do
            current_predecessor_frame=$(
              window_frame "$predecessor_title" 2>/dev/null || true
            )
            current_successor_frame=$(
              window_frame "$successor_title" 2>/dev/null || true
            )
            active_caption=$(active_window_caption 2>/dev/null || true)
            current_pair="$current_predecessor_frame|$current_successor_frame|$active_caption"

            if frame_is_valid "$current_predecessor_frame" \
              && frame_is_valid "$current_successor_frame" \
              && [[ "$active_caption" == "$successor_title" ]]; then
              if [[ "$current_pair" == "$previous_pair" ]]; then
                stable_samples=$((stable_samples + 1))
              else
                stable_samples=1
              fi

              if ((stable_samples >= 2)); then
                predecessor_frame=$current_predecessor_frame
                successor_frame=$current_successor_frame
                break
              fi
            else
              stable_samples=0
            fi

            previous_pair=$current_pair
            sleep 0.1
          done

          gap=$(
            ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
              --file "$HOME/.config/kwinrc" \
              --group "Script-${pluginId}" \
              --key Gap \
              --default 16 \
              2>/dev/null || true
          )

          if frame_is_valid "$original_frame" \
            && frame_is_valid "$full_frame" \
            && frame_is_valid "$predecessor_frame" \
            && frame_is_valid "$successor_frame" \
            && [[ "$gap" =~ ^[1-9][0-9]*$ ]]; then
            IFS=, read -r _ _ original_width _ <<< "$original_frame"
            IFS=, read -r full_x full_y full_width full_height \
              <<< "$full_frame"
            IFS=, read -r \
              predecessor_x \
              predecessor_y \
              predecessor_width \
              predecessor_height \
              <<< "$predecessor_frame"
            IFS=, read -r \
              successor_x \
              successor_y \
              successor_width \
              successor_height \
              <<< "$successor_frame"
            full_right=$((full_x + full_width))
            predecessor_right=$((predecessor_x + predecessor_width))
            successor_right=$((successor_x + successor_width))

            if ((full_width > original_width \
              && predecessor_width == full_width \
              && predecessor_x < full_x \
              && predecessor_right > full_x \
              && predecessor_right == successor_x - gap \
              && successor_x > full_x \
              && successor_right == full_right \
              && predecessor_y == full_y \
              && predecessor_height == full_height \
              && successor_y == full_y \
              && successor_height == full_height)); then
              verified=true
              record_focus_state \
                "new real window minimally revealed after a full-width predecessor"
            fi
          fi
        fi

        if [[ -n "$successor_pid" ]]; then
          terminate_process "$successor_pid"
          successor_pid=""

          if ! wait_for_window_gone "$successor_title"; then
            cleanup_verified=false
          fi
        fi

        if [[ -n "$predecessor_pid" ]]; then
          if ! frame_is_valid "$full_frame" \
            || ! frame_is_valid "$original_frame" \
            || ! activate_window "$predecessor_title" \
            || ! wait_for_active "$predecessor_title" \
            || ! wait_for_named_frames "$predecessor_title" "$full_frame" \
            || ! invoke_shortcut "driftile_maximize_column" \
            || ! wait_for_named_frames "$predecessor_title" "$original_frame"; then
            cleanup_verified=false
          fi

          terminate_process "$predecessor_pid"
          predecessor_pid=""

          if ! wait_for_window_gone "$predecessor_title"; then
            cleanup_verified=false
          fi
        fi

        if ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$verified" == true && "$cleanup_verified" == true ]]; then
          return 0
        fi

        record_focus_state "full-width successor edge-gap verification failed"
        {
          printf 'configured gap: %s\n' "''${gap:-unavailable}"
          printf 'original predecessor frame: %s\n' "$original_frame"
          printf 'full-width predecessor frame: %s\n' "$full_frame"
          printf 'parked predecessor frame: %s\n' "$predecessor_frame"
          printf 'active successor frame: %s\n' "$successor_frame"
          printf 'expected active right edge: %s\n' "$full_right"
          printf 'expected inter-column gap: %s\n' "$gap"
          printf 'verified: %s\n' "$verified"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
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

      verify_physical_horizontal_pointer_resize() {
        local accepted_width=0
        local adoption_verified=false
        local destination_x=0
        local destination_y=0
        local expected_firefox_frame=""
        local expected_xterm_frame=""
        local firefox_frame=""
        local firefox_height=0
        local firefox_title=$1
        local firefox_width=0
        local firefox_x=0
        local firefox_y=0
        local gesture_delivered=false
        local handshake_delivered=false
        local held_active=""
        local held_height=0
        local held_interactive_state=""
        local held_move=""
        local held_resize=""
        local held_state_height=0
        local held_state_width=0
        local held_state_x=0
        local held_state_y=0
        local held_width=0
        local held_x=0
        local held_xterm_frame=""
        local held_y=0
        local layout_digest=""
        local output_frame=$3
        local output_height=0
        local output_width=0
        local output_x=0
        local output_y=0
        local reset_verified=false
        local resize_distance=0
        local resize_policy=""
        local resized_xterm_frame=""
        local resized_xterm_height=0
        local resized_xterm_x=0
        local resized_xterm_y=0
        local source_x=0
        local source_y=0
        local xterm_frame=""
        local xterm_height=0
        local xterm_title=$2
        local xterm_width=0
        local xterm_x=0
        local xterm_y=0

        if ! layout_digest=$(wait_for_stable_overview_layout_digest); then
          record_focus_state \
            "horizontal pointer resize layout barrier failed"
          return 1
        fi

        firefox_frame=$(
          capture_stable_window_frame_contains "$firefox_title" \
            || true
        )
        xterm_frame=$(
          capture_stable_window_frame_contains "$xterm_title" \
            || true
        )
        resize_policy=$(
          x11_window_resize_policy "$xterm_title" xterm 2>/dev/null \
            || true
        )

        if frame_is_valid "$output_frame" \
          && frame_is_valid "$firefox_frame" \
          && frame_is_valid "$xterm_frame" \
          && resize_policy_is_nontrivial "$resize_policy" \
          && wait_for_active "$xterm_title"; then
          IFS=, read -r \
            output_x \
            output_y \
            output_width \
            output_height \
            <<< "$output_frame"
          IFS=, read -r \
            firefox_x \
            firefox_y \
            firefox_width \
            firefox_height \
            <<< "$firefox_frame"
          IFS=, read -r \
            xterm_x \
            xterm_y \
            xterm_width \
            xterm_height \
            <<< "$xterm_frame"
          source_x=$((xterm_x + xterm_width - 3))
          source_y=$((xterm_y + (xterm_height / 2)))
          resize_distance=$((xterm_width / 5))

          if ((resize_distance < 64)); then
            resize_distance=64
          elif ((resize_distance > 128)); then
            resize_distance=128
          fi

          destination_x=$((source_x - resize_distance))
          destination_y=$source_y

          if ((xterm_width >= 192 \
            && firefox_x == xterm_x \
            && firefox_width == xterm_width \
            && firefox_y + firefox_height < xterm_y \
            && source_x > xterm_x + ((2 * xterm_width) / 3) \
            && source_x < xterm_x + xterm_width \
            && source_y >= xterm_y \
            && source_y < xterm_y + xterm_height \
            && destination_x >= output_x \
            && destination_x < output_x + output_width \
            && destination_y >= output_y \
            && destination_y < output_y + output_height)) \
            && request_physical_pointer_resize \
              horizontal \
              "$source_x" \
              "$source_y" \
              "$destination_x" \
              "$destination_y" \
              "$output_frame" \
              "$xterm_title" \
              held_xterm_frame \
              held_interactive_state; then
            handshake_delivered=true

            if frame_is_valid "$held_xterm_frame" \
              && [[ "$held_interactive_state" \
                =~ ^(true|false),(true|false),(-?[0-9]+),(-?[0-9]+),([0-9]+),([0-9]+),(true|false)$ ]]; then
              IFS=, read -r \
                held_move \
                held_resize \
                held_state_x \
                held_state_y \
                held_state_width \
                held_state_height \
                held_active \
                <<< "$held_interactive_state"
              IFS=, read -r \
                held_x \
                held_y \
                held_width \
                held_height \
                <<< "$held_xterm_frame"

              if [[ "$held_move" == false \
                && "$held_resize" == true \
                && "$held_active" == true ]] \
                && ((held_x == xterm_x \
                  && held_y == xterm_y \
                  && held_width != xterm_width \
                  && held_height == xterm_height \
                  && held_state_x == held_x \
                  && held_state_y == held_y \
                  && held_state_width == held_width \
                  && held_state_height == held_height)); then
                gesture_delivered=true
              fi
            fi
          fi
        fi

        if [[ "$gesture_delivered" == true ]]; then
          resized_xterm_frame=$(
            capture_stable_window_frame_contains "$xterm_title" \
              || true
          )

          if frame_is_valid "$resized_xterm_frame"; then
            IFS=, read -r \
              resized_xterm_x \
              resized_xterm_y \
              accepted_width \
              resized_xterm_height \
              <<< "$resized_xterm_frame"
            expected_xterm_frame="$xterm_x,$xterm_y,$accepted_width,$xterm_height"
            expected_firefox_frame="$firefox_x,$firefox_y,$accepted_width,$firefox_height"

            if ((accepted_width != xterm_width \
              && resized_xterm_x == xterm_x \
              && resized_xterm_y == xterm_y \
              && resized_xterm_height == xterm_height)) \
              && frame_width_matches_resize_lattice \
                "$resized_xterm_frame" \
                "$resize_policy" \
              && wait_for_named_frames \
                "$xterm_title" \
                "$expected_xterm_frame" \
                "$firefox_title" \
                "$expected_firefox_frame" \
              && wait_for_pointer_stack_order \
                "$firefox_title" \
                "$xterm_title" \
                "$accepted_width" \
              && wait_for_active "$xterm_title"; then
              adoption_verified=true
              record_focus_state \
                "physical horizontal pointer resize adopted the accepted XWayland width"
            fi
          fi
        fi

        if [[ "$adoption_verified" == true ]] \
          && invoke_shortcut "driftile_reset_column_width" \
          && wait_for_named_frames \
            "$xterm_title" \
            "$xterm_frame" \
            "$firefox_title" \
            "$firefox_frame" \
          && wait_for_pointer_stack_order \
            "$firefox_title" \
            "$xterm_title" \
            "$xterm_width" \
          && wait_for_active "$xterm_title"; then
          reset_verified=true
          record_focus_state \
            "horizontal pointer resize reset restored the exact stacked frames"
        fi

        if [[ "$adoption_verified" == true \
          && "$reset_verified" == true ]]; then
          return 0
        fi

        if [[ "$gesture_delivered" == true \
          && "$reset_verified" == false ]]; then
          invoke_shortcut "driftile_reset_column_width" \
            >/dev/null 2>&1 || true
          wait_for_named_frames \
            "$xterm_title" \
            "$xterm_frame" \
            "$firefox_title" \
            "$firefox_frame" \
            >/dev/null 2>&1 || true
        fi

        record_focus_state \
          "physical horizontal pointer resize verification failed"
        {
          printf 'output frame: %s\n' "$output_frame"
          printf 'Firefox frame before resize: %s\n' "$firefox_frame"
          printf 'XWayland xterm frame before resize: %s\n' "$xterm_frame"
          printf 'XWayland resize policy: %s\n' "$resize_policy"
          printf 'layout barrier digest: %s\n' "$layout_digest"
          printf 'resize source and destination: %s,%s -> %s,%s\n' \
            "$source_x" \
            "$source_y" \
            "$destination_x" \
            "$destination_y"
          printf 'XWayland xterm held frame: %s\n' "$held_xterm_frame"
          printf 'KWin held move,resize,x,y,width,height,active: %s\n' \
            "$held_interactive_state"
          printf 'XWayland xterm accepted frame: %s\n' \
            "$resized_xterm_frame"
          printf 'expected adopted frames: %s | %s\n' \
            "$expected_firefox_frame" \
            "$expected_xterm_frame"
          printf 'handshake delivered: %s\n' "$handshake_delivered"
          printf 'interactive resize proven: %s\n' "$gesture_delivered"
          printf 'adoption verified: %s\n' "$adoption_verified"
          printf 'reset verified: %s\n' "$reset_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      verify_physical_pointer_reinsertion() {
        local baseline_first
        local baseline_second
        local baseline_third
        local cleanup_verified=true
        local cross_column_verified=false
        local destination_x
        local destination_y
        local firefox_frame=""
        local firefox_height
        local firefox_pid=""
        local firefox_profile=""
        local firefox_title="Driftile VM Firefox"
        local firefox_width
        local firefox_x
        local firefox_y
        local horizontal_resize_verified=false
        local output_frame=""
        local output_height
        local output_width
        local output_x
        local output_y
        local overview_verified=false
        local same_stack_verified=false
        local source_x
        local source_y
        local target_width=""
        local touchpad_navigation_verified=false
        local xterm_frame=""
        local xterm_height
        local xterm_pid=""
        local xterm_title="Driftile VM Pointer XWayland"
        local xterm_width
        local xterm_x
        local xterm_y

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames; then
          record_focus_state "physical pointer fixture baseline failed"
          return 1
        fi

        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame

        if start_firefox_window \
            firefox_pid \
            firefox_title \
            firefox_profile \
            "$firefox_title" \
          && activate_window "$firefox_title" \
          && wait_for_active "$firefox_title" \
          && start_xterm_window xterm_pid xterm_title "$xterm_title" \
          && activate_window "$xterm_title" \
          && wait_for_active "$xterm_title" \
          && activate_window "$firefox_title" \
          && wait_for_active "$firefox_title"; then
          output_frame=$(single_enabled_output_frame 2>/dev/null || true)
          firefox_frame=$(
            capture_stable_window_frame_contains "$firefox_title" \
              || true
          )
          xterm_frame=$(
            capture_stable_window_frame_contains "$xterm_title" \
              || true
          )

          if frame_is_valid "$output_frame" \
            && frame_is_valid "$firefox_frame" \
            && frame_is_valid "$xterm_frame"; then
            IFS=, read -r \
              output_x \
              output_y \
              output_width \
              output_height \
              <<< "$output_frame"
            IFS=, read -r \
              firefox_x \
              firefox_y \
              firefox_width \
              firefox_height \
              <<< "$firefox_frame"
            IFS=, read -r \
              xterm_x \
              xterm_y \
              xterm_width \
              xterm_height \
              <<< "$xterm_frame"
            source_x=$((firefox_x + (firefox_width / 2)))
            source_y=$((firefox_y + (firefox_height / 2)))
            destination_x=$((xterm_x + (xterm_width / 2)))
            destination_y=$((xterm_y + ((3 * xterm_height) / 4)))
            target_width=$xterm_width

            if (((firefox_x + firefox_width < xterm_x \
                || xterm_x + xterm_width < firefox_x) \
              && source_x >= output_x \
              && source_x < output_x + output_width \
              && source_y >= output_y \
              && source_y < output_y + output_height \
              && destination_x >= output_x \
              && destination_x < output_x + output_width \
              && destination_y >= output_y \
              && destination_y < output_y + output_height)) \
              && request_physical_pointer_drag \
                cross-column \
                "$source_x" \
                "$source_y" \
                "$destination_x" \
                "$destination_y" \
                "$output_frame" \
              && wait_for_pointer_stack_order \
                "$xterm_title" \
                "$firefox_title" \
                "$target_width" \
              && wait_for_active "$firefox_title"; then
              cross_column_verified=true
              record_focus_state \
                "physical pointer cross-column reinsertion succeeded"
            fi
          fi
        fi

        if [[ "$cross_column_verified" == true ]] \
          && activate_window "$xterm_title" \
          && wait_for_active "$xterm_title"; then
          xterm_frame=$(
            capture_stable_window_frame_contains "$xterm_title" \
              || true
          )
          firefox_frame=$(
            capture_stable_window_frame_contains "$firefox_title" \
              || true
          )

          if frame_is_valid "$xterm_frame" \
            && frame_is_valid "$firefox_frame"; then
            IFS=, read -r \
              xterm_x \
              xterm_y \
              xterm_width \
              xterm_height \
              <<< "$xterm_frame"
            IFS=, read -r \
              firefox_x \
              firefox_y \
              firefox_width \
              firefox_height \
              <<< "$firefox_frame"
            source_x=$((xterm_x + (xterm_width / 2)))
            source_y=$((xterm_y + (xterm_height / 2)))
            destination_x=$((firefox_x + (firefox_width / 2)))
            destination_y=$((firefox_y + ((3 * firefox_height) / 4)))

            if ((source_x >= output_x \
              && source_x < output_x + output_width \
              && source_y >= output_y \
              && source_y < output_y + output_height \
              && destination_x >= output_x \
              && destination_x < output_x + output_width \
              && destination_y >= output_y \
              && destination_y < output_y + output_height)) \
              && request_physical_pointer_drag \
                same-stack \
                "$source_x" \
                "$source_y" \
                "$destination_x" \
                "$destination_y" \
                "$output_frame" \
              && wait_for_pointer_stack_order \
                "$firefox_title" \
                "$xterm_title" \
                "$target_width" \
              && wait_for_active "$xterm_title"; then
              same_stack_verified=true
              record_focus_state \
                "physical pointer same-stack reorder succeeded"
            fi
          fi
        fi

        if [[ "$cross_column_verified" == true \
          && "$same_stack_verified" == true ]] \
          && verify_physical_horizontal_pointer_resize \
            "$firefox_title" \
            "$xterm_title" \
            "$output_frame"; then
          horizontal_resize_verified=true
        fi

        if [[ "$cross_column_verified" == true \
          && "$same_stack_verified" == true \
          && "$horizontal_resize_verified" == true ]] \
          && verify_touchpad_navigation_checkpoint \
            "$title_a" \
            "$title_b" \
            "$title_c" \
            "$firefox_title" \
            "$xterm_title"; then
          touchpad_navigation_verified=true
        fi

        if [[ "$cross_column_verified" == true \
          && "$same_stack_verified" == true \
          && "$horizontal_resize_verified" == true \
          && "$touchpad_navigation_verified" == true ]] \
          && verify_overview_effect_checkpoint \
            "$title_a" \
            "$title_b" \
            "$title_c" \
            "$firefox_title" \
            "$xterm_title"; then
          overview_verified=true
        fi

        if [[ -n "$xterm_pid" ]]; then
          terminate_process "$xterm_pid"

          if ! wait_for_window_gone_contains "$xterm_title"; then
            cleanup_verified=false
          fi
        fi

        if [[ -n "$firefox_pid" ]]; then
          terminate_process "$firefox_pid"

          if ! wait_for_window_gone_contains "$firefox_title"; then
            cleanup_verified=false
          fi
        fi

        if [[ -n "$firefox_profile" ]] \
          && ! rm -rf -- "$firefox_profile"; then
          cleanup_verified=false
        fi

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$cross_column_verified" == true \
          && "$same_stack_verified" == true \
          && "$horizontal_resize_verified" == true \
          && "$touchpad_navigation_verified" == true \
          && "$overview_verified" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "physical pointer fixture closed and restored the tiled layout"
          return 0
        fi

        record_focus_state "physical pointer reinsertion verification failed"
        {
          printf 'output frame: %s\n' "$output_frame"
          printf 'Firefox frame: %s\n' "$firefox_frame"
          printf 'XWayland xterm frame: %s\n' "$xterm_frame"
          printf 'target width: %s\n' "$target_width"
          printf 'cross-column verified: %s\n' "$cross_column_verified"
          printf 'same-stack verified: %s\n' "$same_stack_verified"
          printf 'horizontal resize verified: %s\n' \
            "$horizontal_resize_verified"
          printf 'touchpad navigation verified: %s\n' \
            "$touchpad_navigation_verified"
          printf 'overview verified: %s\n' "$overview_verified"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      verify_physical_cross_desktop_pointer_adoption() {
        local adoption_verified=false
        local baseline_first=""
        local baseline_second=""
        local baseline_third=""
        local cleanup_release_delivered=false
        local cleanup_verified=true
        local destination_release_delivered=false
        local destination_x=0
        local destination_y=0
        local edge_x=0
        local edge_y=0
        local firefox_frame=""
        local firefox_height=0
        local firefox_pid=""
        local firefox_profile=""
        local firefox_title="Driftile VM Firefox"
        local firefox_width=0
        local firefox_x=0
        local firefox_y=0
        local hidden_first=""
        local hidden_primary_xterm_frame=""
        local hidden_second=""
        local hidden_third=""
        local hold_delivered=false
        local hold_interactive_state=""
        local hold_interactive_verified=false
        local hold_pointer_location=""
        local hold_ready_exposed=false
        local hold_requested=false
        local output_frame=""
        local output_height=0
        local output_width=0
        local output_x=0
        local output_y=0
        local observed_current_desktop=""
        local observed_firefox_state=""
        local observed_target_state=""
        local primary_xterm_pid=""
        local primary_xterm_title="Driftile VM Cross-desktop Primary XWayland"
        local setup_verified=false
        local source_x=0
        local source_y=0
        local stable_frame_set=""
        local target_frame=""
        local target_height=0
        local target_pid=""
        local target_title="Driftile VM Cross-desktop Target XWayland"
        local target_width=0
        local target_x=0
        local target_y=0

        clear_physical_cross_desktop_pointer_handshake || return 1
        if set_current_desktop "$primary_desktop_id" \
          && activate_window "$title_c" \
          && wait_for_active "$title_c" \
          && capture_stable_frames; then
          baseline_first=$stable_first_frame
          baseline_second=$stable_second_frame
          baseline_third=$stable_third_frame
        else
          record_focus_state \
            "cross-desktop pointer adoption baseline capture failed"
        fi

        if frame_is_valid "$baseline_first" \
          && frame_is_valid "$baseline_second" \
          && frame_is_valid "$baseline_third" \
          && set_current_desktop "$secondary_desktop_id" \
          && start_xterm_window target_pid target_title "$target_title" \
          && wait_for_window_desktop "$target_title" "$secondary_desktop_id" \
          && set_current_desktop "$primary_desktop_id" \
          && start_xterm_window \
            primary_xterm_pid \
            primary_xterm_title \
            "$primary_xterm_title" \
          && wait_for_window_desktop \
            "$primary_xterm_title" \
            "$primary_desktop_id" \
          && start_firefox_window \
            firefox_pid \
            firefox_title \
            firefox_profile \
            "$firefox_title" \
          && wait_for_window_desktop "$firefox_title" "$primary_desktop_id" \
          && activate_window "$firefox_title" \
          && wait_for_active "$firefox_title" \
          && sleep 1 \
          && stable_frame_set=$(capture_stable_named_frame_set \
            2 \
            "$title_a" \
            "$title_b" \
            "$title_c" \
            "$primary_xterm_title" \
            "$firefox_title"); then
          IFS='|' read -r \
            hidden_first \
            hidden_second \
            hidden_third \
            hidden_primary_xterm_frame \
            firefox_frame \
            <<< "$stable_frame_set"
          output_frame=$(single_enabled_output_frame 2>/dev/null || true)

          if frame_is_valid "$hidden_primary_xterm_frame" \
            && frame_is_valid "$firefox_frame" \
            && frame_is_valid "$output_frame"; then
            IFS=, read -r \
              firefox_x \
              firefox_y \
              firefox_width \
              firefox_height \
              <<< "$firefox_frame"
            IFS=, read -r \
              output_x \
              output_y \
              output_width \
              output_height \
              <<< "$output_frame"
            source_x=$((firefox_x + (firefox_width / 2)))
            source_y=$((firefox_y + (firefox_height / 2)))
            edge_x=$source_x
            edge_y=$((output_y + output_height - 1))

            if ((source_x >= output_x \
              && source_x < output_x + output_width \
              && source_y >= output_y \
              && source_y < output_y + output_height \
              && edge_y >= output_y \
              && edge_y < output_y + output_height)); then
              setup_verified=true
            fi
          fi
        fi

        if [[ "$setup_verified" == true ]]; then
          hold_requested=true

          if request_physical_cross_desktop_pointer_hold \
            "$source_x" \
            "$source_y" \
            "$edge_x" \
            "$edge_y" \
            "$output_frame" \
            hold_ready_exposed \
            hold_interactive_state \
            hold_pointer_location \
            "$firefox_title" \
            "$firefox_frame" \
            "$primary_desktop_id"; then
            hold_delivered=true

            if [[ "$hold_interactive_state" \
              =~ ^true,false,-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+,true$ ]]; then
              hold_interactive_verified=true
            fi
          fi

          if [[ -f \
            /tmp/shared/driftile-cross-desktop-pointer-hold-ready ]]; then
            hold_ready_exposed=true
          fi
        fi

        if [[ "$hold_delivered" == true \
          && "$hold_interactive_verified" == true ]]; then
          if wait_for_cross_desktop_pointer_destination \
            "$firefox_title" \
            "$target_title" \
            "$secondary_desktop_id" \
            "$output_frame"; then
            target_frame=$(
              capture_stable_window_frame_contains "$target_title" \
                || true
            )

            if frame_is_valid "$target_frame"; then
              IFS=, read -r \
                target_x \
                target_y \
                target_width \
                target_height \
                <<< "$target_frame"
              destination_x=$((target_x + (target_width / 2)))
              destination_y=$((target_y + ((3 * target_height) / 4)))

              if ((destination_x >= output_x \
                && destination_x < output_x + output_width \
                && destination_y >= output_y \
                && destination_y < output_y + output_height)) \
                && request_physical_cross_desktop_pointer_release \
                  "$destination_x" \
                  "$destination_y" \
                  "$output_frame"; then
                destination_release_delivered=true

                if wait_for_cross_desktop_pointer_destination \
                  "$firefox_title" \
                  "$target_title" \
                  "$secondary_desktop_id" \
                  "$output_frame" \
                  && wait_for_pointer_stack_order \
                    "$target_title" \
                    "$firefox_title" \
                    "$target_width" \
                  && wait_for_window_frame_contains \
                    "$primary_xterm_title" \
                    "$hidden_primary_xterm_frame" \
                  && wait_for_named_frames \
                    "$title_a" \
                    "$hidden_first" \
                    "$title_b" \
                    "$hidden_second" \
                    "$title_c" \
                    "$hidden_third" \
                  && window_is_on_desktop \
                    "$primary_xterm_title" \
                    "$primary_desktop_id" \
                  && window_is_on_desktop \
                    "$title_a" \
                    "$primary_desktop_id" \
                  && window_is_on_desktop \
                    "$title_b" \
                    "$primary_desktop_id" \
                  && window_is_on_desktop \
                    "$title_c" \
                    "$primary_desktop_id"; then
                  adoption_verified=true
                  record_focus_state \
                    "physical cross-desktop pointer adoption preserved hidden contexts"
                fi
              fi
            fi
          fi
        fi

        observed_current_desktop=$(current_desktop_id 2>/dev/null || true)
        observed_firefox_state=$(
          window_desktop_output_state_contains \
            "$firefox_title" "$output_frame" 2>/dev/null || true
        )
        observed_target_state=$(
          window_desktop_output_state_contains \
            "$target_title" "$output_frame" 2>/dev/null || true
        )

        if [[ "$hold_requested" == true \
          && ( "$hold_ready_exposed" == true \
            || "$hold_delivered" == true ) \
          && "$destination_release_delivered" == false ]]; then
          if request_physical_cross_desktop_pointer_release \
            "$source_x" \
            "$source_y" \
            "$output_frame"; then
            cleanup_release_delivered=true
          else
            cleanup_verified=false
          fi
        fi
        clear_physical_cross_desktop_pointer_handshake \
          || cleanup_verified=false

        if [[ -n "$firefox_pid" ]]; then
          terminate_process "$firefox_pid"

          if ! wait_for_window_gone_contains "$firefox_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$target_pid" ]]; then
          terminate_process "$target_pid"

          if ! wait_for_window_gone_contains "$target_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$primary_xterm_pid" ]]; then
          terminate_process "$primary_xterm_pid"

          if ! wait_for_window_gone_contains "$primary_xterm_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$firefox_profile" ]] \
          && ! rm -rf -- "$firefox_profile"; then
          cleanup_verified=false
        fi
        if ! set_current_desktop "$primary_desktop_id" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$adoption_verified" == true \
          && "$destination_release_delivered" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "cross-desktop pointer fixture closed and restored the primary desktop"
          return 0
        fi

        record_focus_state \
          "physical cross-desktop pointer adoption verification failed"
        {
          printf 'setup verified: %s\n' "$setup_verified"
          printf 'hold requested: %s\n' "$hold_requested"
          printf 'hold ready exposed: %s\n' "$hold_ready_exposed"
          printf 'hold delivered: %s\n' "$hold_delivered"
          printf 'hold interactive verified: %s\n' \
            "$hold_interactive_verified"
          printf 'hold move,resize,x,y,width,height,active: %s\n' \
            "$hold_interactive_state"
          printf 'hold pointer location: %s\n' "$hold_pointer_location"
          printf 'destination release delivered: %s\n' \
            "$destination_release_delivered"
          printf 'cleanup release delivered: %s\n' \
            "$cleanup_release_delivered"
          printf 'adoption verified: %s\n' "$adoption_verified"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
          printf 'output frame: %s\n' "$output_frame"
          printf 'source Firefox frame: %s\n' "$firefox_frame"
          printf 'fresh target frame: %s\n' "$target_frame"
          printf 'hidden primary xterm frame: %s\n' \
            "$hidden_primary_xterm_frame"
          printf 'hidden application frames: %s | %s | %s\n' \
            "$hidden_first" \
            "$hidden_second" \
            "$hidden_third"
          printf 'current desktop: %s\n' "$observed_current_desktop"
          printf 'Firefox desktop/output: %s\n' "$observed_firefox_state"
          printf 'target desktop/output: %s\n' "$observed_target_state"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      fail_activity_layout_verification() {
        record_focus_state "$1"
        cleanup_activity_fixture || true
      }

      verify_activity_layout_ownership() {
        local activity_count
        local attempt
        local firefox_frame
        local firefox_initial_frame
        local firefox_initial_width
        local firefox_x
        local move_relation
        local move_shortcut
        local primary_first_frame
        local primary_first_id
        local primary_second_frame
        local primary_third_frame
        local xterm_frame
        local xterm_x

        activity_count=$(activity_ids 2>/dev/null | wc -l) || activity_count=0
        if [[ "$activity_count" != 1 ]] \
          || ! activity_primary_id=$(current_activity_id) \
          || ! start_firefox_window \
            activity_firefox_pid \
            activity_firefox_title \
            activity_firefox_profile \
            "Driftile VM Firefox" \
          || ! start_xterm_window \
            activity_xterm_pid \
            activity_xterm_title \
            "Driftile VM Activity XWayland Terminal" \
          || ! activity_firefox_id=$(window_id_contains "Driftile VM Firefox") \
          || ! activity_xterm_id=$(window_id_contains \
            "Driftile VM Activity XWayland Terminal") \
          || ! primary_first_id=$(window_id "$title_a") \
          || ! activity_secondary_id=$(create_activity \
            "Driftile VM Secondary Activity"); then
          fail_activity_layout_verification "the activity fixture setup failed"
          return 1
        fi

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          assign_activity_fixture_windows >/dev/null 2>&1 || true

          if window_has_exact_activity "$activity_firefox_id" "$activity_secondary_id" \
            && window_has_exact_activity "$activity_xterm_id" "$activity_secondary_id" \
            && window_has_exact_activity "$primary_first_id" "$activity_primary_id"; then
            break
          fi

          sleep 0.1
        done

        if ! window_has_exact_activity "$activity_firefox_id" "$activity_secondary_id" \
          || ! window_has_exact_activity "$activity_xterm_id" "$activity_secondary_id" \
          || ! window_has_exact_activity "$primary_first_id" "$activity_primary_id" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames 4; then
          fail_activity_layout_verification \
            "exact activity membership did not stabilize"
          return 1
        fi

        primary_first_frame=$stable_first_frame
        primary_second_frame=$stable_second_frame
        primary_third_frame=$stable_third_frame

        if ! set_current_activity "$activity_secondary_id" \
          || ! wait_for_window "$activity_firefox_title" \
          || ! wait_for_window "$activity_xterm_title" \
          || ! activate_window "$activity_firefox_title" \
          || ! wait_for_active "$activity_firefox_title" \
          || ! firefox_initial_frame=$(capture_stable_window_frame \
            "$activity_firefox_title") \
          || ! xterm_frame=$(capture_stable_window_frame \
            "$activity_xterm_title"); then
          fail_activity_layout_verification "the secondary activity layout failed"
          return 1
        fi
        IFS=, read -r firefox_x _ firefox_initial_width _ \
          <<< "$firefox_initial_frame"
        IFS=, read -r xterm_x _ _ _ <<< "$xterm_frame"

        if ((firefox_x == xterm_x)) \
          || ! invoke_shortcut "driftile_decrease_column_width" \
          || ! wait_for_real_window_width \
            "$activity_firefox_title" less "$firefox_initial_width"; then
          fail_activity_layout_verification \
            "the secondary activity width change failed"
          return 1
        fi

        if ! firefox_frame=$(capture_stable_window_frame \
            "$activity_firefox_title") \
          || ! xterm_frame=$(capture_stable_window_frame \
            "$activity_xterm_title"); then
          fail_activity_layout_verification \
            "the resized secondary activity layout did not stabilize"
          return 1
        fi
        IFS=, read -r firefox_x _ _ _ <<< "$firefox_frame"
        IFS=, read -r xterm_x _ _ _ <<< "$xterm_frame"

        if ((firefox_x < xterm_x)); then
          move_shortcut=driftile_move_column_right
          move_relation=right
        else
          move_shortcut=driftile_move_column_left
          move_relation=left
        fi

        if ! invoke_shortcut "$move_shortcut" \
          || ! wait_for_horizontal_order \
            "$activity_firefox_title" "$move_relation" "$activity_xterm_title"; then
          fail_activity_layout_verification \
            "the secondary activity column reorder failed"
          return 1
        fi

        if ! firefox_frame=$(capture_stable_window_frame \
            "$activity_firefox_title") \
          || ! xterm_frame=$(capture_stable_window_frame \
            "$activity_xterm_title"); then
          fail_activity_layout_verification \
            "the reordered secondary activity layout did not stabilize"
          return 1
        fi

        if ! set_current_activity "$activity_primary_id" \
          || ! wait_for_window "$title_c" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$primary_first_frame" \
            "$primary_second_frame" \
            "$primary_third_frame"; then
          fail_activity_layout_verification "the primary layout was not isolated"
          return 1
        fi

        if ! set_current_activity "$activity_secondary_id" \
          || ! wait_for_window "$activity_firefox_title" \
          || ! activate_window "$activity_firefox_title" \
          || ! wait_for_active "$activity_firefox_title" \
          || ! wait_for_named_frames \
            "$activity_firefox_title" "$firefox_frame" \
            "$activity_xterm_title" "$xterm_frame"; then
          fail_activity_layout_verification "the secondary layout was not restored"
          return 1
        fi

        if ! cleanup_activity_fixture \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$primary_first_frame" \
            "$primary_second_frame" \
            "$primary_third_frame"; then
          record_focus_state "the activity fixture cleanup failed"
          return 1
        fi

        record_focus_state \
          "activity-local width and order restored across switches"
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

        if ! close_real_application_physically_and_restore \
            "$firefox_query" \
            "$firefox_pid" \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          if ! rm -rf -- "$firefox_profile"; then
            record_focus_state "Firefox profile cleanup failed"
          fi
          return 1
        fi
        if ! rm -rf -- "$firefox_profile"; then
          record_focus_state "Firefox profile cleanup failed"
          return 1
        fi

        record_focus_state \
          "Firefox closed through physical Meta+Q and the tiled layout reflowed"

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

      verify_application_borderless_exclusions() {
        local baseline_first
        local baseline_second
        local baseline_third
        local borderless_exclusions=""
        local calculator_desktop_file=""
        local calculator_pid=""
        local calculator_title="Driftile VM Borderless KDE Calculator"
        local cleanup_verified=true
        local exclusions_cleared=false
        local exclusions_reapplied=false
        local exclusions_verified=false
        local konsole_desktop_file=""
        local xterm_desktop_file=""
        local xterm_pid=""
        local xterm_title="Driftile VM Borderless XWayland Terminal"

        if ! set_application_borderless_exclusions "" \
          || ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_real_window_borderless "$title_a" \
          || ! capture_stable_frames; then
          set_application_borderless_exclusions "" >/dev/null 2>&1 || true
          record_focus_state \
            "application borderless exclusion baseline failed"
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame

        if start_kcalc_window \
            calculator_pid \
            calculator_title \
            "$calculator_title" \
          && start_xterm_window \
            xterm_pid \
            xterm_title \
            "$xterm_title"; then
          konsole_desktop_file=$(window_desktop_file_contains "$title_a" 2>/dev/null || true)
          calculator_desktop_file=$(
            window_desktop_file_contains "$calculator_title" 2>/dev/null || true
          )
          xterm_desktop_file=$(
            window_desktop_file_contains "$xterm_title" 2>/dev/null || true
          )
          printf -v borderless_exclusions \
            '%s\n%s' \
            "$konsole_desktop_file" \
            "$xterm_desktop_file"

          if [[ -n "$konsole_desktop_file" \
            && -n "$calculator_desktop_file" \
            && -n "$xterm_desktop_file" \
            && "$konsole_desktop_file" != "$calculator_desktop_file" \
            && "$xterm_desktop_file" != "$calculator_desktop_file" ]] \
            && activate_window "$calculator_title" \
            && wait_for_active "$calculator_title" \
            && set_application_borderless_exclusions "$borderless_exclusions" \
            && wait_for_real_window_decorated "$title_a" \
            && wait_for_real_window_decorated "$title_b" \
            && wait_for_real_window_decorated "$title_c" \
            && wait_for_real_window_decorated "$xterm_title" \
            && wait_for_real_window_borderless "$calculator_title" \
            && wait_for_active "$calculator_title"; then
            exclusions_verified=true
            record_focus_state \
              "application exclusions preserved native and XWayland borders"
          fi

          if [[ "$exclusions_verified" == true ]] \
            && set_application_borderless_exclusions "" \
            && wait_for_real_window_borderless "$title_a" \
            && wait_for_real_window_borderless "$title_b" \
            && wait_for_real_window_borderless "$title_c" \
            && wait_for_real_window_borderless "$xterm_title" \
            && wait_for_real_window_borderless "$calculator_title" \
            && wait_for_active "$calculator_title"; then
            exclusions_cleared=true
            record_focus_state \
              "cleared application exclusions restored borderless windows"
          fi

          if [[ "$exclusions_cleared" == true ]] \
            && set_application_borderless_exclusions "$borderless_exclusions" \
            && wait_for_real_window_decorated "$title_a" \
            && wait_for_real_window_decorated "$title_b" \
            && wait_for_real_window_decorated "$title_c" \
            && wait_for_real_window_decorated "$xterm_title" \
            && wait_for_real_window_borderless "$calculator_title" \
            && wait_for_active "$calculator_title"; then
            exclusions_reapplied=true
            record_focus_state \
              "reapplied application exclusions restored owned borders"
          fi
        fi

        if ! set_application_borderless_exclusions ""; then
          cleanup_verified=false
        fi
        if [[ -n "$calculator_pid" ]] \
          && ! wait_for_real_window_borderless "$calculator_title"; then
          cleanup_verified=false
        fi
        if [[ -n "$xterm_pid" ]] \
          && ! wait_for_real_window_borderless "$xterm_title"; then
          cleanup_verified=false
        fi
        if ! wait_for_real_window_borderless "$title_a"; then
          cleanup_verified=false
        fi
        if ! wait_for_real_window_borderless "$title_b"; then
          cleanup_verified=false
        fi
        if ! wait_for_real_window_borderless "$title_c"; then
          cleanup_verified=false
        fi

        if [[ -n "$calculator_pid" ]]; then
          terminate_process "$calculator_pid"

          if ! wait_for_window_gone_contains "$calculator_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$xterm_pid" ]]; then
          terminate_process "$xterm_pid"

          if ! wait_for_window_gone_contains "$xterm_title"; then
            cleanup_verified=false
          fi
        fi
        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$exclusions_verified" == true \
          && "$exclusions_cleared" == true \
          && "$exclusions_reapplied" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "application borderless exclusion verification passed"
          return 0
        fi

        record_focus_state \
          "application borderless exclusion verification failed"
        {
          printf 'Konsole desktop-file ID: %s\n' "$konsole_desktop_file"
          printf 'KCalc desktop-file ID: %s\n' "$calculator_desktop_file"
          printf 'xterm desktop-file ID: %s\n' "$xterm_desktop_file"
          printf 'initial exclusion phase: %s\n' "$exclusions_verified"
          printf 'cleared exclusion phase: %s\n' "$exclusions_cleared"
          printf 'reapplied exclusion phase: %s\n' "$exclusions_reapplied"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      verify_application_column_width_override() {
        local baseline_first
        local baseline_second
        local baseline_third
        local cleanup_verified=true
        local desktop_file_name="firefox"
        local expected_first_width
        local expected_second_width
        local first_frame=""
        local first_pid=""
        local first_profile=""
        local first_title="Driftile VM Firefox"
        local first_verified=false
        local first_width=0
        local minimum_width_delta
        local output_frame
        local output_width
        local override_cleared=false
        local second_frame=""
        local second_pid=""
        local second_profile=""
        local second_title="Driftile VM Firefox"
        local second_verified=false
        local second_width=0
        local unchanged_frame=""

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames; then
          record_focus_state "application column-width override baseline failed"
          set_application_column_widths "" >/dev/null 2>&1 || true
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)

        if ! frame_is_valid "$output_frame"; then
          record_focus_state "application column-width override output frame failed"
          set_application_column_widths "" >/dev/null 2>&1 || true
          return 1
        fi
        IFS=, read -r _ _ output_width _ <<< "$output_frame"
        expected_first_width=$((
          (60 * (output_width - 16) + 50) / 100 - 16
        ))
        expected_second_width=$((
          (80 * (output_width - 16) + 50) / 100 - 16
        ))
        minimum_width_delta=$((output_width / 10))

        if set_application_column_widths "$desktop_file_name=60" \
          && start_firefox_window \
            first_pid \
            first_title \
            first_profile \
            "$first_title" \
          && [[ "$(window_desktop_file_contains "$first_title" 2>/dev/null || true)" \
            == "$desktop_file_name" ]] \
          && first_frame=$(capture_stable_window_frame_contains "$first_title") \
          && frame_is_valid "$first_frame"; then
          IFS=, read -r _ _ first_width _ <<< "$first_frame"

          if ((first_width >= expected_first_width - 2 \
              && first_width <= expected_first_width + 2)) \
            && set_application_column_widths "$desktop_file_name=80"; then
            sleep 0.2
            unchanged_frame=$(
              capture_stable_window_frame_contains "$first_title" \
                || true
            )

            if [[ "$unchanged_frame" == "$first_frame" ]]; then
              first_verified=true
              record_focus_state \
                "application override preserved the existing Firefox column"
            fi
          fi
        fi

        if [[ -n "$first_pid" ]]; then
          terminate_process "$first_pid"

          if ! wait_for_window_gone_contains "$first_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$first_profile" ]] \
          && ! rm -rf -- "$first_profile"; then
          cleanup_verified=false
        fi
        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$first_verified" == true \
          && "$cleanup_verified" == true ]] \
          && start_firefox_window \
            second_pid \
            second_title \
            second_profile \
            "$second_title" \
          && [[ "$(window_desktop_file_contains "$second_title" 2>/dev/null || true)" \
            == "$desktop_file_name" ]] \
          && second_frame=$(capture_stable_window_frame_contains "$second_title") \
          && frame_is_valid "$second_frame"; then
          IFS=, read -r _ _ second_width _ <<< "$second_frame"

          if ((second_width >= expected_second_width - 2 \
            && second_width <= expected_second_width + 2 \
            && second_width >= first_width + minimum_width_delta)); then
            second_verified=true
            record_focus_state \
              "application override enlarged only the new Firefox column"
          fi
        fi

        if [[ -n "$second_pid" ]]; then
          terminate_process "$second_pid"

          if ! wait_for_window_gone_contains "$second_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$second_profile" ]] \
          && ! rm -rf -- "$second_profile"; then
          cleanup_verified=false
        fi
        if set_application_column_widths ""; then
          override_cleared=true
        else
          cleanup_verified=false
        fi
        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_singleton_layout \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$first_verified" == true \
          && "$second_verified" == true \
          && "$override_cleared" == true \
          && "$cleanup_verified" == true ]]; then
          record_focus_state \
            "application column-width override verification passed"
          return 0
        fi

        record_focus_state "application column-width override verification failed"
        {
          printf 'desktop-file ID: %s\n' "$desktop_file_name"
          printf 'output frame: %s\n' "$output_frame"
          printf '60 percent Firefox frame: %s\n' "$first_frame"
          printf 'frame after the 80 percent reconfigure: %s\n' "$unchanged_frame"
          printf '80 percent Firefox frame: %s\n' "$second_frame"
          printf 'expected 60 percent width: %s\n' "$expected_first_width"
          printf 'expected 80 percent width: %s\n' "$expected_second_width"
          printf 'minimum material width delta: %s\n' "$minimum_width_delta"
          printf 'first phase verified: %s\n' "$first_verified"
          printf 'second phase verified: %s\n' "$second_verified"
          printf 'override cleared: %s\n' "$override_cleared"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
      }

      verify_application_tiling_exclusion() {
        local admitted_frame=""
        local admitted_width=0
        local attempt
        local baseline_first
        local baseline_second
        local baseline_third
        local cleanup_verified=true
        local configuration_barrier=false
        local current_frame=""
        local desktop_file_name="firefox"
        local excluded_frame=""
        local expected_width
        local firefox_pid=""
        local firefox_profile=""
        local firefox_title="Driftile VM Firefox"
        local output_frame
        local output_width
        local previous_frame=""
        local stable_samples=0
        local verified=false

        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! capture_stable_frames; then
          record_focus_state "application tiling exclusion baseline failed"
          return 1
        fi
        baseline_first=$stable_first_frame
        baseline_second=$stable_second_frame
        baseline_third=$stable_third_frame
        output_frame=$(single_enabled_output_frame 2>/dev/null || true)

        if ! frame_is_valid "$output_frame"; then
          record_focus_state "application tiling exclusion output frame failed"
          return 1
        fi
        IFS=, read -r _ _ output_width _ <<< "$output_frame"
        expected_width=$(((80 * (output_width - 16) + 50) / 100 - 16))

        if set_application_column_widths "$desktop_file_name=80" \
          && set_application_tiling_exclusions "$desktop_file_name" \
          && set_gap 24; then
          for ((attempt = 0; attempt < 100; attempt += 1)); do
            if capture_stable_frames \
              && { [[ "$stable_first_frame" != "$baseline_first" ]] \
                || [[ "$stable_second_frame" != "$baseline_second" ]] \
                || [[ "$stable_third_frame" != "$baseline_third" ]]; }; then
              configuration_barrier=true
              break
            fi

            sleep 0.1
          done
        fi

        if [[ "$configuration_barrier" == true ]] \
          && set_gap 16 \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && start_firefox_window \
            firefox_pid \
            firefox_title \
            firefox_profile \
            "$firefox_title" \
          && [[ "$(window_desktop_file_contains "$firefox_title" 2>/dev/null || true)" \
            == "$desktop_file_name" ]] \
          && activate_window "$firefox_title" \
          && wait_for_active "$firefox_title" \
          && excluded_frame=$(capture_stable_window_frame_contains "$firefox_title") \
          && frame_is_valid "$excluded_frame" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && invoke_shortcut "driftile_increase_column_width" \
          && invoke_shortcut "driftile_move_column_left" \
          && wait_for_window_frame_contains "$firefox_title" "$excluded_frame" \
          && wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third" \
          && set_application_tiling_exclusions ""; then
          for ((attempt = 0; attempt < 100; attempt += 1)); do
            current_frame=$(window_frame_contains "$firefox_title" 2>/dev/null || true)

            if frame_is_valid "$current_frame" \
              && [[ "$current_frame" != "$excluded_frame" ]]; then
              IFS=, read -r _ _ admitted_width _ <<< "$current_frame"

              if ((admitted_width >= expected_width - 2 \
                && admitted_width <= expected_width + 2)); then
                if [[ "$current_frame" == "$previous_frame" ]]; then
                  stable_samples=$((stable_samples + 1))
                else
                  stable_samples=1
                fi

                if ((stable_samples >= 2)); then
                  admitted_frame=$current_frame
                  break
                fi
              else
                stable_samples=0
              fi
            else
              stable_samples=0
            fi

            previous_frame=$current_frame
            sleep 0.1
          done

          if frame_is_valid "$admitted_frame" \
            && set_application_tiling_exclusions "$desktop_file_name" \
            && wait_for_frames \
              "$baseline_first" \
              "$baseline_second" \
              "$baseline_third" \
            && wait_for_window_frame_contains "$firefox_title" "$admitted_frame" \
            && activate_window "$firefox_title" \
            && wait_for_active "$firefox_title" \
            && invoke_shortcut "driftile_increase_column_width" \
            && invoke_shortcut "driftile_move_column_left" \
            && wait_for_window_frame_contains "$firefox_title" "$admitted_frame" \
            && wait_for_frames \
              "$baseline_first" \
              "$baseline_second" \
              "$baseline_third"; then
            verified=true
          fi
        fi

        if [[ -n "$firefox_pid" ]]; then
          terminate_process "$firefox_pid"

          if ! wait_for_window_gone_contains "$firefox_title"; then
            cleanup_verified=false
          fi
        fi
        if [[ -n "$firefox_profile" ]] \
          && ! rm -rf -- "$firefox_profile"; then
          cleanup_verified=false
        fi
        if ! set_application_tiling_exclusions ""; then
          cleanup_verified=false
        fi
        if ! set_application_column_widths ""; then
          cleanup_verified=false
        fi
        if ! set_gap 16; then
          cleanup_verified=false
        fi
        if ! activate_window "$title_c" \
          || ! wait_for_active "$title_c" \
          || ! wait_for_frames \
            "$baseline_first" \
            "$baseline_second" \
            "$baseline_third"; then
          cleanup_verified=false
        fi

        if [[ "$verified" == true && "$cleanup_verified" == true ]]; then
          record_focus_state "application tiling exclusion verification passed"
          return 0
        fi

        record_focus_state "application tiling exclusion verification failed"
        {
          printf 'desktop-file ID: %s\n' "$desktop_file_name"
          printf 'excluded Firefox frame: %s\n' "$excluded_frame"
          printf 'admitted Firefox frame: %s\n' "$admitted_frame"
          printf 'expected admitted width: %s\n' "$expected_width"
          printf 'configuration barrier: %s\n' "$configuration_barrier"
          printf 'verified: %s\n' "$verified"
          printf 'cleanup verified: %s\n' "$cleanup_verified"
        } >> /tmp/shared/driftile-focus-diagnostics
        return 1
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

      shortcut_editor_verified=false
      if [[ "$loaded" == true ]] \
        && wait_for_shortcuts \
        && verify_shortcut_editor; then
        shortcut_editor_verified=true
      fi
      printf '%s\n' "$shortcut_editor_verified" \
        > /tmp/shared/driftile-shortcut-editor-verified

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
      activity_firefox_id=""
      activity_firefox_pid=""
      activity_firefox_profile=""
      activity_firefox_title=""
      activity_primary_id=""
      activity_secondary_id=""
      activity_xterm_id=""
      activity_xterm_pid=""
      activity_xterm_title=""
      trap cleanup_temporary_windows EXIT
      : > /tmp/shared/driftile-focus-diagnostics
      if [[ "$loaded" != true \
        || "$shortcut_editor_verified" != true \
        || "$desktops_ready" != true ]]; then
        {
          printf '\n[early VM readiness failed]\n'
          printf 'script loaded: %s\n' "$loaded"
          printf 'shortcut editor verified: %s\n' "$shortcut_editor_verified"
          printf 'desktops ready: %s\n' "$desktops_ready"
          printf 'desktop count: %s\n' \
            "$(virtual_desktop_count 2>/dev/null || printf unavailable)"
          printf 'desktop rows: %s\n' \
            "$(virtual_desktop_rows 2>/dev/null || printf unavailable)"
          printf 'recent user journal:\n'
          journalctl --user -n 80 --no-pager -o cat 2>/dev/null || true
          printf 'recent KWin journal:\n'
          journalctl --user \
            --unit plasma-kwin_wayland.service \
            -n 160 \
            --no-pager \
            -o cat \
            2>/dev/null \
            || true
        } >> /tmp/shared/driftile-focus-diagnostics
      fi

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

      if [[ "$loaded" == true \
        && "$shortcut_editor_verified" == true \
        && "$desktops_ready" == true ]] \
        && verify_focus \
        && verify_center_focused_column_configuration \
        && verify_physical_consume_expel_shortcuts \
        && verify_physical_layer_focus_shortcut \
        && verify_physical_floating_navigation_shortcuts \
        && verify_physical_width_shortcuts \
        && verify_configured_column_width_presets \
        && verify_physical_height_shortcuts \
        && verify_physical_column_view_shortcuts \
        && verify_full_width_successor_edge_gaps \
        && verify_physical_fullscreen_shortcut \
        && verify_physical_maximize_shortcut \
        && verify_real_applications \
        && verify_activity_layout_ownership \
        && verify_application_borderless_exclusions \
        && verify_application_column_width_override \
        && verify_application_tiling_exclusion \
        && verify_physical_pointer_reinsertion \
        && verify_physical_cross_desktop_pointer_adoption; then
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
  twoHeadDemo = pkgs.writeShellApplication {
    name = "driftile-two-head-demo";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gnugrep
      pkgs.jq
      pkgs.kdotool
      pkgs.kdePackages.libkscreen
      pkgs.systemd
      pkgs.xterm
      pkgs.xprop
    ];
    text = ''
      readonly diagnostics_file=/tmp/shared/driftile-two-head-diagnostics
      readonly result_file=/tmp/shared/driftile-two-head-verified
      firefox_pid=""
      firefox_profile=""
      firefox_title="Driftile VM Firefox"
      overview_command_file="''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/driftile-overview-command.ini"
      layout_state_file="''${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini"
      left_frame=""
      left_id=""
      overview_plugin_id="io.github.kontonkara.driftile.overview"
      overview_shortcut="driftile_toggle_overview"
      right_frame=""
      right_id=""
      xterm_pid=""
      xterm_title="Driftile VM Two-head XWayland"

      write_result() {
        local temporary_file="$result_file.tmp"

        printf '%s\n' "$1" > "$temporary_file"
        mv "$temporary_file" "$result_file"
      }

      fail_test() {
        {
          printf '%s\n' "$1"
          printf '\nKWin matches:\n'
          busctl --user --json=short call \
            org.kde.KWin \
            /WindowsRunner \
            org.kde.krunner1 \
            Match \
            s Driftile \
            2>&1 || true
          printf '\nActive window:\n'
          kdotool getactivewindow getwindowname 2>&1 || true
          printf '\nOverview state:\n'
          printf 'loaded=%s active=%s kwin-pid=%s\n' \
            "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || true)" \
            "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" \
            "$(kwin_process_id 2>/dev/null || true)"
          printf 'request-id=%s\n' \
            "$(overview_command_request_id 2>/dev/null || true)"
          printf '\nFirefox frame:\n'
          window_frame_contains "$firefox_title" 2>&1 || true
          printf '\nFirefox info:\n'
          window_info_contains "$firefox_title" 2>&1 || true
          printf '\nxterm frame:\n'
          window_frame_contains "$xterm_title" 2>&1 || true

          for log_file in \
            /tmp/driftile-vm-two-head-firefox.log \
            /tmp/driftile-vm-two-head-xterm.log; do
            if [[ -s "$log_file" ]]; then
              printf '\n%s:\n' "$log_file"
              tail -n 100 "$log_file"
            fi
          done
        } >> "$diagnostics_file"
        write_result false
        exit 1
      }

      cleanup() {
        if [[ -n "$xterm_pid" ]]; then
          kill "$xterm_pid" >/dev/null 2>&1 || true
        fi

        if [[ -n "$firefox_pid" ]]; then
          kill "$firefox_pid" >/dev/null 2>&1 || true
        fi

        if [[ -n "$firefox_profile" ]]; then
          rm -rf -- "$firefox_profile"
        fi
      }

      wait_for_extension() {
        local attempt
        local state

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          state=$(busctl --user call \
            org.kde.KWin \
            /Scripting \
            org.kde.kwin.Scripting \
            isScriptLoaded \
            s ${pluginId} 2>/dev/null || true)

          if [[ "$state" == "b true" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      effect_is_available() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          listOfEffects 2>/dev/null \
          | jq --exit-status \
            --arg effectId "$1" \
            '.data | any(. == $effectId)' \
            >/dev/null
      }

      effect_loaded_state() {
        local state

        state=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          isEffectLoaded \
          s "$1" 2>/dev/null) || return 1

        case "$state" in
          "b true") printf '%s' true ;;
          "b false") printf '%s' false ;;
          *) return 1 ;;
        esac
      }

      effect_active_state() {
        busctl --user --json=short get-property \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          activeEffects 2>/dev/null \
          | jq --exit-status --raw-output \
            --arg effectId "$1" \
            '.data | any(. == $effectId) | tostring'
      }

      wait_for_effect_loaded_state() {
        local attempt
        local expected=$2

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(effect_loaded_state "$1" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      wait_for_effect_active_state() {
        local attempt
        local expected=$2

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ "$(effect_active_state "$1" 2>/dev/null || true)" == "$expected" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      load_overview_effect() {
        local result

        if [[ "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || true)" == true ]]; then
          return 0
        fi

        result=$(busctl --user call \
          org.kde.KWin \
          /Effects \
          org.kde.kwin.Effects \
          loadEffect \
          s "$overview_plugin_id" 2>/dev/null) || return 1

        [[ "$result" == "b true" ]] \
          && wait_for_effect_loaded_state "$overview_plugin_id" true
      }

      kwin_process_id() {
        local process_id
        local reply
        local signature
        local trailing

        reply=$(busctl --user call \
          org.freedesktop.DBus \
          /org/freedesktop/DBus \
          org.freedesktop.DBus \
          GetConnectionUnixProcessID \
          s org.kde.KWin 2>/dev/null) || return 1
        read -r signature process_id trailing <<< "$reply"

        [[ "$signature" == u \
          && "$process_id" =~ ^[1-9][0-9]*$ \
          && -z "$trailing" ]] || return 1

        printf '%s' "$process_id"
      }

      kwin_process_is_unchanged() {
        local process_id

        process_id=$(kwin_process_id) || return 1
        [[ "$process_id" == "$1" ]]
      }

      overview_command_request_id() {
        local request_id

        request_id=$(
          ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
            --file "$overview_command_file" \
            --group Command \
            --key last-request-id \
            --default 0
        ) || return 1
        [[ "$request_id" =~ ^[0-9]+$ ]] || return 1
        printf '%s' "$request_id"
      }

      wait_for_overview_command_after() {
        local attempt
        local minimum_request_id=$1
        local request_id

        [[ "$minimum_request_id" =~ ^[0-9]+$ ]] || return 1
        for ((attempt = 0; attempt < 20; attempt += 1)); do
          request_id=$(overview_command_request_id 2>/dev/null || true)
          if [[ "$request_id" =~ ^[0-9]+$ ]] \
            && ((request_id > minimum_request_id)); then
            printf '%s' "$request_id"
            return 0
          fi
          sleep 0.1
        done

        return 1
      }

      overview_layout_document() {
        local representation

        representation=$(
          ${pkgs.kdePackages.kconfig}/bin/kreadconfig6 \
            --file "$layout_state_file" \
            --group Layout \
            --key layout-v1 \
            --default ""
        ) || return 1

        jq --exit-status --compact-output --sort-keys --slurp '
          select(length == 1)
          | .[0]
          | if type == "object" then
              .
            elif type == "string" then
              fromjson | select(type == "object")
            else
              empty
            end
          | select(.version == 2 and (.snapshots | length) > 0)
        ' <<< "$representation"
      }

      wait_for_stable_layout_digest() {
        local attempt
        local current=""
        local document
        local excluded_digest="''${1:-}"
        local previous=""
        local stable_samples=0

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          if document=$(overview_layout_document 2>/dev/null) \
            && current=$(printf '%s' "$document" | sha256sum 2>/dev/null); then
            current="''${current%% *}"

            if [[ -n "$excluded_digest" && "$current" == "$excluded_digest" ]]; then
              previous=""
              stable_samples=0
              sleep 0.1
              continue
            fi

            if [[ -n "$previous" && "$current" == "$previous" ]]; then
              stable_samples=$((stable_samples + 1))
            else
              stable_samples=1
            fi
            previous=$current

            if ((stable_samples >= 3)); then
              printf '%s' "$current"
              return 0
            fi
          else
            previous=""
            stable_samples=0
          fi

          sleep 0.1
        done

        return 1
      }

      configure_outputs() {
        local attempt
        local json
        local left_mode
        local right_mode
        local -a output_ids=()

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          json=$(kscreen-doctor -j 2>/dev/null || true)
          mapfile -t output_ids < <(
            jq --raw-output '
              [
                .outputs[]
                | select(.connected == true)
              ]
              | sort_by(.id | tonumber)
              | .[].id
            ' <<< "$json" 2>/dev/null || true
          )

          if ((''${#output_ids[@]} == 2)); then
            left_id=''${output_ids[0]}
            right_id=''${output_ids[1]}
            break
          fi

          sleep 0.1
        done

        [[ -n "$left_id" && -n "$right_id" ]] || return 1
        left_mode=$(jq --exit-status --raw-output \
          --arg id "$left_id" '
            .outputs[]
            | select((.id | tostring) == $id)
            | .modes[]
            | select(.size.width == 688 and .size.height == 768)
            | .id
          ' <<< "$json" | head -n 1) || return 1
        right_mode=$(jq --exit-status --raw-output \
          --arg id "$right_id" '
            .outputs[]
            | select((.id | tostring) == $id)
            | .modes[]
            | select(.size.width == 688 and .size.height == 768)
            | .id
          ' <<< "$json" | head -n 1) || return 1

        kscreen-doctor \
          "output.$left_id.mode.$left_mode" \
          "output.$left_id.scale.1" \
          "output.$left_id.position.0,0" \
          "output.$left_id.enable" \
          "output.$right_id.mode.$right_mode" \
          "output.$right_id.scale.1" \
          "output.$right_id.position.688,0" \
          "output.$right_id.enable" \
          >/dev/null || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          json=$(kscreen-doctor -j 2>/dev/null || true)
          left_frame=$(jq --exit-status --raw-output \
            --arg id "$left_id" '
              .outputs[]
              | select((.id | tostring) == $id and .enabled == true)
              | [
                  .pos.x,
                  .pos.y,
                  (.size.width / (.scale // 1)),
                  (.size.height / (.scale // 1))
                ]
              | map(round | tostring)
              | join(",")
            ' <<< "$json" 2>/dev/null || true)
          right_frame=$(jq --exit-status --raw-output \
            --arg id "$right_id" '
              .outputs[]
              | select((.id | tostring) == $id and .enabled == true)
              | [
                  .pos.x,
                  .pos.y,
                  (.size.width / (.scale // 1)),
                  (.size.height / (.scale // 1))
                ]
              | map(round | tostring)
              | join(",")
            ' <<< "$json" 2>/dev/null || true)

          if [[ "$left_frame" == "0,0,688,768" \
            && "$right_frame" == "688,0,688,768" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      request_pointer_probe() {
        local attempt
        local expected_x=$3
        local expected_y=$4
        local extra
        local head=$2
        local location
        local name=$1
        local output_height
        local output_width
        local output_x
        local output_y
        local ready_file="/tmp/shared/driftile-two-head-pointer-probe-$name-ready"
        local sent_file="/tmp/shared/driftile-two-head-pointer-probe-$name-sent"
        local temporary_file="$ready_file.tmp"
        local x
        local y

        case "$name" in
          left|right) ;;
          *) return 1 ;;
        esac

        IFS=, read -r \
          output_x output_y output_width output_height extra \
          <<< "$5"
        [[ -z "''${extra:-}" ]] || return 1
        rm -f "$ready_file" "$sent_file" "$temporary_file"
        printf '%s %s %s %s %s %s %s\n' \
          "$head" \
          "$expected_x" \
          "$expected_y" \
          "$output_x" \
          "$output_y" \
          "$output_width" \
          "$output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ -f "$sent_file" ]]; then
            break
          fi

          sleep 0.1
        done

        [[ -f "$sent_file" ]] || return 1

        for ((attempt = 0; attempt < 50; attempt += 1)); do
          location=$(kdotool getmouselocation 2>/dev/null || true)

          if [[ "$location" =~ x:([-0-9]+)[[:space:]]y:([-0-9]+) ]]; then
            x=''${BASH_REMATCH[1]}
            y=''${BASH_REMATCH[2]}

            if ((x >= expected_x - 2 && x <= expected_x + 2 \
              && y >= expected_y - 2 && y <= expected_y + 2)); then
              return 0
            fi
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

      window_protocol_matches() {
        local attempt
        local expected=$2
        local matches
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          matches=$(x11_window_match_count "$1") || return 1

          if { [[ "$expected" == true ]] && ((matches == 1)); } \
            || { [[ "$expected" == false ]] && ((matches == 0)); }; then
            stable_samples=$((stable_samples + 1))
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

      x11_window_match_count() {
        local client_list
        local display="''${DISPLAY:-:0}"
        local id
        local matches=0
        local query=$1
        local title_properties

        client_list=$(xprop -display "$display" -root _NET_CLIENT_LIST 2>/dev/null) \
          || return 1

        while IFS= read -r id; do
          [[ -n "$id" ]] || continue
          title_properties=$(xprop -display "$display" -id "$id" \
            _NET_WM_NAME WM_NAME 2>/dev/null || true)

          if [[ "$title_properties" == *"$query"* ]]; then
            matches=$((matches + 1))
          fi
        done < <(
          grep --only-matching --extended-regexp \
            '0x[0-9a-fA-F]+' <<< "$client_list" \
            || true
        )

        printf '%s' "$matches"
      }

      wait_for_window() {
        local attempt

        for ((attempt = 0; attempt < 200; attempt += 1)); do
          if window_info_contains "$1" >/dev/null 2>&1; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      capture_stable_window_frame() {
        local attempt
        local current
        local previous=""
        local query=$1
        local stable_samples=0

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          current=$(window_frame_contains "$query" 2>/dev/null || true)

          if [[ "$current" =~ ^-?[0-9]+,-?[0-9]+,[1-9][0-9]*,[1-9][0-9]*$ \
            && "$current" == "$previous" ]]; then
            stable_samples=$((stable_samples + 1))
          else
            stable_samples=0
          fi

          if ((stable_samples >= 2)); then
            printf '%s' "$current"
            return 0
          fi

          previous=$current
          sleep 0.1
        done

        return 1
      }

      window_is_active() {
        local caption

        caption=$(kdotool getactivewindow getwindowname 2>/dev/null) || return 1
        [[ "$caption" == *"$1"* ]]
      }

      activate_window() {
        local match_id

        match_id=$(window_match_id_contains "$1") || return 1
        busctl --user call \
          org.kde.KWin \
          /WindowsRunner \
          org.kde.krunner1 \
          Run \
          ss "$match_id" "" \
          >/dev/null
      }

      wait_for_active() {
        local attempt

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if window_is_active "$1"; then
            return 0
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

      frame_is_valid() {
        [[ "$1" =~ ^-?[0-9]+,-?[0-9]+,[1-9][0-9]*,[1-9][0-9]*$ ]]
      }

      frame_center_is_in_output() {
        local frame_height
        local frame_width
        local frame_x
        local frame_y
        local output_height
        local output_width
        local output_x
        local output_y

        if ! frame_is_valid "$1" || ! frame_is_valid "$2"; then
          return 1
        fi
        IFS=, read -r frame_x frame_y frame_width frame_height <<< "$1"
        IFS=, read -r output_x output_y output_width output_height <<< "$2"
        ((frame_x + frame_width / 2 >= output_x \
          && frame_x + frame_width / 2 < output_x + output_width \
          && frame_y + frame_height / 2 >= output_y \
          && frame_y + frame_height / 2 < output_y + output_height))
      }

      ensure_window_on_output() {
        local attempt
        local frame
        local output=$2
        local query=$1
        local shortcut=$3

        frame=$(capture_stable_window_frame "$query" 2>/dev/null || true)

        if frame_center_is_in_output "$frame" "$output"; then
          return 0
        fi

        activate_window "$query" \
          && wait_for_active "$query" \
          && invoke_shortcut "$shortcut" \
          || return 1

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          frame=$(window_frame_contains "$query" 2>/dev/null || true)

          if frame_center_is_in_output "$frame" "$output"; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      start_firefox() {
        firefox_profile=$(mktemp -d -t driftile-firefox.XXXXXXXXXX) \
          || return 1
        cp ${firefoxPreferences} "$firefox_profile/user.js" || return 1
        cp ${firefoxWindowState} "$firefox_profile/xulstore.json" || return 1
        env \
          MOZ_CRASHREPORTER_DISABLE=1 \
          MOZ_DATA_REPORTING=0 \
          MOZ_ENABLE_WAYLAND=1 \
          ${pkgs.firefox}/bin/firefox \
          --new-instance \
          --no-remote \
          --profile "$firefox_profile" \
          --new-window "file://${firefoxPage}" \
          >>/tmp/driftile-vm-two-head-firefox.log 2>&1 &
        firefox_pid=$!
        wait_for_window "$firefox_title" \
          && window_protocol_matches "$firefox_title" false
      }

      start_xterm() {
        DISPLAY="''${DISPLAY:-:0}" \
          ${pkgs.xterm}/bin/xterm \
          -T "$xterm_title" \
          -class DriftileXTerm \
          -e ${pkgs.coreutils}/bin/sleep 180 \
          >>/tmp/driftile-vm-two-head-xterm.log 2>&1 &
        xterm_pid=$!
        wait_for_window "$xterm_title" \
          && window_protocol_matches "$xterm_title" true
      }

      request_pointer_drag() {
        local attempt
        local destination_frame=$9
        local destination_head=$6
        local destination_height
        local destination_output_height
        local destination_output_width
        local destination_output_x
        local destination_output_y
        local destination_width
        local destination_x=$7
        local destination_y=$8
        local drag_name=$1
        local extra
        local ready_file="/tmp/shared/driftile-two-head-pointer-drag-$drag_name-ready"
        local sent_file="/tmp/shared/driftile-two-head-pointer-drag-$drag_name-sent"
        local source_frame=$5
        local source_head=$2
        local source_height
        local source_output_height
        local source_output_width
        local source_output_x
        local source_output_y
        local source_width
        local source_x=$3
        local source_y=$4
        local temporary_file="$ready_file.tmp"

        case "$drag_name" in
          insert|fallback|overview-insert) ;;
          *) return 1 ;;
        esac

        IFS=, read -r \
          destination_output_x \
          destination_output_y \
          destination_output_width \
          destination_output_height \
          extra \
          <<< "$destination_frame"
        [[ -z "''${extra:-}" ]] || return 1
        IFS=, read -r \
          source_output_x \
          source_output_y \
          source_output_width \
          source_output_height \
          extra \
          <<< "$source_frame"
        [[ -z "''${extra:-}" ]] || return 1
        destination_width=$destination_output_width
        destination_height=$destination_output_height
        source_width=$source_output_width
        source_height=$source_output_height
        ((destination_width > 1 && destination_height > 1 \
          && source_width > 1 && source_height > 1)) || return 1

        rm -f "$ready_file" "$sent_file" "$temporary_file"
        printf '%s %s %s %s %s %s %s %s %s %s %s %s %s %s\n' \
          "$source_head" \
          "$source_x" \
          "$source_y" \
          "$source_output_x" \
          "$source_output_y" \
          "$source_output_width" \
          "$source_output_height" \
          "$destination_head" \
          "$destination_x" \
          "$destination_y" \
          "$destination_output_x" \
          "$destination_output_y" \
          "$destination_output_width" \
          "$destination_output_height" \
          > "$temporary_file"
        mv "$temporary_file" "$ready_file"

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          if [[ -f "$sent_file" ]]; then
            return 0
          fi

          sleep 0.1
        done

        return 1
      }

      request_overview_pointer_drag() {
        local destination_head=$6
        local destination_output_frame=$5
        local destination_output_height
        local destination_output_width
        local destination_output_x
        local destination_output_y
        local destination_pointer_x
        local destination_pointer_y
        local destination_viewport_x_milli
        local destination_window_frame=$4
        local destination_window_height
        local destination_window_width
        local destination_window_x
        local destination_window_y
        local edge_margin_milli
        local extra
        local source_head=$3
        local source_output_frame=$2
        local source_output_height
        local source_output_width
        local source_output_x
        local source_output_y
        local source_pointer_x
        local source_pointer_y
        local source_viewport_x_milli
        local source_window_frame=$1
        local source_window_height
        local source_window_width
        local source_window_x
        local source_window_y
        local zoom_milli=${toString overviewZoom.milli}

        frame_is_valid "$source_window_frame" || return 1
        frame_is_valid "$source_output_frame" || return 1
        frame_is_valid "$destination_window_frame" || return 1
        frame_is_valid "$destination_output_frame" || return 1
        IFS=, read -r \
          source_window_x \
          source_window_y \
          source_window_width \
          source_window_height \
          extra \
          <<< "$source_window_frame"
        [[ -z "''${extra:-}" ]] || return 1
        IFS=, read -r \
          source_output_x \
          source_output_y \
          source_output_width \
          source_output_height \
          extra \
          <<< "$source_output_frame"
        [[ -z "''${extra:-}" ]] || return 1
        IFS=, read -r \
          destination_window_x \
          destination_window_y \
          destination_window_width \
          destination_window_height \
          extra \
          <<< "$destination_window_frame"
        [[ -z "''${extra:-}" ]] || return 1
        IFS=, read -r \
          destination_output_x \
          destination_output_y \
          destination_output_width \
          destination_output_height \
          extra \
          <<< "$destination_output_frame"
        [[ -z "''${extra:-}" ]] || return 1

        source_viewport_x_milli=$(((source_output_width * 1000 \
          - source_output_width * zoom_milli) / 2))
        edge_margin_milli=$(((source_output_height * 1000 \
          - source_output_height * zoom_milli) / 2))
        source_pointer_x=$((source_output_x \
          + (source_viewport_x_milli \
            + (source_window_x - source_output_x) * zoom_milli \
            + source_window_width * zoom_milli / 2 \
            + 500) / 1000))
        source_pointer_y=$((source_output_y \
          + (edge_margin_milli \
            + (source_window_y - source_output_y) * zoom_milli \
            + source_window_height * zoom_milli / 2 \
            + 500) / 1000))

        destination_viewport_x_milli=$(((destination_output_width * 1000 \
          - destination_output_width * zoom_milli) / 2))
        edge_margin_milli=$(((destination_output_height * 1000 \
          - destination_output_height * zoom_milli) / 2))
        destination_pointer_x=$((destination_output_x \
          + (destination_viewport_x_milli \
            + (destination_window_x - destination_output_x) * zoom_milli \
            + destination_window_width * zoom_milli / 2 \
            + 500) / 1000))
        destination_pointer_y=$((destination_output_y \
          + (edge_margin_milli \
            + (destination_window_y - destination_output_y) * zoom_milli \
            + destination_window_height * zoom_milli * 3 / 4 \
            + 500) / 1000))

        request_pointer_drag \
          overview-insert \
          "$source_head" \
          "$source_pointer_x" \
          "$source_pointer_y" \
          "$source_output_frame" \
          "$destination_head" \
          "$destination_pointer_x" \
          "$destination_pointer_y" \
          "$destination_output_frame"
      }

      verify_targeted_insertion() {
        local attempt
        local firefox_frame
        local firefox_height
        local firefox_width
        local firefox_x
        local firefox_y
        local stable_samples=0
        local target_width=$1
        local xterm_frame
        local xterm_height
        local xterm_width
        local xterm_x
        local xterm_y

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          firefox_frame=$(window_frame_contains "$firefox_title" 2>/dev/null || true)
          xterm_frame=$(window_frame_contains "$xterm_title" 2>/dev/null || true)
          IFS=, read -r firefox_x firefox_y firefox_width firefox_height \
            <<< "$firefox_frame"
          IFS=, read -r xterm_x xterm_y xterm_width xterm_height \
            <<< "$xterm_frame"

          if frame_center_is_in_output "$firefox_frame" "$right_frame" \
            && frame_center_is_in_output "$xterm_frame" "$right_frame" \
            && ((firefox_x == xterm_x \
              && firefox_width == target_width \
              && xterm_width == target_width \
              && xterm_y + xterm_height < firefox_y)) \
            && window_is_active "$firefox_title"; then
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

      verify_empty_output_fallback() {
        local attempt
        local firefox_frame
        local stable_samples=0
        local xterm_frame

        for ((attempt = 0; attempt < 100; attempt += 1)); do
          firefox_frame=$(window_frame_contains "$firefox_title" 2>/dev/null || true)
          xterm_frame=$(window_frame_contains "$xterm_title" 2>/dev/null || true)

          if frame_center_is_in_output "$firefox_frame" "$left_frame" \
            && frame_center_is_in_output "$xterm_frame" "$right_frame" \
            && window_is_active "$firefox_title"; then
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

      rm -f \
        "$result_file" \
        "$result_file.tmp" \
        /tmp/shared/driftile-two-head-pointer-*-ready \
        /tmp/shared/driftile-two-head-pointer-*-sent
      : > "$diagnostics_file"
      trap cleanup EXIT

      wait_for_extension \
        || fail_test "The extension did not load."
      configure_outputs \
        || fail_test "KScreen did not expose two 688x768 connected outputs."
      effect_is_available "$overview_plugin_id" \
        || fail_test "The Overview effect was not installed in the two-output VM."
      load_overview_effect \
        || fail_test "KWin could not load the Overview effect in the two-output VM."
      wait_for_effect_active_state "$overview_plugin_id" false \
        || fail_test "The loaded Overview effect did not start inactive."

      IFS=, read -r left_x left_y left_width left_height <<< "$left_frame"
      IFS=, read -r right_x right_y right_width right_height <<< "$right_frame"
      left_probe_x=$((left_x + left_width / 2))
      left_probe_y=$((left_y + left_height / 2))
      right_probe_x=$((right_x + right_width / 2))
      right_probe_y=$((right_y + right_height / 2))

      request_pointer_probe left 0 "$left_probe_x" "$left_probe_y" "$left_frame" \
        || fail_test "Absolute QMP pointer mapping failed on the left output."
      start_firefox \
        || fail_test "The native Wayland Firefox fixture did not start."
      ensure_window_on_output \
        "$firefox_title" \
        "$left_frame" \
        driftile_move_window_to_output_left \
        || fail_test "Firefox did not settle on the left output."

      request_pointer_probe right 1 "$right_probe_x" "$right_probe_y" "$right_frame" \
        || fail_test "Absolute QMP pointer mapping failed on the right output."
      start_xterm \
        || fail_test "The XWayland xterm fixture did not start."
      ensure_window_on_output \
        "$xterm_title" \
        "$right_frame" \
        driftile_move_window_to_output_right \
        || fail_test "xterm did not settle on the right output."

      firefox_frame=$(capture_stable_window_frame "$firefox_title" 2>/dev/null || true)
      xterm_frame=$(capture_stable_window_frame "$xterm_title" 2>/dev/null || true)
      if ! frame_is_valid "$firefox_frame" \
        || ! frame_is_valid "$xterm_frame"; then
        fail_test "The initial application frames were invalid."
      fi
      IFS=, read -r \
        firefox_x firefox_y firefox_width firefox_height \
        <<< "$firefox_frame"
      IFS=, read -r xterm_x xterm_y xterm_width xterm_height <<< "$xterm_frame"
      source_x=$((firefox_x + firefox_width / 2))
      source_y=$((firefox_y + firefox_height / 2))
      destination_x=$((xterm_x + xterm_width / 2))
      destination_y=$((xterm_y + 3 * xterm_height / 4))
      activate_window "$firefox_title" \
        || fail_test "Firefox could not be activated before the insertion drag."
      wait_for_active "$firefox_title" \
        || fail_test "Firefox focus did not settle before the insertion drag."
      request_pointer_drag \
        insert \
        0 \
        "$source_x" \
        "$source_y" \
        "$left_frame" \
        1 \
        "$destination_x" \
        "$destination_y" \
        "$right_frame" \
        || fail_test "The physical cross-output insertion drag was not delivered."
      verify_targeted_insertion "$xterm_width" \
        || fail_test "The cross-output target insertion layout was not adopted."

      firefox_frame=$(capture_stable_window_frame "$firefox_title" 2>/dev/null || true)
      frame_is_valid "$firefox_frame" \
        || fail_test "The inserted Firefox frame was invalid."
      IFS=, read -r \
        firefox_x firefox_y firefox_width firefox_height \
        <<< "$firefox_frame"
      source_x=$((firefox_x + firefox_width / 2))
      source_y=$((firefox_y + firefox_height / 2))
      destination_x=$left_probe_x
      destination_y=$left_probe_y
      request_pointer_drag \
        fallback \
        1 \
        "$source_x" \
        "$source_y" \
        "$right_frame" \
        0 \
        "$destination_x" \
        "$destination_y" \
        "$left_frame" \
        || fail_test "The physical empty-output fallback drag was not delivered."
      verify_empty_output_fallback \
        || fail_test "The empty-output drop did not use ordinary admission."

      firefox_frame=$(capture_stable_window_frame "$firefox_title" 2>/dev/null || true)
      xterm_frame=$(capture_stable_window_frame "$xterm_title" 2>/dev/null || true)
      overview_layout_before=$(wait_for_stable_layout_digest 2>/dev/null || true)
      if ! frame_is_valid "$firefox_frame" \
        || ! frame_is_valid "$xterm_frame" \
        || [[ -z "$overview_layout_before" ]]; then
        fail_test "The exact Overview cross-output fixture did not stabilize."
      fi
      overview_kwin_pid=$(kwin_process_id 2>/dev/null || true)
      overview_request_before=$(overview_command_request_id 2>/dev/null || true)
      [[ "$overview_kwin_pid" =~ ^[1-9][0-9]*$ ]] \
        || fail_test "The KWin process was unavailable before the exact Overview drop."
      [[ "$overview_request_before" =~ ^[0-9]+$ ]] \
        || fail_test "The Overview command sequence was unavailable before the exact drop."
      invoke_shortcut "$overview_shortcut" \
        || fail_test "The Overview shortcut could not be invoked on two outputs."
      wait_for_effect_active_state "$overview_plugin_id" true \
        || fail_test "The Overview effect did not become active on two outputs."
      sleep 0.3
      request_overview_pointer_drag \
        "$firefox_frame" \
        "$left_frame" \
        0 \
        "$xterm_frame" \
        "$right_frame" \
        1 \
        || fail_test "The physical exact Overview cross-output drop was not delivered."
      overview_request_after=$(wait_for_overview_command_after "$overview_request_before" 2>/dev/null || true)
      if [[ ! "$overview_request_after" =~ ^[0-9]+$ ]]; then
        fail_test "The physical exact Overview drop did not submit a spatial command."
      fi
      verify_targeted_insertion "$xterm_width" \
        || fail_test "The exact Overview drop did not persist the destination stack."
      overview_layout_after=$(wait_for_stable_layout_digest "$overview_layout_before" 2>/dev/null || true)
      if [[ -z "$overview_layout_after" \
        || "$overview_layout_after" == "$overview_layout_before" \
        || "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || true)" != true \
        || "$(effect_active_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
        || ! kwin_process_is_unchanged "$overview_kwin_pid"; then
        fail_test "The exact Overview drop did not preserve its persisted layout, active effect, and KWin process."
      fi
      invoke_shortcut "$overview_shortcut" \
        || fail_test "The Overview shortcut could not close the two-output checkpoint."
      wait_for_effect_active_state "$overview_plugin_id" false \
        || fail_test "The Overview effect did not close after the exact drop."
      if [[ "$(effect_loaded_state "$overview_plugin_id" 2>/dev/null || true)" != true ]] \
        || ! kwin_process_is_unchanged "$overview_kwin_pid"; then
        fail_test "The Overview effect unloaded or KWin restarted while closing the exact checkpoint."
      fi

      printf '%s\n' \
        "two real outputs, native Wayland Firefox, XWayland xterm, targeted insertion, empty-output fallback, and exact Overview insertion passed" \
        >> "$diagnostics_file"
      write_result true
    '';
  };
  kwinConfig = pkgs.writeText "driftile-vm-kwinrc" ''
    ${
      if driftileVmTwoHead then
        ""
      else
        ''
          [Desktops]
          Rows=1

          [Windows]
          ElectricBorderPushbackPixels=0
          ElectricBorders=2
        ''
    }

    [MouseBindings]
    CommandAll1=Move
    CommandAll3=Resize
    CommandAllKey=Meta

    [Plugins]
    ${pluginId}Enabled=true
    ${wheelControlPluginId}Enabled=true

    [Effect-io.github.kontonkara.driftile.overview]
    OverviewZoom=${overviewZoom.config}

    [Script-${pluginId}]
    ApplicationBorderlessExclusions=
    ApplicationTilingExclusions=
    CenterFocusedColumn=false
    ColumnWidthStepPercent=10
    DefaultColumnWidthPercent=${if driftileVmTwoHead then "100" else "50"}
    Gap=${if driftileVmTwoHead then "8" else "16"}
    WindowHeightStepPercent=10
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
  networking.hostName = if driftileVmTwoHead then "driftile-vm-two-head" else "driftile-vm";
  programs.driftile.enable = true;
  programs.driftile.overview.enable = true;
  programs.driftile.shortcutEditor.enable = true;
  programs.driftile.wheelControl.enable = true;
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
    (if driftileVmTwoHead then twoHeadDemo else demo)
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
    Exec=${
      if driftileVmTwoHead then
        "${twoHeadDemo}/bin/driftile-two-head-demo"
      else
        "${demo}/bin/driftile-demo"
    }
    OnlyShowIn=KDE;
    X-KDE-autostart-after=panel
  '';

  virtualisation.vmVariant.virtualisation = {
    cores = 8;
    diskImage = null;
    graphics = true;
    memorySize = 8192;
    resolution =
      if driftileVmTwoHead then
        {
          x = 688;
          y = 768;
        }
      else
        {
          x = 1680;
          y = 1050;
        };
    restrictNetwork = true;
    qemu = {
      forceAccel = true;
      options =
        if driftileVmTwoHead then
          [
            "-display sdl,gl=off,show-cursor=on,window-close=off"
            "-vga none"
            "-device '${twoHeadGpu}'"
          ]
        else
          [
            "-display gtk,gl=off"
            "-vga none"
            "-device virtio-gpu-pci,xres=1680,yres=1050"
          ];
    };
  };
}
