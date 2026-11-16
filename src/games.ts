import { IGameComponent } from './components/types'
import { IGame, IGameAdapter } from './pkg/cpp-basic'
import { LPSTR, gt, lpstr } from './pkg/gt'

export const enum GameName {
  Arknights = 'arknights',
}

/** Games whose support has been removed. Their pages only let the user data out, pointing to a build kept for them. */
export const retiredGames: Record<string, RetiredGameInfo> = {
  reverse1999: {
    archive: 'https://cpp--re1999.orz.tools',
    // The commit the archive is built from, on the public mirror, in case the archive goes away.
    source: 'https://github.com/orz-tools/cpp/tree/6ff9fb0b1a6c2ff0fcd4917583fcfe611efc2baf',
    farewell: lpstr(() => gt.gettext('时间重叠、飞跃，令人恍惚，所幸我们共度的时光鲜明而真切……')),
  },
}

export interface RetiredGameInfo {
  archive: string
  source: string
  farewell?: LPSTR
}

export const gameAdapterLoaders = {
  [GameName.Arknights]: async () => new (await import('./pkg/cpp-arknights')).ArknightsAdapter(),
} satisfies Record<GameName, () => Promise<IGameAdapter<IGame>>>

export const gameComponentLoaders = {
  [GameName.Arknights]: async () => (await import('./components/arknights')).ArknightsComponents,
} satisfies Record<GameName, () => Promise<IGameComponent>>
