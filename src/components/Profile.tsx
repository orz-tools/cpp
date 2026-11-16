import { MenuDivider, MenuItem } from '@blueprintjs/core'
import { memo, useMemo } from 'react'
import { useCpp } from '../Cpp'
import { formatProfileName, getProfiles } from '../profiles'

export const ProfileTitle = memo(({ codename, profile }: { codename: string; profile: string }) => {
  return (
    <code title={formatProfileName(codename, profile)}>
      [{codename.toUpperCase()}]["
      <span
        style={{
          maxWidth: '16ch',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'inline-block',
          verticalAlign: 'bottom',
        }}
      >
        {JSON.stringify(decodeURIComponent(profile)).slice(1, -1)}
      </span>
      "]
    </code>
  )
})

export const ProfileMenu = memo(() => {
  const cpp = useCpp()
  const codename = cpp.gameAdapter.getCodename()
  const instanceName = cpp.instanceName
  const profiles = useMemo(() => {
    const isOpen = (x: [string, string, ...unknown[]]) => x[0] === codename && x[1] === instanceName
    const all = getProfiles()
    // The open profile has no userdata key until its first save; list it anyway so the menu is never empty.
    const created: [string, string, ...unknown[]][] = all.filter((x) => !x[2] || isOpen(x))
    if (!created.some(isOpen)) created.push([codename, instanceName])
    return created
  }, [codename, instanceName])
  return (
    <>
      {profiles.map((profile) => (
        <MenuItem
          key={profile[0] + '/' + profile[1]}
          href={`/${profile[0]}/${profile[1]}`}
          text={<ProfileTitle codename={profile[0]} profile={profile[1]} />}
          active={profile[0] === codename && profile[1] === instanceName}
        />
      ))}
      <MenuDivider />
      <MenuItem text="Home" icon="home" href="/" />
    </>
  )
})
