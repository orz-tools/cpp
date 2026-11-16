{
  # git+https 而非 github:：github: fetcher 走 api.github.com，绕开 gitconfig 里
  # 指向机房反代的 insteadOf，会撞上匿名限流（HTTP 403）。
  inputs = {
    nixpkgs.url = "git+https://github.com/NixOS/nixpkgs?ref=nixos-25.11&shallow=1";
    flake-utils.url = "git+https://github.com/numtide/flake-utils?shallow=1";
    devshell.url = "git+https://github.com/numtide/devshell?shallow=1";
    devshell.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, ... }:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [ inputs.devshell.overlays.default ];
        };
        nodejs = pkgs.nodejs_20;
      in
      {
        devShell = pkgs.devshell.mkShell {
          imports = [{
            name = "cpp";
            packages = [
              pkgs.nixpkgs-fmt
              nodejs
              # yarn 1 只是入口：.yarnrc.yml 的 yarnPath 会转交给仓库里提交的 yarn 3。
              # override 让它用上面这份 node，而不是另带一份。
              (pkgs.yarn.override { inherit nodejs; })
              # scripts/update-messages.sh（yarn gt）要用 msgmerge。
              pkgs.gettext
            ];
          }];
        };
      });
}
