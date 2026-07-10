{
  description = "Driftile development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
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
          developmentPackages = with pkgs; [
            gh
            kdePackages.kconfig
            kdePackages.kpackage
            kdePackages.qtdeclarative
            nodejs_24
            reuse
            shellcheck
            zip
          ];
          integrationPackages =
            developmentPackages
            ++ (with pkgs; [
              dbus
              kdePackages.kwin
              kdePackages.kwin-x11
              kdePackages.qtwayland
              jq
              systemd
              xorg-server
              xwayland
            ]);
        in
        {
          default = pkgs.mkShell {
            packages = developmentPackages;
          };

          integration = pkgs.mkShell {
            packages = integrationPackages;
          };
        }
      );
    };
}
