{
  description = "A KWin extension for KDE Plasma providing scrollable tiling and dynamic workspaces";

  inputs = {
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    {
      home-manager,
      self,
      nixpkgs,
      ...
    }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      homeManagerModule = import ./nix/modules/install.nix {
        homeSettings = true;
        inherit self;
        packageOptionPath = [
          "home"
          "packages"
        ];
        preventSystemInstall = true;
        shortcutConfigFile = true;
      };
      nixosModule = import ./nix/modules/install.nix {
        inherit self;
        packageOptionPath = [
          "environment"
          "systemPackages"
        ];
      };
      packageFor =
        pkgs:
        pkgs.buildNpmPackage {
          pname = "driftile";
          version = "1.7.0";
          outputs = [
            "out"
            "overview"
          ];
          src = self;

          nodejs = pkgs.nodejs_24;
          npmDepsHash = "sha256-hJ0lPL+UJc59x8+xrE2h/8RawbbGjGAa7m4kwQnac6U=";
          npmBuildScript = "build";
          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            runHook preInstall

            install -d "$out/share/kwin/scripts/io.github.kontonkara.driftile"
            cp -r dist/kwin-script/. \
              "$out/share/kwin/scripts/io.github.kontonkara.driftile/"
            install -Dm644 \
              dist/bin/driftile-shortcuts.mjs \
              "$out/libexec/driftile/driftile-shortcuts.mjs"
            makeWrapper \
              ${pkgs.nodejs_24}/bin/node \
              "$out/bin/driftile-shortcuts" \
              --add-flags "$out/libexec/driftile/driftile-shortcuts.mjs" \
              --prefix PATH : ${
                pkgs.lib.makeBinPath [
                  pkgs.systemd
                  pkgs.util-linux
                ]
              }

            install -d \
              "$overview/share/kwin/effects/io.github.kontonkara.driftile.overview"
            cp -r dist/kwin-effect/. \
              "$overview/share/kwin/effects/io.github.kontonkara.driftile.overview/"

            runHook postInstall
          '';

          meta = {
            description = "A KWin extension for KDE Plasma providing scrollable tiling and dynamic workspaces.";
            homepage = "https://github.com/kontonkara/driftile";
            license = pkgs.lib.licenses.gpl3Plus;
            platforms = pkgs.lib.platforms.linux;
          };
        };
    in
    {
      checks = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          home-manager = import ./nix/home-manager-check.nix {
            defaultPackage = self.packages.${system}.driftile;
            defaultOverviewPackage = self.packages.${system}."driftile-overview";
            inherit
              home-manager
              homeManagerModule
              nixosModule
              pkgs
              system
              ;
            lib = nixpkgs.lib;
          };
          modules = import ./nix/module-check.nix {
            defaultPackage = self.packages.${system}.driftile;
            defaultOverviewPackage = self.packages.${system}."driftile-overview";
            inherit
              homeManagerModule
              nixosModule
              pkgs
              ;
            lib = nixpkgs.lib;
          };
          package-layout = pkgs.runCommand "driftile-package-layout-check" { } ''
            main=${self.packages.${system}.driftile}
            overview=${self.packages.${system}."driftile-overview"}

            test -d "$main/share/kwin/scripts/io.github.kontonkara.driftile"
            test -x "$main/bin/driftile-shortcuts"
            test -f "$main/libexec/driftile/driftile-shortcuts.mjs"
            test ! -e "$main/share/kwin/effects"
            test "$(find "$main" -mindepth 1 -maxdepth 1 | wc -l)" -eq 3
            test "$(find "$main/bin" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$main/libexec/driftile" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$main/share" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$main/share/kwin" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1

            test -d "$overview/share/kwin/effects/io.github.kontonkara.driftile.overview"
            test ! -e "$overview/share/kwin/scripts"
            test ! -e "$overview/bin"
            test ! -e "$overview/libexec"
            test "$(find "$overview" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$overview/share" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$overview/share/kwin" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1
            test "$(find "$overview/share/kwin/effects" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1

            touch "$out"
          '';
        }
      );

      homeManagerModules = {
        default = homeManagerModule;
        driftile = homeManagerModule;
      };

      nixosModules = {
        default = nixosModule;
        driftile = nixosModule;
      };

      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          driftile = packageFor pkgs;
        in
        {
          "driftile-overview" = driftile.overview;
          inherit driftile;
          default = driftile;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          fakeInputClient = pkgs.stdenv.mkDerivation {
            name = "driftile-fake-input-client";
            dontUnpack = true;
            strictDeps = true;

            nativeBuildInputs = [
              pkgs.pkg-config
              pkgs.wayland-scanner
            ];
            buildInputs = [ pkgs.wayland ];

            buildPhase = ''
              runHook preBuild

              wayland-scanner client-header \
                ${pkgs.kdePackages.plasma-wayland-protocols}/share/plasma-wayland-protocols/fake-input.xml \
                fake-input-client-protocol.h
              wayland-scanner private-code \
                ${pkgs.kdePackages.plasma-wayland-protocols}/share/plasma-wayland-protocols/fake-input.xml \
                fake-input-protocol.c
              $CC \
                -std=c11 \
                -D_POSIX_C_SOURCE=200809L \
                -Wall \
                -Wextra \
                -Wpedantic \
                -Werror \
                $(pkg-config --cflags wayland-client) \
                -I. \
                ${./tools/integration/fake-input-client.c} \
                fake-input-protocol.c \
                $(pkg-config --libs wayland-client) \
                -o driftile-fake-input-client

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              install -Dm755 \
                driftile-fake-input-client \
                "$out/bin/driftile-fake-input-client"

              runHook postInstall
            '';
          };
          developmentPackages = with pkgs; [
            gh
            kdePackages.kconfig
            kdePackages.kpackage
            kdePackages.qtdeclarative
            nodejs_24
            reuse
            shellcheck
            unzip
            util-linux
            zip
          ];
          integrationPackages =
            developmentPackages
            ++ (with pkgs; [
              dbus
              fakeInputClient
              gjs
              gtk3
              kdePackages.kglobalacceld
              kdePackages.layer-shell-qt
              kdePackages.libkscreen
              kdePackages.kwin
              kdePackages.kwin-x11
              kdePackages.qtwayland
              jq
              socat
              systemd
              xdotool
              xorg-server
              xterm
              xprop
              xrandr
              xwayland
            ]);
        in
        {
          default = pkgs.mkShell {
            packages = developmentPackages;
          };

          integration = pkgs.mkShell {
            packages = integrationPackages;
            DRIFTILE_SMOKE_FAKE_INPUT_CLIENT = "${fakeInputClient}/bin/driftile-fake-input-client";
            DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT = "${pkgs.kdePackages.layer-shell-qt}/lib/qt-6/qml";
            DRIFTILE_SMOKE_KGLOBALACCELD = "${pkgs.kdePackages.kglobalacceld}/libexec/kglobalacceld";
            GI_TYPELIB_PATH = pkgs.lib.makeSearchPath "lib/girepository-1.0" [
              pkgs.atk
              pkgs.gdk-pixbuf
              pkgs.glib.out
              pkgs.gobject-introspection-unwrapped
              pkgs.gtk3
              pkgs.harfbuzz
              pkgs.pango.out
            ];
          };
        }
      );

      nixosConfigurations.driftile-vm = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs.driftileVmTwoHead = false;
        modules = [
          self.nixosModules.default
          ./nix/vm.nix
        ];
      };

      nixosConfigurations.driftile-vm-two-head = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs.driftileVmTwoHead = true;
        modules = [
          self.nixosModules.default
          ./nix/vm.nix
        ];
      };

      nixosConfigurations.driftile-vm-lifecycle = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          driftileCurrentOverviewPackage = self.packages.x86_64-linux."driftile-overview";
          driftileCurrentPackage = self.packages.x86_64-linux.driftile;
        };
        modules = [ ./nix/lifecycle-vm.nix ];
      };
    };
}
