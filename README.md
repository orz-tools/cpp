## Closure++

Originally known as Yet Another Toolbox for Arknights. Now with more games!

### Introduction

Closure++ is an open-source project aimed at providing a comprehensive toolbox for various games. It started as a solution specifically built for the game Arknights and has since evolved to cater to the needs of multiple games.

### Features

- Game-specific toolsets: Closure++ offers a wide range of features tailored to specific games, including but not limited to Arknights. We strive to enhance the gaming experience by providing utilities, guides, and resources for various aspects of the supported games.

- Community-driven contributions: We encourage developers and non-developers to participate in the project. Whether it's submitting bug reports, suggesting new features, or contributing code, we value and appreciate every contribution. Together, we can make Closure++ a versatile and invaluable resource for gamers.

### Supported Games

Closure++ currently supports the following games:

- Arknights: A 2D tower defense mobile game developed and published by Hypergryph.

Support for Reverse: 1999 has been removed. Its pages now only export or clear existing user data; the last build that supported it is kept at <https://cpp--re1999.orz.tools>, built from [6ff9fb0](https://github.com/orz-tools/cpp/tree/6ff9fb0b1a6c2ff0fcd4917583fcfe611efc2baf).

### Getting Started

The toolchain is provided by a [nix](https://nixos.org) devshell in `.nix/`. With [direnv](https://direnv.net) and flakes enabled:

```shell
$ direnv allow
$ pnpm install
$ pnpm dev
```

Without direnv, run `nix develop path:$PWD/.nix` first.

### Contributions

Closure++ is an open-source project, and contributions are highly welcome. If you encounter any issues, have ideas for improvements, or would like to contribute in any way, please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to get involved.

### License

Closure++ is released under the [GNU AFFERO GENERAL PUBLIC LICENSE Version 3](LICENSE). Please refer to the LICENSE file for more details.

### Contact

If you have any questions, suggestions, or just want to connect with the Closure++ community, you can reach us through the following channels:

- [GitHub Issues](https://github.com/orz-tools/cpp/issues)
- [Email](mailto:cpp@ouomail.com)

Feel free to join the conversation and contribute to Closure++ in any way you can!
