{
  description = "ARI Discord Bot (Node.js) - Nix flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_20; # Node 20 LTS with fetch built-in
        pname = "ari-discord-bot";
        version = (builtins.fromJSON (builtins.readFile ./package.json)).version or "0.0.0";
      in {
        packages.default = pkgs.buildNpmPackage {
          inherit pname version;
          src = ./.;
          npmDepsHash = pkgs.lib.fakeSha256; # run nix build once to get the real hash
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r . $out/
            runHook postInstall
          '';
        };

        devShells.default = pkgs.mkShell {
          packages = [ nodejs pkgs.nodePackages.pnpm pkgs.nodePackages.npm-check-updates ];
          shellHook = ''
            echo "Dev shell: Node $(node --version)"
          '';
        };

        apps.default = {
          type = "app";
          program = pkgs.writeShellScript "run-bot" ''
            exec ${nodejs}/bin/node index.js
          '';
        };
      }
    );
}
