import { Alignment, AnchorButton, Callout, Classes, H2, Icon, Navbar } from '@blueprintjs/core'
import { memo } from 'react'
import { LocaleButton } from '../locales'
import { gt } from '../pkg/gt'
import { formatProfileName } from '../profiles'
import { UserDataManagerContent, useUserDataDump } from './UserDataManager'

export const RetiredGame = memo(
  ({ game, instanceName, archive }: { game: string; instanceName: string; archive: string }) => {
    const { data, loading } = useUserDataDump(game, instanceName)
    // The archive is the same app at an older commit, so the same path opens the same profile there.
    const archiveHref = archive + location.pathname

    return (
      <>
        <Navbar fixedToTop={true}>
          <Navbar.Group align={Alignment.LEFT}>
            <Navbar.Heading style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>
                <img src="/favicon.png" alt="Closure++ logo" width="24" height="24" style={{ marginRight: 4 }} />
                <code>{`Closure++`}</code>
              </a>
            </Navbar.Heading>
          </Navbar.Group>
          <Navbar.Group align={Alignment.RIGHT}>
            <LocaleButton />
          </Navbar.Group>
        </Navbar>
        <div className="App">
          <div style={{ padding: 40, margin: '0 auto' }}>
            <div className={Classes.DIALOG} style={{ margin: 0 }}>
              <div className={Classes.DIALOG_HEADER}>
                <Icon icon="database" />
                <H2>{`Closure${formatProfileName(game, instanceName)}++ ${gt.gettext('用户数据管理')}`}</H2>
              </div>
              <UserDataManagerContent
                key={loading ? 'loading' : 'ready'}
                data={data}
                loading={loading}
                game={game}
                instanceName={instanceName}
                exportOnly={true}
              >
                <Callout
                  intent="warning"
                  title={gt.gettext('Closure++ 对 %s 的支持已彻底下线').replaceAll('%s', game.toUpperCase())}
                  style={{ marginBottom: '1em', maxWidth: '500px' }}
                >
                  <p>
                    {gt.gettext(
                      '本站已移除相关的全部功能，只保留导出和清空用户数据。如需继续使用，请先导出为文件，再前往存档站自行导入：两边的数据并不互通。',
                    )}
                  </p>
                  <AnchorButton intent="primary" icon="globe" href={archiveHref} text={gt.gettext('前往存档站')} />{' '}
                  <code className={Classes.TEXT_MUTED}>{archive.replace(/^https:\/\//, '')}</code>
                </Callout>
              </UserDataManagerContent>
            </div>
          </div>
        </div>
      </>
    )
  },
)
