import { FocusStyleManager } from '@blueprintjs/core'
import ReactDOM from 'react-dom/client'
import { Home } from './components/Home'
import { showConfirm } from './components/MessageBox'
import { RetiredGame } from './components/RetiredGame'
import { runCpp } from './entry'
import { GameName, RetiredGameInfo, gameAdapterLoaders, gameComponentLoaders, retiredGames } from './games'
import './icons'
import { setupLocale } from './locales'
import { gt } from './pkg/gt'
import { formatProfileName, getStoragePrefix } from './profiles'

FocusStyleManager.onlyShowFocusOnTabs()

async function runApp() {
  await setupLocale()

  const pathName = location.pathname
  if (pathName[0] !== '/') throw new Error('location pathname not started with /')

  const parts = pathName.split('/')
  if (parts[0]) throw new Error('location parts 0 invalid')

  const game = parts[1] as GameName
  if (!game) {
    return runHome()
  }
  const profile = parts[2] || ''
  if (parts.length > 3) throw new Error('invalid parts.length')

  if (Object.prototype.hasOwnProperty.call(retiredGames, game)) {
    return runRetired(game, profile, retiredGames[game])
  }
  if (!Object.prototype.hasOwnProperty.call(gameAdapterLoaders, game)) throw new Error('invalid game name')

  const storagePrefix = getStoragePrefix(game, profile)

  if (profile && !localStorage.getItem(storagePrefix + 'userdata')) {
    const create = await showConfirm(
      gt
        .gettext('档案 %s 不存在，要新建吗？') /* I10N: %s: profile name */
        .replaceAll('%s', formatProfileName(game, profile)),
    )
    if (!create) {
      location.href = '/'
      return
    }
  }

  const [gameAdapter, gameComponent] = await Promise.all([gameAdapterLoaders[game](), gameComponentLoaders[game]()])
  document.title = 'Closure' + formatProfileName(game, profile) + '++'
  runCpp(storagePrefix, profile, gameAdapter, gameComponent)
}

function runHome() {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Home />)
}

function runRetired(game: string, profile: string, retired: RetiredGameInfo) {
  document.title = 'Closure' + formatProfileName(game, profile) + '++'
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <RetiredGame game={game} instanceName={profile} retired={retired} />,
  )
}

runApp().catch((e) => {
  const he = document.getElementById('root') as HTMLElement
  he.style.cssText = 'color: darkred; margin: 20px; white-space: pre-wrap; font-family: monospace'
  he.innerText = `## PANIC: ${e.message}\n\n${e.stack}`
  he.appendChild(document.createElement('br'))
  const a = document.createElement('a')
  he.appendChild(a)
  a.href = '/'
  a.text = '[go back to home]'
  console.error(e)
})
