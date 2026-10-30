{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    git-hooks-nix = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux"];
      flake.overlays.default = _final: prev: {
        bun = prev.bun.overrideAttrs (_: rec {
          version = "1.4.4";
          src = prev.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-x64-baseline.zip";
            hash = "sha256-4ERutVmVdy65iUvrrppr42jZhai5Jx7hJEhvmUbu3XY=";
          };
        });
        nodejs-bin_24 = prev.stdenvNoCC.mkDerivation rec {
          pname = "nodejs";
          version = "24.22.1";
          src = prev.fetchurl {
            url = "https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.xz";
            hash = "sha256-bBcqmrZxj3uAH7WnvUhq8u5eMnWAhqBLhPzOKqdwleY=";
          };
          nativeBuildInputs = [prev.patchelf prev.makeWrapper];
          dontStrip = true;
          dontPatchELF = true;
          meta.platforms = ["x86_64-linux"];
          installPhase = ''
            mkdir -p $out/libexec
            cp -r bin lib include share $out/
            mv $out/bin/node $out/libexec/node
            patchelf --set-interpreter ${prev.stdenv.cc.libc}/lib/ld-linux-x86-64.so.2 $out/libexec/node
            makeWrapper $out/libexec/node $out/bin/node \
              --prefix LD_LIBRARY_PATH : ${prev.lib.makeLibraryPath [prev.stdenv.cc.cc.lib]}
          '';
        };
      };
      imports = [
        inputs.treefmt-nix.flakeModule
        inputs.git-hooks-nix.flakeModule
      ];
      perSystem = {
        config,
        pkgs,
        system,
        ...
      }: {
        _module.args.pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [inputs.self.overlays.default];
        };

        treefmt = {
          projectRootFile = "flake.nix";
          programs = {
            alejandra.enable = true;
            deadnix.enable = true;
            statix.enable = true;
            prettier.enable = true;
          };
        };
        formatter = config.treefmt.build.wrapper;

        pre-commit = {
          check.enable = true;
          settings = {
            hooks = {
              treefmt.enable = true;
            };
          };
        };
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            nodejs-bin_24
            svelte-language-server
            typescript-language-server
          ];
          shellHook = config.pre-commit.installationScript;
        };
      };
    };
}
