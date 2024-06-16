import { Alignment, Navbar } from '@blueprintjs/core'
import { memo, useMemo } from 'react'
import { LocaleButton } from '../locales'
import { formatProfileName, getProfiles } from '../profiles'
import { HelpButton } from './AboutList'

export const Home = memo(() => {
  const profiles = useMemo(() => getProfiles(), [])
  const aa = profiles.filter((x) => !x[2])
  const bb = profiles.filter((x) => x[2])

  return (
    <>
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <img src="/favicon.png" alt="Closure++ logo" width="24" height="24" title="" style={{ marginRight: 4 }} />
            <code>{`Closure++`}</code>
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <HelpButton />
          <LocaleButton />
        </Navbar.Group>
      </Navbar>
      <div className="App">
        <div style={{ padding: 40 }}>
          {aa.length > 0 ? (
            <>
              <p>existing profiles:</p>
              <ul>
                {aa.map((profile) => (
                  <li key={profile[0] + '/' + profile[1]}>
                    <a href={`/${profile[0]}/${profile[1]}`}>
                      <code>{formatProfileName(profile[0], profile[1])}</code>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {bb.length > 0 ? (
            <>
              <p>create default profile:</p>
              <ul>
                {profiles
                  .filter((x) => x[2])
                  .map((profile) => (
                    <li key={profile[0] + '/' + profile[1]}>
                      <a href={`/${encodeURIComponent(profile[0])}/${encodeURIComponent(profile[1])}`}>
                        <code>+ {formatProfileName(profile[0], profile[1])}</code>
                      </a>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
})
