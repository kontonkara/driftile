{
  driftileCurrentPackage,
  pkgs,
  ...
}:

let
  pluginId = "io.github.kontonkara.driftile";
  pluginMetadata = builtins.fromJSON (builtins.readFile ../packaging/kwin-script/metadata.json);
  currentVersion = pluginMetadata.KPlugin.Version;
  publishedVersion = "1.1.0";
  publishedArchive = pkgs.fetchurl {
    name = "driftile-${publishedVersion}.kwinscript";
    url = "https://github.com/kontonkara/driftile/releases/download/v${publishedVersion}/driftile-${publishedVersion}.kwinscript";
    hash = "sha256-vs+S70jK2M8IT4YlUfImG5e1Q7x2umALjhntKRfoJ60=";
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
        test -f package/contents/code/main.js
        test -f package/contents/ui/main.qml
        test -z "$(find package -type l -print -quit)"

        find package -exec touch -h -d @315532800 {} +
        find package -type f -printf '%P\n' | LC_ALL=C sort > entries
        (cd package && zip -0Xq "$out" -@ < ../entries)
      '';
  lifecycleCheck = pkgs.writeShellApplication {
    name = "driftile-lifecycle-check";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gnugrep
      pkgs.jq
      pkgs.kdePackages.kcalc
      pkgs.kdePackages.kconfig
      pkgs.kdePackages.konsole
      pkgs.kdePackages.kpackage
      pkgs.systemd
      pkgs.unzip
    ];
    text = ''
      readonly diagnostics_file=/tmp/shared/driftile-lifecycle-diagnostics
      readonly result_file=/tmp/shared/driftile-lifecycle-verified
      readonly command_log=/tmp/driftile-lifecycle-commands.log
      readonly plugin_id=${pluginId}
      readonly published_archive=${publishedArchive}
      readonly current_archive=${currentArchive}
      readonly published_version=${publishedVersion}
      readonly current_version=${currentVersion}
      readonly data_home="''${XDG_DATA_HOME:-$HOME/.local/share}"
      readonly installed_package="$data_home/kwin/scripts/$plugin_id"
      readonly installed_main="$installed_package/contents/ui/main.qml"
      readonly installed_runtime="$installed_package/contents/code/main.js"
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

      load_installed_script() {
        local load_result

        [[ -f "$installed_main" ]] \
          || fail_test "the installed entry point is missing"
        load_result=$(busctl --user call \
          org.kde.KWin \
          /Scripting \
          org.kde.kwin.Scripting \
          loadDeclarativeScript \
          ss "$installed_main" "$plugin_id" \
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

      installed_version() {
        jq --exit-status --raw-output '.KPlugin.Version' \
          "$installed_package/metadata.json"
      }

      runtime_digest() {
        local digest

        digest=$(sha256sum "$installed_runtime") || return 1
        printf '%s' "''${digest%% *}"
      }

      package_is_listed() {
        kpackagetool6 --type=KWin/Script --list 2>/dev/null \
          | grep --fixed-strings --quiet "$plugin_id"
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
          fi
          printf '\nKPackage matches:\n'
          kpackagetool6 --type=KWin/Script --list 2>&1 \
            | grep --fixed-strings "$plugin_id" \
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
      [[ "$(archive_version "$current_archive")" == "$current_version" ]] \
        || fail_test "the current archive metadata is unexpected"
      [[ ! -e "$installed_package" ]] \
        || fail_test "a user package was present before the test"
      [[ ! -e "/run/current-system/sw/share/kwin/scripts/$plugin_id" ]] \
        || fail_test "a system package was present before the test"
      if package_is_listed; then
        fail_test "KPackage listed Driftile before installation"
      fi
      progress "clean package baseline confirmed"

      run_checked \
        "the published package could not be installed" \
        kpackagetool6 --type=KWin/Script --install "$published_archive"
      [[ "$(installed_version)" == "$published_version" ]] \
        || fail_test "the installed published metadata is unexpected"
      published_runtime_digest=$(runtime_digest) \
        || fail_test "the published runtime could not be hashed"
      set_enabled true
      load_installed_script
      progress "published $published_version package installed and loaded"

      set_enabled false
      unload_installed_script
      run_checked \
        "the current package could not upgrade the published package" \
        kpackagetool6 --type=KWin/Script --upgrade "$current_archive"
      [[ "$(installed_version)" == "$current_version" ]] \
        || fail_test "the upgraded metadata did not change"
      current_runtime_digest=$(runtime_digest) \
        || fail_test "the current runtime could not be hashed"
      [[ "$current_runtime_digest" != "$published_runtime_digest" ]] \
        || fail_test "the runtime bundle did not change during upgrade"
      progress "package upgraded to $current_version with a new runtime"

      set_enabled true
      load_installed_script
      app_konsole_title="Driftile lifecycle Konsole application"
      app_kcalc_title="Driftile lifecycle Calculator application"
      start_test_konsole "$app_konsole_title" \
        || fail_test "the current runtime could not open Konsole"
      start_test_kcalc "$app_kcalc_title" \
        || fail_test "the current runtime could not open KDE Calculator"
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
