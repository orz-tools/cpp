import { Alignment, AnchorButton, Button, H2, Icon, type IconName, Navbar, Tag } from '@blueprintjs/core'
import { type ReactNode, memo, useState } from 'react'
import { RetiredGameInfo } from '../games'
import { LocaleButton } from '../locales'
import { gt } from '../pkg/gt'
import { ThemeButton } from './ThemeMenu'
import { AppToaster } from './Toaster'
import {
  CopyDataButton,
  ExportDataButton,
  confirmClearUserData,
  removeStoredUserData,
  useUserDataDump,
} from './UserDataManager'

/** Sets names the reader should find on screen (a profile, the old build's buttons) as tags at %1, %2, … */
function withTags(template: string, tags: { text: string; icon?: IconName }[]) {
  const parts = template.split(/(%\d)/)
  const isTag = (part: string | undefined) => !!part && /^%\d$/.test(part)
  // A line must not start with the punctuation that follows a tag, so that punctuation moves into the tag's nowrap.
  const punctuation = /^[，。、；：）),.;:]+/
  return parts.map((part, i) => {
    if (!isTag(part)) return isTag(parts[i - 1]) ? part.replace(punctuation, '') : part
    const tag = tags[+part.slice(1) - 1]
    const trailing = punctuation.exec(parts[i + 1] ?? '')?.[0]
    return (
      <span key={i} style={{ whiteSpace: 'nowrap' }}>
        <Tag
          minimal
          icon={tag.icon && <Icon icon={tag.icon} size={12} />}
          style={trailing ? { marginRight: 0 } : undefined}
        >
          {tag.text}
        </Tag>
        {trailing}
      </span>
    )
  })
}

const Step = memo(
  ({
    n,
    state,
    title,
    children,
    action,
  }: {
    n: number
    state?: 'done' | 'skipped'
    title: string
    children: ReactNode
    action?: ReactNode
  }) => (
    <li className={state === 'skipped' ? 'is-skipped' : undefined}>
      <span className={state === 'done' ? 'cpp-retired-step-no is-done' : 'cpp-retired-step-no'}>
        {state === 'done' ? <Icon icon="tick" /> : n}
      </span>
      <div>
        <div className="cpp-retired-step-title">{title}</div>
        <div className="cpp-retired-step-desc">{children}</div>
      </div>
      {action}
    </li>
  ),
)

