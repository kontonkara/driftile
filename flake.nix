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
          version = "1.0.0-rc.1";
          src = self;

          nodejs = pkgs.nodejs_24;
          npmDepsHash = "sha256-LSjsssWchKCXyX1WMKClG90JDVOgBriC7d/DzwuNdvw=";
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
            inherit
              homeManagerModule
              nixosModule
              pkgs
              ;
            lib = nixpkgs.lib;
          };
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
          inherit driftile;
          default = driftile;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
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
        specialArgs.driftileCurrentPackage = self.packages.x86_64-linux.driftile;
        modules = [ ./nix/lifecycle-vm.nix ];
      };
    };
}
