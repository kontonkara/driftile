{
  description = "Driftile development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      packageFor =
        pkgs:
        pkgs.buildNpmPackage {
          pname = "driftile";
          version = "0.1.0";
          src = self;

          nodejs = pkgs.nodejs_24;
          npmDepsHash = "sha256-J6WPqqPh/Q3X4kii/sZaWAY4gOPf2F7Yz5c3f+RdSPg=";
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
              --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.systemd pkgs.util-linux ]}

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
            util-linux
            zip
          ];
          integrationPackages =
            developmentPackages
            ++ (with pkgs; [
              dbus
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
            DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT =
              "${pkgs.kdePackages.layer-shell-qt}/lib/qt-6/qml";
            DRIFTILE_SMOKE_KGLOBALACCELD =
              "${pkgs.kdePackages.kglobalacceld}/libexec/kglobalacceld";
          };
        }
      );

      nixosConfigurations.driftile-vm = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = { inherit self; };
        modules = [ ./nix/vm.nix ];
      };
    };
}
