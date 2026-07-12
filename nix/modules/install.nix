{
  self,
  packageOptionPath,
  preventSystemInstall ? false,
}:

{
  config,
  lib,
  osConfig ? { },
  pkgs,
  ...
}:

let
  cfg = config.programs.driftile;
  system = pkgs.stdenv.hostPlatform.system;
  systemInstallEnabled = lib.attrByPath [
    "programs"
    "driftile"
    "enable"
  ] false osConfig;
in
{
  options.programs.driftile = {
    enable = lib.mkEnableOption "installation of the Driftile KWin extension";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${system}.driftile;
      defaultText = lib.literalExpression "inputs.driftile.packages.\${pkgs.stdenv.hostPlatform.system}.driftile";
      description = "The Driftile package to install.";
    };
  };

  config = lib.mkIf cfg.enable (
    lib.mkMerge [
      (lib.setAttrByPath packageOptionPath [ cfg.package ])
      (lib.optionalAttrs preventSystemInstall {
        assertions = [
          {
            assertion = !systemInstallEnabled;
            message = "Install Driftile through either NixOS or Home Manager for a user, not both.";
          }
        ];
      })
    ]
  );
}
