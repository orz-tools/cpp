{
  # git+https 而非 github:：github: fetcher 走 api.github.com，绕开 gitconfig 里
  # 指向机房反代的 insteadOf，会撞上匿名限流（HTTP 403）。
  inputs = {
    nixpkgs.url = "git+https://github.com/NixOS/nixpkgs?ref=nixos-26.05&shallow=1";
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
      in
      {
        devShell = pkgs.devshell.mkShell {
          imports = [{
            name = "cpp";
            packages = [
              pkgs.nixpkgs-fmt
              pkgs.nodejs_26
              # 版本要和 package.json 的 packageManager 一致，否则 pnpm 会自己去下载那个版本。
              pkgs.pnpm_12
              # scripts/update-messages.sh（pnpm gt）要用 msgmerge。
              pkgs.gettext
            ];
          }];
        };
      });
}