export const RetiredGame = memo(
  ({ game, instanceName, retired }: { game: string; instanceName: string; retired: RetiredGameInfo }) => {
    const { data, loading } = useUserDataDump(game, instanceName)
    const empty = !data && !loading
    const [exported, setExported] = useState(false)
    const [opened, setOpened] = useState(false)
    const { archive, source, farewell } = retired
    // The archive is the same app at an older commit, so the same path opens the same profile there.
    const archiveHref = archive + location.pathname
    const profile = { text: instanceName ? decodeURIComponent(instanceName) : gt.pgettext('profile name', '默认') }
    const name = game.toUpperCase()
    const clearData = async () => {
      if (!(await confirmClearUserData())) return
      await removeStoredUserData(game, instanceName)
      location.href = '/'
    }

    // I10N: %s: game codename
    const title = gt.gettext('Closure++ 已不再支持 %s')
    const intro = empty
      ? // I10N: %s: game codename
        gt.gettext(
          '%s 的功能已经全部移除，这里只能导出或清空您的数据。我们保留了移除前的最后一版（下面称作「旧版」），您可以在那里继续使用。这个档案里没有数据，直接打开旧版就好。',
        )
      : // I10N: %s: game codename
        gt.gettext(
          '%s 的功能已经全部移除，这里只能导出或清空您的数据。我们保留了移除前的最后一版（下面称作「旧版」），您可以在那里继续使用。旧版和这里的数据分开存放，按下面三步就能搬过去。',
        )
    const exportHint = empty
      ? // I10N: %1: profile name
        gt.gettext('档案 %1 里没有数据，不用导出。')
      : // I10N: %1: profile name
        gt.gettext('档案 %1 的数据可以存成文件留作备份，也可以直接复制，到旧版里粘贴。')
    const archiveHint = instanceName
      ? // I10N: %1: address of the old version; %2: profile name
        gt.gettext('地址是 %1，会在新标签页打开。旧版会询问是否新建档案 %2，请选确定。')
      : // I10N: %1: address of the old version
        gt.gettext('地址是 %1，会在新标签页打开。')
    const importHint = empty
      ? gt.gettext('这个档案没有数据，不需要导入。')
      : // I10N: %1, %2, %3: the old version's labels 导入/导出, 用户数据管理 and 从文本框中导入
        gt.gettext('点右上角的 %1，选 %2；把文本框清空，粘贴刚才复制的数据或导出文件的全部内容，再点 %3 并确认。')

    const copied = () => {
      setExported(true)
      void AppToaster.then((t) =>
        t.show({ icon: 'tick', intent: 'success', message: gt.gettext('已复制，到旧版里粘贴就好。') }),
      )
    }

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
            <ThemeButton />
            <LocaleButton />
          </Navbar.Group>
        </Navbar>
        <div className="App">
          <main className="cpp-retired">
            <div className="cpp-retired-body">
              <H2>{title.split('%s').map((part, i) => (i ? [<span key={i}>{name}</span>, part] : part))}</H2>
              <p className="cpp-retired-intro">{intro.replaceAll('%s', name)}</p>
              <div className="cpp-retired-panel">
                <ol className="cpp-retired-steps">
                  <Step
                    n={1}
                    state={empty ? 'skipped' : exported ? 'done' : undefined}
                    title={gt.gettext('在这里导出')}
                    action={
                      <div className="cpp-retired-step-actions">
                        <CopyDataButton variant="outlined" data={data} onCopied={copied} />
                        <ExportDataButton
                          intent="primary"
                          game={game}
                          instanceName={instanceName}
                          data={data}
                          onClick={() => setExported(true)}
                        />
                      </div>
                    }
                  >
                    {withTags(exportHint, [profile])}
                  </Step>
                  <Step
                    n={2}
                    state={opened ? 'done' : undefined}
                    title={gt.gettext('到旧版去')}
                    action={
                      <AnchorButton
                        variant="outlined"
                        icon="share"
                        href={archiveHref}
                        target="_blank"
                        rel="noopener"
                        text={gt.gettext('打开旧版')}
                        onClick={() => setOpened(true)}
                      />
                    }
                  >
                    <p>
                      {withTags(archiveHint.replaceAll('%1', archive.replace(/^https:\/\//, '')), [profile, profile])}
                    </p>
                    <p>
                      {gt.gettext('旧版能保留多久，我们也说不准。万一它打不开了，源码还在 GitHub 上，可以自行部署。')}{' '}
                      <a className="cpp-retired-link" href={source} target="_blank" rel="noopener">
                        {gt.gettext('查看源码')}
                        <Icon icon="share" size={12} />
                      </a>
                    </p>
                  </Step>
                  <Step n={3} state={empty ? 'skipped' : undefined} title={gt.gettext('在旧版里导入')}>
                    {withTags(importHint, [
                      { text: gt.gettext('导入/导出'), icon: 'th-derived' },
                      { text: gt.gettext('用户数据管理'), icon: 'database' },
                      { text: gt.gettext('从文本框中导入'), icon: 'log-in' },
                    ])}
                  </Step>
                </ol>
                <div className="cpp-retired-clear">
                  <span>{gt.gettext('不再需要这里的数据时，可以把它清空，旧版里的数据不受影响。')}</span>
                  <Button
                    variant="minimal"
                    size="small"
                    intent="danger"
                    icon="trash"
                    text={gt.gettext('清空')}
                    onClick={() => void clearData()}
                  />
                </div>
              </div>
            </div>
            {farewell ? (
              <footer className="cpp-retired-farewell">
                {/* Slanted word by word: one slanted block would push its first line right of the rest. */}
                {farewell
                  .toString()
                  .split(/(\s+)/)
                  .map((part, i) => (i % 2 ? part : <span key={i}>{part}</span>))}
              </footer>
            ) : null}
          </main>
        </div>
      </>
    )
  },
)
