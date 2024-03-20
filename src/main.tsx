import { FocusStyleManager } from '@blueprintjs/core'
import ReactDOM from 'react-dom/client'
import { Home } from './components/Home'
import { runCpp } from './entry'
import { GameName, gameAdapterLoaders, gameComponentLoaders } from './games'
import './icons'
import { formatProfileName, getStoragePrefix } from './profiles'

FocusStyleManager.onlyShowFocusOnTabs()

async function runApp() {
  const pathName = location.pathname
  if (pathName[0] !== '/') throw new Error('location pathname not started with /')

  const parts = pathName.split('/')
  if (parts[0]) throw new Error('location parts 0 invalid')

  const game = parts[1] as GameName
  if (!game) {
    return runHome()
  }
  if (!Object.prototype.hasOwnProperty.call(gameAdapterLoaders, game)) throw new Error('invalid game name')

  const profile = parts[2] || ''
  const storagePrefix = getStoragePrefix(game, profile)

  if (parts.length > 3) throw new Error('invalid parts.length')

  if (profile && !localStorage.getItem(storagePrefix + 'userdata')) {
    if (!confirm('profile ' + formatProfileName(game, profile) + ' does not exist. do you want to create it?')) {
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
