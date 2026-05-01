# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start dev server (builds messages first, then vite)
yarn build        # Production build (tsc + vite)
yarn preview      # Preview production build
yarn gt           # Extract + update + build i18n message files
```

## i18n Workflow

UI strings use gettext via `gt.gettext()`, `gt.pgettext(context, text)`, and `gt.ngettext()`. The default locale is `zh_Hans` (Chinese); translations live in `/po/`.

After changing any user-facing strings, run:

1. `yarn gt` — extract new strings and rebuild message templates
2. Translate the updated `.po` files in `/po/`
3. `yarn gt` again — compile translations into runtime `.json`
4. Commit

## Architecture

**Multi-game toolbox** — Closure++ supports multiple gacha games (Arknights, Reverse:1999) through a plugin system.

**Stack**: React 18 + Jotai (state) + BlueprintJS 5 (UI) + Vite + TypeScript (strict).

### Game plugin system

Each game provides two things registered in `src/games.ts`:
- **GameAdapter** (`src/pkg/cpp-{game}/GameAdapter.ts`) — implements `IGameAdapter`: data fetching, region configs, character/item definitions
- **GameComponent** (`src/components/{game}/index.tsx`) — game-specific UI components (character status, importers, filters)

Games are code-split via dynamic imports. The URL path (`/{game}/{profile}`) determines which game loads.

### Core flow

`main.tsx` (routing) → `entry.tsx` (init GameAdapter + DataManager) → `Cpp.ts` (Jotai store, preferences) → `App.tsx` (shell UI) → game-specific components via `useComponents()` hook.

### Data layer

- `DataManager` (per-game, in `src/pkg/cpp-{game}/`) handles region-aware data fetching and caching (`dccache` / localforage)
- `UserData` lives in localStorage, managed by `UserDataAtomHolder` with immer-based undo/redo
- Data schemas in `src/pkg/cpp-data-schemas/` define external data source structures

### Key packages in `src/pkg/`

| Package | Purpose |
|---------|---------|
| `cpp-basic` | Core interfaces (`IGame`, `IGameAdapter`, `DataManager`) |
| `cpp-core` | Shared logic (UserData atoms, Task solver, formula system) |
| `cpp-arknights` | Arknights adapter |
| `cpp-re1999` | Reverse:1999 adapter |
| `gt` | Gettext wrapper |
| `dccache` | Data container caching |
| `blobcache` | Image/asset variant handling |

### State management

Jotai atoms are the primary state mechanism. `Cpp.ts` creates the store with preference atoms (value type, farm goals, forbidden stages). Game adapters extend this with game-specific atoms. Undo/redo is built into the `dataAtom` via immer patches.
