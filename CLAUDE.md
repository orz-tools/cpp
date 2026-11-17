# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev environment

The toolchain (node, pnpm, gettext for `msgmerge`) comes from the nix devshell in `.nix/`, pinned by `.nix/flake.lock`. Nothing is installed globally.

- With direnv: run `direnv allow` once; the shell loads on `cd`.
- Without direnv, or from a worktree/agent shell: prefix commands with `nix develop path:$PWD/.nix --command`, e.g. `nix develop path:$PWD/.nix --command pnpm build`.
- The pnpm version in `.nix/flake.nix` must match `packageManager` in `package.json`; otherwise pnpm downloads the pinned version itself. pnpm settings (overrides, patches, allowed build scripts) live in `pnpm-workspace.yaml`.
- Change tool versions in `.nix/flake.nix`, then `nix flake lock path:$PWD/.nix`. Commit both files.

## Commands

All of these run inside the devshell.

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (builds messages first, then vite)
pnpm build        # Production build (tsc + vite)
pnpm preview      # Preview production build
pnpm gt           # Extract + update + build i18n message files
pnpm lint         # oxlint with type-aware rules (.oxlintrc.json)
pnpm fmt          # Format with oxfmt (.oxfmtrc.json)
pnpm vitest run   # Unit tests
```

## i18n Workflow

UI strings use gettext via `gt.gettext()`, `gt.pgettext(context, text)`, and `gt.ngettext()`. The default locale is `zh_Hans` (Chinese); translations live in `/po/`.

After changing any user-facing strings, run:

1. `pnpm gt` — extract new strings and rebuild message templates
2. Translate the updated `.po` files in `/po/`
3. `pnpm gt` again — compile translations into runtime `.json`
4. Commit

## Architecture

**Multi-game toolbox** — Closure++ supports gacha games through a plugin system; Arknights is the only one left. A game whose support was removed is listed in `retiredGames` (`src/games.ts`): its URL renders `RetiredGame`, which only exports or clears the stored user data and links to an archived build and the source it was built from.

**Stack**: React 18 + Jotai (state) + BlueprintJS 5 (UI) + Vite + TypeScript (strict).

### Game plugin system

Each game provides two things registered in `src/games.ts`:

- **GameAdapter** (`src/pkg/cpp-{game}/GameAdapter.ts`) — implements `IGameAdapter`: data fetching, region configs, character/item definitions, and the presets of the 「更多视图」 menu: `getPredefinedQueryGroups()` names their groups in menu order, and a preset's `segments` put its other versions on the same row
- **GameComponent** (`src/components/{game}/index.tsx`) — game-specific UI components (character status, importers, filters), and the sidebar panels (`sidebarPanels`) that follow the shell's own 「关于」, which always comes first; see `src/components/Sidebar.tsx`. Clicking a character opens its dossier, a drawer on the right: the game's `dossierSections` follow the shell's own 「练度」 section, which always comes first; see `src/components/CharacterDossier.tsx`. Characters drawn by a sidebar panel or its pop-out window open the dossier through `useOpenCharacterDossier()`, which toggles it like a click in the list; `useShowCharacterDossier()` opens it without ever closing it, for links to something inside the dossier (the skins panel uses it). A sidebar panel can narrow the character list to a set of characters through `rosterPinAtom` (`src/components/rosterPin.ts`); the pin lapses when the list's view, search or quick filters change

Games are code-split via dynamic imports. The URL path (`/{game}/{profile}`) determines which game loads.

### Core flow

`main.tsx` (routing) → `entry.tsx` (init GameAdapter + DataManager) → `Cpp.ts` (Jotai store, preferences) → `App.tsx` (shell UI) → game-specific components via `useComponents()` hook.

### Data layer

- `DataManager` (per-game, in `src/pkg/cpp-{game}/`) handles region-aware data fetching and caching (`dccache` / localforage)
- A container outside a region's `required` sources is fetched on demand: Arknights' skill and module texts (`arknights-kengxxiao-details-<lang>`) load through `ArknightsDataManager.loadDetails()` the first time the status editor's (i) panel opens, and zh_CN's skin sale windows from PRTS (`arknights-prts-skins`) through `loadPrtsSkins()` the first time the skins panel or a dossier's 时装 section shows
- `UserData` lives in localStorage, managed by `UserDataAtomHolder` with immer-based undo/redo
- Per-profile extras that are not user data (`src/pkg/cpp-core/profileExtras.ts`) live in IndexedDB (`cpp_extras`), one record per profile; today only the 森空岛 snapshot (`skland`). They are outside undo/redo, travel in the `@orz/cpp/dump` export as `extras`, and are deleted with the profile's data
- Data schemas in `src/pkg/cpp-data-schemas/` define external data source structures

### Key packages in `src/pkg/`

| Package         | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| `cpp-basic`     | Core interfaces (`IGame`, `IGameAdapter`, `DataManager`)   |
| `cpp-core`      | Shared logic (UserData atoms, Task solver, formula system) |
| `cpp-arknights` | Arknights adapter                                          |
| `gt`            | Gettext wrapper                                            |
| `dccache`       | Data container caching                                     |
| `blobcache`     | Image/asset variant handling                               |

### State management

Jotai atoms are the primary state mechanism. `Cpp.ts` creates the store with preference atoms (value type, farm goals, forbidden stages). Game adapters extend this with game-specific atoms. Undo/redo is built into the `dataAtom` via immer patches.
