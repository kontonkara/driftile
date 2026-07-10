{
  description = "Driftile development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              dbus
              gh
              kdePackages.kconfig
              kdePackages.kpackage
              kdePackages.kwin
              kdePackages.qtdeclarative
              nodejs_24
              reuse
              shellcheck
              systemd
              xterm
              xwininfo
              xprop
              xwayland
              zip
            ];
          };
        }
      );
    };
}
