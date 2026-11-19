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
pnpm lint         # oxlint with type-aware rules (.oxlintrc.json) and the repo's own (scripts/oxlint-plugin.js)
pnpm fmt          # Format with oxfmt (.oxfmtrc.json)
pnpm vitest run   # Unit tests
pnpm test:coverage # Unit tests with v8 coverage of cpp-core and cpp-arknights, written to coverage/
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

**Stack**: React 18 + Jotai (state) + BlueprintJS 6 (UI) + Vite + TypeScript (strict).

### Game plugin system

Each game provides two things registered in `src/games.ts`:

- **GameAdapter** (`src/pkg/cpp-{game}/GameAdapter.ts`) — implements `IGameAdapter`: data fetching, region configs, character/item definitions, and the presets of the 「更多视图」 menu: `getPredefinedQueryGroups()` names their groups in menu order, and a preset's `segments` put its other versions on the same row
- **GameComponent** (`src/components/{game}/index.tsx`) — game-specific UI components (character status, importers, filters), and the sidebar panels (`sidebarPanels`) that follow the shell's own 「关于」, which always comes first; see `src/components/Sidebar.tsx`. Clicking a character opens its dossier, a drawer on the right that shows one tab at a time: the shell's own 「练度」 is always the first page, and the game's `dossierSections` follow it; see `src/components/CharacterDossier.tsx`. Characters drawn by a sidebar panel or its pop-out window open the dossier through `useOpenCharacterDossier()`, which toggles it like a click in the list; `useShowCharacterDossier()` opens it without ever closing it, for links to something inside the dossier. Both take `{ section }` to open on a given page; the skins panel opens the 「时装」 page this way. Anything that opens a card where it is clicked (a skill, a module, an item, a stage) is wrapped in `PeekTrigger` (`src/components/Peek.tsx`): the shell brings the item card, the game registers its own kinds in `peekKinds`, and a card can be pinned to the board on the right. To frame an entry in the dossier or a panel after jumping to it, request it through `src/components/focusFrame.ts` and call `useFocusFrame` on the entry. A game can add notes under a task's name in the task list with `taskNotes`; clicking one can open the dossier on a page and frame an entry there. Arknights writes the game mission that unlocks each of a special operator's tasks this way. A tag to the right of a task's name comes from `TaskTag` and stays visible when a long name is cut short; Arknights' 「任务 n/m」 on a module's unlock opens the dossier's 模组任务 page and frames that module. The import result dialog shows its own 角色, 目标 and 道具 pages; `useImportDiffTabs` adds the game's after them (Arknights: 时装, the skins an import added and removed). A sidebar panel can narrow the character list to a set of characters through `rosterPinAtom` (`src/components/rosterPin.ts`); the pin lapses when the list's view, search or quick filters change. The quick filters (`quickFilters`) can follow what the view's query expands: `quickFiltersByJoin` gives a sub query its own set, `QuickFilterBuilder` is told the join, and values of another set stay in the parameters without applying; see `src/components/quickFilters.ts`

Games are code-split via dynamic imports. The URL path (`/{game}/{profile}`) determines which game loads.

### Core flow

`main.tsx` (routing) → `entry.tsx` (init GameAdapter + DataManager) → `Cpp.ts` (Jotai store, preferences) → `App.tsx` (shell UI) → game-specific components via `useComponents()` hook.

### Data layer

