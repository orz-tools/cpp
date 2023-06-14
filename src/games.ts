import { IGameComponent } from './components/types'
import { IGame, IGameAdapter } from './pkg/cpp-basic'

export const enum GameName {
  Arknights = 'arknights',
  Re1999 = 'reverse1999',
}

export const gameAdapterLoaders = {
  [GameName.Arknights]: async () => new (await import('./pkg/cpp-arknights')).ArknightsAdapter(),
  [GameName.Re1999]: async () => new (await import('./pkg/cpp-re1999')).Re1999Adapter(),
} satisfies Record<GameName, () => Promise<IGameAdapter<IGame>>>

export const gameComponentLoaders = {
  [GameName.Arknights]: async () => (await import('./components/arknights')).ArknightsComponents,
  [GameName.Re1999]: async () => (await import('./components/re1999')).Re1999Components,
} satisfies Record<GameName, () => Promise<IGameComponent>>
