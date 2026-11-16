import { IGameComponent } from './components/types'
import { IGame, IGameAdapter } from './pkg/cpp-basic'

export const enum GameName {
  Arknights = 'arknights',
}

/** Games whose support has been removed. Their pages only let the user data out, pointing to a build kept for them. */
export const retiredGames: Record<string, { archive: string }> = {
  reverse1999: { archive: 'https://cpp--re1999.orz.tools' },
}

export const gameAdapterLoaders = {
  [GameName.Arknights]: async () => new (await import('./pkg/cpp-arknights')).ArknightsAdapter(),
} satisfies Record<GameName, () => Promise<IGameAdapter<IGame>>>

export const gameComponentLoaders = {
  [GameName.Arknights]: async () => (await import('./components/arknights')).ArknightsComponents,
} satisfies Record<GameName, () => Promise<IGameComponent>>