- `DataManager` (per-game, in `src/pkg/cpp-{game}/`) handles region-aware data fetching and caching (`dccache` / localforage). dccache serves a stored copy that passes verification without asking the repo, and records a version as checked only once its data is stored, so an interrupted download leaves the copy in hand. A region's `optional` containers (Arknights: the penguin matrix and the two surveys) may be missing: a load that cannot get one commits without it and names it in the state's `missing`, every update tries it again (`UpdateResult.failed` carries its error while the rest are committed), and what reads it says it did not load and offers 重试 (`useMissingData` and `MissingDataState` in `src/components/MissingData.tsx`, which call `loadMissing()`; the 刷图 area asks the game through `useFarmNotice`)
- A container outside a region's `required` sources is fetched on demand: Arknights' skill, module and base skill texts (`arknights-kengxxiao-details-<lang>`) load through `ArknightsDataManager.loadDetails()` the first time the status editor's (i) panel opens, a base skill view lists or a dossier's 基建技能 page shows, and zh_CN's skin sale windows from PRTS (`arknights-prts-skins`) through `loadPrtsSkins()` the first time the skins panel or a dossier's 时装 page shows
- `UserData` lives in localStorage, managed by `UserDataAtomHolder` with immer-based undo/redo that keeps 10 steps. Display settings stored there are written with `modifyWithoutUndo` instead of `modify`, so they take no steps: today the list's column widths changed outside the query editor, which go into a saved view's own query or, for a game preset, into `presetWidths` under its 「更多视图」 row
- The plan order is `goalOrder`. Within a character, a game marks the tasks that move together with `Task.group` (Arknights: one skill's masteries, one module); `taskGroupOrder` keeps their order per character, and `generateTasksForCharacter` takes it as `groupOrder` (see `orderGroups`). Both orders are dragged in the 计划 view and the task list (`src/components/ListDrag.tsx`) or moved with the buttons in the context menus. Operators can be selected (Ctrl/⌘- or Shift-click, a click on the drag handle, or the context menu) and dragged or moved together; while a list has a selection, a plain click on an operator toggles it instead of opening the dossier, until the selection is empty again; each list keeps its own selection (`src/components/ListSelection.tsx`). An operator's goal is maxed out or cleared in one step from the status editor's 培养目标 row or the character's context menu (`src/components/PlanActions.tsx`); they write `maxGoals` and `clearGoals`, which take a list of characters and make one undo step. A task's context menu completes that task alone (完成, 强制完成) or every task of its operator from the top of the task list down to it (完成至此, the range from `tasksUpTo`); all of them write `completeTasks`, one undo step
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
| `zod`           | `zod/mini` with English error messages; import `z` here    |

### State management

Jotai atoms are the primary state mechanism. `Cpp.ts` creates the store with preference atoms (value type, farm goals, forbidden stages). Game adapters extend this with game-specific atoms. Undo/redo is built into the `dataAtom` via immer patches.

### Phone layout

Below 768px wide (`PHONE_QUERY` in `src/components/phoneLayout.ts`) `<html>` carries `cpp-phone` (set by `watchPhoneLayoutClass()` from `runCpp`) and the shell shows one area at a time: the five `section`s of `.App` (`data-area`) stack in place, all mounted, only the current one visible (`phoneAreaAtom`, kept in `cpp_phone_area`), and `PhoneTabBar` at the bottom switches 干员 / 任务 / 刷图 / 材料 / 更多. The sidebar's column is 更多 (`PhoneMore.tsx`): the data menu, the sidebar panels and the navbar's menus, each opening a page (`phoneMorePageAtom`) that holds the same menu component the navbar pops up; a panel fills the screen, and `useShowSidebarPanel` switches to 更多 and closes the dossier. `usePhoneLayout()` decides layout; `useCoarsePointer()` (`(pointer: coarse)`, any width) decides touch behaviour: a tap on a task opens its context menu, a long press on an operator opens theirs (`useLongPressContextMenu`, as iOS never fires `contextmenu`), a finger never resizes a column. On a phone a selected operator (`ListSelection.tsx`) is tinted on its avatar and name cells only. On a phone the back key closes the top layer before it leaves the page (`phoneBack.ts`, run by `PhoneBack` in `App.tsx`). Phone styles live at the end of `App.css`, under `.cpp-phone`, and use Blueprint's colour variables only.

### Icons

Blueprint's own icon loader is patched out (`patches/`), so an icon renders only if `src/icons.ts` bundles its paths, and at the size it is drawn: Blueprint takes the 20px paths for an icon drawn at 20px or more, which `NonIdealState`, `Alert` (so `showAlert` / `showConfirm`), `Drawer` and `<Icon size={20}>` always are. A missing one renders blank and toasts "missing icon". `pnpm lint` reports it (`cpp/bundled-icon`) wherever the name is written out: icon props, `{ icon: … }` objects, and values typed `IconName`.
